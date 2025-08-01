import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface AccountAssignmentStackProps extends cdk.StackProps {
  environment: string;
  identityCenterArn: string;
  permissionSets: { [key: string]: iam.Role };
  config: {
    enableCloudTrail: boolean;
    enableGuardDuty: boolean;
    retentionDays: number;
  };
}

export interface AccountAssignment {
  accountId: string;
  accountName: string;
  environment: string;
  permissionSets: string[];
  principalType: 'USER' | 'GROUP';
  principalName: string;
  conditions?: { [key: string]: any };
}

export class AccountAssignmentStack extends cdk.Stack {
  public readonly assignmentRoles: { [key: string]: iam.Role } = {};

  constructor(scope: Construct, id: string, props: AccountAssignmentStackProps) {
    super(scope, id, props);

    // Define account assignments configuration
    const accountAssignments: AccountAssignment[] = [
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

  private createAccountAssignmentRoles(
    assignment: AccountAssignment,
    props: AccountAssignmentStackProps,
    index: number
  ): void {
    assignment.permissionSets.forEach((permissionSetName) => {
      const baseRole = props.permissionSets[permissionSetName];
      if (!baseRole) {
        throw new Error(`Permission set ${permissionSetName} not found`);
      }

      // Create cross-account access role
      const crossAccountRole = new iam.Role(
        this,
        `CrossAccount-${assignment.accountName}-${permissionSetName}-${index}`,
        {
          roleName: `CrossAccount-${assignment.accountName}-${permissionSetName}-${props.environment}`,
          description: `Cross-account access role for ${assignment.principalName} in ${assignment.accountName}`,
          assumedBy: new iam.CompositePrincipal(
            // Allow the base permission set role to assume this role
            new iam.ArnPrincipal(baseRole.roleArn),
            // Allow direct federated access
            new iam.FederatedPrincipal(
              'arn:aws:iam::' + cdk.Stack.of(this).account + ':saml-provider/EnterpriseIdP-' + props.environment,
              {
                'StringEquals': {
                  'SAML:aud': 'https://signin.aws.amazon.com/saml',
                  'SAML:department': assignment.principalName,
                },
                'StringLike': {
                  'SAML:environment': assignment.environment,
                },
              },
              'sts:AssumeRoleWithSAML'
            )
          ),
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
        }
      );

      // Add session tagging for attribute-based access control
      crossAccountRole.assumeRolePolicy?.addStatements(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          principals: [new iam.ArnPrincipal(baseRole.roleArn)],
          actions: ['sts:AssumeRole', 'sts:TagSession'],
          conditions: {
            'StringEquals': {
              'aws:PrincipalTag/Department': assignment.principalName,
              'aws:PrincipalTag/Environment': assignment.environment,
            },
          },
        })
      );

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

  private createAssignmentLogging(props: AccountAssignmentStackProps): void {
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

  private createBreakGlassRole(props: AccountAssignmentStackProps): void {
    // Emergency break-glass role for critical incidents
    const breakGlassRole = new iam.Role(this, 'BreakGlassRole', {
      roleName: `BreakGlass-Emergency-${props.environment}`,
      description: 'Emergency break-glass role for critical incidents - requires MFA and approval',
      assumedBy: new iam.CompositePrincipal(
        // Only allow specific emergency users
        new iam.FederatedPrincipal(
          'arn:aws:iam::' + this.account + ':saml-provider/EnterpriseIdP-' + props.environment,
          {
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
          },
          'sts:AssumeRoleWithSAML'
        )
      ),
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
    breakGlassRole.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('sso.amazonaws.com')],
        actions: ['sts:TagSession'],
        conditions: {
          'ForAllValues:StringEquals': {
            'aws:PrincipalTag/EmergencyAccess': 'true',
            'aws:PrincipalTag/IncidentId': '*',
          },
        },
      })
    );

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