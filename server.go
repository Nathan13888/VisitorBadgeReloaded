package main

import (
	"fmt"
	"log"
	"net/http"
	"time"
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
	fmt.Printf("Starting Visitor Badge Reloaded Server...\n\n")

	// TODO: DEFAULT_*{COLOUR,STYLE,TEXT,LOGO}

	fmt.Printf("Key is set to `%s`\n", key)

	http.HandleFunc("/", getWebsite)
	http.HandleFunc("/index.html", getWebsite)
	http.HandleFunc("/ping", getPing)
	http.HandleFunc("/badge", getBadge)

	log.Fatal(http.ListenAndServe(":"+port, nil))
	// log.Fatal(http.ListenAndServeTLS(":8081", "localhost.crt", "localhost.key", nil))
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
	cnt := updateCounter(hash)

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
