
#!/usr/bin/env bash
set -euo pipefail

# requires prowler installed on agent (pipx/pip/docker)
prowler -M csv,json,html -q -S
echo "[+] Prowler scan done (integrate to Security Hub in Phase 2)."
