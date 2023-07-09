package main

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/rs/zerolog/pkgerrors"
)

func logEntryOverwriten(key string, entry []byte) {
	logErrorMsg(errors.New("entry overwritten in cache"),
		fmt.Sprintf("key: %s entry: %s", key, string(entry)))
}

var timeFormat = time.RFC3339

func configureLogger(debug bool) {
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
	if debug {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	}
	zerolog.TimeFieldFormat = timeFormat
	zerolog.ErrorStackMarshaler = pkgerrors.MarshalStack

	consoleWriter := zerolog.ConsoleWriter{Out: os.Stdout}
	multi := zerolog.MultiLevelWriter(consoleWriter) // TODO: add extra logging outputs
	log.Logger = zerolog.New(multi).With().Timestamp().Logger()
}

func logError(err error) {
	badgeErrorCount++
	logErrorMsg(err, "")
}

func logErrorMsg(err error, msg string) {
	log.Debug().Stack().Err(err).Msg(msg)
}

func loggingMiddleware(next http.Handler) http.Handler {
	processedBadges++
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		defer func() {
			log.Info().
				Str("method", r.Method).
				Dur("resp_time", time.Since(start)).
				Str("path", r.URL.Path).
				Str("remote_address", r.RemoteAddr).
				Str("user_agent", r.UserAgent()).
				Msg("Access")
		}()
		next.ServeHTTP(w, r)
	})
}

// TODO: implement redis logger
// func loggingRedis(ctx context.Context, format string, v ...interface{}) {

// }

func getTime() string {
	return time.Now().Format(timeFormat)
}
