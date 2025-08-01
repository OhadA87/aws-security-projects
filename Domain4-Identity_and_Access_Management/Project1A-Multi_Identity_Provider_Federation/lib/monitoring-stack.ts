import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

export interface MonitoringStackProps extends cdk.StackProps {
  environment: string;
  identityCenterArn: string;
  config: {
    enableCloudTrail: boolean;
    enableGuardDuty: boolean;
    retentionDays: number;
  };
}

export class MonitoringStack extends cdk.Stack {
  public readonly securityTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // SNS Topic for security alerts
    this.securityTopic = new sns.Topic(this, 'SecurityAlertsTopic', {
      topicName: `IdentitySecurityAlerts-${props.environment}`,
      displayName: 'Identity and Access Security Alerts',
    });

    // Email subscription for security team
    this.securityTopic.addSubscription(
      new subscriptions.EmailSubscription('security-team@company.com')
    );

    // Create CloudWatch Log Groups for monitoring
    this.createLogGroups(props);

    // Create CloudWatch Metrics and Alarms
    this.createSecurityMetrics(props);

    // Create EventBridge Rules for identity events
    this.createEventRules(props);

    // Create Lambda function for processing security events
    this.createEventProcessor(props);

    // Create CloudWatch Dashboard
    this.createSecurityDashboard(props);
  }

  private createLogGroups(props: MonitoringStackProps): void {
    // Identity Center Sign-in events
    new logs.LogGroup(this, 'IdentityCenterSignInLogGroup', {
      logGroupName: `/aws/identitycenter/signin/${props.environment}`,
      retention: props.config.retentionDays,
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Failed authentication events
    new logs.LogGroup(this, 'FailedAuthLogGroup', {
      logGroupName: `/aws/identitycenter/failed-auth/${props.environment}`,
      retention: props.config.retentionDays,
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Role assumption events
    new logs.LogGroup(this, 'RoleAssumptionLogGroup', {
      logGroupName: `/aws/iam/role-assumption/${props.environment}`,
      retention: props.config.retentionDays,
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Break-glass access events
    new logs.LogGroup(this, 'BreakGlassLogGroup', {
      logGroupName: `/aws/emergency/break-glass/${props.environment}`,
      retention: logs.RetentionDays.ONE_YEAR, // Always retain emergency access logs
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }

  private createSecurityMetrics(props: MonitoringStackProps): void {
    // Metric for failed authentication attempts
    const failedAuthMetric = new cloudwatch.Metric({
      namespace: 'IdentitySecurity',
      metricName: 'FailedAuthentications',
      dimensionsMap: {
        Environment: props.environment,
      },
      statistic: 'Sum',
    });

    // Metric for successful logins
    new cloudwatch.Metric({
      namespace: 'IdentitySecurity',
      metricName: 'SuccessfulLogins',
      dimensionsMap: {
        Environment: props.environment,
      },
      statistic: 'Sum',
    });

    // Metric for role assumptions
    new cloudwatch.Metric({
      namespace: 'IdentitySecurity',
      metricName: 'RoleAssumptions',
      dimensionsMap: {
        Environment: props.environment,
      },
      statistic: 'Sum',
    });

    // Metric for break-glass access
    const breakGlassMetric = new cloudwatch.Metric({
      namespace: 'IdentitySecurity',
      metricName: 'BreakGlassAccess',
      dimensionsMap: {
        Environment: props.environment,
      },
      statistic: 'Sum',
    });

    // Alarm for excessive failed authentication attempts
    new cloudwatch.Alarm(this, 'FailedAuthAlarm', {
      alarmName: `IdentitySecurity-FailedAuth-${props.environment}`,
      alarmDescription: 'Alert when there are excessive failed authentication attempts',
      metric: failedAuthMetric,
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.securityTopic));

    // Alarm for break-glass access
    new cloudwatch.Alarm(this, 'BreakGlassAlarm', {
      alarmName: `IdentitySecurity-BreakGlass-${props.environment}`,
      alarmDescription: 'Immediate alert for any break-glass access',
      metric: breakGlassMetric,
      threshold: 0,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.securityTopic));

    // Composite alarm for identity security
    new cloudwatch.CompositeAlarm(this, 'IdentitySecurityCompositeAlarm', {
      alarmDescription: 'Composite alarm for identity security events',
      compositeAlarmName: `IdentitySecurity-Composite-${props.environment}`,
      alarmRule: cloudwatch.AlarmRule.anyOf(
        cloudwatch.AlarmRule.fromAlarm(
          cloudwatch.Alarm.fromAlarmArn(
            this,
            'FailedAuthAlarmRef',
            `arn:aws:cloudwatch:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:alarm:IdentitySecurity-FailedAuth-${props.environment}`
          ),
          cloudwatch.AlarmState.ALARM
        ),
        cloudwatch.AlarmRule.fromAlarm(
          cloudwatch.Alarm.fromAlarmArn(
            this,
            'BreakGlassAlarmRef',
            `arn:aws:cloudwatch:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:alarm:IdentitySecurity-BreakGlass-${props.environment}`
          ),
          cloudwatch.AlarmState.ALARM
        )
      ),
    });
  }

  private createEventRules(props: MonitoringStackProps): void {
    // EventBridge rule for AWS SSO events
    new events.Rule(this, 'SSOEventsRule', {
      ruleName: `SSO-Events-${props.environment}`,
      description: 'Capture AWS SSO authentication events',
      eventPattern: {
        source: ['aws.sso'],
        detailType: ['AWS SSO Sign-in'],
        detail: {
          eventSource: ['sso.amazonaws.com'],
          eventName: [
            'Authenticate',
            'AssumeRoleWithSAML',
            'AssumeRoleWithWebIdentity',
          ],
        },
      },
      targets: [
        new targets.SnsTopic(this.securityTopic),
        new targets.CloudWatchLogGroup(
          logs.LogGroup.fromLogGroupName(
            this,
            'SSOEventsLogGroup',
            `/aws/identitycenter/signin/${props.environment}`
          )
        ),
      ],
    });

    // EventBridge rule for IAM role assumption events
    new events.Rule(this, 'IAMRoleAssumptionRule', {
      ruleName: `IAM-RoleAssumption-${props.environment}`,
      description: 'Capture IAM role assumption events',
      eventPattern: {
        source: ['aws.sts'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['sts.amazonaws.com'],
          eventName: [
            'AssumeRole',
            'AssumeRoleWithSAML',
            'AssumeRoleWithWebIdentity',
          ],
        },
      },
      targets: [
        new targets.CloudWatchLogGroup(
          logs.LogGroup.fromLogGroupName(
            this,
            'RoleAssumptionLogGroupRef',
            `/aws/iam/role-assumption/${props.environment}`
          )
        ),
      ],
    });

    // EventBridge rule for break-glass access
    new events.Rule(this, 'BreakGlassRule', {
      ruleName: `BreakGlass-Access-${props.environment}`,
      description: 'Immediate alert for break-glass access',
      eventPattern: {
        source: ['aws.sts'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['sts.amazonaws.com'],
          eventName: ['AssumeRole'],
          requestParameters: {
            roleArn: [{
              prefix: `arn:aws:iam::${cdk.Stack.of(this).account}:role/BreakGlass-`
            }]
          },
        },
      },
      targets: [
        new targets.SnsTopic(this.securityTopic),
        new targets.CloudWatchLogGroup(
          logs.LogGroup.fromLogGroupName(
            this,
            'BreakGlassLogGroupRef',
            `/aws/emergency/break-glass/${props.environment}`
          )
        ),
      ],
    });
  }

  private createEventProcessor(props: MonitoringStackProps): void {
    // Lambda function for processing identity events
    const eventProcessorFunction = new lambda.Function(this, 'EventProcessor', {
      functionName: `IdentityEventProcessor-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      description: 'Process identity and access management events',
      timeout: cdk.Duration.minutes(5),
      code: lambda.Code.fromInline(`
import json
import boto3
import logging
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

cloudwatch = boto3.client('cloudwatch')
sns = boto3.client('sns')

def handler(event, context):
    try:
        # Parse the event
        detail = event.get('detail', {})
        source = event.get('source', '')

        # Extract relevant information
        event_name = detail.get('eventName', '')
        source_ip = detail.get('sourceIPAddress', '')
        user_identity = detail.get('userIdentity', {})

        logger.info(f"Processing event: {event_name} from {source}")

        # Send custom metrics
        namespace = 'IdentitySecurity'
        timestamp = datetime.utcnow()

        if 'failed' in event_name.lower() or detail.get('errorCode'):
            # Failed authentication
            cloudwatch.put_metric_data(
                Namespace=namespace,
                MetricData=[
                    {
                        'MetricName': 'FailedAuthentications',
                        'Dimensions': [
                            {
                                'Name': 'Environment',
                                'Value': '${props.environment}'
                            },
                            {
                                'Name': 'SourceIP',
                                'Value': source_ip
                            }
                        ],
                        'Value': 1,
                        'Timestamp': timestamp
                    }
                ]
            )

        elif 'AssumeRole' in event_name:
            role_arn = detail.get('requestParameters', {}).get('roleArn', '')

            if 'BreakGlass' in role_arn:
                # Break-glass access
                cloudwatch.put_metric_data(
                    Namespace=namespace,
                    MetricData=[
                        {
                            'MetricName': 'BreakGlassAccess',
                            'Dimensions': [
                                {
                                    'Name': 'Environment',
                                    'Value': '${props.environment}'
                                },
                                {
                                    'Name': 'UserName',
                                    'Value': user_identity.get('userName', 'Unknown')
                                }
                            ],
                            'Value': 1,
                            'Timestamp': timestamp
                        }
                    ]
                )

                # Send immediate SNS alert
                sns.publish(
                    TopicArn='${this.securityTopic.topicArn}',
                    Subject=f'CRITICAL: Break-Glass Access in {props.environment}',
                    Message=f'''Break-glass access detected:

User: {user_identity.get('userName', 'Unknown')}
                    Role: {role_arn}
                    Source IP: {source_ip}
                    Time: {timestamp}
                    Environment: ${props.environment}

                    Please investigate immediately.'''
                )
            else:
                # Regular role assumption
                cloudwatch.put_metric_data(
                    Namespace=namespace,
                    MetricData=[
                        {
                            'MetricName': 'RoleAssumptions',
                            'Dimensions': [
                                {
                                    'Name': 'Environment',
                                    'Value': '${props.environment}'
                                },
                                {
                                    'Name': 'RoleName',
                                    'Value': role_arn.split('/')[-1] if role_arn else 'Unknown'
                                }
                            ],
                            'Value': 1,
                            'Timestamp': timestamp
                        }
                    ]
                )

        elif event_name in ['Authenticate', 'Login']:
            # Successful authentication
            cloudwatch.put_metric_data(
                Namespace=namespace,
                MetricData=[
                    {
                        'MetricName': 'SuccessfulLogins',
                        'Dimensions': [
                            {
                                'Name': 'Environment',
                                'Value': '${props.environment}'
                            },
                            {
                                'Name': 'SourceIP',
                                'Value': source_ip
                            }
                        ],
                        'Value': 1,
                        'Timestamp': timestamp
                    }
                ]
            )

        return {'statusCode': 200, 'body': 'Event processed successfully'}

    except Exception as e:
        logger.error(f"Error processing event: {str(e)}")
        return {'statusCode': 500, 'body': f'Error: {str(e)}'}
      `),
      environment: {
        SNS_TOPIC_ARN: this.securityTopic.topicArn,
        ENVIRONMENT: props.environment,
      },
    });

    // Grant permissions to the Lambda function
    eventProcessorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudwatch:PutMetricData',
          'sns:Publish',
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      })
    );

    // Add Lambda as target to EventBridge rules
    new events.Rule(this, 'IdentityEventsRule', {
      ruleName: `Identity-Events-Processor-${props.environment}`,
      description: 'Route identity events to processor function',
      eventPattern: {
        source: ['aws.sso', 'aws.sts'],
        detailType: ['AWS API Call via CloudTrail', 'AWS SSO Sign-in'],
      },
      targets: [new targets.LambdaFunction(eventProcessorFunction)],
    });

    // CDK NAG suppressions
    NagSuppressions.addResourceSuppressions(
      eventProcessorFunction,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Lambda execution role uses AWS managed policy',
        },
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Lambda needs wildcard permissions for CloudWatch metrics',
        },
      ]
    );
  }

  private createSecurityDashboard(props: MonitoringStackProps): void {
    const dashboard = new cloudwatch.Dashboard(this, 'IdentitySecurityDashboard', {
      dashboardName: `IdentitySecurity-${props.environment}`,
    });

    // Add widgets to the dashboard
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Authentication Events',
        left: [
          new cloudwatch.Metric({
            namespace: 'IdentitySecurity',
            metricName: 'SuccessfulLogins',
            dimensionsMap: { Environment: props.environment },
            statistic: 'Sum',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'IdentitySecurity',
            metricName: 'FailedAuthentications',
            dimensionsMap: { Environment: props.environment },
            statistic: 'Sum',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Role Assumptions',
        left: [
          new cloudwatch.Metric({
            namespace: 'IdentitySecurity',
            metricName: 'RoleAssumptions',
            dimensionsMap: { Environment: props.environment },
            statistic: 'Sum',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'IdentitySecurity',
            metricName: 'BreakGlassAccess',
            dimensionsMap: { Environment: props.environment },
            statistic: 'Sum',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Current Security Status',
        metrics: [
          new cloudwatch.Metric({
            namespace: 'IdentitySecurity',
            metricName: 'FailedAuthentications',
            dimensionsMap: { Environment: props.environment },
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'IdentitySecurity',
            metricName: 'BreakGlassAccess',
            dimensionsMap: { Environment: props.environment },
            statistic: 'Sum',
          }),
        ],
        width: 12,
        height: 3,
      })
    );

    // Output
    new cdk.CfnOutput(this, 'DashboardURL', {
      value: `https://${cdk.Stack.of(this).region}.console.aws.amazon.com/cloudwatch/home?region=${cdk.Stack.of(this).region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'Identity Security Dashboard URL',
      exportName: `${props.environment}-identity-dashboard-url`,
    });
  }
}
