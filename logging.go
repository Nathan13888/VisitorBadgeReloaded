package main

import "log"

func logEntryOverwriten(key string, entry []byte) {
	log.Println("")
}

func logError(err error) {
	log.Println(err)
}
