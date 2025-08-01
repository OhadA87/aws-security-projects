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
exports.IdentityProviderFederationStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
const cdk_nag_1 = require("cdk-nag");
const auth0_config_1 = require("../config/auth0-config");
class IdentityProviderFederationStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // KMS Key for encryption
        this.kmsKey = new kms.Key(this, 'IdentityFederationKey', {
            description: `Identity Federation encryption key - ${props.environment}`,
            enableKeyRotation: true,
            policy: new iam.PolicyDocument({
                statements: [
                    new iam.PolicyStatement({
                        sid: 'Enable IAM User Permissions',
                        effect: iam.Effect.ALLOW,
                        principals: [new iam.AccountRootPrincipal()],
                        actions: ['kms:*'],
                        resources: ['*'],
                    }),
                    new iam.PolicyStatement({
                        sid: 'Allow CloudWatch access',
                        effect: iam.Effect.ALLOW,
                        principals: [new iam.ServicePrincipal('logs.amazonaws.com')],
                        actions: [
                            'kms:Encrypt',
                            'kms:Decrypt',
                            'kms:ReEncrypt*',
                            'kms:GenerateDataKey*',
                            'kms:DescribeKey',
                        ],
                        resources: ['*'],
                    }),
                ],
            }),
        });
        // KMS Key Alias
        new kms.Alias(this, 'IdentityFederationKeyAlias', {
            aliasName: `alias/identity-federation-${props.environment}`,
            targetKey: this.kmsKey,
        });
        // CloudWatch Log Group for Identity Center activities
        const logGroup = new logs.LogGroup(this, 'IdentityCenterLogGroup', {
            logGroupName: `/aws/identitycenter/${props.environment}`,
            retention: props.config.retentionDays,
            encryptionKey: this.kmsKey,
            removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // IAM Identity Center Instance (AWS SSO)
        // Note: In real scenarios, this would typically be created manually or via AWS Organizations
        // For this educational project, we'll create the configuration resources
        // Identity Source Configuration for External IdPs
        new iam.Role(this, 'IdentitySourceRole', {
            assumedBy: new iam.ServicePrincipal('sso.amazonaws.com'),
            description: 'Role for Identity Center to access external identity sources',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AWSSSODirectoryReadOnlyAccess'),
            ],
            inlinePolicies: {
                IdentitySourceAccess: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'identitystore:DescribeUser',
                                'identitystore:DescribeGroup',
                                'identitystore:ListUsers',
                                'identitystore:ListGroups',
                                'identitystore:ListGroupMemberships',
                            ],
                            resources: ['*'],
                        }),
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'logs:CreateLogStream',
                                'logs:PutLogEvents',
                                'logs:DescribeLogGroups',
                                'logs:DescribeLogStreams',
                            ],
                            resources: [logGroup.logGroupArn],
                        }),
                    ],
                }),
            },
        });
        // SAML Identity Provider configuration (example for enterprise IdP)
        const samlProvider = new iam.SamlProvider(this, 'SAMLProvider', {
            name: `EnterpriseIdP-${props.environment}`,
            metadataDocument: iam.SamlMetadataDocument.fromXml(
            // This would typically be loaded from your IdP's metadata URL
            // For demo purposes, using a placeholder
            '<?xml version="1.0" encoding="UTF-8"?><md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://example.com/saml"><md:IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"><md:KeyDescriptor use="signing"><ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:X509Data><ds:X509Certificate>MIICertificateData</ds:X509Certificate></ds:X509Data></ds:KeyInfo></md:KeyDescriptor><md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat><md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://example.com/saml/sso"/></md:IDPSSODescriptor></md:EntityDescriptor>'),
        });
        // OIDC Identity Provider configuration for Auth0
        const auth0Config = (0, auth0_config_1.getAuth0Config)(props.environment);
        const oidcProvider = new iam.OpenIdConnectProvider(this, 'Auth0OIDCProvider', {
            url: `https://${auth0Config.domain}`,
            clientIds: [auth0Config.clientId],
            thumbprints: ['9e99a48a9960b14926bb7e3b6e3f1c478a45c21b'], // Auth0 thumbprint
        });
        // Cross-account access role for identity federation
        const federationRole = new iam.Role(this, 'FederationRole', {
            roleName: `IdentityFederation-${props.environment}`,
            assumedBy: new iam.WebIdentityPrincipal(oidcProvider.openIdConnectProviderArn, {
                'StringEquals': {
                    [`${auth0Config.domain}:aud`]: auth0Config.clientId,
                },
            }),
            description: 'Role for federated users from external identity providers',
            maxSessionDuration: cdk.Duration.hours(12),
            inlinePolicies: {
                BaseAccessPolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'sts:GetCallerIdentity',
                                'sts:TagSession',
                            ],
                            resources: ['*'],
                        }),
                    ],
                }),
            },
        });
        // Session tags for attribute-based access control
        federationRole.assumeRolePolicy?.addStatements(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.WebIdentityPrincipal(oidcProvider.openIdConnectProviderArn)],
            actions: ['sts:AssumeRoleWithWebIdentity', 'sts:TagSession'],
            conditions: {
                'StringEquals': {
                    'example.auth0.com:aud': 'your-client-id',
                },
                'ForAllValues:StringEquals': {
                    'aws:PrincipalTag/Department': ['Engineering', 'Security', 'Operations'],
                    'aws:PrincipalTag/Project': 'AWS-Security-Specialty',
                },
            },
        }));
        // Outputs
        new cdk.CfnOutput(this, 'SAMLProviderArn', {
            value: samlProvider.samlProviderArn,
            description: 'SAML Identity Provider ARN',
            exportName: `${props.environment}-saml-provider-arn`,
        });
        new cdk.CfnOutput(this, 'OIDCProviderArn', {
            value: oidcProvider.openIdConnectProviderArn,
            description: 'OIDC Identity Provider ARN',
            exportName: `${props.environment}-oidc-provider-arn`,
        });
        new cdk.CfnOutput(this, 'FederationRoleArn', {
            value: federationRole.roleArn,
            description: 'Identity Federation Role ARN',
            exportName: `${props.environment}-federation-role-arn`,
        });
        new cdk.CfnOutput(this, 'KMSKeyId', {
            value: this.kmsKey.keyId,
            description: 'KMS Key ID for Identity Federation',
            exportName: `${props.environment}-identity-kms-key-id`,
        });
        // For this demo, we'll use placeholder values for Identity Center
        // In real scenarios, these would come from an existing Identity Center instance
        this.identityCenterArn = `arn:aws:sso:::instance/ssoins-${cdk.Stack.of(this).account}`;
        this.identityStoreId = `d-${cdk.Stack.of(this).account.substring(0, 10)}`;
        // CDK NAG suppressions for demo code
        cdk_nag_1.NagSuppressions.addResourceSuppressions(samlProvider, [
            {
                id: 'AwsSolutions-IAM4',
                reason: 'Demo SAML metadata document - would be real in production',
            },
        ]);
        cdk_nag_1.NagSuppressions.addResourceSuppressions(oidcProvider, [
            {
                id: 'AwsSolutions-IAM3',
                reason: 'Demo OIDC configuration - would be real thumbprints in production',
            },
        ]);
    }
}
exports.IdentityProviderFederationStack = IdentityProviderFederationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlbnRpdHktcHJvdmlkZXItZmVkZXJhdGlvbi1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImlkZW50aXR5LXByb3ZpZGVyLWZlZGVyYXRpb24tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQywyREFBNkM7QUFDN0MseURBQTJDO0FBRTNDLHFDQUEwQztBQUMxQyx5REFBd0Q7QUFXeEQsTUFBYSwrQkFBZ0MsU0FBUSxHQUFHLENBQUMsS0FBSztJQUs1RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTJDO1FBQ25GLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLHlCQUF5QjtRQUN6QixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDdkQsV0FBVyxFQUFFLHdDQUF3QyxLQUFLLENBQUMsV0FBVyxFQUFFO1lBQ3hFLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsTUFBTSxFQUFFLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQztnQkFDN0IsVUFBVSxFQUFFO29CQUNWLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQzt3QkFDdEIsR0FBRyxFQUFFLDZCQUE2Qjt3QkFDbEMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSzt3QkFDeEIsVUFBVSxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsb0JBQW9CLEVBQUUsQ0FBQzt3QkFDNUMsT0FBTyxFQUFFLENBQUMsT0FBTyxDQUFDO3dCQUNsQixTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7cUJBQ2pCLENBQUM7b0JBQ0YsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO3dCQUN0QixHQUFHLEVBQUUseUJBQXlCO3dCQUM5QixNQUFNLEVBQUUs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O1NBQ3ZELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ2xDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsV0FBVyxFQUFFLG9DQUFvQztZQUNqRCxVQUFVLEVBQUUsR0FBRyxLQUFLLENBQUMsV0FBVyxzQkFBc0I7U0FDdkQsQ0FBQyxDQUFDO1FBRUgsa0VBQWtFO1FBQ2xFLGdGQUFnRjtRQUNoRixJQUFJLENBQUMsaUJBQWlCLEdBQUcsaUNBQWlDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3ZGLElBQUksQ0FBQyxlQUFlLEdBQUcsS0FBSyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO1FBRTFFLHFDQUFxQztRQUNyQyx5QkFBZSxDQUFDLHVCQUF1QixDQUNyQyxZQUFZLEVBQ1o7WUFDRTtnQkFDRSxFQUFFLEVBQUUsbUJBQW1CO2dCQUN2QixNQUFNLEVBQUUsMkRBQTJEO2FBQ3BFO1NBQ0YsQ0FDRixDQUFDO1FBRUYseUJBQWUsQ0FBQyx1QkFBdUIsQ0FDckMsWUFBWSxFQUNaO1lBQ0U7Z0JBQ0UsRUFBRSxFQUFFLG1CQUFtQjtnQkFDdkIsTUFBTSxFQUFFLG1FQUFtRTthQUM1RTtTQUNGLENBQ0YsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQWhORCwwRUFnTkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBrbXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWttcyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IE5hZ1N1cHByZXNzaW9ucyB9IGZyb20gJ2Nkay1uYWcnO1xuaW1wb3J0IHsgZ2V0QXV0aDBDb25maWcgfSBmcm9tICcuLi9jb25maWcvYXV0aDAtY29uZmlnJztcblxuZXhwb3J0IGludGVyZmFjZSBJZGVudGl0eVByb3ZpZGVyRmVkZXJhdGlvblN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIGNvbmZpZzoge1xuICAgIGVuYWJsZUNsb3VkVHJhaWw6IGJvb2xlYW47XG4gICAgZW5hYmxlR3VhcmREdXR5OiBib29sZWFuO1xuICAgIHJldGVudGlvbkRheXM6IG51bWJlcjtcbiAgfTtcbn1cblxuZXhwb3J0IGNsYXNzIElkZW50aXR5UHJvdmlkZXJGZWRlcmF0aW9uU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgaWRlbnRpdHlDZW50ZXJBcm46IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IGlkZW50aXR5U3RvcmVJZDogc3RyaW5nO1xuICBwdWJsaWMgcmVhZG9ubHkga21zS2V5OiBrbXMuS2V5O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBJZGVudGl0eVByb3ZpZGVyRmVkZXJhdGlvblN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIEtNUyBLZXkgZm9yIGVuY3J5cHRpb25cbiAgICB0aGlzLmttc0tleSA9IG5ldyBrbXMuS2V5KHRoaXMsICdJZGVudGl0eUZlZGVyYXRpb25LZXknLCB7XG4gICAgICBkZXNjcmlwdGlvbjogYElkZW50aXR5IEZlZGVyYXRpb24gZW5jcnlwdGlvbiBrZXkgLSAke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBlbmFibGVLZXlSb3RhdGlvbjogdHJ1ZSxcbiAgICAgIHBvbGljeTogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBzaWQ6ICdFbmFibGUgSUFNIFVzZXIgUGVybWlzc2lvbnMnLFxuICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uQWNjb3VudFJvb3RQcmluY2lwYWwoKV0sXG4gICAgICAgICAgICBhY3Rpb25zOiBbJ2ttczoqJ10sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIHNpZDogJ0FsbG93IENsb3VkV2F0Y2ggYWNjZXNzJyxcbiAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xvZ3MuYW1hem9uYXdzLmNvbScpXSxcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgJ2ttczpFbmNyeXB0JyxcbiAgICAgICAgICAgICAgJ2ttczpEZWNyeXB0JyxcbiAgICAgICAgICAgICAgJ2ttczpSZUVuY3J5cHQqJyxcbiAgICAgICAgICAgICAgJ2ttczpHZW5lcmF0ZURhdGFLZXkqJyxcbiAgICAgICAgICAgICAgJ2ttczpEZXNjcmliZUtleScsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gS01TIEtleSBBbGlhc1xuICAgIG5ldyBrbXMuQWxpYXModGhpcywgJ0lkZW50aXR5RmVkZXJhdGlvbktleUFsaWFzJywge1xuICAgICAgYWxpYXNOYW1lOiBgYWxpYXMvaWRlbnRpdHktZmVkZXJhdGlvbi0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICB0YXJnZXRLZXk6IHRoaXMua21zS2V5LFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2cgR3JvdXAgZm9yIElkZW50aXR5IENlbnRlciBhY3Rpdml0aWVzXG4gICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnSWRlbnRpdHlDZW50ZXJMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvaWRlbnRpdHljZW50ZXIvJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgcmV0ZW50aW9uOiBwcm9wcy5jb25maWcucmV0ZW50aW9uRGF5cyxcbiAgICAgIGVuY3J5cHRpb25LZXk6IHRoaXMua21zS2V5LFxuICAgICAgcmVtb3ZhbFBvbGljeTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBJQU0gSWRlbnRpdHkgQ2VudGVyIEluc3RhbmNlIChBV1MgU1NPKVxuICAgIC8vIE5vdGU6IEluIHJlYWwgc2NlbmFyaW9zLCB0aGlzIHdvdWxkIHR5cGljYWxseSBiZSBjcmVhdGVkIG1hbnVhbGx5IG9yIHZpYSBBV1MgT3JnYW5pemF0aW9uc1xuICAgIC8vIEZvciB0aGlzIGVkdWNhdGlvbmFsIHByb2plY3QsIHdlJ2xsIGNyZWF0ZSB0aGUgY29uZmlndXJhdGlvbiByZXNvdXJjZXNcbiAgICBcbiAgICAvLyBJZGVudGl0eSBTb3VyY2UgQ29uZmlndXJhdGlvbiBmb3IgRXh0ZXJuYWwgSWRQc1xuICAgIG5ldyBpYW0uUm9sZSh0aGlzLCAnSWRlbnRpdHlTb3VyY2VSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ3Nzby5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ1JvbGUgZm9yIElkZW50aXR5IENlbnRlciB0byBhY2Nlc3MgZXh0ZXJuYWwgaWRlbnRpdHkgc291cmNlcycsXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBV1NTU09EaXJlY3RvcnlSZWFkT25seUFjY2VzcycpLFxuICAgICAgXSxcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgIElkZW50aXR5U291cmNlQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdpZGVudGl0eXN0b3JlOkRlc2NyaWJlVXNlcicsXG4gICAgICAgICAgICAgICAgJ2lkZW50aXR5c3RvcmU6RGVzY3JpYmVHcm91cCcsXG4gICAgICAgICAgICAgICAgJ2lkZW50aXR5c3RvcmU6TGlzdFVzZXJzJyxcbiAgICAgICAgICAgICAgICAnaWRlbnRpdHlzdG9yZTpMaXN0R3JvdXBzJyxcbiAgICAgICAgICAgICAgICAnaWRlbnRpdHlzdG9yZTpMaXN0R3JvdXBNZW1iZXJzaGlwcycsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nU3RyZWFtJyxcbiAgICAgICAgICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnLFxuICAgICAgICAgICAgICAgICdsb2dzOkRlc2NyaWJlTG9nR3JvdXBzJyxcbiAgICAgICAgICAgICAgICAnbG9nczpEZXNjcmliZUxvZ1N0cmVhbXMnLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtsb2dHcm91cC5sb2dHcm91cEFybl0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBTQU1MIElkZW50aXR5IFByb3ZpZGVyIGNvbmZpZ3VyYXRpb24gKGV4YW1wbGUgZm9yIGVudGVycHJpc2UgSWRQKVxuICAgIGNvbnN0IHNhbWxQcm92aWRlciA9IG5ldyBpYW0uU2FtbFByb3ZpZGVyKHRoaXMsICdTQU1MUHJvdmlkZXInLCB7XG4gICAgICBuYW1lOiBgRW50ZXJwcmlzZUlkUC0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBtZXRhZGF0YURvY3VtZW50OiBpYW0uU2FtbE1ldGFkYXRhRG9jdW1lbnQuZnJvbVhtbChcbiAgICAgICAgLy8gVGhpcyB3b3VsZCB0eXBpY2FsbHkgYmUgbG9hZGVkIGZyb20geW91ciBJZFAncyBtZXRhZGF0YSBVUkxcbiAgICAgICAgLy8gRm9yIGRlbW8gcHVycG9zZXMsIHVzaW5nIGEgcGxhY2Vob2xkZXJcbiAgICAgICAgJzw/eG1sIHZlcnNpb249XCIxLjBcIiBlbmNvZGluZz1cIlVURi04XCI/PjxtZDpFbnRpdHlEZXNjcmlwdG9yIHhtbG5zOm1kPVwidXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6Mi4wOm1ldGFkYXRhXCIgZW50aXR5SUQ9XCJodHRwczovL2V4YW1wbGUuY29tL3NhbWxcIj48bWQ6SURQU1NPRGVzY3JpcHRvciBXYW50QXV0aG5SZXF1ZXN0c1NpZ25lZD1cImZhbHNlXCIgcHJvdG9jb2xTdXBwb3J0RW51bWVyYXRpb249XCJ1cm46b2FzaXM6bmFtZXM6dGM6U0FNTDoyLjA6cHJvdG9jb2xcIj48bWQ6S2V5RGVzY3JpcHRvciB1c2U9XCJzaWduaW5nXCI+PGRzOktleUluZm8geG1sbnM6ZHM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwLzA5L3htbGRzaWcjXCI+PGRzOlg1MDlEYXRhPjxkczpYNTA5Q2VydGlmaWNhdGU+TUlJQ2VydGlmaWNhdGVEYXRhPC9kczpYNTA5Q2VydGlmaWNhdGU+PC9kczpYNTA5RGF0YT48L2RzOktleUluZm8+PC9tZDpLZXlEZXNjcmlwdG9yPjxtZDpOYW1lSURGb3JtYXQ+dXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6MS4xOm5hbWVpZC1mb3JtYXQ6ZW1haWxBZGRyZXNzPC9tZDpOYW1lSURGb3JtYXQ+PG1kOlNpbmdsZVNpZ25PblNlcnZpY2UgQmluZGluZz1cInVybjpvYXNpczpuYW1lczp0YzpTQU1MOjIuMDpiaW5kaW5nczpIVFRQLVBPU1RcIiBMb2NhdGlvbj1cImh0dHBzOi8vZXhhbXBsZS5jb20vc2FtbC9zc29cIi8+PC9tZDpJRFBTU09EZXNjcmlwdG9yPjwvbWQ6RW50aXR5RGVzY3JpcHRvcj4nXG4gICAgICApLFxuICAgIH0pO1xuXG4gICAgLy8gT0lEQyBJZGVudGl0eSBQcm92aWRlciBjb25maWd1cmF0aW9uIGZvciBBdXRoMFxuICAgIGNvbnN0IGF1dGgwQ29uZmlnID0gZ2V0QXV0aDBDb25maWcocHJvcHMuZW52aXJvbm1lbnQpO1xuICAgIGNvbnN0IG9pZGNQcm92aWRlciA9IG5ldyBpYW0uT3BlbklkQ29ubmVjdFByb3ZpZGVyKHRoaXMsICdBdXRoME9JRENQcm92aWRlcicsIHtcbiAgICAgIHVybDogYGh0dHBzOi8vJHthdXRoMENvbmZpZy5kb21haW59YCxcbiAgICAgIGNsaWVudElkczogW2F1dGgwQ29uZmlnLmNsaWVudElkXSxcbiAgICAgIHRodW1icHJpbnRzOiBbJzllOTlhNDhhOTk2MGIxNDkyNmJiN2UzYjZlM2YxYzQ3OGE0NWMyMWInXSwgLy8gQXV0aDAgdGh1bWJwcmludFxuICAgIH0pO1xuXG4gICAgLy8gQ3Jvc3MtYWNjb3VudCBhY2Nlc3Mgcm9sZSBmb3IgaWRlbnRpdHkgZmVkZXJhdGlvblxuICAgIGNvbnN0IGZlZGVyYXRpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdGZWRlcmF0aW9uUm9sZScsIHtcbiAgICAgIHJvbGVOYW1lOiBgSWRlbnRpdHlGZWRlcmF0aW9uLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5XZWJJZGVudGl0eVByaW5jaXBhbChcbiAgICAgICAgb2lkY1Byb3ZpZGVyLm9wZW5JZENvbm5lY3RQcm92aWRlckFybixcbiAgICAgICAge1xuICAgICAgICAgICdTdHJpbmdFcXVhbHMnOiB7XG4gICAgICAgICAgICBbYCR7YXV0aDBDb25maWcuZG9tYWlufTphdWRgXTogYXV0aDBDb25maWcuY2xpZW50SWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgfVxuICAgICAgKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUm9sZSBmb3IgZmVkZXJhdGVkIHVzZXJzIGZyb20gZXh0ZXJuYWwgaWRlbnRpdHkgcHJvdmlkZXJzJyxcbiAgICAgIG1heFNlc3Npb25EdXJhdGlvbjogY2RrLkR1cmF0aW9uLmhvdXJzKDEyKSxcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgIEJhc2VBY2Nlc3NQb2xpY3k6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ3N0czpHZXRDYWxsZXJJZGVudGl0eScsXG4gICAgICAgICAgICAgICAgJ3N0czpUYWdTZXNzaW9uJyxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFNlc3Npb24gdGFncyBmb3IgYXR0cmlidXRlLWJhc2VkIGFjY2VzcyBjb250cm9sXG4gICAgZmVkZXJhdGlvblJvbGUuYXNzdW1lUm9sZVBvbGljeT8uYWRkU3RhdGVtZW50cyhcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBwcmluY2lwYWxzOiBbbmV3IGlhbS5XZWJJZGVudGl0eVByaW5jaXBhbChvaWRjUHJvdmlkZXIub3BlbklkQ29ubmVjdFByb3ZpZGVyQXJuKV0sXG4gICAgICAgIGFjdGlvbnM6IFsnc3RzOkFzc3VtZVJvbGVXaXRoV2ViSWRlbnRpdHknLCAnc3RzOlRhZ1Nlc3Npb24nXSxcbiAgICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICAgICdTdHJpbmdFcXVhbHMnOiB7XG4gICAgICAgICAgICAnZXhhbXBsZS5hdXRoMC5jb206YXVkJzogJ3lvdXItY2xpZW50LWlkJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgICdGb3JBbGxWYWx1ZXM6U3RyaW5nRXF1YWxzJzoge1xuICAgICAgICAgICAgJ2F3czpQcmluY2lwYWxUYWcvRGVwYXJ0bWVudCc6IFsnRW5naW5lZXJpbmcnLCAnU2VjdXJpdHknLCAnT3BlcmF0aW9ucyddLFxuICAgICAgICAgICAgJ2F3czpQcmluY2lwYWxUYWcvUHJvamVjdCc6ICdBV1MtU2VjdXJpdHktU3BlY2lhbHR5JyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTQU1MUHJvdmlkZXJBcm4nLCB7XG4gICAgICB2YWx1ZTogc2FtbFByb3ZpZGVyLnNhbWxQcm92aWRlckFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnU0FNTCBJZGVudGl0eSBQcm92aWRlciBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMuZW52aXJvbm1lbnR9LXNhbWwtcHJvdmlkZXItYXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdPSURDUHJvdmlkZXJBcm4nLCB7XG4gICAgICB2YWx1ZTogb2lkY1Byb3ZpZGVyLm9wZW5JZENvbm5lY3RQcm92aWRlckFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnT0lEQyBJZGVudGl0eSBQcm92aWRlciBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMuZW52aXJvbm1lbnR9LW9pZGMtcHJvdmlkZXItYXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGZWRlcmF0aW9uUm9sZUFybicsIHtcbiAgICAgIHZhbHVlOiBmZWRlcmF0aW9uUm9sZS5yb2xlQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdJZGVudGl0eSBGZWRlcmF0aW9uIFJvbGUgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLmVudmlyb25tZW50fS1mZWRlcmF0aW9uLXJvbGUtYXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdLTVNLZXlJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmttc0tleS5rZXlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnS01TIEtleSBJRCBmb3IgSWRlbnRpdHkgRmVkZXJhdGlvbicsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5lbnZpcm9ubWVudH0taWRlbnRpdHkta21zLWtleS1pZGAsXG4gICAgfSk7XG5cbiAgICAvLyBGb3IgdGhpcyBkZW1vLCB3ZSdsbCB1c2UgcGxhY2Vob2xkZXIgdmFsdWVzIGZvciBJZGVudGl0eSBDZW50ZXJcbiAgICAvLyBJbiByZWFsIHNjZW5hcmlvcywgdGhlc2Ugd291bGQgY29tZSBmcm9tIGFuIGV4aXN0aW5nIElkZW50aXR5IENlbnRlciBpbnN0YW5jZVxuICAgIHRoaXMuaWRlbnRpdHlDZW50ZXJBcm4gPSBgYXJuOmF3czpzc286OjppbnN0YW5jZS9zc29pbnMtJHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH1gO1xuICAgIHRoaXMuaWRlbnRpdHlTdG9yZUlkID0gYGQtJHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudC5zdWJzdHJpbmcoMCwgMTApfWA7XG5cbiAgICAvLyBDREsgTkFHIHN1cHByZXNzaW9ucyBmb3IgZGVtbyBjb2RlXG4gICAgTmFnU3VwcHJlc3Npb25zLmFkZFJlc291cmNlU3VwcHJlc3Npb25zKFxuICAgICAgc2FtbFByb3ZpZGVyLFxuICAgICAgW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdBd3NTb2x1dGlvbnMtSUFNNCcsXG4gICAgICAgICAgcmVhc29uOiAnRGVtbyBTQU1MIG1ldGFkYXRhIGRvY3VtZW50IC0gd291bGQgYmUgcmVhbCBpbiBwcm9kdWN0aW9uJyxcbiAgICAgICAgfSxcbiAgICAgIF1cbiAgICApO1xuXG4gICAgTmFnU3VwcHJlc3Npb25zLmFkZFJlc291cmNlU3VwcHJlc3Npb25zKFxuICAgICAgb2lkY1Byb3ZpZGVyLFxuICAgICAgW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdBd3NTb2x1dGlvbnMtSUFNMycsXG4gICAgICAgICAgcmVhc29uOiAnRGVtbyBPSURDIGNvbmZpZ3VyYXRpb24gLSB3b3VsZCBiZSByZWFsIHRodW1icHJpbnRzIGluIHByb2R1Y3Rpb24nLFxuICAgICAgICB9LFxuICAgICAgXVxuICAgICk7XG4gIH1cbn0iXX0=