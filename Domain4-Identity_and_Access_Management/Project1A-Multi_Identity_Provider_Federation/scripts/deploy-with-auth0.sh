#!/bin/bash

# Deploy script for Auth0 integration testing
set -e

echo "🚀 Starting deployment with Auth0 integration..."

# Check if Auth0 environment variables are set
if [ -z "$AUTH0_DOMAIN" ] || [ -z "$AUTH0_CLIENT_ID" ]; then
    echo "❌ Error: AUTH0_DOMAIN and AUTH0_CLIENT_ID environment variables must be set"
    echo ""
    echo "Please set them like this:"
    echo "export AUTH0_DOMAIN=your-tenant.auth0.com"
    echo "export AUTH0_CLIENT_ID=your-client-id"
    echo ""
    exit 1
fi

echo "✅ Auth0 configuration found:"
echo "   Domain: $AUTH0_DOMAIN"
echo "   Client ID: $AUTH0_CLIENT_ID"
echo ""

# Verify AWS credentials
echo "🔍 Checking AWS credentials..."
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_DEFAULT_REGION:-us-east-1}

echo "✅ AWS Account: $AWS_ACCOUNT"
echo "✅ AWS Region: $AWS_REGION"
echo ""

# Set CDK environment variables
export CDK_DEFAULT_ACCOUNT=$AWS_ACCOUNT
export CDK_DEFAULT_REGION=$AWS_REGION

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building the project..."
npm run build

# Deploy to development environment
echo "🚀 Deploying to development environment..."
npx cdk deploy --all --context environment=dev --require-approval never

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Check AWS Console for created resources"
echo "2. Note the OIDC Provider ARN from the output"
echo "3. Configure Auth0 application with AWS integration"
echo "4. Test the authentication flow"
echo ""

# Display useful information
echo "🔍 Useful commands for testing:"
echo "aws iam list-open-id-connect-providers"
echo "aws iam list-roles --query 'Roles[?contains(RoleName, \`dev\`)].RoleName'"
echo "aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE"
