package main

import (
	"time"

	"github.com/allegro/bigcache"
	"github.com/rs/zerolog/log"
)

var cacheConfig = bigcache.Config{
	Shards:      1024,               // power of two
	LifeWindow:  7 * 24 * time.Hour, // expiry time
	CleanWindow: 5 * time.Minute,
	// rps * lifeWindow, used only in initial memory allocation
	MaxEntriesInWindow: 1000 * 10 * 60,
	// max entry size in bytes, used only in initial memory allocation
	MaxEntrySize: 1000,
	// prints information about additional memory allocation
	Verbose: false,
	// cache will not allocate more memory than this limit, value in MB
	// if value is reached then the oldest entries can be overridden for the new ones
	// 0 value means no size limit
	HardMaxCacheSize: 4096,
	// callback fired when the oldest entry is removed because of its expiration time or no space left
	// for the new entry, or because delete was called. A bitmask representing the reason will be returned.
	// Default value is nil which means no callback and it prevents from unwrapping the oldest entry.
	OnRemove: logEntryOverwriten,
	// OnRemoveWithReason is a callback fired when the oldest entry is removed because of its expiration time or no space left
	// for the new entry, or because delete was called. A constant representing the reason will be passed through.
	// Default value is nil which means no callback and it prevents from unwrapping the oldest entry.
	// Ignored if OnRemove is specified.
	OnRemoveWithReason: nil,
}

var cache *bigcache.BigCache

func initCache() {
	c, err := bigcache.NewBigCache(cacheConfig)
	if err != nil {
		logError(err)
	}
	cache = c
}

func updateCachedCount(hash string) string {
	entry, err := cache.Get(hash)
	// return CountAPI value if entry does not exist in cache
	if err != nil {
		capi := updateRedis(hash)
		if err == bigcache.ErrEntryNotFound {
			// update cached value
			log.Info().Str("page", hash).Msg("Cached")
			cache.Set(hash, []byte(capi))
		} else {
			logError(err)
		}
		return capi
	}
	if len(entry) == 0 {
		return "-1"
	}
	newCount := tallyByteSlice(entry)
	setCachedCount(hash, newCount)

	// update CountAPI count in a separate go routine
	go func() {
		res := updateRedis(hash)
		// "sync" with CountAPI every so often
		if res[len(res)-1] == '0' {
			setCachedCount(hash, []byte(res))
		}
	}()

	return string(newCount)
}

func setCachedCount(hash string, count []byte) error {
	err := cache.Set(hash, count)
	if err != nil {
		logError(err)
	}

	return err
}

func tallyByteSlice(slice []byte) []byte {
	n := len(slice)
	// increment last
	last := n - 1
	slice[last]++
	if slice[last] > '9' {
		return append(tallyByteSlice(slice[:last]), '0')
	}

	return slice
}
