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
exports.PermissionSetsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const cdk_nag_1 = require("cdk-nag");
class PermissionSetsStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        this.permissionSets = {};
        // Define permission sets configuration
        const permissionSetConfigs = [
            {
                name: 'SecurityAuditor',
                description: 'Read-only access for security auditing and compliance',
                sessionDuration: cdk.Duration.hours(8),
                managedPolicies: [
                    'arn:aws:iam::aws:policy/SecurityAudit',
                    'arn:aws:iam::aws:policy/ReadOnlyAccess',
                ],
                inlinePolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            sid: 'SecurityAuditAccess',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'access-analyzer:*',
                                'config:*',
                                'cloudtrail:*',
                                'guardduty:*',
                                'securityhub:*',
                                'inspector:*',
                                'macie:*',
                                'detective:*',
                            ],
                            resources: ['*'],
                        }),
                        new iam.PolicyStatement({
                            sid: 'DenyDestructiveActions',
                            effect: iam.Effect.DENY,
                            actions: [
                                'ec2:TerminateInstances',
                                'ec2:DeleteVolume',
                                'ec2:DeleteSnapshot',
                                'rds:DeleteDBInstance',
                                'rds:DeleteDBCluster',
                                's3:DeleteBucket',
                                's3:DeleteObject',
                                'lambda:DeleteFunction',
                                'iam:DeleteRole',
                                'iam:DeleteUser',
                                'iam:DeletePolicy',
                                'iam:AttachUserPolicy',
                                'iam:AttachRolePolicy',
                                'iam:PutUserPolicy',
                                'iam:PutRolePolicy',
                            ],
                            resources: ['*'],
                        }),
                    ],
                }),
                tags: {
                    Role: 'SecurityAuditor',
                    AccessLevel: 'ReadOnly',
                },
            },
            {
                name: 'SecurityEngineer',
                description: 'Security engineering access with limited administrative permissions',
                sessionDuration: cdk.Duration.hours(8),
                managedPolicies: [
                    'arn:aws:iam::aws:policy/SecurityAudit',
                ],
                inlinePolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            sid: 'SecurityServicesManagement',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'guardduty:*',
                                'securityhub:*',
                                'config:*',
                                'cloudtrail:*',
                                'inspector:*',
                                'macie:*',
                            ],
                            resources: ['*'],
                        }),
                        new iam.PolicyStatement({
                            sid: 'SecurityGroupManagement',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'ec2:DescribeSecurityGroups',
                                'ec2:CreateSecurityGroup',
                                'ec2:AuthorizeSecurityGroupIngress',
                                'ec2:AuthorizeSecurityGroupEgress',
                                'ec2:RevokeSecurityGroupIngress',
                                'ec2:RevokeSecurityGroupEgress',
                                'ec2:CreateTags',
                            ],
                            resources: ['*'],
                            conditions: {
                                'StringEquals': {
                                    'aws:RequestedRegion': ['us-east-1', 'us-west-2'],
                                },
                            },
                        }),
                        new iam.PolicyStatement({
                            sid: 'IAMPolicyManagement',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'iam:GetPolicy',
                                'iam:GetPolicyVersion',
                                'iam:ListPolicyVersions',
                                'iam:CreatePolicy',
                                'iam:CreatePolicyVersion',
                                'iam:SetDefaultPolicyVersion',
                            ],
                            resources: [
                                `arn:aws:iam::${cdk.Stack.of(this).account}:policy/Security*`,
                                `arn:aws:iam::${cdk.Stack.of(this).account}:policy/Compliance*`,
                            ],
                        }),
                        new iam.PolicyStatement({
                            sid: 'DenyHighRiskActions',
                            effect: iam.Effect.DENY,
                            actions: [
                                'iam:DeleteRole',
                                'iam:DeleteUser',
                                'iam:DeletePolicy',
                                'iam:PutRolePolicy',
                                'iam:AttachRolePolicy',
                                'organizations:*',
                                'account:*',
                            ],
                            resources: ['*'],
                        }),
                    ],
                }),
                tags: {
                    Role: 'SecurityEngineer',
                    AccessLevel: 'Limited',
                },
            },
            {
                name: 'DeveloperReadOnly',
                description: 'Read-only access for developers to view resources',
                sessionDuration: cdk.Duration.hours(4),
                managedPolicies: [
                    'arn:aws:iam::aws:policy/ReadOnlyAccess',
                ],
                inlinePolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            sid: 'DeveloperReadAccess',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'logs:DescribeLogGroups',
                                'logs:DescribeLogStreams',
                                'logs:GetLogEvents',
                                'cloudwatch:GetMetricStatistics',
                                'cloudwatch:ListMetrics',
                                'xray:GetTraceSummaries',
                                'xray:BatchGetTraces',
                            ],
                            resources: ['*'],
                        }),
                        new iam.PolicyStatement({
                            sid: 'RestrictToDevResources',
                            effect: iam.Effect.DENY,
                            actions: ['*'],
                            resources: ['*'],
                            conditions: {
                                'StringNotEquals': {
                                    'aws:RequestedRegion': ['us-east-1', 'us-west-2'],
                                },
                                'StringNotLike': {
                                    'aws:ResourceTag/Environment': ['dev', 'development'],
                                },
                            },
                        }),
                    ],
                }),
                tags: {
                    Role: 'Developer',
                    AccessLevel: 'ReadOnly',
                    Environment: 'Development',
                },
            },
            {
                name: 'DevOpsEngineer',
                description: 'DevOps engineering access for CI/CD and infrastructure management',
                sessionDuration: cdk.Duration.hours(8),
                managedPolicies: [
                    'arn:aws:iam::aws:policy/PowerUserAccess',
                ],
                inlinePolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            sid: 'IAMReadAccess',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'iam:Get*',
                                'iam:List*',
                                'iam:PassRole',
                            ],
                            resources: ['*'],
                        }),
                        new iam.PolicyStatement({
                            sid: 'ServiceRoleManagement',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'iam:CreateRole',
                                'iam:AttachRolePolicy',
                                'iam:DetachRolePolicy',
                                'iam:PutRolePolicy',
                                'iam:DeleteRolePolicy',
                            ],
                            resources: [
                                `arn:aws:iam::${cdk.Stack.of(this).account}:role/service-role/*`,
                                `arn:aws:iam::${cdk.Stack.of(this).account}:role/aws-service-role/*`,
                                `arn:aws:iam::${cdk.Stack.of(this).account}:role/CodeBuild*`,
                                `arn:aws:iam::${cdk.Stack.of(this).account}:role/CodePipeline*`,
                                `arn:aws:iam::${cdk.Stack.of(this).account}:role/Lambda*`,
                            ],
                        }),
                        new iam.PolicyStatement({
                            sid: 'DenyHighPrivilegeOperations',
                            effect: iam.Effect.DENY,
                            actions: [
                                'iam:CreateUser',
                                'iam:DeleteUser',
                                'iam:CreateAccessKey',
                                'iam:DeleteAccessKey',
                                'iam:AttachUserPolicy',
                                'iam:DetachUserPolicy',
                                'organizations:*',
                                'account:*',
                            ],
                            resources: ['*'],
                        }),
                    ],
                }),
                tags: {
                    Role: 'DevOpsEngineer',
                    AccessLevel: 'PowerUser',
                },
            },
        ];
        // Create permission sets as IAM roles
        // Note: In a real AWS SSO setup, these would be created as Permission Sets
        // For this educational project, we simulate them as IAM roles
        permissionSetConfigs.forEach((config) => {
            const role = this.createPermissionSetRole(config, props);
            this.permissionSets[config.name] = role;
        });
        // Output permission set ARNs
        Object.entries(this.permissionSets).forEach(([name, role]) => {
            new cdk.CfnOutput(this, `${name}RoleArn`, {
                value: role.roleArn,
                description: `${name} Permission Set Role ARN`,
                exportName: `${props.environment}-${name.toLowerCase()}-role-arn`,
            });
        });
    }
    createPermissionSetRole(config, props) {
        const role = new iam.Role(this, `${config.name}Role`, {
            roleName: `${config.name}-${props.environment}`,
            description: config.description,
            assumedBy: new iam.CompositePrincipal(
            // Allow AWS SSO to assume this role
            new iam.ServicePrincipal('sso.amazonaws.com'), 
            // Allow federated users to assume this role
            new iam.FederatedPrincipal('arn:aws:iam::' + cdk.Stack.of(this).account + ':saml-provider/EnterpriseIdP-' + props.environment, {
                'StringEquals': {
                    'SAML:aud': 'https://signin.aws.amazon.com/saml',
                },
            }, 'sts:AssumeRoleWithSAML')),
            maxSessionDuration: config.sessionDuration,
            managedPolicies: config.managedPolicies?.map((policyArn) => iam.ManagedPolicy.fromManagedPolicyArn(this, `${config.name}-${policyArn.split('/').pop()}`, policyArn)),
            inlinePolicies: config.inlinePolicy
                ? {
                    [`${config.name}Policy`]: config.inlinePolicy,
                }
                : undefined,
        });
        // Add session tagging capability
        role.assumeRolePolicy?.addStatements(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('sso.amazonaws.com')],
            actions: ['sts:TagSession'],
            conditions: {
                'StringEquals': {
                    'aws:RequestedRegion': cdk.Stack.of(this).region,
                },
            },
        }));
        // Add tags to the role
        if (config.tags) {
            Object.entries(config.tags).forEach(([key, value]) => {
                cdk.Tags.of(role).add(key, value);
            });
        }
        // Add environment and project tags
        cdk.Tags.of(role).add('Environment', props.environment);
        cdk.Tags.of(role).add('Project', 'Multi-Identity-Provider-Federation');
        // CDK NAG suppressions
        cdk_nag_1.NagSuppressions.addResourceSuppressions(role, [
            {
                id: 'AwsSolutions-IAM4',
                reason: 'Managed policies are used intentionally for standard AWS permissions',
            },
            {
                id: 'AwsSolutions-IAM5',
                reason: 'Wildcard permissions are necessary for cross-service access in these roles',
            },
        ]);
        return role;
    }
}
exports.PermissionSetsStack = PermissionSetsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVybWlzc2lvbi1zZXRzLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicGVybWlzc2lvbi1zZXRzLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx5REFBMkM7QUFFM0MscUNBQTBDO0FBcUIxQyxNQUFhLG1CQUFvQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBR2hELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBK0I7UUFDdkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFIVixtQkFBYyxHQUFnQyxFQUFFLENBQUM7UUFLL0QsdUNBQXVDO1FBQ3ZDLE1BQU0sb0JBQW9CLEdBQTBCO1lBQ2xEO2dCQUNFLElBQUksRUFBRSxpQkFBaUI7Z0JBQ3ZCLFdBQVcsRUFBRSx1REFBdUQ7Z0JBQ3BFLGVBQWUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ3RDLGVBQWUsRUFBRTtvQkFDZix1Q0FBdUM7b0JBQ3ZDLHdDQUF3QztpQkFDekM7Z0JBQ0QsWUFBWSxFQUFFLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQztvQkFDbkMsVUFBVSxFQUFFO3dCQUNWLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQzs0QkFDdEIsR0FBRyxFQUFFLHFCQUFxQjs0QkFDMUIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSzs0QkFDeEIsT0FBTyxFQUFFO2dDQUNQLG1CQUFtQjtnQ0FDbkIsVUFBVTtnQ0FDVixjQUFjO2dDQUNkLGFBQWE7Z0NBQ2IsZUFBZTtnQ0FDZixhQUFhO2dDQUNiLFNBQVM7Z0NBQ1QsYUFBYTs2QkFDZDs0QkFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7eUJBQ2pCLENBQUM7d0JBQ0YsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDOzRCQUN0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Q0wsQ0FBQztRQUVELG1DQUFtQztRQUNuQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN4RCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLG9DQUFvQyxDQUFDLENBQUM7UUFFdkUsdUJBQXVCO1FBQ3ZCLHlCQUFlLENBQUMsdUJBQXVCLENBQ3JDLElBQUksRUFDSjtZQUNFO2dCQUNFLEVBQUUsRUFBRSxtQkFBbUI7Z0JBQ3ZCLE1BQU0sRUFBRSxzRUFBc0U7YUFDL0U7WUFDRDtnQkFDRSxFQUFFLEVBQUUsbUJBQW1CO2dCQUN2QixNQUFNLEVBQUUsNEVBQTRFO2FBQ3JGO1NBQ0YsQ0FDRixDQUFDO1FBRUYsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0NBQ0Y7QUFsVkQsa0RBa1ZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgTmFnU3VwcHJlc3Npb25zIH0gZnJvbSAnY2RrLW5hZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGVybWlzc2lvblNldHNTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBpZGVudGl0eUNlbnRlckFybjogc3RyaW5nO1xuICBjb25maWc6IHtcbiAgICBlbmFibGVDbG91ZFRyYWlsOiBib29sZWFuO1xuICAgIGVuYWJsZUd1YXJkRHV0eTogYm9vbGVhbjtcbiAgICByZXRlbnRpb25EYXlzOiBudW1iZXI7XG4gIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGVybWlzc2lvblNldENvbmZpZyB7XG4gIG5hbWU6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgc2Vzc2lvbkR1cmF0aW9uOiBjZGsuRHVyYXRpb247XG4gIG1hbmFnZWRQb2xpY2llcz86IHN0cmluZ1tdO1xuICBpbmxpbmVQb2xpY3k/OiBpYW0uUG9saWN5RG9jdW1lbnQ7XG4gIHRhZ3M/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9O1xufVxuXG5leHBvcnQgY2xhc3MgUGVybWlzc2lvblNldHNTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBwZXJtaXNzaW9uU2V0czogeyBba2V5OiBzdHJpbmddOiBpYW0uUm9sZSB9ID0ge307XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFBlcm1pc3Npb25TZXRzU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gRGVmaW5lIHBlcm1pc3Npb24gc2V0cyBjb25maWd1cmF0aW9uXG4gICAgY29uc3QgcGVybWlzc2lvblNldENvbmZpZ3M6IFBlcm1pc3Npb25TZXRDb25maWdbXSA9IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ1NlY3VyaXR5QXVkaXRvcicsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnUmVhZC1vbmx5IGFjY2VzcyBmb3Igc2VjdXJpdHkgYXVkaXRpbmcgYW5kIGNvbXBsaWFuY2UnLFxuICAgICAgICBzZXNzaW9uRHVyYXRpb246IGNkay5EdXJhdGlvbi5ob3Vycyg4KSxcbiAgICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgICAgJ2Fybjphd3M6aWFtOjphd3M6cG9saWN5L1NlY3VyaXR5QXVkaXQnLFxuICAgICAgICAgICdhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9SZWFkT25seUFjY2VzcycsXG4gICAgICAgIF0sXG4gICAgICAgIGlubGluZVBvbGljeTogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBzaWQ6ICdTZWN1cml0eUF1ZGl0QWNjZXNzJyxcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2FjY2Vzcy1hbmFseXplcjoqJyxcbiAgICAgICAgICAgICAgICAnY29uZmlnOionLFxuICAgICAgICAgICAgICAgICdjbG91ZHRyYWlsOionLFxuICAgICAgICAgICAgICAgICdndWFyZGR1dHk6KicsXG4gICAgICAgICAgICAgICAgJ3NlY3VyaXR5aHViOionLFxuICAgICAgICAgICAgICAgICdpbnNwZWN0b3I6KicsXG4gICAgICAgICAgICAgICAgJ21hY2llOionLFxuICAgICAgICAgICAgICAgICdkZXRlY3RpdmU6KicsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgc2lkOiAnRGVueURlc3RydWN0aXZlQWN0aW9ucycsXG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5ERU5ZLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2VjMjpUZXJtaW5hdGVJbnN0YW5jZXMnLFxuICAgICAgICAgICAgICAgICdlYzI6RGVsZXRlVm9sdW1lJyxcbiAgICAgICAgICAgICAgICAnZWMyOkRlbGV0ZVNuYXBzaG90JyxcbiAgICAgICAgICAgICAgICAncmRzOkRlbGV0ZURCSW5zdGFuY2UnLFxuICAgICAgICAgICAgICAgICdyZHM6RGVsZXRlREJDbHVzdGVyJyxcbiAgICAgICAgICAgICAgICAnczM6RGVsZXRlQnVja2V0JyxcbiAgICAgICAgICAgICAgICAnczM6RGVsZXRlT2JqZWN0JyxcbiAgICAgICAgICAgICAgICAnbGFtYmRhOkRlbGV0ZUZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgICAnaWFtOkRlbGV0ZVJvbGUnLFxuICAgICAgICAgICAgICAgICdpYW06RGVsZXRlVXNlcicsXG4gICAgICAgICAgICAgICAgJ2lhbTpEZWxldGVQb2xpY3knLFxuICAgICAgICAgICAgICAgICdpYW06QXR0YWNoVXNlclBvbGljeScsXG4gICAgICAgICAgICAgICAgJ2lhbTpBdHRhY2hSb2xlUG9saWN5JyxcbiAgICAgICAgICAgICAgICAnaWFtOlB1dFVzZXJQb2xpY3knLFxuICAgICAgICAgICAgICAgICdpYW06UHV0Um9sZVBvbGljeScsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgICAgdGFnczoge1xuICAgICAgICAgIFJvbGU6ICdTZWN1cml0eUF1ZGl0b3InLFxuICAgICAgICAgIEFjY2Vzc0xldmVsOiAnUmVhZE9ubHknLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ1NlY3VyaXR5RW5naW5lZXInLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGVuZ2luZWVyaW5nIGFjY2VzcyB3aXRoIGxpbWl0ZWQgYWRtaW5pc3RyYXRpdmUgcGVybWlzc2lvbnMnLFxuICAgICAgICBzZXNzaW9uRHVyYXRpb246IGNkay5EdXJhdGlvbi5ob3Vycyg4KSxcbiAgICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgICAgJ2Fybjphd3M6aWFtOjphd3M6cG9saWN5L1NlY3VyaXR5QXVkaXQnLFxuICAgICAgICBdLFxuICAgICAgICBpbmxpbmVQb2xpY3k6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgc2lkOiAnU2VjdXJpdHlTZXJ2aWNlc01hbmFnZW1lbnQnLFxuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnZ3VhcmRkdXR5OionLFxuICAgICAgICAgICAgICAgICdzZWN1cml0eWh1YjoqJyxcbiAgICAgICAgICAgICAgICAnY29uZmlnOionLFxuICAgICAgICAgICAgICAgICdjbG91ZHRyYWlsOionLFxuICAgICAgICAgICAgICAgICdpbnNwZWN0b3I6KicsXG4gICAgICAgICAgICAgICAgJ21hY2llOionLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIHNpZDogJ1NlY3VyaXR5R3JvdXBNYW5hZ2VtZW50JyxcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2VjMjpEZXNjcmliZVNlY3VyaXR5R3JvdXBzJyxcbiAgICAgICAgICAgICAgICAnZWMyOkNyZWF0ZVNlY3VyaXR5R3JvdXAnLFxuICAgICAgICAgICAgICAgICdlYzI6QXV0aG9yaXplU2VjdXJpdHlHcm91cEluZ3Jlc3MnLFxuICAgICAgICAgICAgICAgICdlYzI6QXV0aG9yaXplU2VjdXJpdHlHcm91cEVncmVzcycsXG4gICAgICAgICAgICAgICAgJ2VjMjpSZXZva2VTZWN1cml0eUdyb3VwSW5ncmVzcycsXG4gICAgICAgICAgICAgICAgJ2VjMjpSZXZva2VTZWN1cml0eUdyb3VwRWdyZXNzJyxcbiAgICAgICAgICAgICAgICAnZWMyOkNyZWF0ZVRhZ3MnLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgICAgICAgICAgJ1N0cmluZ0VxdWFscyc6IHtcbiAgICAgICAgICAgICAgICAgICdhd3M6UmVxdWVzdGVkUmVnaW9uJzogWyd1cy1lYXN0LTEnLCAndXMtd2VzdC0yJ10sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBzaWQ6ICdJQU1Qb2xpY3lNYW5hZ2VtZW50JyxcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2lhbTpHZXRQb2xpY3knLFxuICAgICAgICAgICAgICAgICdpYW06R2V0UG9saWN5VmVyc2lvbicsXG4gICAgICAgICAgICAgICAgJ2lhbTpMaXN0UG9saWN5VmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICdpYW06Q3JlYXRlUG9saWN5JyxcbiAgICAgICAgICAgICAgICAnaWFtOkNyZWF0ZVBvbGljeVZlcnNpb24nLFxuICAgICAgICAgICAgICAgICdpYW06U2V0RGVmYXVsdFBvbGljeVZlcnNpb24nLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgYXJuOmF3czppYW06OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9OnBvbGljeS9TZWN1cml0eSpgLFxuICAgICAgICAgICAgICAgIGBhcm46YXdzOmlhbTo6JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06cG9saWN5L0NvbXBsaWFuY2UqYCxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBzaWQ6ICdEZW55SGlnaFJpc2tBY3Rpb25zJyxcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkRFTlksXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnaWFtOkRlbGV0ZVJvbGUnLFxuICAgICAgICAgICAgICAgICdpYW06RGVsZXRlVXNlcicsXG4gICAgICAgICAgICAgICAgJ2lhbTpEZWxldGVQb2xpY3knLFxuICAgICAgICAgICAgICAgICdpYW06UHV0Um9sZVBvbGljeScsXG4gICAgICAgICAgICAgICAgJ2lhbTpBdHRhY2hSb2xlUG9saWN5JyxcbiAgICAgICAgICAgICAgICAnb3JnYW5pemF0aW9uczoqJyxcbiAgICAgICAgICAgICAgICAnYWNjb3VudDoqJyxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgICB0YWdzOiB7XG4gICAgICAgICAgUm9sZTogJ1NlY3VyaXR5RW5naW5lZXInLFxuICAgICAgICAgIEFjY2Vzc0xldmVsOiAnTGltaXRlZCcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnRGV2ZWxvcGVyUmVhZE9ubHknLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1JlYWQtb25seSBhY2Nlc3MgZm9yIGRldmVsb3BlcnMgdG8gdmlldyByZXNvdXJjZXMnLFxuICAgICAgICBzZXNzaW9uRHVyYXRpb246IGNkay5EdXJhdGlvbi5ob3Vycyg0KSxcbiAgICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgICAgJ2Fybjphd3M6aWFtOjphd3M6cG9saWN5L1JlYWRPbmx5QWNjZXNzJyxcbiAgICAgICAgXSxcbiAgICAgICAgaW5saW5lUG9saWN5OiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIHNpZDogJ0RldmVsb3BlclJlYWRBY2Nlc3MnLFxuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnbG9nczpEZXNjcmliZUxvZ0dyb3VwcycsXG4gICAgICAgICAgICAgICAgJ2xvZ3M6RGVzY3JpYmVMb2dTdHJlYW1zJyxcbiAgICAgICAgICAgICAgICAnbG9nczpHZXRMb2dFdmVudHMnLFxuICAgICAgICAgICAgICAgICdjbG91ZHdhdGNoOkdldE1ldHJpY1N0YXRpc3RpY3MnLFxuICAgICAgICAgICAgICAgICdjbG91ZHdhdGNoOkxpc3RNZXRyaWNzJyxcbiAgICAgICAgICAgICAgICAneHJheTpHZXRUcmFjZVN1bW1hcmllcycsXG4gICAgICAgICAgICAgICAgJ3hyYXk6QmF0Y2hHZXRUcmFjZXMnLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIHNpZDogJ1Jlc3RyaWN0VG9EZXZSZXNvdXJjZXMnLFxuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuREVOWSxcbiAgICAgICAgICAgICAgYWN0aW9uczogWycqJ10sXG4gICAgICAgICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICAgICAgICAgIGNvbmRpdGlvbnM6IHtcbiAgICAgICAgICAgICAgICAnU3RyaW5nTm90RXF1YWxzJzoge1xuICAgICAgICAgICAgICAgICAgJ2F3czpSZXF1ZXN0ZWRSZWdpb24nOiBbJ3VzLWVhc3QtMScsICd1cy13ZXN0LTInXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICdTdHJpbmdOb3RMaWtlJzoge1xuICAgICAgICAgICAgICAgICAgJ2F3czpSZXNvdXJjZVRhZy9FbnZpcm9ubWVudCc6IFsnZGV2JywgJ2RldmVsb3BtZW50J10sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgICB0YWdzOiB7XG4gICAgICAgICAgUm9sZTogJ0RldmVsb3BlcicsXG4gICAgICAgICAgQWNjZXNzTGV2ZWw6ICdSZWFkT25seScsXG4gICAgICAgICAgRW52aXJvbm1lbnQ6ICdEZXZlbG9wbWVudCcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnRGV2T3BzRW5naW5lZXInLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0Rldk9wcyBlbmdpbmVlcmluZyBhY2Nlc3MgZm9yIENJL0NEIGFuZCBpbmZyYXN0cnVjdHVyZSBtYW5hZ2VtZW50JyxcbiAgICAgICAgc2Vzc2lvbkR1cmF0aW9uOiBjZGsuRHVyYXRpb24uaG91cnMoOCksXG4gICAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICAgICdhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9Qb3dlclVzZXJBY2Nlc3MnLFxuICAgICAgICBdLFxuICAgICAgICBpbmxpbmVQb2xpY3k6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgc2lkOiAnSUFNUmVhZEFjY2VzcycsXG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdpYW06R2V0KicsXG4gICAgICAgICAgICAgICAgJ2lhbTpMaXN0KicsXG4gICAgICAgICAgICAgICAgJ2lhbTpQYXNzUm9sZScsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgc2lkOiAnU2VydmljZVJvbGVNYW5hZ2VtZW50JyxcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2lhbTpDcmVhdGVSb2xlJyxcbiAgICAgICAgICAgICAgICAnaWFtOkF0dGFjaFJvbGVQb2xpY3knLFxuICAgICAgICAgICAgICAgICdpYW06RGV0YWNoUm9sZVBvbGljeScsXG4gICAgICAgICAgICAgICAgJ2lhbTpQdXRSb2xlUG9saWN5JyxcbiAgICAgICAgICAgICAgICAnaWFtOkRlbGV0ZVJvbGVQb2xpY3knLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgYXJuOmF3czppYW06OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9OnJvbGUvc2VydmljZS1yb2xlLypgLFxuICAgICAgICAgICAgICAgIGBhcm46YXdzOmlhbTo6JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06cm9sZS9hd3Mtc2VydmljZS1yb2xlLypgLFxuICAgICAgICAgICAgICAgIGBhcm46YXdzOmlhbTo6JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06cm9sZS9Db2RlQnVpbGQqYCxcbiAgICAgICAgICAgICAgICBgYXJuOmF3czppYW06OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9OnJvbGUvQ29kZVBpcGVsaW5lKmAsXG4gICAgICAgICAgICAgICAgYGFybjphd3M6aWFtOjoke2Nkay5TdGFjay5vZih0aGlzKS5hY2NvdW50fTpyb2xlL0xhbWJkYSpgLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIHNpZDogJ0RlbnlIaWdoUHJpdmlsZWdlT3BlcmF0aW9ucycsXG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5ERU5ZLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2lhbTpDcmVhdGVVc2VyJyxcbiAgICAgICAgICAgICAgICAnaWFtOkRlbGV0ZVVzZXInLFxuICAgICAgICAgICAgICAgICdpYW06Q3JlYXRlQWNjZXNzS2V5JyxcbiAgICAgICAgICAgICAgICAnaWFtOkRlbGV0ZUFjY2Vzc0tleScsXG4gICAgICAgICAgICAgICAgJ2lhbTpBdHRhY2hVc2VyUG9saWN5JyxcbiAgICAgICAgICAgICAgICAnaWFtOkRldGFjaFVzZXJQb2xpY3knLFxuICAgICAgICAgICAgICAgICdvcmdhbml6YXRpb25zOionLFxuICAgICAgICAgICAgICAgICdhY2NvdW50OionLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICAgIHRhZ3M6IHtcbiAgICAgICAgICBSb2xlOiAnRGV2T3BzRW5naW5lZXInLFxuICAgICAgICAgIEFjY2Vzc0xldmVsOiAnUG93ZXJVc2VyJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgXTtcblxuICAgIC8vIENyZWF0ZSBwZXJtaXNzaW9uIHNldHMgYXMgSUFNIHJvbGVzXG4gICAgLy8gTm90ZTogSW4gYSByZWFsIEFXUyBTU08gc2V0dXAsIHRoZXNlIHdvdWxkIGJlIGNyZWF0ZWQgYXMgUGVybWlzc2lvbiBTZXRzXG4gICAgLy8gRm9yIHRoaXMgZWR1Y2F0aW9uYWwgcHJvamVjdCwgd2Ugc2ltdWxhdGUgdGhlbSBhcyBJQU0gcm9sZXNcbiAgICBwZXJtaXNzaW9uU2V0Q29uZmlncy5mb3JFYWNoKChjb25maWcpID0+IHtcbiAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLmNyZWF0ZVBlcm1pc3Npb25TZXRSb2xlKGNvbmZpZywgcHJvcHMpO1xuICAgICAgdGhpcy5wZXJtaXNzaW9uU2V0c1tjb25maWcubmFtZV0gPSByb2xlO1xuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IHBlcm1pc3Npb24gc2V0IEFSTnNcbiAgICBPYmplY3QuZW50cmllcyh0aGlzLnBlcm1pc3Npb25TZXRzKS5mb3JFYWNoKChbbmFtZSwgcm9sZV0pID0+IHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGAke25hbWV9Um9sZUFybmAsIHtcbiAgICAgICAgdmFsdWU6IHJvbGUucm9sZUFybixcbiAgICAgICAgZGVzY3JpcHRpb246IGAke25hbWV9IFBlcm1pc3Npb24gU2V0IFJvbGUgQVJOYCxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMuZW52aXJvbm1lbnR9LSR7bmFtZS50b0xvd2VyQ2FzZSgpfS1yb2xlLWFybmAsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUGVybWlzc2lvblNldFJvbGUoXG4gICAgY29uZmlnOiBQZXJtaXNzaW9uU2V0Q29uZmlnLFxuICAgIHByb3BzOiBQZXJtaXNzaW9uU2V0c1N0YWNrUHJvcHNcbiAgKTogaWFtLlJvbGUge1xuICAgIGNvbnN0IHJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgYCR7Y29uZmlnLm5hbWV9Um9sZWAsIHtcbiAgICAgIHJvbGVOYW1lOiBgJHtjb25maWcubmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgZGVzY3JpcHRpb246IGNvbmZpZy5kZXNjcmlwdGlvbixcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5Db21wb3NpdGVQcmluY2lwYWwoXG4gICAgICAgIC8vIEFsbG93IEFXUyBTU08gdG8gYXNzdW1lIHRoaXMgcm9sZVxuICAgICAgICBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ3Nzby5hbWF6b25hd3MuY29tJyksXG4gICAgICAgIC8vIEFsbG93IGZlZGVyYXRlZCB1c2VycyB0byBhc3N1bWUgdGhpcyByb2xlXG4gICAgICAgIG5ldyBpYW0uRmVkZXJhdGVkUHJpbmNpcGFsKFxuICAgICAgICAgICdhcm46YXdzOmlhbTo6JyArIGNkay5TdGFjay5vZih0aGlzKS5hY2NvdW50ICsgJzpzYW1sLXByb3ZpZGVyL0VudGVycHJpc2VJZFAtJyArIHByb3BzLmVudmlyb25tZW50LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgICdTdHJpbmdFcXVhbHMnOiB7XG4gICAgICAgICAgICAgICdTQU1MOmF1ZCc6ICdodHRwczovL3NpZ25pbi5hd3MuYW1hem9uLmNvbS9zYW1sJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnc3RzOkFzc3VtZVJvbGVXaXRoU0FNTCdcbiAgICAgICAgKVxuICAgICAgKSxcbiAgICAgIG1heFNlc3Npb25EdXJhdGlvbjogY29uZmlnLnNlc3Npb25EdXJhdGlvbixcbiAgICAgIG1hbmFnZWRQb2xpY2llczogY29uZmlnLm1hbmFnZWRQb2xpY2llcz8ubWFwKChwb2xpY3lBcm4pID0+XG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21NYW5hZ2VkUG9saWN5QXJuKHRoaXMsIGAke2NvbmZpZy5uYW1lfS0ke3BvbGljeUFybi5zcGxpdCgnLycpLnBvcCgpfWAsIHBvbGljeUFybilcbiAgICAgICksXG4gICAgICBpbmxpbmVQb2xpY2llczogY29uZmlnLmlubGluZVBvbGljeVxuICAgICAgICA/IHtcbiAgICAgICAgICAgIFtgJHtjb25maWcubmFtZX1Qb2xpY3lgXTogY29uZmlnLmlubGluZVBvbGljeSxcbiAgICAgICAgICB9XG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHNlc3Npb24gdGFnZ2luZyBjYXBhYmlsaXR5XG4gICAgcm9sZS5hc3N1bWVSb2xlUG9saWN5Py5hZGRTdGF0ZW1lbnRzKFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ3Nzby5hbWF6b25hd3MuY29tJyldLFxuICAgICAgICBhY3Rpb25zOiBbJ3N0czpUYWdTZXNzaW9uJ10sXG4gICAgICAgIGNvbmRpdGlvbnM6IHtcbiAgICAgICAgICAnU3RyaW5nRXF1YWxzJzoge1xuICAgICAgICAgICAgJ2F3czpSZXF1ZXN0ZWRSZWdpb24nOiBjZGsuU3RhY2sub2YodGhpcykucmVnaW9uLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBBZGQgdGFncyB0byB0aGUgcm9sZVxuICAgIGlmIChjb25maWcudGFncykge1xuICAgICAgT2JqZWN0LmVudHJpZXMoY29uZmlnLnRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgICBjZGsuVGFncy5vZihyb2xlKS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBZGQgZW52aXJvbm1lbnQgYW5kIHByb2plY3QgdGFnc1xuICAgIGNkay5UYWdzLm9mKHJvbGUpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZpcm9ubWVudCk7XG4gICAgY2RrLlRhZ3Mub2Yocm9sZSkuYWRkKCdQcm9qZWN0JywgJ011bHRpLUlkZW50aXR5LVByb3ZpZGVyLUZlZGVyYXRpb24nKTtcblxuICAgIC8vIENESyBOQUcgc3VwcHJlc3Npb25zXG4gICAgTmFnU3VwcHJlc3Npb25zLmFkZFJlc291cmNlU3VwcHJlc3Npb25zKFxuICAgICAgcm9sZSxcbiAgICAgIFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnQXdzU29sdXRpb25zLUlBTTQnLFxuICAgICAgICAgIHJlYXNvbjogJ01hbmFnZWQgcG9saWNpZXMgYXJlIHVzZWQgaW50ZW50aW9uYWxseSBmb3Igc3RhbmRhcmQgQVdTIHBlcm1pc3Npb25zJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnQXdzU29sdXRpb25zLUlBTTUnLFxuICAgICAgICAgIHJlYXNvbjogJ1dpbGRjYXJkIHBlcm1pc3Npb25zIGFyZSBuZWNlc3NhcnkgZm9yIGNyb3NzLXNlcnZpY2UgYWNjZXNzIGluIHRoZXNlIHJvbGVzJyxcbiAgICAgICAgfSxcbiAgICAgIF1cbiAgICApO1xuXG4gICAgcmV0dXJuIHJvbGU7XG4gIH1cbn0iXX0=