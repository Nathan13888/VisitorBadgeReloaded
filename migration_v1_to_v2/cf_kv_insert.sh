if [ -z "$1" ]; then
  echo "Usage: $0 <filename>"
  echo "Example: $0 redis_dump.txt"
  exit 1
fi

INPUT_FILE="$1"
KV_BINDING_NAME="vbr_badge_counts"

# Check if the input file exists and is readable
if [ ! -f "$INPUT_FILE" ]; then
  echo "Error: File not found at '$INPUT_FILE'"
  exit 1
fi

echo "--- Starting processing for file: $INPUT_FILE ---"
echo "--- Targeting KV Namespace Binding: $KV_BINDING_NAME ---"
echo ""

# Read the file line by line
while IFS= read -r line || [ -n "$line" ]; do
  # Skip empty lines
  if [ -z "$line" ]; then
    continue
  fi

  # Check if the line contains a space. If not, it's a malformed line.
  if [[ "$line" != *" "* ]]; then
    echo "Skipping malformed line (no space found): \"$line\"" >&2
    echo "--------------------------------------------------" >&2
    continue
  fi

  # Extract the key (the first word) and the value (the rest of the line)
  # This method correctly handles values that contain spaces.
  key="${line%% *}"
  value="${line#* }"

  echo "Inserting Key:   '$key'"
  echo "Inserting Value: '$value'"

  # We wrap the key and value in quotes to handle special characters safely.
  bunx wrangler kv key put --binding="$KV_BINDING_NAME" "$key" "$value" --remote

  echo "--------------------------------------------------"

done < "$INPUT_FILE"

echo "--- Bulk insertion complete ---"