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
func generateBadge(SHIELDS_URL string, text string, cnt string, colour string,
	leftColour string, style string, logo string, logoColour string) []byte {
	if badgeErrorCount > 5 && badgeErrorCount < 10 {
		SHIELDS_URL = DEFAULT_SHIELDS
		log.Err(fmt.Errorf("experienced %d errors when generating badges", badgeErrorCount)).Msg("reseting SHIELDS_URL")
	}
	data, err := createBadge(SHIELDS_URL, text, cnt, colour, leftColour, style, logo, logoColour)
	if err != nil {
		fb, err := getFallBackBadge(err, text, cnt, colour, leftColour, style, logo, logoColour)
		if err != nil {
			logError(err)
			badgeErrorCount++
			return getErrorBadge()
		}
		return fb
	}
	return data
}
func createBadge(SHIELDS_URL string, text string, cnt string, colour string,
	leftColour string, style string, logo string, logoColour string) ([]byte, error) {
	log.Debug().
		Str("shields_url", SHIELDS_URL).
		Str("text", text).
		Str("count", cnt).
		Str("colour", colour).
		Str("leftColour", leftColour).
		Str("style", style).
		Str("logo", logo).
		Str("logo_colour", logoColour).
		Msg("Generating badge")

	url := fmt.Sprintf("%s/badge/%s-%s-%s?labelColor=%s&style=%s&logo=%s&logoColor=%s",
		SHIELDS_URL, text, cnt, colour, leftColour, style, logo, logoColour)
	client := &http.Client{}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Add("Accept", "image/svg+xml")
	req.Header.Add("Content-Type", "image/svg+xml")

	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if res.StatusCode != 200 {
		return nil, fmt.Errorf("error generating badge: received status code %d from %s", res.StatusCode, SHIELDS_URL)
	}

	defer res.Body.Close()
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	return body, nil
}

func getFallBackBadge(err error, text string, cnt string, colour string,
	leftColour string, style string, logo string, logoColour string) ([]byte, error) {
	logError(err)
	badgeErrorCount++
	// FALLBACK if local shields fail
	return createBadge(DEFAULT_SHIELDS, text, cnt, colour, leftColour, style, logo, logoColour)
}

func getErrorBadge() []byte {
	log.Error().Msg("Generated ERROR badge")
	return []byte{} // TODO: generate SVG error badge
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
