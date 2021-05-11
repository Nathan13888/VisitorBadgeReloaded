package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

// defaults
const (
	colour     = "blue"
	style      = "flat"
	text       = "Visitors"
	logo       = "" // https://simpleicons.org/
	logoColour = "white"
)

var port = getEnv("PORT", "8080")
var key = getEnv("KEY", "guess_what")

var startTime time.Time
var processedBadges int64 = 0

// Visitor Badge URL Format: /badge?page_id=<key>
func main() {
	debug := false
	if len(getEnv("DEBUG", "")) > 0 {
		debug = true
	}

	// configure logging
	configureLogger(debug)

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

	log.Info().Msg("Configuring cache")
	initCache()
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
	processedBadges++
	page := qryParam("page_id", r, "")

	if page == "" {
		return
	}

	// TODO: time query speed
	log.Info().Str("page", page).Msg("Look up")

	hash := getHash(page)

	colour := qryParam("color", r, colour)
	style := qryParam("style", r, style)
	text := qryParam("text", r, text)
	logo := qryParam("logo", r, logo)
	logoColour := qryParam("logoColor", r, logoColour)
	useCache := false
	if len(qryParam("cache", r, "")) > 0 {
		useCache = true
	}

	cnt := updateCounter(useCache, hash)

	badge := generateBadge(text, cnt, colour, style, logo, logoColour)

	date := time.Now().Add(time.Minute * -10).Format(http.TimeFormat)
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "no-cache,max-age=0")
	w.Header().Set("Date", date)
	w.Header().Set("Expires", date)

	w.Write(badge)

	log.Info().Str("page", page).Str("views", cnt).Msg("Generated badge")
}

func getWebsite(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "A website is currently unavailable :(")
}

func getPing(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "PONG!!!")
}

func getStatus(w http.ResponseWriter, r *http.Request) {
	res := StatusResponse{
		CachedHashes:      cache.Len(),
		ProcessedRequests: processedBadges,
		Uptime:            int64(time.Since(startTime).Seconds()),
		CodeRepository:    "https://github.com/Nathan13888/VisitorBadgeReloaded",
	}
	json.NewEncoder(w).Encode(res)
}
