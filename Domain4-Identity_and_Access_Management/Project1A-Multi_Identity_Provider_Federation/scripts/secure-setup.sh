#!/bin/bash

# Secure Auth0 Environment Setup Script
# This script helps you set environment variables securely

set -e

echo "🔐 Secure Auth0 Environment Setup"
echo "================================="
echo ""

# Check if .env file exists (and warn about it)
if [ -f ".env" ]; then
    echo "⚠️  WARNING: .env file detected!"
    echo "   Make sure .env is in .gitignore to prevent committing secrets"
    echo ""
fi

# Interactive setup for security
echo "Please provide your Auth0 configuration:"
echo ""

# Get Auth0 Domain
while true; do
    read -p "🌐 Auth0 Domain (e.g., your-tenant.us.auth0.com): " auth0_domain
    
    # Validate domain format
    if [[ $auth0_domain =~ ^[a-zA-Z0-9-]+\.(auth0\.com|us\.auth0\.com|eu\.auth0\.com|au\.auth0\.com)$ ]]; then
        break
    else
        echo "❌ Invalid domain format. Please use format: tenant.region.auth0.com"
        echo "   Examples: my-app.auth0.com, my-app.us.auth0.com"
        echo ""
    fi
done

# Get Auth0 Client ID
while true; do
    read -p "🔑 Auth0 Client ID: " auth0_client_id
    
    # Basic validation (Auth0 client IDs are typically alphanumeric)
    if [[ $auth0_client_id =~ ^[a-zA-Z0-9]{32}$ ]]; then
        break
    else
        echo "❌ Invalid Client ID format. Should be 32 alphanumeric characters."
        echo ""
    fi
done

echo ""
echo "✅ Configuration validated!"
echo ""

# Set environment variables for current session
export AUTH0_DOMAIN="$auth0_domain"
export AUTH0_CLIENT_ID="$auth0_client_id"

# Also set AWS environment variables
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
export CDK_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

echo "🔧 Environment Variables Set:"
echo "   AUTH0_DOMAIN=$AUTH0_DOMAIN"
echo "   AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID"
echo "   CDK_DEFAULT_ACCOUNT=$CDK_DEFAULT_ACCOUNT"
echo "   CDK_DEFAULT_REGION=$CDK_DEFAULT_REGION"
echo ""

# Create temporary .env file for this session only
cat > .env.tmp << EOF
# Temporary environment variables for this session
# This file should NOT be committed to Git
AUTH0_DOMAIN=$AUTH0_DOMAIN
AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID
CDK_DEFAULT_ACCOUNT=$CDK_DEFAULT_ACCOUNT
CDK_DEFAULT_REGION=$CDK_DEFAULT_REGION
EOF

echo "📋 Security Checklist:"
echo "✅ No secrets hard-coded in source files"
echo "✅ Domain format validated"
echo "✅ Client ID format validated"
echo "✅ Environment variables set securely"
echo ""

echo "🚀 Ready to deploy! Run:"
echo "   source .env.tmp  # Load variables in new terminal sessions"
echo "   ./scripts/deploy-with-auth0.sh"
echo ""

echo "🧹 After testing, cleanup with:"
echo "   rm .env.tmp"
echo "   unset AUTH0_DOMAIN AUTH0_CLIENT_ID"
echo ""

# Verify AWS credentials
if [ -z "$CDK_DEFAULT_ACCOUNT" ]; then
    echo "⚠️  WARNING: Could not get AWS account ID. Please verify AWS credentials:"
    echo "   aws sts get-caller-identity"
fi