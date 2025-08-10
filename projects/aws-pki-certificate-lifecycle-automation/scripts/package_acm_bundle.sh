
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

cp artifacts/server.crt        artifacts/acm_body.pem
cp artifacts/server.key        artifacts/acm_key.pem
cp artifacts/intermediate.crt  artifacts/acm_chain.pem

echo "[+] Prepared artifacts/acm_body.pem, acm_key.pem, acm_chain.pem"
