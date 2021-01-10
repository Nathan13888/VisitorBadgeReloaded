package main

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
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

var varCountAPInamespace = "visitor-badge"
var port = os.Getenv("PORT")
var key = os.Getenv("KEY")

// TODO: log levels

// Visitor Badge URL Format: /badge?page_id=<key>
func main() {
	fmt.Printf("Starting Visitor Badge Reloaded Server...\n\n")

	if port == "" {
		port = "8080"
	}
	if key == "" {
		key = "guess_what"
	}

	// TODO: DEFAULT_*{COLOUR,STYLE,TEXT,LOGO}

	fmt.Printf("Key is set to `%s`\n", key)

	http.HandleFunc("/", getWebsite)
	http.HandleFunc("/index.html", getWebsite)
	http.HandleFunc("/badge", getBadge)

	log.Fatal(http.ListenAndServe(":"+port, nil))
	// log.Fatal(http.ListenAndServeTLS(":8081", "localhost.crt", "localhost.key", nil))
}

func getHash(pageID string) string {
	// TODO: customizable key
	data := []byte(pageID + key)
	sum := md5.Sum(data)
	hex := hex.EncodeToString(sum[:])
	// fmt.Printf("%s\n", hex)
	return hex
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

// TODO: add struct to handle badge input
func generateBadge(text string, cnt string, colour string,
	style string, logo string, logoColour string) []byte {
	// TODO: validate SVG format
	// https://img.shields.io/badge/text-cnt-colour[?flags=here...]
	url := fmt.Sprintf("https://img.shields.io/badge/%s-%s-%s?style=%s&logo=%s&logoColor=%s",
		text, cnt, colour, style, logo, logoColour)
	fmt.Println(url)
	res, err := http.Get(url)
	if err != nil {
		log.Fatal(err)
	}
	defer res.Body.Close()
	body, e := ioutil.ReadAll(res.Body)
	if e != nil {
		log.Fatal(err)
	}
	// fmt.Println(string(body))
	return body
}

func getErrorBadge() {
	log.Println("Generated ERROR badge")
	// TODO: return error badge
}

func qryParam(param string, r *http.Request, defValue string) string {
	qry, found := r.URL.Query()[param]
	// TODO: better sanitation
	if !found || len(qry) == 0 {
		return defValue
	}
	return url.QueryEscape(qry[0])
}

func getWebsite(res http.ResponseWriter, req *http.Request) {
	fmt.Fprintf(res, "A website is currently unavailable :(")
}

type CountAPIResponse struct {
	Value int `json:"value"`
}

func updateCounter(hash string) string {
	url := "https://api.countapi.xyz/hit/visitor-badge/" + hash
	res, err := http.Get(url)
	// TODO: fix header content check
	// cont := res.Header.Get("Content-Type")
	// if cont != "application/json" {
	// 	log.Fatal("Did not receive expected JSON response. Received: " + cont)
	// }
	if err != nil {
		log.Fatal(err)
	}
	defer res.Body.Close()

	var obj CountAPIResponse
	decoder := json.NewDecoder(res.Body)
	decoder.DisallowUnknownFields()
	decoder.Decode(&obj)

	return strconv.Itoa(obj.Value)
}
