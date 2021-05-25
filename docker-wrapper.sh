#!/bin/bash

set -m

# Start VBR
./vbr &
status=$?
if [ $status -ne 0 ]; then
  echo "Failed to start VBR: $status"
  exit $status
fi

# Start Shields.io server
cd /app/shields
node server 9090
status=$?
if [ $status -ne 0 ]; then
  echo "Failed to start Shields.io server: $status"
  exit $status
fi

fg %1

