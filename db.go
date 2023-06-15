package main

import (
	"context"
	"strconv"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

var redisAddr = GetENV("REDIS_URL", "localhost:6379")
var rdb *redis.Client
var ctx = context.Background()

func ConnectRedis() {
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
	// TODO: health check

	log.Info().Msg("Pinging Redis")
	_, err = rdb.Ping(ctx).Result()
	if err != nil {
		log.Fatal().Err(err)
	}
}

func QueryHash(hash string) string {
	val, err := rdb.Incr(ctx, hash).Result()
	if err != nil {
		log.Debug().Err(err)
		return "error"
	}
	return strconv.FormatInt(val, 10)
}

func IncrHashBy(hash string, cnt int64) int64 {
	if cnt < 0 {
		return -1
	}
	val, err := rdb.IncrBy(ctx, hash, cnt).Result()
	if err != nil {
		log.Debug().Err(err)
		return -1
	}

	return val
}

func GetHash(hash string) string {
	val, err := rdb.Get(ctx, hash).Result()

	if err == redis.Nil { // key does not exist: initialize key
		return "0"
	} else if err != nil {
		logError(err)
		return "error"
	}
	return val
}
