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

  key="${line%% *}"
  value="${line#* }"

  echo "Sanity Checking Key: '$key' with Value: '$value'"

  COUNT=$(bunx wrangler kv key get --binding="$KV_BINDING_NAME" "$key" --remote)
  if [ $? -ne 0 ]; then
    echo "Error: Failed to get key '$key' from KV Namespace '$KV_BINDING_NAME'."
    # continue
    exit 1
  fi

  echo "--------------------------------------------------"

done < "$INPUT_FILE"

echo "--- Sanity check complete ---"