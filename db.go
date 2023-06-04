package main

import (
	"context"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

var redisAddr = GetENV("REDIS_ADDR", "localhost:6379")
var rdb *redis.Client
var ctx = context.Background()

func ConnectRedis(address string) {
	log.Info().Msg("Initializing Redis connection")

	// rdb = redis.NewClient(&redis.Options{
	// 	Addr:     redis_addr,
	// 	Password: "",
	// 	DB:       0,
	// })
	opt, err := redis.ParseURL(redisAddr)
	if err != nil {
		panic(err)
	}
	rdb = redis.NewClient(opt)
	// TODO: use TLS and CRT/KEY; or SSH

	// TODO: redis logger
	// logger := &internal.Logging{
	// 	Printf: loggingRedis,
	// }
	// redis.SetLogger(logger)

	// TODO: config Context ctx

	_, err = rdb.Ping(ctx).Result()
	if err != nil {
		log.Fatal().Err(err)
	}
}

// TODO: health check

func QueryHash(hash string) string {
	intCmd := rdb.Incr(ctx, hash)
	if intCmd.Err() != nil {
		log.Error().Err(intCmd.Err())
		return "error"
	}
	return intCmd.String()
}

func GetHash(hash string) string {
	val, err := rdb.Get(ctx, hash).Result()

	if err == redis.Nil { // key does not exist: initialize key
		// TODO:
	} else if err != nil {
		log.Error().Err(err)
		return ""
	}
	return val
}
