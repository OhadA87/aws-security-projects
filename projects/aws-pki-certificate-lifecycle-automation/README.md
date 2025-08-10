

# AWS PKI Certificate Lifecycle Automation

## Overview
A full lifecycle Public Key Infrastructure (PKI) project that automates the issuance, validation, packaging, deployment, and rotation of SSL/TLS certificates across AWS and hybrid Windows environments.

This project demonstrates:
- **AWS ACM** for certificate management
- **ALB** for TLS termination and zero-downtime rotation
- **KMS & SSM** for secure storage of keys and secrets
- **Jenkins (OIDC)** for CI/CD-driven certificate workflows
- **OpenSSL** for PKI creation and validation
- **Prowler & AWS Config** for compliance enforcement
- **IIS** integration for hybrid workloads

## Key Features
- Root → Intermediate → Server cert creation with OpenSSL
- Automated chain validation (`openssl verify`, `testssl.sh`)
- Secure `.pfx` packaging for IIS, encrypted with KMS
- ALB listener rotation via ACM import
- Compliance gates with Prowler → Security Hub integration
- Expiry monitoring with AWS Config (`acm-certificate-expiration-check`)
- Rollback automation

## Structure
terraform/ # Infrastructure modules
jenkins/ # Jenkinsfile and shared pipeline code
scripts/ # OpenSSL issuance, packaging, deployment
validation/ # testssl.sh and OpenSSL chain tests
prowler/ # Prowler scan automation
iis/ # PowerShell scripts for IIS deployment
docs/ # Architecture, runbooks, screenshots
adr/ # Architecture Decision Records


## Demo Flow
1. Issue or renew certificate
2. Validate trust chain
3. Package for AWS/IIS targets
4. Deploy to ACM + rotate ALB listener
5. Post-deploy verification & compliance scan
6. Rollback if any gate fails

## Notes for Interview
- Keep all private keys out of Git
- Use screenshots & reports for evidence
- Be ready to explain ADRs and trade-offs
