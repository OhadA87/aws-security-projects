
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

: "${ALB_LISTENER_ARN:=${ALB_LISTENER_ARN:-}}"
: "${TARGET_GROUP_ARN:=${TARGET_GROUP_ARN:-REPLACE_TG_IF_REQUIRED}}"

if [[ -z "$ALB_LISTENER_ARN" ]]; then
  echo "ALB_LISTENER_ARN is required (inject via Jenkins credential)"; exit 1
fi

CERT_ARN=$(aws acm import-certificate \
  --certificate fileb://artifacts/acm_body.pem \
  --private-key fileb://artifacts/acm_key.pem \
  --certificate-chain fileb://artifacts/acm_chain.pem \
  --query CertificateArn --output text)

echo "[+] Imported ACM certificate: $CERT_ARN"

aws elbv2 modify-listener \
  --listener-arn "$ALB_LISTENER_ARN" \
  --certificates CertificateArn="$CERT_ARN" >/dev/null

echo "[+] Rotated ALB listener to new cert"
