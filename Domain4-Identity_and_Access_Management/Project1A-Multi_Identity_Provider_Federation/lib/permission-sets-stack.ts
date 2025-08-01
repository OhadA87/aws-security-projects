import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

export interface PermissionSetsStackProps extends cdk.StackProps {
  environment: string;
  identityCenterArn: string;
  config: {
    enableCloudTrail: boolean;
    enableGuardDuty: boolean;
    retentionDays: number;
  };
}

export interface PermissionSetConfig {
  name: string;
  description: string;
  sessionDuration: cdk.Duration;
  managedPolicies?: string[];
  inlinePolicy?: iam.PolicyDocument;
  tags?: { [key: string]: string };
}

export class PermissionSetsStack extends cdk.Stack {
  public readonly permissionSets: { [key: string]: iam.Role } = {};

  constructor(scope: Construct, id: string, props: PermissionSetsStackProps) {
    super(scope, id, props);

    // Define permission sets configuration
    const permissionSetConfigs: PermissionSetConfig[] = [
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

  private createPermissionSetRole(
    config: PermissionSetConfig,
    props: PermissionSetsStackProps
  ): iam.Role {
    const role = new iam.Role(this, `${config.name}Role`, {
      roleName: `${config.name}-${props.environment}`,
      description: config.description,
      assumedBy: new iam.CompositePrincipal(
        // Allow AWS SSO to assume this role
        new iam.ServicePrincipal('sso.amazonaws.com'),
        // Allow federated users to assume this role
        new iam.FederatedPrincipal(
          'arn:aws:iam::' + cdk.Stack.of(this).account + ':saml-provider/EnterpriseIdP-' + props.environment,
          {
            'StringEquals': {
              'SAML:aud': 'https://signin.aws.amazon.com/saml',
            },
          },
          'sts:AssumeRoleWithSAML'
        )
      ),
      maxSessionDuration: config.sessionDuration,
      managedPolicies: config.managedPolicies?.map((policyArn) =>
        iam.ManagedPolicy.fromManagedPolicyArn(this, `${config.name}-${policyArn.split('/').pop()}`, policyArn)
      ),
      inlinePolicies: config.inlinePolicy
        ? {
            [`${config.name}Policy`]: config.inlinePolicy,
          }
        : undefined,
    });

    // Add session tagging capability
    role.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('sso.amazonaws.com')],
        actions: ['sts:TagSession'],
        conditions: {
          'StringEquals': {
            'aws:RequestedRegion': cdk.Stack.of(this).region,
          },
        },
      })
    );

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
    NagSuppressions.addResourceSuppressions(
      role,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Managed policies are used intentionally for standard AWS permissions',
        },
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wildcard permissions are necessary for cross-service access in these roles',
        },
      ]
    );

    return role;
  }
}