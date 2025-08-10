
#!/usr/bin/env bash
set -euo pipefail

ENDPOINT="${1:-}"
if [[ -z "$ENDPOINT" ]]; then echo "Usage: endpoint_testssl.sh https://host"; exit 1; fi

if ! command -v testssl.sh >/dev/null 2>&1; then
  echo "testssl.sh not found on agent. Install it or vendor it."; exit 1
fi

testssl.sh --fast --sneaky "$ENDPOINT"
