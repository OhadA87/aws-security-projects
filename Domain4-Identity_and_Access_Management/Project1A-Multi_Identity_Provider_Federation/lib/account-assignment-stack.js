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
exports.AccountAssignmentStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class AccountAssignmentStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        this.assignmentRoles = {};
        // Define account assignments configuration
        const accountAssignments = [
            {
                accountId: cdk.Stack.of(this).account, // Current account for demo
                accountName: 'Security-Dev',
                environment: 'development',
                permissionSets: ['SecurityAuditor', 'DeveloperReadOnly'],
                principalType: 'GROUP',
                principalName: 'SecurityTeam',
            },
            {
                accountId: cdk.Stack.of(this).account,
                accountName: 'Security-Staging',
                environment: 'staging',
                permissionSets: ['SecurityEngineer', 'DevOpsEngineer'],
                principalType: 'GROUP',
                principalName: 'PlatformTeam',
            },
            {
                accountId: cdk.Stack.of(this).account,
                accountName: 'Security-Prod',
                environment: 'production',
                permissionSets: ['SecurityAuditor'],
                principalType: 'GROUP',
                principalName: 'SecurityAuditors',
            },
        ];
        // Create cross-account roles for each assignment
        accountAssignments.forEach((assignment, index) => {
            this.createAccountAssignmentRoles(assignment, props, index);
        });
        // Create logging for account assignments
        this.createAssignmentLogging(props);
        // Create emergency access break-glass role
        this.createBreakGlassRole(props);
    }
    createAccountAssignmentRoles(assignment, props, index) {
        assignment.permissionSets.forEach((permissionSetName) => {
            const baseRole = props.permissionSets[permissionSetName];
            if (!baseRole) {
                throw new Error(`Permission set ${permissionSetName} not found`);
            }
            // Create cross-account access role
            const crossAccountRole = new iam.Role(this, `CrossAccount-${assignment.accountName}-${permissionSetName}-${index}`, {
                roleName: `CrossAccount-${assignment.accountName}-${permissionSetName}-${props.environment}`,
                description: `Cross-account access role for ${assignment.principalName} in ${assignment.accountName}`,
                assumedBy: new iam.CompositePrincipal(
                // Allow the base permission set role to assume this role
                new iam.ArnPrincipal(baseRole.roleArn), 
                // Allow direct federated access
                new iam.FederatedPrincipal('arn:aws:iam::' + cdk.Stack.of(this).account + ':saml-provider/EnterpriseIdP-' + props.environment, {
                    'StringEquals': {
                        'SAML:aud': 'https://signin.aws.amazon.com/saml',
                        'SAML:department': assignment.principalName,
                    },
                    'StringLike': {
                        'SAML:environment': assignment.environment,
                    },
                }, 'sts:AssumeRoleWithSAML')),
                maxSessionDuration: cdk.Duration.hours(8),
                externalIds: [`${assignment.accountId}-${assignment.environment}`],
                inlinePolicies: {
                    AccountSpecificPolicy: new iam.PolicyDocument({
                        statements: [
                            new iam.PolicyStatement({
                                sid: 'EnforceAccountBoundary',
                                effect: iam.Effect.DENY,
                                actions: ['*'],
                                resources: ['*'],
                                conditions: {
                                    'StringNotEquals': {
                                        'aws:RequestedRegion': ['us-east-1', 'us-west-2'],
                                    },
                                },
                            }),
                            new iam.PolicyStatement({
                                sid: 'RequireEnvironmentTag',
                                effect: iam.Effect.DENY,
                                actions: [
                                    'ec2:RunInstances',
                                    's3:CreateBucket',
                                    'rds:CreateDBInstance',
                                    'lambda:CreateFunction',
                                ],
                                resources: ['*'],
                                conditions: {
                                    'StringNotEquals': {
                                        'aws:RequestTag/Environment': assignment.environment,
                                    },
                                },
                            }),
                            new iam.PolicyStatement({
                                sid: 'AllowAssumeRoleInAccount',
                                effect: iam.Effect.ALLOW,
                                actions: ['sts:AssumeRole'],
                                resources: [`arn:aws:iam::${assignment.accountId}:role/*`],
                                conditions: {
                                    'StringEquals': {
                                        'sts:ExternalId': `${assignment.accountId}-${assignment.environment}`,
                                    },
                                },
                            }),
                        ],
                    }),
                },
            });
            // Add session tagging for attribute-based access control
            crossAccountRole.assumeRolePolicy?.addStatements(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                principals: [new iam.ArnPrincipal(baseRole.roleArn)],
                actions: ['sts:AssumeRole', 'sts:TagSession'],
                conditions: {
                    'StringEquals': {
                        'aws:PrincipalTag/Department': assignment.principalName,
                        'aws:PrincipalTag/Environment': assignment.environment,
                    },
                },
            }));
            // Tag the role
            cdk.Tags.of(crossAccountRole).add('AccountId', assignment.accountId);
            cdk.Tags.of(crossAccountRole).add('AccountName', assignment.accountName);
            cdk.Tags.of(crossAccountRole).add('PrincipalType', assignment.principalType);
            cdk.Tags.of(crossAccountRole).add('PrincipalName', assignment.principalName);
            cdk.Tags.of(crossAccountRole).add('PermissionSet', permissionSetName);
            cdk.Tags.of(crossAccountRole).add('Environment', props.environment);
            this.assignmentRoles[`${assignment.accountName}-${permissionSetName}`] = crossAccountRole;
            // Output
            new cdk.CfnOutput(this, `${assignment.accountName}-${permissionSetName}-RoleArn`, {
                value: crossAccountRole.roleArn,
                description: `Cross-account role ARN for ${assignment.accountName} - ${permissionSetName}`,
                exportName: `${props.environment}-${assignment.accountName.toLowerCase()}-${permissionSetName.toLowerCase()}-role-arn`,
            });
        });
    }
    createAssignmentLogging(props) {
        // CloudWatch Log Group for account assignment activities
        const assignmentLogGroup = new logs.LogGroup(this, 'AccountAssignmentLogGroup', {
            logGroupName: `/aws/identitycenter/assignments/${props.environment}`,
            retention: props.config.retentionDays,
            removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // CloudWatch Log Stream for different assignment types
        new logs.LogStream(this, 'AssignmentSuccessLogStream', {
            logGroup: assignmentLogGroup,
            logStreamName: 'assignment-success',
        });
        new logs.LogStream(this, 'AssignmentFailureLogStream', {
            logGroup: assignmentLogGroup,
            logStreamName: 'assignment-failure',
        });
        new logs.LogStream(this, 'SessionTaggingLogStream', {
            logGroup: assignmentLogGroup,
            logStreamName: 'session-tagging',
        });
        // Output
        new cdk.CfnOutput(this, 'AssignmentLogGroupArn', {
            value: assignmentLogGroup.logGroupArn,
            description: 'Account Assignment Log Group ARN',
            exportName: `${props.environment}-assignment-log-group-arn`,
        });
    }
    createBreakGlassRole(props) {
        // Emergency break-glass role for critical incidents
        const breakGlassRole = new iam.Role(this, 'BreakGlassRole', {
            roleName: `BreakGlass-Emergency-${props.environment}`,
            description: 'Emergency break-glass role for critical incidents - requires MFA and approval',
            assumedBy: new iam.CompositePrincipal(
            // Only allow specific emergency users
            new iam.FederatedPrincipal('arn:aws:iam::' + this.account + ':saml-provider/EnterpriseIdP-' + props.environment, {
                'StringEquals': {
                    'SAML:aud': 'https://signin.aws.amazon.com/saml',
                    'SAML:role': 'EmergencyAdmin',
                },
                'Bool': {
                    'aws:MultiFactorAuthPresent': 'true',
                },
                'NumericLessThan': {
                    'aws:MultiFactorAuthAge': '3600', // MFA within last hour
                },
            }, 'sts:AssumeRoleWithSAML')),
            maxSessionDuration: cdk.Duration.hours(1), // Short session duration
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
            ],
            inlinePolicies: {
                BreakGlassLogging: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            sid: 'RequireCloudTrailLogging',
                            effect: iam.Effect.DENY,
                            actions: [
                                'cloudtrail:StopLogging',
                                'cloudtrail:DeleteTrail',
                                'cloudtrail:PutEventSelectors',
                            ],
                            resources: ['*'],
                        }),
                        new iam.PolicyStatement({
                            sid: 'RequireIncidentLogging',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'logs:CreateLogStream',
                                'logs:PutLogEvents',
                            ],
                            resources: [
                                `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/emergency/*`,
                            ],
                        }),
                    ],
                }),
            },
        });
        // Add emergency session tagging
        breakGlassRole.assumeRolePolicy?.addStatements(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('sso.amazonaws.com')],
            actions: ['sts:TagSession'],
            conditions: {
                'ForAllValues:StringEquals': {
                    'aws:PrincipalTag/EmergencyAccess': 'true',
                    'aws:PrincipalTag/IncidentId': '*',
                },
            },
        }));
        // Tag the break-glass role
        cdk.Tags.of(breakGlassRole).add('AccessType', 'Emergency');
        cdk.Tags.of(breakGlassRole).add('RequiresMFA', 'true');
        cdk.Tags.of(breakGlassRole).add('MaxDuration', '1hour');
        cdk.Tags.of(breakGlassRole).add('Environment', props.environment);
        // Output
        new cdk.CfnOutput(this, 'BreakGlassRoleArn', {
            value: breakGlassRole.roleArn,
            description: 'Emergency Break-Glass Role ARN',
            exportName: `${props.environment}-break-glass-role-arn`,
        });
    }
}
exports.AccountAssignmentStack = AccountAssignmentStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWNjb3VudC1hc3NpZ25tZW50LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWNjb3VudC1hc3NpZ25tZW50LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx5REFBMkM7QUFDM0MsMkRBQTZDO0FBd0I3QyxNQUFhLHNCQUF1QixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBR25ELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBa0M7UUFDMUUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFIVixvQkFBZSxHQUFnQyxFQUFFLENBQUM7UUFLaEUsMkNBQTJDO1FBQzNDLE1BQU0sa0JBQWtCLEdBQXdCO1lBQzlDO2dCQUNFLFNBQVMsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEVBQUUsMkJBQTJCO2dCQUNsRSxXQUFXLEVBQUUsY0FBYztnQkFDM0IsV0FBVyxFQUFFLGFBQWE7Z0JBQzFCLGNBQWMsRUFBRSxDQUFDLGlCQUFpQixFQUFFLG1CQUFtQixDQUFDO2dCQUN4RCxhQUFhLEVBQUUsT0FBTztnQkFDdEIsYUFBYSxFQUFFLGNBQWM7YUFDOUI7WUFDRDtnQkFDRSxTQUFTLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTztnQkFDckMsV0FBVyxFQUFFLGtCQUFrQjtnQkFDL0IsV0FBVyxFQUFFLFNBQVM7Z0JBQ3RCLGNBQWMsRUFBRSxDQUFDLGtCQUFrQixFQUFFLGdCQUFnQixDQUFDO2dCQUN0RCxhQUFhLEVBQUUsT0FBTztnQkFDdEIsYUFBYSxFQUFFLGNBQWM7YUFDOUI7WUFDRDtnQkFDRSxTQUFTLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMs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RSxHQUFHO2lCQUNuQzthQUNGO1NBQ0YsQ0FBQyxDQUNILENBQUM7UUFFRiwyQkFBMkI7UUFDM0IsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxXQUFXLENBQUMsQ0FBQztRQUMzRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDeEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFbEUsU0FBUztRQUNULElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLGNBQWMsQ0FBQyxPQUFPO1lBQzdCLFdBQVcsRUFBRSxnQ0FBZ0M7WUFDN0MsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLFdBQVcsdUJBQXVCO1NBQ3hELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTFSRCx3REEwUkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBBY2NvdW50QXNzaWdubWVudFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIGlkZW50aXR5Q2VudGVyQXJuOiBzdHJpbmc7XG4gIHBlcm1pc3Npb25TZXRzOiB7IFtrZXk6IHN0cmluZ106IGlhbS5Sb2xlIH07XG4gIGNvbmZpZzoge1xuICAgIGVuYWJsZUNsb3VkVHJhaWw6IGJvb2xlYW47XG4gICAgZW5hYmxlR3VhcmREdXR5OiBib29sZWFuO1xuICAgIHJldGVudGlvbkRheXM6IG51bWJlcjtcbiAgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBY2NvdW50QXNzaWdubWVudCB7XG4gIGFjY291bnRJZDogc3RyaW5nO1xuICBhY2NvdW50TmFtZTogc3RyaW5nO1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBwZXJtaXNzaW9uU2V0czogc3RyaW5nW107XG4gIHByaW5jaXBhbFR5cGU6ICdVU0VSJyB8ICdHUk9VUCc7XG4gIHByaW5jaXBhbE5hbWU6IHN0cmluZztcbiAgY29uZGl0aW9ucz86IHsgW2tleTogc3RyaW5nXTogYW55IH07XG59XG5cbmV4cG9ydCBjbGFzcyBBY2NvdW50QXNzaWdubWVudFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGFzc2lnbm1lbnRSb2xlczogeyBba2V5OiBzdHJpbmddOiBpYW0uUm9sZSB9ID0ge307XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEFjY291bnRBc3NpZ25tZW50U3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gRGVmaW5lIGFjY291bnQgYXNzaWdubWVudHMgY29uZmlndXJhdGlvblxuICAgIGNvbnN0IGFjY291bnRBc3NpZ25tZW50czogQWNjb3VudEFzc2lnbm1lbnRbXSA9IFtcbiAgICAgIHtcbiAgICAgICAgYWNjb3VudElkOiBjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudCwgLy8gQ3VycmVudCBhY2NvdW50IGZvciBkZW1vXG4gICAgICAgIGFjY291bnROYW1lOiAnU2VjdXJpdHktRGV2JyxcbiAgICAgICAgZW52aXJvbm1lbnQ6ICdkZXZlbG9wbWVudCcsXG4gICAgICAgIHBlcm1pc3Npb25TZXRzOiBbJ1NlY3VyaXR5QXVkaXRvcicsICdEZXZlbG9wZXJSZWFkT25seSddLFxuICAgICAgICBwcmluY2lwYWxUeXBlOiAnR1JPVVAnLFxuICAgICAgICBwcmluY2lwYWxOYW1lOiAnU2VjdXJpdHlUZWFtJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGFjY291bnRJZDogY2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnQsXG4gICAgICAgIGFjY291bnROYW1lOiAnU2VjdXJpdHktU3RhZ2luZycsXG4gICAgICAgIGVudmlyb25tZW50OiAnc3RhZ2luZycsXG4gICAgICAgIHBlcm1pc3Npb25TZXRzOiBbJ1NlY3VyaXR5RW5naW5lZXInLCAnRGV2T3BzRW5naW5lZXInXSxcbiAgICAgICAgcHJpbmNpcGFsVHlwZTogJ0dST1VQJyxcbiAgICAgICAgcHJpbmNpcGFsTmFtZTogJ1BsYXRmb3JtVGVhbScsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBhY2NvdW50SWQ6IGNkay5TdGFjay5vZih0aGlzKS5hY2NvdW50LFxuICAgICAgICBhY2NvdW50TmFtZTogJ1NlY3VyaXR5LVByb2QnLFxuICAgICAgICBlbnZpcm9ubWVudDogJ3Byb2R1Y3Rpb24nLFxuICAgICAgICBwZXJtaXNzaW9uU2V0czogWydTZWN1cml0eUF1ZGl0b3InXSxcbiAgICAgICAgcHJpbmNpcGFsVHlwZTogJ0dST1VQJyxcbiAgICAgICAgcHJpbmNpcGFsTmFtZTogJ1NlY3VyaXR5QXVkaXRvcnMnLFxuICAgICAgfSxcbiAgICBdO1xuXG4gICAgLy8gQ3JlYXRlIGNyb3NzLWFjY291bnQgcm9sZXMgZm9yIGVhY2ggYXNzaWdubWVudFxuICAgIGFjY291bnRBc3NpZ25tZW50cy5mb3JFYWNoKChhc3NpZ25tZW50LCBpbmRleCkgPT4ge1xuICAgICAgdGhpcy5jcmVhdGVBY2NvdW50QXNzaWdubWVudFJvbGVzKGFzc2lnbm1lbnQsIHByb3BzLCBpbmRleCk7XG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgbG9nZ2luZyBmb3IgYWNjb3VudCBhc3NpZ25tZW50c1xuICAgIHRoaXMuY3JlYXRlQXNzaWdubWVudExvZ2dpbmcocHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIGVtZXJnZW5jeSBhY2Nlc3MgYnJlYWstZ2xhc3Mgcm9sZVxuICAgIHRoaXMuY3JlYXRlQnJlYWtHbGFzc1JvbGUocHJvcHMpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVBY2NvdW50QXNzaWdubWVudFJvbGVzKFxuICAgIGFzc2lnbm1lbnQ6IEFjY291bnRBc3NpZ25tZW50LFxuICAgIHByb3BzOiBBY2NvdW50QXNzaWdubWVudFN0YWNrUHJvcHMsXG4gICAgaW5kZXg6IG51bWJlclxuICApOiB2b2lkIHtcbiAgICBhc3NpZ25tZW50LnBlcm1pc3Npb25TZXRzLmZvckVhY2goKHBlcm1pc3Npb25TZXROYW1lKSA9PiB7XG4gICAgICBjb25zdCBiYXNlUm9sZSA9IHByb3BzLnBlcm1pc3Npb25TZXRzW3Blcm1pc3Npb25TZXROYW1lXTtcbiAgICAgIGlmICghYmFzZVJvbGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQZXJtaXNzaW9uIHNldCAke3Blcm1pc3Npb25TZXROYW1lfSBub3QgZm91bmRgKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ3JlYXRlIGNyb3NzLWFjY291bnQgYWNjZXNzIHJvbGVcbiAgICAgIGNvbnN0IGNyb3NzQWNjb3VudFJvbGUgPSBuZXcgaWFtLlJvbGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIGBDcm9zc0FjY291bnQtJHthc3NpZ25tZW50LmFjY291bnROYW1lfS0ke3Blcm1pc3Npb25TZXROYW1lfS0ke2luZGV4fWAsXG4gICAgICAgIHtcbiAgICAgICAgICByb2xlTmFtZTogYENyb3NzQWNjb3VudC0ke2Fzc2lnbm1lbnQuYWNjb3VudE5hbWV9LSR7cGVybWlzc2lvblNldE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogYENyb3NzLWFjY291bnQgYWNjZXNzIHJvbGUgZm9yICR7YXNzaWdubWVudC5wcmluY2lwYWxOYW1lfSBpbiAke2Fzc2lnbm1lbnQuYWNjb3VudE5hbWV9YCxcbiAgICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uQ29tcG9zaXRlUHJpbmNpcGFsKFxuICAgICAgICAgICAgLy8gQWxsb3cgdGhlIGJhc2UgcGVybWlzc2lvbiBzZXQgcm9sZSB0byBhc3N1bWUgdGhpcyByb2xlXG4gICAgICAgICAgICBuZXcgaWFtLkFyblByaW5jaXBhbChiYXNlUm9sZS5yb2xlQXJuKSxcbiAgICAgICAgICAgIC8vIEFsbG93IGRpcmVjdCBmZWRlcmF0ZWQgYWNjZXNzXG4gICAgICAgICAgICBuZXcgaWFtLkZlZGVyYXRlZFByaW5jaXBhbChcbiAgICAgICAgICAgICAgJ2Fybjphd3M6aWFtOjonICsgY2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnQgKyAnOnNhbWwtcHJvdmlkZXIvRW50ZXJwcmlzZUlkUC0nICsgcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAnU3RyaW5nRXF1YWxzJzoge1xuICAgICAgICAgICAgICAgICAgJ1NBTUw6YXVkJzogJ2h0dHBzOi8vc2lnbmluLmF3cy5hbWF6b24uY29tL3NhbWwnLFxuICAgICAgICAgICAgICAgICAgJ1NBTUw6ZGVwYXJ0bWVudCc6IGFzc2lnbm1lbnQucHJpbmNpcGFsTmFtZSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICdTdHJpbmdMaWtlJzoge1xuICAgICAgICAgICAgICAgICAgJ1NBTUw6ZW52aXJvbm1lbnQnOiBhc3NpZ25tZW50LmVudmlyb25tZW50LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICdzdHM6QXNzdW1lUm9sZVdpdGhTQU1MJ1xuICAgICAgICAgICAgKVxuICAgICAgICAgICksXG4gICAgICAgICAgbWF4U2Vzc2lvbkR1cmF0aW9uOiBjZGsuRHVyYXRpb24uaG91cnMoOCksXG4gICAgICAgICAgZXh0ZXJuYWxJZHM6IFtgJHthc3NpZ25tZW50LmFjY291bnRJZH0tJHthc3NpZ25tZW50LmVudmlyb25tZW50fWBdLFxuICAgICAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgICAgICBBY2NvdW50U3BlY2lmaWNQb2xpY3k6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgICAgc2lkOiAnRW5mb3JjZUFjY291bnRCb3VuZGFyeScsXG4gICAgICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuREVOWSxcbiAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFsnKiddLFxuICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ1N0cmluZ05vdEVxdWFscyc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAnYXdzOlJlcXVlc3RlZFJlZ2lvbic6IFsndXMtZWFzdC0xJywgJ3VzLXdlc3QtMiddLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgICAgICBzaWQ6ICdSZXF1aXJlRW52aXJvbm1lbnRUYWcnLFxuICAgICAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkRFTlksXG4gICAgICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgICAgICdlYzI6UnVuSW5zdGFuY2VzJyxcbiAgICAgICAgICAgICAgICAgICAgJ3MzOkNyZWF0ZUJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICAgICdyZHM6Q3JlYXRlREJJbnN0YW5jZScsXG4gICAgICAgICAgICAgICAgICAgICdsYW1iZGE6Q3JlYXRlRnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICAgICAgICAgICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgICAgICAgICAgICAgICdTdHJpbmdOb3RFcXVhbHMnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgJ2F3czpSZXF1ZXN0VGFnL0Vudmlyb25tZW50JzogYXNzaWdubWVudC5lbnZpcm9ubWVudCxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgICAgc2lkOiAnQWxsb3dBc3N1bWVSb2xlSW5BY2NvdW50JyxcbiAgICAgICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFsnc3RzOkFzc3VtZVJvbGUnXSxcbiAgICAgICAgICAgICAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOmlhbTo6JHthc3NpZ25tZW50LmFjY291bnRJZH06cm9sZS8qYF0sXG4gICAgICAgICAgICAgICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgICAgICAgICAgICAgICdTdHJpbmdFcXVhbHMnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgJ3N0czpFeHRlcm5hbElkJzogYCR7YXNzaWdubWVudC5hY2NvdW50SWR9LSR7YXNzaWdubWVudC5lbnZpcm9ubWVudH1gLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0sXG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIC8vIEFkZCBzZXNzaW9uIHRhZ2dpbmcgZm9yIGF0dHJpYnV0ZS1iYXNlZCBhY2Nlc3MgY29udHJvbFxuICAgICAgY3Jvc3NBY2NvdW50Um9sZS5hc3N1bWVSb2xlUG9saWN5Py5hZGRTdGF0ZW1lbnRzKFxuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLkFyblByaW5jaXBhbChiYXNlUm9sZS5yb2xlQXJuKV0sXG4gICAgICAgICAgYWN0aW9uczogWydzdHM6QXNzdW1lUm9sZScsICdzdHM6VGFnU2Vzc2lvbiddLFxuICAgICAgICAgIGNvbmRpdGlvbnM6IHtcbiAgICAgICAgICAgICdTdHJpbmdFcXVhbHMnOiB7XG4gICAgICAgICAgICAgICdhd3M6UHJpbmNpcGFsVGFnL0RlcGFydG1lbnQnOiBhc3NpZ25tZW50LnByaW5jaXBhbE5hbWUsXG4gICAgICAgICAgICAgICdhd3M6UHJpbmNpcGFsVGFnL0Vudmlyb25tZW50JzogYXNzaWdubWVudC5lbnZpcm9ubWVudCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICAgIC8vIFRhZyB0aGUgcm9sZVxuICAgICAgY2RrLlRhZ3Mub2YoY3Jvc3NBY2NvdW50Um9sZSkuYWRkKCdBY2NvdW50SWQnLCBhc3NpZ25tZW50LmFjY291bnRJZCk7XG4gICAgICBjZGsuVGFncy5vZihjcm9zc0FjY291bnRSb2xlKS5hZGQoJ0FjY291bnROYW1lJywgYXNzaWdubWVudC5hY2NvdW50TmFtZSk7XG4gICAgICBjZGsuVGFncy5vZihjcm9zc0FjY291bnRSb2xlKS5hZGQoJ1ByaW5jaXBhbFR5cGUnLCBhc3NpZ25tZW50LnByaW5jaXBhbFR5cGUpO1xuICAgICAgY2RrLlRhZ3Mub2YoY3Jvc3NBY2NvdW50Um9sZSkuYWRkKCdQcmluY2lwYWxOYW1lJywgYXNzaWdubWVudC5wcmluY2lwYWxOYW1lKTtcbiAgICAgIGNkay5UYWdzLm9mKGNyb3NzQWNjb3VudFJvbGUpLmFkZCgnUGVybWlzc2lvblNldCcsIHBlcm1pc3Npb25TZXROYW1lKTtcbiAgICAgIGNkay5UYWdzLm9mKGNyb3NzQWNjb3VudFJvbGUpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZpcm9ubWVudCk7XG5cbiAgICAgIHRoaXMuYXNzaWdubWVudFJvbGVzW2Ake2Fzc2lnbm1lbnQuYWNjb3VudE5hbWV9LSR7cGVybWlzc2lvblNldE5hbWV9YF0gPSBjcm9zc0FjY291bnRSb2xlO1xuXG4gICAgICAvLyBPdXRwdXRcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGAke2Fzc2lnbm1lbnQuYWNjb3VudE5hbWV9LSR7cGVybWlzc2lvblNldE5hbWV9LVJvbGVBcm5gLCB7XG4gICAgICAgIHZhbHVlOiBjcm9zc0FjY291bnRSb2xlLnJvbGVBcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgQ3Jvc3MtYWNjb3VudCByb2xlIEFSTiBmb3IgJHthc3NpZ25tZW50LmFjY291bnROYW1lfSAtICR7cGVybWlzc2lvblNldE5hbWV9YCxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMuZW52aXJvbm1lbnR9LSR7YXNzaWdubWVudC5hY2NvdW50TmFtZS50b0xvd2VyQ2FzZSgpfS0ke3Blcm1pc3Npb25TZXROYW1lLnRvTG93ZXJDYXNlKCl9LXJvbGUtYXJuYCxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVBc3NpZ25tZW50TG9nZ2luZyhwcm9wczogQWNjb3VudEFzc2lnbm1lbnRTdGFja1Byb3BzKTogdm9pZCB7XG4gICAgLy8gQ2xvdWRXYXRjaCBMb2cgR3JvdXAgZm9yIGFjY291bnQgYXNzaWdubWVudCBhY3Rpdml0aWVzXG4gICAgY29uc3QgYXNzaWdubWVudExvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0FjY291bnRBc3NpZ25tZW50TG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2lkZW50aXR5Y2VudGVyL2Fzc2lnbm1lbnRzLyR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIHJldGVudGlvbjogcHJvcHMuY29uZmlnLnJldGVudGlvbkRheXMsXG4gICAgICByZW1vdmFsUG9saWN5OiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkV2F0Y2ggTG9nIFN0cmVhbSBmb3IgZGlmZmVyZW50IGFzc2lnbm1lbnQgdHlwZXNcbiAgICBuZXcgbG9ncy5Mb2dTdHJlYW0odGhpcywgJ0Fzc2lnbm1lbnRTdWNjZXNzTG9nU3RyZWFtJywge1xuICAgICAgbG9nR3JvdXA6IGFzc2lnbm1lbnRMb2dHcm91cCxcbiAgICAgIGxvZ1N0cmVhbU5hbWU6ICdhc3NpZ25tZW50LXN1Y2Nlc3MnLFxuICAgIH0pO1xuXG4gICAgbmV3IGxvZ3MuTG9nU3RyZWFtKHRoaXMsICdBc3NpZ25tZW50RmFpbHVyZUxvZ1N0cmVhbScsIHtcbiAgICAgIGxvZ0dyb3VwOiBhc3NpZ25tZW50TG9nR3JvdXAsXG4gICAgICBsb2dTdHJlYW1OYW1lOiAnYXNzaWdubWVudC1mYWlsdXJlJyxcbiAgICB9KTtcblxuICAgIG5ldyBsb2dzLkxvZ1N0cmVhbSh0aGlzLCAnU2Vzc2lvblRhZ2dpbmdMb2dTdHJlYW0nLCB7XG4gICAgICBsb2dHcm91cDogYXNzaWdubWVudExvZ0dyb3VwLFxuICAgICAgbG9nU3RyZWFtTmFtZTogJ3Nlc3Npb24tdGFnZ2luZycsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXNzaWdubWVudExvZ0dyb3VwQXJuJywge1xuICAgICAgdmFsdWU6IGFzc2lnbm1lbnRMb2dHcm91cC5sb2dHcm91cEFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWNjb3VudCBBc3NpZ25tZW50IExvZyBHcm91cCBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMuZW52aXJvbm1lbnR9LWFzc2lnbm1lbnQtbG9nLWdyb3VwLWFybmAsXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUJyZWFrR2xhc3NSb2xlKHByb3BzOiBBY2NvdW50QXNzaWdubWVudFN0YWNrUHJvcHMpOiB2b2lkIHtcbiAgICAvLyBFbWVyZ2VuY3kgYnJlYWstZ2xhc3Mgcm9sZSBmb3IgY3JpdGljYWwgaW5jaWRlbnRzXG4gICAgY29uc3QgYnJlYWtHbGFzc1JvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0JyZWFrR2xhc3NSb2xlJywge1xuICAgICAgcm9sZU5hbWU6IGBCcmVha0dsYXNzLUVtZXJnZW5jeS0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VtZXJnZW5jeSBicmVhay1nbGFzcyByb2xlIGZvciBjcml0aWNhbCBpbmNpZGVudHMgLSByZXF1aXJlcyBNRkEgYW5kIGFwcHJvdmFsJyxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5Db21wb3NpdGVQcmluY2lwYWwoXG4gICAgICAgIC8vIE9ubHkgYWxsb3cgc3BlY2lmaWMgZW1lcmdlbmN5IHVzZXJzXG4gICAgICAgIG5ldyBpYW0uRmVkZXJhdGVkUHJpbmNpcGFsKFxuICAgICAgICAgICdhcm46YXdzOmlhbTo6JyArIHRoaXMuYWNjb3VudCArICc6c2FtbC1wcm92aWRlci9FbnRlcnByaXNlSWRQLScgKyBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICAnU3RyaW5nRXF1YWxzJzoge1xuICAgICAgICAgICAgICAnU0FNTDphdWQnOiAnaHR0cHM6Ly9zaWduaW4uYXdzLmFtYXpvbi5jb20vc2FtbCcsXG4gICAgICAgICAgICAgICdTQU1MOnJvbGUnOiAnRW1lcmdlbmN5QWRtaW4nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICdCb29sJzoge1xuICAgICAgICAgICAgICAnYXdzOk11bHRpRmFjdG9yQXV0aFByZXNlbnQnOiAndHJ1ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJ051bWVyaWNMZXNzVGhhbic6IHtcbiAgICAgICAgICAgICAgJ2F3czpNdWx0aUZhY3RvckF1dGhBZ2UnOiAnMzYwMCcsIC8vIE1GQSB3aXRoaW4gbGFzdCBob3VyXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJ3N0czpBc3N1bWVSb2xlV2l0aFNBTUwnXG4gICAgICAgIClcbiAgICAgICksXG4gICAgICBtYXhTZXNzaW9uRHVyYXRpb246IGNkay5EdXJhdGlvbi5ob3VycygxKSwgLy8gU2hvcnQgc2Vzc2lvbiBkdXJhdGlvblxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQWRtaW5pc3RyYXRvckFjY2VzcycpLFxuICAgICAgXSxcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgIEJyZWFrR2xhc3NMb2dnaW5nOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIHNpZDogJ1JlcXVpcmVDbG91ZFRyYWlsTG9nZ2luZycsXG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5ERU5ZLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2Nsb3VkdHJhaWw6U3RvcExvZ2dpbmcnLFxuICAgICAgICAgICAgICAgICdjbG91ZHRyYWlsOkRlbGV0ZVRyYWlsJyxcbiAgICAgICAgICAgICAgICAnY2xvdWR0cmFpbDpQdXRFdmVudFNlbGVjdG9ycycsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgc2lkOiAnUmVxdWlyZUluY2lkZW50TG9nZ2luZycsXG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXG4gICAgICAgICAgICAgICAgJ2xvZ3M6UHV0TG9nRXZlbnRzJyxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgYGFybjphd3M6bG9nczoke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9OmxvZy1ncm91cDovYXdzL2VtZXJnZW5jeS8qYCxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBlbWVyZ2VuY3kgc2Vzc2lvbiB0YWdnaW5nXG4gICAgYnJlYWtHbGFzc1JvbGUuYXNzdW1lUm9sZVBvbGljeT8uYWRkU3RhdGVtZW50cyhcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBwcmluY2lwYWxzOiBbbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdzc28uYW1hem9uYXdzLmNvbScpXSxcbiAgICAgICAgYWN0aW9uczogWydzdHM6VGFnU2Vzc2lvbiddLFxuICAgICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgICAgJ0ZvckFsbFZhbHVlczpTdHJpbmdFcXVhbHMnOiB7XG4gICAgICAgICAgICAnYXdzOlByaW5jaXBhbFRhZy9FbWVyZ2VuY3lBY2Nlc3MnOiAndHJ1ZScsXG4gICAgICAgICAgICAnYXdzOlByaW5jaXBhbFRhZy9JbmNpZGVudElkJzogJyonLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBUYWcgdGhlIGJyZWFrLWdsYXNzIHJvbGVcbiAgICBjZGsuVGFncy5vZihicmVha0dsYXNzUm9sZSkuYWRkKCdBY2Nlc3NUeXBlJywgJ0VtZXJnZW5jeScpO1xuICAgIGNkay5UYWdzLm9mKGJyZWFrR2xhc3NSb2xlKS5hZGQoJ1JlcXVpcmVzTUZBJywgJ3RydWUnKTtcbiAgICBjZGsuVGFncy5vZihicmVha0dsYXNzUm9sZSkuYWRkKCdNYXhEdXJhdGlvbicsICcxaG91cicpO1xuICAgIGNkay5UYWdzLm9mKGJyZWFrR2xhc3NSb2xlKS5hZGQoJ0Vudmlyb25tZW50JywgcHJvcHMuZW52aXJvbm1lbnQpO1xuXG4gICAgLy8gT3V0cHV0XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0JyZWFrR2xhc3NSb2xlQXJuJywge1xuICAgICAgdmFsdWU6IGJyZWFrR2xhc3NSb2xlLnJvbGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0VtZXJnZW5jeSBCcmVhay1HbGFzcyBSb2xlIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5lbnZpcm9ubWVudH0tYnJlYWstZ2xhc3Mtcm9sZS1hcm5gLFxuICAgIH0pO1xuICB9XG59Il19