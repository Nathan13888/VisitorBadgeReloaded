package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"

	"github.com/rs/zerolog/log"
)

type BadgeOptions struct {
	Label       string
	Text        string
	Colour      string // I'm Canadian...
	LabelColour string
	Style       string
	Logo        string
	LogoColour  string
	Hit         bool
	// TODO: FallbackShields option (to use public shields instead)
}

func generateBadge(SHIELDS_URL string, options BadgeOptions) []byte {
	// TODO: verify this mechanism
	// TODO: auto undo fallback mechanism if triggered
	if badgeErrorCount > 5 && badgeErrorCount < 10 {
		SHIELDS_URL = DEFAULT_SHIELDS
		log.Err(fmt.Errorf("experienced %d errors when generating badges", badgeErrorCount)).Msg("reseting SHIELDS_URL")
	}
	data, err := createBadge(SHIELDS_URL, options)
	if err != nil {
		fb, err := getFallBackBadge(err, options)
		if err != nil {
			logError(err)
			badgeErrorCount++
			return getErrorBadge()
		}
		return fb
	}
	return data
}

func createBadge(SHIELDS_URL string, o BadgeOptions) ([]byte, error) {
	log.Debug().
		Str("shields_url", SHIELDS_URL).
		Str("text", o.Label).
		Str("count", o.Text).
		Str("colour", o.Colour).
		Str("labelColour", o.LabelColour).
		Str("style", o.Style).
		Str("logo", o.Logo).
		Str("logo_colour", o.LogoColour).
		Bool("hit", o.Hit).
		Msg("Generating badge")

	url := fmt.Sprintf("%s/badge/%s-%s-%s?labelColor=%s&style=%s&logo=%s&logoColor=%s",
		SHIELDS_URL,
		o.Label,
		o.Text,
		o.Colour,
		o.LabelColour,
		o.Style,
		o.Logo,
		o.LogoColour,
	)
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

func getFallBackBadge(err error, options BadgeOptions) ([]byte, error) {
	logError(err)
	badgeErrorCount++
	// FALLBACK if local shields fail
	return createBadge(DEFAULT_SHIELDS, options)
}

func getErrorBadge() []byte {
	log.Debug().Msg("Generated ERROR badge")
	return []byte{} // TODO: generate SVG error badge
}

func updateCounter(useCache bool, hash string) string {
	if !useCache {
		// return updateCountAPI(hash)
		return updateRedis(hash)
	}
	// look up cache
	return updateCachedCount(hash) // note that this will return the CountAPI count if hash does not exist
}

func updateRedis(hash string) string {
	return QueryHash(hash)
}

// DEPRECATED:
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
