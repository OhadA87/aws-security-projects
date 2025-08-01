#!/usr/bin/env node

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { IdentityProviderFederationStack } from '../lib/identity-provider-federation-stack';
import { PermissionSetsStack } from '../lib/permission-sets-stack';
import { AccountAssignmentStack } from '../lib/account-assignment-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

const app = new cdk.App();

// Add CDK NAG for security scanning (disabled for initial testing)
// cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Environment-specific configuration
const envConfig = {
  dev: {
    enableCloudTrail: false,
    enableGuardDuty: false,
    retentionDays: 7,
  },
  staging: {
    enableCloudTrail: true,
    enableGuardDuty: true,
    retentionDays: 30,
  },
  prod: {
    enableCloudTrail: true,
    enableGuardDuty: true,
    retentionDays: 365,
  },
};

const config = envConfig[environment as keyof typeof envConfig] || envConfig.dev;

// Define common props
const commonProps = {
  env: { account, region },
  environment,
  config,
};

// Identity Provider Federation Stack
const identityFederationStack = new IdentityProviderFederationStack(
  app,
  `IdentityFederation-${environment}`,
  {
    ...commonProps,
    description: `Multi-Identity Provider Federation Stack - ${environment}`,
  }
);

// Permission Sets Stack
const permissionSetsStack = new PermissionSetsStack(
  app,
  `PermissionSets-${environment}`,
  {
    ...commonProps,
    identityCenterArn: identityFederationStack.identityCenterArn,
    description: `IAM Identity Center Permission Sets - ${environment}`,
  }
);

// Account Assignment Stack
const accountAssignmentStack = new AccountAssignmentStack(
  app,
  `AccountAssignment-${environment}`,
  {
    ...commonProps,
    identityCenterArn: identityFederationStack.identityCenterArn,
    permissionSets: permissionSetsStack.permissionSets,
    description: `IAM Identity Center Account Assignments - ${environment}`,
  }
);

// Monitoring Stack
const monitoringStack = new MonitoringStack(
  app,
  `IdentityMonitoring-${environment}`,
  {
    ...commonProps,
    identityCenterArn: identityFederationStack.identityCenterArn,
    description: `Identity and Access Monitoring - ${environment}`,
  }
);

// Add dependencies
permissionSetsStack.addDependency(identityFederationStack);
accountAssignmentStack.addDependency(permissionSetsStack);
monitoringStack.addDependency(identityFederationStack);

// Add tags to all stacks
const tags = {
  Project: 'AWS-Security-Specialty',
  Domain: 'Identity-and-Access-Management',
  Subproject: 'Multi-Identity-Provider-Federation',
  Environment: environment,
  Owner: 'Security-Team',
  CostCenter: 'Security',
  Compliance: 'SOC2-ISO27001',
};

Object.entries(tags).forEach(([key, value]) => {
  cdk.Tags.of(app).add(key, value);
});

app.synth();