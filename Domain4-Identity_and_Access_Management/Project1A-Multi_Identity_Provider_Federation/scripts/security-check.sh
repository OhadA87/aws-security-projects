#!/bin/bash

# Security Validation Script
# Checks for common security issues before deployment

set -e

echo "🔍 Security Validation Check"
echo "============================"
echo ""

# Initialize counters
ISSUES_FOUND=0
WARNINGS_FOUND=0

# Check 1: Look for hardcoded secrets in source files (excluding compiled JS)
echo "🔎 Checking for hardcoded secrets..."
HARDCODED_SECRETS=$(grep -r -i -E "(password|secret|key|token|credential)" --include="*.ts" config/ bin/ 2>/dev/null | grep -v "// " | grep -v "console.log" | grep -v "process.env" | grep -v "kms.Key" | grep -v "keyPolicy" | grep -v "KMSKeyId" | grep -v "encryptionKey" | grep -v "as keyof" | grep -v "key, value" || true)

if [ ! -z "$HARDCODED_SECRETS" ]; then
    echo "❌ CRITICAL: Potential hardcoded secrets found:"
    echo "$HARDCODED_SECRETS"
    ((ISSUES_FOUND++))
else
    echo "✅ No hardcoded secrets detected"
fi

# Check 2: Look for hardcoded Auth0 domains or client IDs
echo ""
echo "🔎 Checking for hardcoded Auth0 configuration..."
HARDCODED_AUTH0=$(grep -r -E "(auth0\.com|\.auth0\.com)" --include="*.ts" config/ bin/ 2>/dev/null | grep -v "process.env" | grep -v "throw new Error" | grep -v "// " | grep -v "Expected format" || true)

if [ ! -z "$HARDCODED_AUTH0" ]; then
    echo "❌ CRITICAL: Hardcoded Auth0 configuration found:"
    echo "$HARDCODED_AUTH0"
    ((ISSUES_FOUND++))
else
    echo "✅ No hardcoded Auth0 configuration found"
fi

# Check 3: Verify environment variables are set
echo ""
echo "🔎 Checking required environment variables..."
if [ -z "$AUTH0_DOMAIN" ]; then
    echo "❌ CRITICAL: AUTH0_DOMAIN environment variable not set"
    ((ISSUES_FOUND++))
else
    echo "✅ AUTH0_DOMAIN is set: $AUTH0_DOMAIN"
fi

if [ -z "$AUTH0_CLIENT_ID" ]; then
    echo "❌ CRITICAL: AUTH0_CLIENT_ID environment variable not set"
    ((ISSUES_FOUND++))
else
    echo "✅ AUTH0_CLIENT_ID is set: ${AUTH0_CLIENT_ID:0:8}..."
fi

# Check 4: Validate Auth0 domain format
if [ ! -z "$AUTH0_DOMAIN" ]; then
    if [[ $AUTH0_DOMAIN =~ ^[a-zA-Z0-9-]+\.(auth0\.com|us\.auth0\.com|eu\.auth0\.com|au\.auth0\.com)$ ]]; then
        echo "✅ Auth0 domain format is valid"
    else
        echo "❌ CRITICAL: Invalid Auth0 domain format: $AUTH0_DOMAIN"
        ((ISSUES_FOUND++))
    fi
fi

# Check 5: Verify .gitignore includes security patterns
echo ""
echo "🔎 Checking .gitignore security patterns..."
if grep -q ".env" ../../.gitignore; then
    echo "✅ .env files are ignored"
else
    echo "⚠️  WARNING: .env files should be added to .gitignore"
    ((WARNINGS_FOUND++))
fi

# Check 6: Look for TODO or FIXME security items
echo ""
echo "🔎 Checking for security TODOs..."
SECURITY_TODOS=$(grep -r -i -E "(TODO|FIXME|HACK).*security" --include="*.ts" config/ bin/ 2>/dev/null || true)
if [ ! -z "$SECURITY_TODOS" ]; then
    echo "⚠️  WARNING: Security-related TODOs found:"
    echo "$SECURITY_TODOS"
    ((WARNINGS_FOUND++))
else
    echo "✅ No security TODOs found"
fi

# Check 7: Verify AWS credentials are configured
echo ""
echo "🔎 Checking AWS credentials..."
if aws sts get-caller-identity >/dev/null 2>&1; then
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    echo "✅ AWS credentials configured for account: $AWS_ACCOUNT"
else
    echo "❌ CRITICAL: AWS credentials not configured or invalid"
    ((ISSUES_FOUND++))
fi

# Check 8: Look for demo/test data that shouldn't be in production
echo ""
echo "🔎 Checking for demo/test data..."
DEMO_DATA=$(grep -r -i -E "(example|test|demo|placeholder)" --include="*.ts" config/ bin/ 2>/dev/null | grep -v "// " | grep -v "console.log" | grep -v "Expected format" | grep -v "Example:" || true)
if [ ! -z "$DEMO_DATA" ]; then
    echo "⚠️  WARNING: Demo/test data found (review before production):"
    echo "$DEMO_DATA" | head -5
    ((WARNINGS_FOUND++))
else
    echo "✅ No demo/test data found"
fi

# Summary
echo ""
echo "🏁 Security Check Summary"
echo "========================"
echo "Critical Issues: $ISSUES_FOUND"
echo "Warnings: $WARNINGS_FOUND"
echo ""

if [ $ISSUES_FOUND -gt 0 ]; then
    echo "❌ SECURITY CHECK FAILED"
    echo "   Fix critical issues before deployment!"
    echo ""
    echo "🔧 Quick fixes:"
    echo "   1. Run: ./scripts/secure-setup.sh"
    echo "   2. Set environment variables"
    echo "   3. Remove any hardcoded secrets"
    exit 1
elif [ $WARNINGS_FOUND -gt 0 ]; then
    echo "⚠️  SECURITY CHECK PASSED WITH WARNINGS"
    echo "   Review warnings before production deployment"
    echo ""
    echo "   Proceed with: ./scripts/deploy-with-auth0.sh"
    exit 0
else
    echo "✅ SECURITY CHECK PASSED"
    echo "   Safe to deploy!"
    echo ""
    echo "   Deploy with: ./scripts/deploy-with-auth0.sh"
    exit 0
fi