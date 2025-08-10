
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

: "${PFX_PASSWORD:=ChangeMe-Use-Jenkins-Secret}"

openssl pkcs12 -export \
  -inkey artifacts/server.key \
  -in artifacts/server.crt \
  -certfile artifacts/intermediate.crt \
  -out artifacts/server.pfx \
  -passout pass:"$PFX_PASSWORD"

echo "[+] Built artifacts/server.pfx"

