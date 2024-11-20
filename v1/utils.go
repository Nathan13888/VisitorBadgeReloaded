package main

import (
	"crypto/md5"
	"encoding/hex"
	"net/http"
	"net/url"
	"os"
)

func getHash(pageID string) string {
	// TODO: customizable key
	data := []byte(pageID + key)
	sum := md5.Sum(data)
	hex := hex.EncodeToString(sum[:])
	// fmt.Printf("%s\n", hex)
	return hex
}

func qryParam(param string, r *http.Request, defValue string) string {
	qry, found := r.URL.Query()[param]
	// TODO: better sanitation
	if !found || len(qry) == 0 {
		return defValue
	}
	return url.QueryEscape(qry[0])
}

func GetENV(key string, defValue string) string {
	env := os.Getenv(key)
	if env == "" {
		return defValue
	}
	return env
}
