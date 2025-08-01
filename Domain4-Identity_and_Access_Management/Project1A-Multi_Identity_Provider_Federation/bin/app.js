#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const identity_provider_federation_stack_1 = require("../lib/identity-provider-federation-stack");
const permission_sets_stack_1 = require("../lib/permission-sets-stack");
const account_assignment_stack_1 = require("../lib/account-assignment-stack");
const monitoring_stack_1 = require("../lib/monitoring-stack");
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
const config = envConfig[environment] || envConfig.dev;
// Define common props
const commonProps = {
    env: { account, region },
    environment,
    config,
};
// Identity Provider Federation Stack
const identityFederationStack = new identity_provider_federation_stack_1.IdentityProviderFederationStack(app, `IdentityFederation-${environment}`, {
    ...commonProps,
    description: `Multi-Identity Provider Federation Stack - ${environment}`,
});
// Permission Sets Stack
const permissionSetsStack = new permission_sets_stack_1.PermissionSetsStack(app, `PermissionSets-${environment}`, {
    ...commonProps,
    identityCenterArn: identityFederationStack.identityCenterArn,
    description: `IAM Identity Center Permission Sets - ${environment}`,
});
// Account Assignment Stack
const accountAssignmentStack = new account_assignment_stack_1.AccountAssignmentStack(app, `AccountAssignment-${environment}`, {
    ...commonProps,
    identityCenterArn: identityFederationStack.identityCenterArn,
    permissionSets: permissionSetsStack.permissionSets,
    description: `IAM Identity Center Account Assignments - ${environment}`,
});
// Monitoring Stack
const monitoringStack = new monitoring_stack_1.MonitoringStack(app, `IdentityMonitoring-${environment}`, {
    ...commonProps,
    identityCenterArn: identityFederationStack.identityCenterArn,
    description: `Identity and Access Monitoring - ${environment}`,
});
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFFbkMsa0dBQTRGO0FBQzVGLHdFQUFtRTtBQUNuRSw4RUFBeUU7QUFDekUsOERBQTBEO0FBRTFELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLG1FQUFtRTtBQUNuRSxzRUFBc0U7QUFFdEUsK0JBQStCO0FBQy9CLE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEtBQUssQ0FBQztBQUNuRSxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDO0FBQ2hELE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksV0FBVyxDQUFDO0FBRTdELHFDQUFxQztBQUNyQyxNQUFNLFNBQVMsR0FBRztJQUNoQixHQUFHLEVBQUU7UUFDSCxnQkFBZ0IsRUFBRSxLQUFLO1FBQ3ZCLGVBQWUsRUFBRSxLQUFLO1FBQ3RCLGFBQWEsRUFBRSxDQUFDO0tBQ2pCO0lBQ0QsT0FBTyxFQUFFO1FBQ1AsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixlQUFlLEVBQUUsSUFBSTtRQUNyQixhQUFhLEVBQUUsRUFBRTtLQUNsQjtJQUNELElBQUksRUFBRTtRQUNKLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsZUFBZSxFQUFFLElBQUk7UUFDckIsYUFBYSxFQUFFLEdBQUc7S0FDbkI7Q0FDRixDQUFDO0FBRUYsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLFdBQXFDLENBQUMsSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDO0FBRWpGLHNCQUFzQjtBQUN0QixNQUFNLFdBQVcsR0FBRztJQUNsQixHQUFHLEVBQUUsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFO0lBQ3hCLFdBQVc7SUFDWCxNQUFNO0NBQ1AsQ0FBQztBQUVGLHFDQUFxQztBQUNyQyxNQUFNLHVCQUF1QixHQUFHLElBQUksb0VBQStCLENBQ2pFLEdBQUcsRUFDSCxzQkFBc0IsV0FBVyxFQUFFLEVBQ25DO0lBQ0UsR0FBRyxXQUFXO0lBQ2QsV0FBVyxFQUFFLDhDQUE4QyxXQUFXLEVBQUU7Q0FDekUsQ0FDRixDQUFDO0FBRUYsd0JBQXdCO0FBQ3hCLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSwyQ0FBbUIsQ0FDakQsR0FBRyxFQUNILGtCQUFrQixXQUFXLEVBQUUsRUFDL0I7SUFDRSxHQUFHLFdBQVc7SUFDZCxpQkFBaUIsRUFBRSx1QkFBdUIsQ0FBQyxpQkFBaUI7SUFDNUQsV0FBVyxFQUFFLHlDQUF5QyxXQUFXLEVBQUU7Q0FDcEUsQ0FDRixDQUFDO0FBRUYsMkJBQTJCO0FBQzNCLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxpREFBc0IsQ0FDdkQsR0FBRyxFQUNILHFCQUFxQixXQUFXLEVBQUUsRUFDbEM7SUFDRSxHQUFHLFdBQVc7SUFDZCxpQkFBaUIsRUFBRSx1QkFBdUIsQ0FBQyxpQkFBaUI7SUFDNUQsY0FBYyxFQUFFLG1CQUFtQixDQUFDLGNBQWM7SUFDbEQsV0FBVyxFQUFFLDZDQUE2QyxXQUFXLEVBQUU7Q0FDeEUsQ0FDRixDQUFDO0FBRUYsbUJBQW1CO0FBQ25CLE1BQU0sZUFBZSxHQUFHLElBQUksa0NBQWUsQ0FDekMsR0FBRyxFQUNILHNCQUFzQixXQUFXLEVBQUUsRUFDbkM7SUFDRSxHQUFHLFdBQVc7SUFDZCxpQkFBaUIsRUFBRSx1QkFBdUIsQ0FBQyxpQkFBaUI7SUFDNUQsV0FBVyxFQUFFLG9DQUFvQyxXQUFXLEVBQUU7Q0FDL0QsQ0FDRixDQUFDO0FBRUYsbUJBQW1CO0FBQ25CLG1CQUFtQixDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0FBQzNELHNCQUFzQixDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0FBQzFELGVBQWUsQ0FBQyxhQUFhLENBQUMsdUJBQXVCLENBQUMsQ0FBQztBQUV2RCx5QkFBeUI7QUFDekIsTUFBTSxJQUFJLEdBQUc7SUFDWCxPQUFPLEVBQUUsd0JBQXdCO0lBQ2pDLE1BQU0sRUFBRSxnQ0FBZ0M7SUFDeEMsVUFBVSxFQUFFLG9DQUFvQztJQUNoRCxXQUFXLEVBQUUsV0FBVztJQUN4QixLQUFLLEVBQUUsZUFBZTtJQUN0QixVQUFVLEVBQUUsVUFBVTtJQUN0QixVQUFVLEVBQUUsZUFBZTtDQUM1QixDQUFDO0FBRUYsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFO0lBQzVDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDbkMsQ0FBQyxDQUFDLENBQUM7QUFFSCxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5cbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBBd3NTb2x1dGlvbnNDaGVja3MgfSBmcm9tICdjZGstbmFnJztcbmltcG9ydCB7IElkZW50aXR5UHJvdmlkZXJGZWRlcmF0aW9uU3RhY2sgfSBmcm9tICcuLi9saWIvaWRlbnRpdHktcHJvdmlkZXItZmVkZXJhdGlvbi1zdGFjayc7XG5pbXBvcnQgeyBQZXJtaXNzaW9uU2V0c1N0YWNrIH0gZnJvbSAnLi4vbGliL3Blcm1pc3Npb24tc2V0cy1zdGFjayc7XG5pbXBvcnQgeyBBY2NvdW50QXNzaWdubWVudFN0YWNrIH0gZnJvbSAnLi4vbGliL2FjY291bnQtYXNzaWdubWVudC1zdGFjayc7XG5pbXBvcnQgeyBNb25pdG9yaW5nU3RhY2sgfSBmcm9tICcuLi9saWIvbW9uaXRvcmluZy1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbi8vIEFkZCBDREsgTkFHIGZvciBzZWN1cml0eSBzY2FubmluZyAoZGlzYWJsZWQgZm9yIGluaXRpYWwgdGVzdGluZylcbi8vIGNkay5Bc3BlY3RzLm9mKGFwcCkuYWRkKG5ldyBBd3NTb2x1dGlvbnNDaGVja3MoeyB2ZXJib3NlOiB0cnVlIH0pKTtcblxuLy8gR2V0IGVudmlyb25tZW50IGZyb20gY29udGV4dFxuY29uc3QgZW52aXJvbm1lbnQgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdlbnZpcm9ubWVudCcpIHx8ICdkZXYnO1xuY29uc3QgYWNjb3VudCA9IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQ7XG5jb25zdCByZWdpb24gPSBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMSc7XG5cbi8vIEVudmlyb25tZW50LXNwZWNpZmljIGNvbmZpZ3VyYXRpb25cbmNvbnN0IGVudkNvbmZpZyA9IHtcbiAgZGV2OiB7XG4gICAgZW5hYmxlQ2xvdWRUcmFpbDogZmFsc2UsXG4gICAgZW5hYmxlR3VhcmREdXR5OiBmYWxzZSxcbiAgICByZXRlbnRpb25EYXlzOiA3LFxuICB9LFxuICBzdGFnaW5nOiB7XG4gICAgZW5hYmxlQ2xvdWRUcmFpbDogdHJ1ZSxcbiAgICBlbmFibGVHdWFyZER1dHk6IHRydWUsXG4gICAgcmV0ZW50aW9uRGF5czogMzAsXG4gIH0sXG4gIHByb2Q6IHtcbiAgICBlbmFibGVDbG91ZFRyYWlsOiB0cnVlLFxuICAgIGVuYWJsZUd1YXJkRHV0eTogdHJ1ZSxcbiAgICByZXRlbnRpb25EYXlzOiAzNjUsXG4gIH0sXG59O1xuXG5jb25zdCBjb25maWcgPSBlbnZDb25maWdbZW52aXJvbm1lbnQgYXMga2V5b2YgdHlwZW9mIGVudkNvbmZpZ10gfHwgZW52Q29uZmlnLmRldjtcblxuLy8gRGVmaW5lIGNvbW1vbiBwcm9wc1xuY29uc3QgY29tbW9uUHJvcHMgPSB7XG4gIGVudjogeyBhY2NvdW50LCByZWdpb24gfSxcbiAgZW52aXJvbm1lbnQsXG4gIGNvbmZpZyxcbn07XG5cbi8vIElkZW50aXR5IFByb3ZpZGVyIEZlZGVyYXRpb24gU3RhY2tcbmNvbnN0IGlkZW50aXR5RmVkZXJhdGlvblN0YWNrID0gbmV3IElkZW50aXR5UHJvdmlkZXJGZWRlcmF0aW9uU3RhY2soXG4gIGFwcCxcbiAgYElkZW50aXR5RmVkZXJhdGlvbi0ke2Vudmlyb25tZW50fWAsXG4gIHtcbiAgICAuLi5jb21tb25Qcm9wcyxcbiAgICBkZXNjcmlwdGlvbjogYE11bHRpLUlkZW50aXR5IFByb3ZpZGVyIEZlZGVyYXRpb24gU3RhY2sgLSAke2Vudmlyb25tZW50fWAsXG4gIH1cbik7XG5cbi8vIFBlcm1pc3Npb24gU2V0cyBTdGFja1xuY29uc3QgcGVybWlzc2lvblNldHNTdGFjayA9IG5ldyBQZXJtaXNzaW9uU2V0c1N0YWNrKFxuICBhcHAsXG4gIGBQZXJtaXNzaW9uU2V0cy0ke2Vudmlyb25tZW50fWAsXG4gIHtcbiAgICAuLi5jb21tb25Qcm9wcyxcbiAgICBpZGVudGl0eUNlbnRlckFybjogaWRlbnRpdHlGZWRlcmF0aW9uU3RhY2suaWRlbnRpdHlDZW50ZXJBcm4sXG4gICAgZGVzY3JpcHRpb246IGBJQU0gSWRlbnRpdHkgQ2VudGVyIFBlcm1pc3Npb24gU2V0cyAtICR7ZW52aXJvbm1lbnR9YCxcbiAgfVxuKTtcblxuLy8gQWNjb3VudCBBc3NpZ25tZW50IFN0YWNrXG5jb25zdCBhY2NvdW50QXNzaWdubWVudFN0YWNrID0gbmV3IEFjY291bnRBc3NpZ25tZW50U3RhY2soXG4gIGFwcCxcbiAgYEFjY291bnRBc3NpZ25tZW50LSR7ZW52aXJvbm1lbnR9YCxcbiAge1xuICAgIC4uLmNvbW1vblByb3BzLFxuICAgIGlkZW50aXR5Q2VudGVyQXJuOiBpZGVudGl0eUZlZGVyYXRpb25TdGFjay5pZGVudGl0eUNlbnRlckFybixcbiAgICBwZXJtaXNzaW9uU2V0czogcGVybWlzc2lvblNldHNTdGFjay5wZXJtaXNzaW9uU2V0cyxcbiAgICBkZXNjcmlwdGlvbjogYElBTSBJZGVudGl0eSBDZW50ZXIgQWNjb3VudCBBc3NpZ25tZW50cyAtICR7ZW52aXJvbm1lbnR9YCxcbiAgfVxuKTtcblxuLy8gTW9uaXRvcmluZyBTdGFja1xuY29uc3QgbW9uaXRvcmluZ1N0YWNrID0gbmV3IE1vbml0b3JpbmdTdGFjayhcbiAgYXBwLFxuICBgSWRlbnRpdHlNb25pdG9yaW5nLSR7ZW52aXJvbm1lbnR9YCxcbiAge1xuICAgIC4uLmNvbW1vblByb3BzLFxuICAgIGlkZW50aXR5Q2VudGVyQXJuOiBpZGVudGl0eUZlZGVyYXRpb25TdGFjay5pZGVudGl0eUNlbnRlckFybixcbiAgICBkZXNjcmlwdGlvbjogYElkZW50aXR5IGFuZCBBY2Nlc3MgTW9uaXRvcmluZyAtICR7ZW52aXJvbm1lbnR9YCxcbiAgfVxuKTtcblxuLy8gQWRkIGRlcGVuZGVuY2llc1xucGVybWlzc2lvblNldHNTdGFjay5hZGREZXBlbmRlbmN5KGlkZW50aXR5RmVkZXJhdGlvblN0YWNrKTtcbmFjY291bnRBc3NpZ25tZW50U3RhY2suYWRkRGVwZW5kZW5jeShwZXJtaXNzaW9uU2V0c1N0YWNrKTtcbm1vbml0b3JpbmdTdGFjay5hZGREZXBlbmRlbmN5KGlkZW50aXR5RmVkZXJhdGlvblN0YWNrKTtcblxuLy8gQWRkIHRhZ3MgdG8gYWxsIHN0YWNrc1xuY29uc3QgdGFncyA9IHtcbiAgUHJvamVjdDogJ0FXUy1TZWN1cml0eS1TcGVjaWFsdHknLFxuICBEb21haW46ICdJZGVudGl0eS1hbmQtQWNjZXNzLU1hbmFnZW1lbnQnLFxuICBTdWJwcm9qZWN0OiAnTXVsdGktSWRlbnRpdHktUHJvdmlkZXItRmVkZXJhdGlvbicsXG4gIEVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgT3duZXI6ICdTZWN1cml0eS1UZWFtJyxcbiAgQ29zdENlbnRlcjogJ1NlY3VyaXR5JyxcbiAgQ29tcGxpYW5jZTogJ1NPQzItSVNPMjcwMDEnLFxufTtcblxuT2JqZWN0LmVudHJpZXModGFncykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gIGNkay5UYWdzLm9mKGFwcCkuYWRkKGtleSwgdmFsdWUpO1xufSk7XG5cbmFwcC5zeW50aCgpOyJdfQ==