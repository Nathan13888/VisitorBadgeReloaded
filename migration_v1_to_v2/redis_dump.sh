#!/bin/sh

# The file where the plain text dump will be saved.
OUTPUT_FILE="redis_dump.txt"

# Optional: Add your connection details here if Redis is not running locally on the default port.
# Example: REDIS_OPTIONS="-h my-redis-host -p 6379 -a your-password"
REDIS_OPTIONS=""

# Ensure the output file is empty before starting.
> "$OUTPUT_FILE"

echo "Starting Redis plain text dump..."

# Use redis-cli --scan to safely iterate over all keys in the database.
# The --raw option ensures key names are printed without extra quotes.
redis-cli --raw ${REDIS_OPTIONS} --scan | while read -r key; do
  # Get the type of the current key.
  type=$(redis-cli ${REDIS_OPTIONS} TYPE "$key")

  # Use a case statement to handle each data type differently.
  case "$type" in
    "string")
      value=$(redis-cli ${REDIS_OPTIONS} GET "$key")
      echo "$key $value" >> "$OUTPUT_FILE"
      ;;

    "hash")
      echo "$key (hash):" >> "$OUTPUT_FILE"
      # HGETALL returns key-value pairs, which we indent for readability.
      redis-cli ${REDIS_OPTIONS} HGETALL "$key" | sed 's/^/  /' >> "$OUTPUT_FILE"
      ;;

    "list")
      echo "$key (list):" >> "$OUTPUT_FILE"
      # LRANGE gets all elements from the list.
      redis-cli ${REDIS_OPTIONS} LRANGE "$key" 0 -1 | sed 's/^/  /' >> "$OUTPUT_FILE"
      ;;

    "set")
      echo "$key (set):" >> "$OUTPUT_FILE"
      # SMEMBERS gets all members of the set.
      redis-cli ${REDIS_OPTIONS} SMEMBERS "$key" | sed 's/^/  /' >> "$OUTPUT_FILE"
      ;;

    "zset")
      echo "$key (sorted set):" >> "$OUTPUT_FILE"
      # ZRANGE with WITHSCORES gets all members and their scores.
      redis-cli ${REDIS_OPTIONS} ZRANGE "$key" 0 -1 WITHSCORES | sed 's/^/  /' >> "$OUTPUT_FILE"
      ;;
      
    "stream")
      echo "$key (stream):" >> "$OUTPUT_FILE"
      # XRANGE gets all entries from a stream. This can be very large.
      redis-cli ${REDIS_OPTIONS} XRANGE "$key" - + | sed 's/^/  /' >> "$OUTPUT_FILE"
      ;;
      
    *)
      echo "$key (unknown type: $type)" >> "$OUTPUT_FILE"
      ;;
  esac
done

echo "Dump complete. Plain text key-value pairs saved to $OUTPUT_FILE"