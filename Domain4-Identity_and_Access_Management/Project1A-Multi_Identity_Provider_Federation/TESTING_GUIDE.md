# 🧪 Testing Guide: Multi-Identity Provider Federation

## Prerequisites Checklist
- [ ] AWS Sandbox Account configured
- [ ] AWS CLI configured and working
- [ ] Node.js 18+ installed
- [ ] Auth0 Free Tier account (we'll create this)

## Phase 1: Environment Setup

### 1.1 Create Auth0 Free Tier Account

1. **Sign Up**: Go to [auth0.com](https://auth0.com) and create a free account
2. **Create Tenant**: 
   - Name: `your-company-dev` (replace with your company)
   - Region: Choose closest to your AWS region
   - Environment: Development

3. **Create Application**:
   ```
   Dashboard → Applications → Create Application
   Name: AWS-Identity-Federation-Test
   Type: Single Page Web Applications
   ```

4. **Configure Application Settings**:
   ```
   Allowed Callback URLs: https://signin.aws.amazon.com/saml
   Allowed Logout URLs: https://your-tenant.auth0.com/logout
   Allowed Web Origins: https://console.aws.amazon.com
   ```

5. **Note Your Configuration**:
   ```bash
   # From Applications → Settings tab
   DOMAIN=your-tenant.auth0.com
   CLIENT_ID=your-client-id-here
   CLIENT_SECRET=your-client-secret-here
   ```

### 1.2 Set Environment Variables

```bash
# Set Auth0 configuration
export AUTH0_DOMAIN=your-tenant.auth0.com
export AUTH0_CLIENT_ID=your-client-id-here

# Set AWS configuration
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=us-east-1  # or your preferred region

# Verify settings
echo "Auth0 Domain: $AUTH0_DOMAIN"
echo "Auth0 Client ID: $AUTH0_CLIENT_ID"
echo "AWS Account: $CDK_DEFAULT_ACCOUNT"
echo "AWS Region: $CDK_DEFAULT_REGION"
```

## Phase 2: Deploy Infrastructure

### 2.1 Quick Deploy
```bash
cd Domain4-Identity_and_Access_Management/Project1A-Multi_Identity_Provider_Federation

# Use the deployment script
./scripts/deploy-with-auth0.sh
```

### 2.2 Manual Deploy (Alternative)
```bash
# Install dependencies
npm install

# Build project
npm run build

# Deploy all stacks
npx cdk deploy --all --context environment=dev --require-approval never
```

### 2.3 Verify Deployment
```bash
# Check CloudFormation stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE

# Check created OIDC providers
aws iam list-open-id-connect-providers

# Check IAM roles
aws iam list-roles --query 'Roles[?contains(RoleName, `dev`)].RoleName'

# Check CloudWatch log groups
aws logs describe-log-groups --log-group-name-prefix "/aws/identitycenter"
```

## Phase 3: Configure Auth0 Integration

### 3.1 Get AWS OIDC Provider Details
```bash
# Get the OIDC provider ARN (you'll need this)
aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[0].Arn' --output text
```

### 3.2 Configure Auth0 Rules (Optional)
In Auth0 Dashboard → Auth Pipeline → Rules, create a rule to add custom claims:

```javascript
function addAWSClaims(user, context, callback) {
  // Add custom claims for AWS role assumption
  const namespace = 'https://aws.amazon.com/';
  context.idToken[namespace + 'role'] = 'SecurityAuditor';
  context.idToken[namespace + 'department'] = user.app_metadata.department || 'Engineering';
  context.idToken[namespace + 'environment'] = 'dev';
  
  callback(null, user, context);
}
```

### 3.3 Create Test Users
1. **Auth0 Dashboard** → **User Management** → **Users** → **Create User**
2. Create test users:
   ```
   Email: test-security@yourcompany.com
   Password: TempPassword123!
   Department: Security (in app_metadata)
   
   Email: test-developer@yourcompany.com  
   Password: TempPassword123!
   Department: Engineering (in app_metadata)
   ```

## Phase 4: Testing Scenarios

### 4.1 Test 1: Basic Infrastructure Validation

```bash
# Test CloudWatch metrics
aws cloudwatch list-metrics --namespace IdentitySecurity

# Test SNS topic
aws sns list-topics --query 'Topics[?contains(TopicArn, `IdentitySecurityAlerts`)]'

# Test KMS key
aws kms list-keys --query 'Keys[0].KeyId' --output text
```

### 4.2 Test 2: Role Assumption (Manual)

```bash
# Try to assume one of the created roles
ROLE_ARN="arn:aws:iam::$CDK_DEFAULT_ACCOUNT:role/SecurityAuditor-dev"

# This should work if you have the right permissions
aws sts assume-role --role-arn $ROLE_ARN --role-session-name test-session
```

### 4.3 Test 3: Monitoring and Alerts

```bash
# Trigger a test event (this will create CloudWatch metrics)
aws events put-events --entries '[{
  "Source": "test.identitysecurity",
  "DetailType": "Test Authentication Event",
  "Detail": "{\"eventName\":\"TestLogin\",\"userIdentity\":{\"userName\":\"test-user\"},\"sourceIPAddress\":\"127.0.0.1\"}"
}]'

# Check if metrics were created (wait 1-2 minutes)
aws cloudwatch get-metric-statistics \
  --namespace IdentitySecurity \
  --metric-name SuccessfulLogins \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### 4.4 Test 4: Break-Glass Access Alert

```bash
# This should trigger an immediate alert
BREAK_GLASS_ROLE="arn:aws:iam::$CDK_DEFAULT_ACCOUNT:role/BreakGlass-Emergency-dev"

# Try to assume break-glass role (will likely fail due to MFA requirement, but should create alert)
aws sts assume-role --role-arn $BREAK_GLASS_ROLE --role-session-name emergency-test 2>/dev/null || echo "Expected failure - break-glass requires MFA"

# Check SNS topic for alerts (you should have received an email if subscribed)
```

## Phase 5: Web Authentication Testing (Advanced)

### 5.1 Create Simple Web App for Testing
Create a simple HTML file to test the Auth0 flow:

```html
<!DOCTYPE html>
<html>
<head>
    <title>AWS Auth0 Federation Test</title>
    <script src="https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js"></script>
</head>
<body>
    <div id="app">
        <h1>AWS Identity Federation Test</h1>
        <button id="login">Login with Auth0</button>
        <button id="logout" style="display:none">Logout</button>
        <div id="profile" style="display:none"></div>
    </div>

    <script>
        let auth0Client = null;

        const configureClient = async () => {
            auth0Client = await auth0.createAuth0Client({
                domain: 'YOUR_AUTH0_DOMAIN',
                clientId: 'YOUR_CLIENT_ID',
                authorizationParams: {
                    redirect_uri: window.location.origin
                }
            });
        };

        const login = async () => {
            await auth0Client.loginWithRedirect();
        };

        const logout = () => {
            auth0Client.logout({
                logoutParams: {
                    returnTo: window.location.origin
                }
            });
        };

        const updateUI = async () => {
            const isAuthenticated = await auth0Client.isAuthenticated();
            
            document.getElementById("login").style.display = isAuthenticated ? "none" : "block";
            document.getElementById("logout").style.display = isAuthenticated ? "block" : "none";
            document.getElementById("profile").style.display = isAuthenticated ? "block" : "none";

            if (isAuthenticated) {
                const user = await auth0Client.getUser();
                const token = await auth0Client.getIdTokenClaims();
                document.getElementById("profile").innerHTML = `
                    <h2>User Profile</h2>
                    <p>Email: ${user.email}</p>
                    <p>Name: ${user.name}</p>
                    <h3>ID Token Claims:</h3>
                    <pre>${JSON.stringify(token, null, 2)}</pre>
                `;
            }
        };

        window.onload = async () => {
            await configureClient();
            
            const query = window.location.search;
            if (query.includes("code=") && query.includes("state=")) {
                await auth0Client.handleRedirectCallback();
                window.history.replaceState({}, document.title, "/");
            }

            document.getElementById("login").addEventListener("click", login);
            document.getElementById("logout").addEventListener("click", logout);

            await updateUI();
        };
    </script>
</body>
</html>
```

## Phase 6: Validation and Monitoring

### 6.1 Check CloudWatch Dashboard
1. Go to **AWS Console** → **CloudWatch** → **Dashboards**
2. Look for `IdentitySecurity-dev` dashboard
3. Verify metrics are being collected

### 6.2 Check Logs
```bash
# Check identity center logs
aws logs tail /aws/identitycenter/dev --follow

# Check role assumption logs  
aws logs tail /aws/iam/role-assumption/dev --follow

# Check emergency access logs
aws logs tail /aws/emergency/break-glass/dev --follow
```

### 6.3 Validate Security Controls
```bash
# Try to perform restricted actions (should fail)
aws ec2 terminate-instances --instance-ids i-1234567890abcdef0 --dry-run

# Check IAM policy simulator
aws iam simulate-principal-policy \
  --policy-source-arn "arn:aws:iam::$CDK_DEFAULT_ACCOUNT:role/SecurityAuditor-dev" \
  --action-names "ec2:TerminateInstances" \
  --resource-arns "*"
```

## Phase 7: Cleanup

### 7.1 Destroy Resources
```bash
# Destroy all CDK stacks
npx cdk destroy --all --force

# Verify cleanup
aws cloudformation list-stacks --stack-status-filter DELETE_COMPLETE
```

### 7.2 Clean Up Auth0
1. Delete test users
2. Delete the application
3. Optionally delete the tenant

## 🎯 Expected Results

After successful testing, you should have:

✅ **Infrastructure**: 4 CloudFormation stacks deployed  
✅ **Identity Provider**: Auth0 OIDC provider configured  
✅ **Roles**: Multiple IAM roles with different permission levels  
✅ **Monitoring**: CloudWatch metrics and dashboard working  
✅ **Alerting**: SNS notifications for security events  
✅ **Security Controls**: Policies preventing destructive actions  

## 🐛 Troubleshooting

### Common Issues

1. **CDK Deploy Fails**:
   ```bash
   # Check CDK bootstrap
   npx cdk bootstrap
   
   # Check AWS permissions
   aws sts get-caller-identity
   ```

2. **Auth0 Integration Issues**:
   - Verify domain and client ID are correct
   - Check Auth0 application configuration
   - Ensure callback URLs are properly set

3. **Role Assumption Fails**:
   - Check trust relationships
   - Verify external ID requirements
   - Check MFA requirements

4. **Monitoring Not Working**:
   - Verify EventBridge rules are enabled
   - Check Lambda function logs
   - Ensure SNS topic subscriptions are confirmed

## 💰 Cost Considerations

**Estimated monthly cost for testing**:
- CloudWatch: $5-10
- Lambda: $0-1  
- SNS: $0-1
- KMS: $1
- **Total: ~$7-13/month**

**Auth0 Free Tier**: Up to 7,000 active users, unlimited logins

This setup gives you a complete testing environment for enterprise identity federation patterns! 🎉