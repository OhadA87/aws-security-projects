
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p artifacts

# Root CA (offline in real life)
[ -f artifacts/root.key ] || openssl genrsa -out artifacts/root.key 4096
[ -f artifacts/root.crt ] || openssl req -x509 -new -nodes -key artifacts/root.key -sha256 -days 3650 -out artifacts/root.crt -subj "/CN=DemoRootCA"

# Intermediate
[ -f artifacts/intermediate.key ] || openssl genrsa -out artifacts/intermediate.key 4096
[ -f artifacts/intermediate.csr ] || openssl req -new -key artifacts/intermediate.key -out artifacts/intermediate.csr -subj "/CN=DemoIntermediateCA"
[ -f artifacts/intermediate.crt ] || openssl x509 -req -in artifacts/intermediate.csr -CA artifacts/root.crt -CAkey artifacts/root.key -CAcreateserial -out artifacts/intermediate.crt -days 1825 -sha256

# Server
openssl genrsa -out artifacts/server.key 2048
# TODO: change CN to your test DNS later
openssl req -new -key artifacts/server.key -out artifacts/server.csr -subj "/CN=CHANGE_ME_DNS"
openssl x509 -req -in artifacts/server.csr -CA artifacts/intermediate.crt -CAkey artifacts/intermediate.key -CAcreateserial -out artifacts/server.crt -days 397 -sha256

cat artifacts/server.crt artifacts/intermediate.crt > artifacts/fullchain.pem
echo "[+] Issued server cert and fullchain.pem"

