package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/gorilla/mux"
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

// TODO: log levels

// Visitor Badge URL Format: /badge?page_id=<key>
func main() {
	r := mux.NewRouter()
	server := &http.Server{
		Handler:      r,
		Addr:         "0.0.0.0:" + port,
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	fmt.Printf("Starting Visitor Badge Reloaded Server...\n\n")

	// TODO: DEFAULT_*{COLOUR,STYLE,TEXT,LOGO}

	fmt.Printf("Key is set to `%s`\n", key)

	r.HandleFunc("/", getWebsite).Methods("GET")
	r.HandleFunc("/index.html", getWebsite).Methods("GET")
	r.HandleFunc("/ping", getPing).Methods("GET")
	r.HandleFunc("/badge", getBadge).Methods("GET")

	initCache()

	// Run our server in a goroutine so that it doesn't block.
	go func() {
		if err := server.ListenAndServe(); err != nil {
			log.Println(err)
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
	log.Println("shutting down...")
	os.Exit(0)
}

func getBadge(w http.ResponseWriter, r *http.Request) {
	page := qryParam("page_id", r, "")

	if page == "" {
		return
	}

	// TODO: time query speed
	log.Printf("Looking up `%s`", page)

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

	log.Printf("Generated badge for `%s` with %s views", page, cnt)
}

func getWebsite(res http.ResponseWriter, req *http.Request) {
	fmt.Fprintf(res, "A website is currently unavailable :(")
}

func getPing(res http.ResponseWriter, req *http.Request) {
	fmt.Fprintf(res, "PONG!!!")
}
