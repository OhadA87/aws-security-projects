
#!/usr/bin/env bash
set -euo pipefail

SERVER_CRT="${1:-../artifacts/server.crt}"
INTERMEDIATE_CRT="${2:-../artifacts/intermediate.crt}"
ROOT_CRT="${3:-../artifacts/root.crt}"

TMP="$(mktemp)"
cat "$INTERMEDIATE_CRT" "$ROOT_CRT" > "$TMP"

openssl verify -CAfile "$TMP" "$SERVER_CRT"
echo "[+] OpenSSL chain verify passed"

rm -f "$TMP"
