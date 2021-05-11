package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"

	"github.com/rs/zerolog/log"
)

// TODO: add struct to handle badge input
func generateBadge(text string, cnt string, colour string,
	style string, logo string, logoColour string) []byte {
	// TODO: validate SVG format
	// https://img.shields.io/badge/text-cnt-colour[?flags=here...]
	url := fmt.Sprintf("https://img.shields.io/badge/%s-%s-%s?style=%s&logo=%s&logoColor=%s",
		text, cnt, colour, style, logo, logoColour)
	res, err := http.Get(url)
	if err != nil {
		logError(err)
	}
	defer res.Body.Close()
	body, e := ioutil.ReadAll(res.Body)
	if e != nil {
		logError(err)
	}
	return body
}

func getErrorBadge() {
	log.Error().Msg("Generated ERROR badge")
	// TODO: return error badge
}

func updateCounter(useCache bool, hash string) string {
	if !useCache {
		return updateCountAPI(hash)
	}
	// look up cache
	return updateCachedCount(hash) // note that this will return the CountAPI count if hash does not exist
}

func updateCountAPI(hash string) string {
	url := "https://api.countapi.xyz/hit/visitor-badge/" + hash
	res, err := http.Get(url)
	// TODO: fix header content check
	// cont := res.Header.Get("Content-Type")
	// if cont != "application/json" {
	// 	log.Fatal("Did not receive expected JSON response. Received: " + cont)
	// }
	if err != nil {
		logError(err)
	}
	defer res.Body.Close()

	var obj CountAPIResponse
	decoder := json.NewDecoder(res.Body)
	decoder.DisallowUnknownFields()
	decoder.Decode(&obj)

	return strconv.Itoa(obj.Value)
}
