package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

// defaults
const (
	colour          = "blue"
	leftColour      = "grey"
	style           = "flat"
	text            = "Visitors"
	logo            = "" // https://simpleicons.org/
	logoColour      = "white"
	DEFAULT_SHIELDS = "https://img.shields.io"
)

var SHIELDS_URL = GetENV("SHIELDS_URL", DEFAULT_SHIELDS)
var badgeErrorCount = 0 // TODO: verify there isn't a race condition on this

var port = GetENV("PORT", "8080")
var key = GetENV("KEY", "guess_what")

var startTime time.Time
var processedBadges int64 = 0

// Visitor Badge URL Format: /badge?page_id=<key>
func main() {
	debug := false
	if strings.EqualFold(GetENV("DEBUG", ""), "enabled") {
		debug = true
		log.Debug().Msg("Enabled Debug Mode.")
	}
	maintenance := false
	if strings.EqualFold(GetENV("MAINTENANCE", ""), "enabled") {
		maintenance = true
		log.Info().Msg("Enabled Maintenance Mode.")
	}

	// configure logging
	configureLogger(debug)
	ConnectRedis()

	r := mux.NewRouter()
	server := &http.Server{
		Handler:      r,
		Addr:         "0.0.0.0:" + port,
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Info().Msg("Starting Visitor Badge Reloaded server")

	// TODO: DEFAULT_*{COLOUR,STYLE,TEXT,LOGO}

	log.Info().Msgf("Key is set to `%s`", key)

	r.HandleFunc("/", getWebsite).Methods("GET")
	r.HandleFunc("/index.html", getWebsite).Methods("GET")
	r.HandleFunc("/ping", getPing).Methods("GET")
	r.HandleFunc("/status", getStatus).Methods("GET")
	r.HandleFunc("/badge", getBadge).Methods("GET")
	// TODO: add auth middleware
	r.HandleFunc("/health", getHealth).Methods("GET")
	r.HandleFunc("/healthz", getHealth).Methods("GET")

	if maintenance {
		r.HandleFunc("/rec", getRec).Methods("GET")
	}

	r.Use(loggingMiddleware)

	log.Info().Msg("Configuring cache")
	startTime = time.Now()

	// Run our server in a goroutine so that it doesn't block.
	go func() {
		if err := server.ListenAndServe(); err != nil {
			logError(err)
		}
	}()

	c := make(chan os.Signal, 1)
	// We'll accept graceful shutdowns when quit via SIGINT (Ctrl+C)
	// SIGKILL, SIGQUIT or SIGTERM (Ctrl+/) will not be caught.
	signal.Notify(c, os.Interrupt)

	// Block until we receive our signal.
	<-c

	wait := 15 * time.Second

	// Create a deadline to wait for.
	ctx, cancel := context.WithTimeout(context.Background(), wait)
	defer cancel()
	// Doesn't block if no connections, but will otherwise wait
	// until the timeout deadline.
	server.Shutdown(ctx)
	// Optionally, you could run srv.Shutdown in a goroutine and block on
	// <-ctx.Done() if your application should wait for other services
	// to finalize based on context cancellation.
	log.Info().Msg("shutting down...")
	os.Exit(0)
}

func getBadge(w http.ResponseWriter, r *http.Request) {
	page := qryParam("page_id", r, "")

	if page == "" {
		return
	}

	// TODO: time query speed
	log.Info().Str("page", page).Msg("Look up")

	hash := getHash(page)

	colour := qryParam("color", r, colour)
	labelColour := qryParam("lcolor", r, leftColour)
	style := qryParam("style", r, style)
	label := qryParam("text", r, text)
	logo := qryParam("logo", r, logo)
	logoColour := qryParam("logoColor", r, logoColour)
	hit := true
	hit_qry := qryParam("hit", r, "")
	if len(hit_qry) > 0 && (hit_qry != "true" && hit_qry != "yes") {
		hit = false
	}
	// TODO: DEPRECATED
	useCache := false
	if len(qryParam("cache", r, "")) > 0 {
		useCache = true
	}

	var cnt string
	if hit {
		cnt = updateCounter(useCache, hash)
	} else {
		cnt = GetHash(hash)
	}

	custom := qryParam("custom", r, "")
	if len(custom) > 0 {
		escaped, _ := url.QueryUnescape(custom)
		cnt = strings.Replace(
			escaped,
			"CNT", cnt, 1)
		log.Info().Msg(cnt)
	}

	badge := generateBadge(SHIELDS_URL,
		BadgeOptions{
			Label:       label,
			Text:        cnt,
			Colour:      colour,
			LabelColour: labelColour,
			Style:       style,
			Logo:        logo,
			LogoColour:  logoColour,
			Hit:         hit,
		})

	date := time.Now().Add(time.Minute * -10).Format(http.TimeFormat)
	expiry := date
	if len(qryParam("unique", r, "")) > 0 {
		expiry = time.Now().Add(time.Minute * 10).Format(http.TimeFormat)
	} else {
		w.Header().Set("Cache-Control", "no-cache,max-age=0")
	}

	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Date", date)
	w.Header().Set("Expires", expiry)

	w.Write(badge)

	log.Info().Str("page", page).Str("views", cnt).Msg("Generated badge")
}

func getHealth(w http.ResponseWriter, r *http.Request) {
	// TODO: do health checks with redis and shields.io
	return
}

func getRec(w http.ResponseWriter, r *http.Request) {
	page := qryParam("page_id", r, "")
	if page == "" {
		return
	}

	cnt, err := strconv.ParseInt(qryParam("count", r, colour), 10, 64)
	if err != nil {
		return
	}

	hash := getHash(page)

	res := IncrHashBy(hash, cnt)

	log.Info().Str("page", page).Int64("old_count", cnt).Int64("views", res).Msg("Recovered badge")
}

func getWebsite(w http.ResponseWriter, r *http.Request) {
	// fmt.Fprintf(w, "A website is currently unavailable :(")
	http.Redirect(w, r, "https://github.com/Nathan13888/VisitorBadgeReloaded", http.StatusTemporaryRedirect)
}

func getPing(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "PONG!!! Refer to /status for more in-depth information.")
}

func getStatus(w http.ResponseWriter, r *http.Request) {
	// TODO: include redis
	res := StatusResponse{
		ProcessedRequests: processedBadges,
		Uptime:            int64(time.Since(startTime).Seconds()),
		CodeRepository:    "https://github.com/Nathan13888/VisitorBadgeReloaded",
		RedisStatus:       "TBI",
		// TODO: more redis fields
	}

	json.NewEncoder(w).Encode(res)
}
