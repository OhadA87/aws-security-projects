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
exports.MonitoringStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatchActions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const subscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const cdk_nag_1 = require("cdk-nag");
class MonitoringStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // SNS Topic for security alerts
        this.securityTopic = new sns.Topic(this, 'SecurityAlertsTopic', {
            topicName: `IdentitySecurityAlerts-${props.environment}`,
            displayName: 'Identity and Access Security Alerts',
        });
        // Email subscription for security team
        this.securityTopic.addSubscription(new subscriptions.EmailSubscription('security-team@company.com'));
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
    createLogGroups(props) {
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
    createSecurityMetrics(props) {
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
            alarmRule: cloudwatch.AlarmRule.anyOf(cloudwatch.AlarmRule.fromAlarm(cloudwatch.Alarm.fromAlarmArn(this, 'FailedAuthAlarmRef', `arn:aws:cloudwatch:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:alarm:IdentitySecurity-FailedAuth-${props.environment}`), cloudwatch.AlarmState.ALARM), cloudwatch.AlarmRule.fromAlarm(cloudwatch.Alarm.fromAlarmArn(this, 'BreakGlassAlarmRef', `arn:aws:cloudwatch:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:alarm:IdentitySecurity-BreakGlass-${props.environment}`), cloudwatch.AlarmState.ALARM)),
        });
    }
    createEventRules(props) {
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
                new targets.CloudWatchLogGroup(logs.LogGroup.fromLogGroupName(this, 'SSOEventsLogGroup', `/aws/identitycenter/signin/${props.environment}`)),
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
                new targets.CloudWatchLogGroup(logs.LogGroup.fromLogGroupName(this, 'RoleAssumptionLogGroupRef', `/aws/iam/role-assumption/${props.environment}`)),
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
                new targets.CloudWatchLogGroup(logs.LogGroup.fromLogGroupName(this, 'BreakGlassLogGroupRef', `/aws/emergency/break-glass/${props.environment}`)),
            ],
        });
    }
    createEventProcessor(props) {
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
        eventProcessorFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'cloudwatch:PutMetricData',
                'sns:Publish',
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
            ],
            resources: ['*'],
        }));
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
        cdk_nag_1.NagSuppressions.addResourceSuppressions(eventProcessorFunction, [
            {
                id: 'AwsSolutions-IAM4',
                reason: 'Lambda execution role uses AWS managed policy',
            },
            {
                id: 'AwsSolutions-IAM5',
                reason: 'Lambda needs wildcard permissions for CloudWatch metrics',
            },
        ]);
    }
    createSecurityDashboard(props) {
        const dashboard = new cloudwatch.Dashboard(this, 'IdentitySecurityDashboard', {
            dashboardName: `IdentitySecurity-${props.environment}`,
        });
        // Add widgets to the dashboard
        dashboard.addWidgets(new cloudwatch.GraphWidget({
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
        }));
        dashboard.addWidgets(new cloudwatch.GraphWidget({
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
        }));
        dashboard.addWidgets(new cloudwatch.SingleValueWidget({
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
        }));
        // Output
        new cdk.CfnOutput(this, 'DashboardURL', {
            value: `https://${cdk.Stack.of(this).region}.console.aws.amazon.com/cloudwatch/home?region=${cdk.Stack.of(this).region}#dashboards:name=${dashboard.dashboardName}`,
            description: 'Identity Security Dashboard URL',
            exportName: `${props.environment}-identity-dashboard-url`,
        });
    }
}
exports.MonitoringStack = MonitoringStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1vbml0b3Jpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCxzRkFBd0U7QUFDeEUsMkRBQTZDO0FBQzdDLHlEQUEyQztBQUMzQyxpRkFBbUU7QUFDbkUsK0RBQWlEO0FBQ2pELHdFQUEwRDtBQUMxRCwrREFBaUQ7QUFDakQseURBQTJDO0FBRTNDLHFDQUEwQztBQVkxQyxNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFHNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEyQjtRQUNuRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixnQ0FBZ0M7UUFDaEMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzlELFNBQVMsRUFBRSwwQkFBMEIsS0FBSyxDQUFDLFdBQVcsRUFBRTtZQUN4RCxXQUFXLEVBQUUscUNBQXFDO1NBQ25ELENBQUMsQ0FBQztRQUVILHVDQUF1QztRQUN2QyxJQUFJLENBQUMsYUFBYSxDQUFDLGVBQWUsQ0FDaEMsSUFBSSxhQUFhLENBQUMsaUJBQWlCLENBQUMsMkJBQTJCLENBQUMsQ0FDakUsQ0FBQztRQUVGLDhDQUE4QztRQUM5QyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTVCLHVDQUF1QztRQUN2QyxJQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFbEMsK0NBQStDO1FBQy9DLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUU3Qix3REFBd0Q7UUFDeEQsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FB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O2lCQUNqQixDQUFDO2dCQUNGLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztvQkFDcEIsU0FBUyxFQUFFLGtCQUFrQjtvQkFDN0IsVUFBVSxFQUFFLGtCQUFrQjtvQkFDOUIsYUFBYSxFQUFFLEVBQUUsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXLEVBQUU7b0JBQ2pELFNBQVMsRUFBRSxLQUFLO2lCQUNqQixDQUFDO2FBQ0g7WUFDRCxLQUFLLEVBQUUsRUFBRTtZQUNULE1BQU0sRUFBRSxDQUFDO1NBQ1YsQ0FBQyxDQUNILENBQUM7UUFFRixTQUFTO1FBQ1QsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLFdBQVcsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxrREFBa0QsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxvQkFBb0IsU0FBUyxDQUFDLGFBQWEsRUFBRTtZQUNuSyxXQUFXLEVBQUUsaUNBQWlDO1lBQzlDLFVBQVUsRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLHlCQUF5QjtTQUMxRCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF4Z0JELDBDQXdnQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoQWN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc3Vic2NyaXB0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zLXN1YnNjcmlwdGlvbnMnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBOYWdTdXBwcmVzc2lvbnMgfSBmcm9tICdjZGstbmFnJztcblxuZXhwb3J0IGludGVyZmFjZSBNb25pdG9yaW5nU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgaWRlbnRpdHlDZW50ZXJBcm46IHN0cmluZztcbiAgY29uZmlnOiB7XG4gICAgZW5hYmxlQ2xvdWRUcmFpbDogYm9vbGVhbjtcbiAgICBlbmFibGVHdWFyZER1dHk6IGJvb2xlYW47XG4gICAgcmV0ZW50aW9uRGF5czogbnVtYmVyO1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgTW9uaXRvcmluZ1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHNlY3VyaXR5VG9waWM6IHNucy5Ub3BpYztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTW9uaXRvcmluZ1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIFNOUyBUb3BpYyBmb3Igc2VjdXJpdHkgYWxlcnRzXG4gICAgdGhpcy5zZWN1cml0eVRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnU2VjdXJpdHlBbGVydHNUb3BpYycsIHtcbiAgICAgIHRvcGljTmFtZTogYElkZW50aXR5U2VjdXJpdHlBbGVydHMtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgZGlzcGxheU5hbWU6ICdJZGVudGl0eSBhbmQgQWNjZXNzIFNlY3VyaXR5IEFsZXJ0cycsXG4gICAgfSk7XG5cbiAgICAvLyBFbWFpbCBzdWJzY3JpcHRpb24gZm9yIHNlY3VyaXR5IHRlYW1cbiAgICB0aGlzLnNlY3VyaXR5VG9waWMuYWRkU3Vic2NyaXB0aW9uKFxuICAgICAgbmV3IHN1YnNjcmlwdGlvbnMuRW1haWxTdWJzY3JpcHRpb24oJ3NlY3VyaXR5LXRlYW1AY29tcGFueS5jb20nKVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgQ2xvdWRXYXRjaCBMb2cgR3JvdXBzIGZvciBtb25pdG9yaW5nXG4gICAgdGhpcy5jcmVhdGVMb2dHcm91cHMocHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkV2F0Y2ggTWV0cmljcyBhbmQgQWxhcm1zXG4gICAgdGhpcy5jcmVhdGVTZWN1cml0eU1ldHJpY3MocHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIEV2ZW50QnJpZGdlIFJ1bGVzIGZvciBpZGVudGl0eSBldmVudHNcbiAgICB0aGlzLmNyZWF0ZUV2ZW50UnVsZXMocHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbiBmb3IgcHJvY2Vzc2luZyBzZWN1cml0eSBldmVudHNcbiAgICB0aGlzLmNyZWF0ZUV2ZW50UHJvY2Vzc29yKHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBDbG91ZFdhdGNoIERhc2hib2FyZFxuICAgIHRoaXMuY3JlYXRlU2VjdXJpdHlEYXNoYm9hcmQocHJvcHMpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVMb2dHcm91cHMocHJvcHM6IE1vbml0b3JpbmdTdGFja1Byb3BzKTogdm9pZCB7XG4gICAgLy8gSWRlbnRpdHkgQ2VudGVyIFNpZ24taW4gZXZlbnRzXG4gICAgbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0lkZW50aXR5Q2VudGVyU2lnbkluTG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2lkZW50aXR5Y2VudGVyL3NpZ25pbi8ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICByZXRlbnRpb246IHByb3BzLmNvbmZpZy5yZXRlbnRpb25EYXlzLFxuICAgICAgcmVtb3ZhbFBvbGljeTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBGYWlsZWQgYXV0aGVudGljYXRpb24gZXZlbnRzXG4gICAgbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0ZhaWxlZEF1dGhMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvaWRlbnRpdHljZW50ZXIvZmFpbGVkLWF1dGgvJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgcmV0ZW50aW9uOiBwcm9wcy5jb25maWcucmV0ZW50aW9uRGF5cyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IHByb3BzLmVudmlyb25tZW50ID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gUm9sZSBhc3N1bXB0aW9uIGV2ZW50c1xuICAgIG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdSb2xlQXNzdW1wdGlvbkxvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9pYW0vcm9sZS1hc3N1bXB0aW9uLyR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIHJldGVudGlvbjogcHJvcHMuY29uZmlnLnJldGVudGlvbkRheXMsXG4gICAgICByZW1vdmFsUG9saWN5OiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEJyZWFrLWdsYXNzIGFjY2VzcyBldmVudHNcbiAgICBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnQnJlYWtHbGFzc0xvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9lbWVyZ2VuY3kvYnJlYWstZ2xhc3MvJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1lFQVIsIC8vIEFsd2F5cyByZXRhaW4gZW1lcmdlbmN5IGFjY2VzcyBsb2dzXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVNlY3VyaXR5TWV0cmljcyhwcm9wczogTW9uaXRvcmluZ1N0YWNrUHJvcHMpOiB2b2lkIHtcbiAgICAvLyBNZXRyaWMgZm9yIGZhaWxlZCBhdXRoZW50aWNhdGlvbiBhdHRlbXB0c1xuICAgIGNvbnN0IGZhaWxlZEF1dGhNZXRyaWMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgbmFtZXNwYWNlOiAnSWRlbnRpdHlTZWN1cml0eScsXG4gICAgICBtZXRyaWNOYW1lOiAnRmFpbGVkQXV0aGVudGljYXRpb25zJyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgRW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgfSk7XG5cbiAgICAvLyBNZXRyaWMgZm9yIHN1Y2Nlc3NmdWwgbG9naW5zXG4gICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0lkZW50aXR5U2VjdXJpdHknLFxuICAgICAgbWV0cmljTmFtZTogJ1N1Y2Nlc3NmdWxMb2dpbnMnLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBFbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICB9KTtcblxuICAgIC8vIE1ldHJpYyBmb3Igcm9sZSBhc3N1bXB0aW9uc1xuICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdJZGVudGl0eVNlY3VyaXR5JyxcbiAgICAgIG1ldHJpY05hbWU6ICdSb2xlQXNzdW1wdGlvbnMnLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBFbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICB9KTtcblxuICAgIC8vIE1ldHJpYyBmb3IgYnJlYWstZ2xhc3MgYWNjZXNzXG4gICAgY29uc3QgYnJlYWtHbGFzc01ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdJZGVudGl0eVNlY3VyaXR5JyxcbiAgICAgIG1ldHJpY05hbWU6ICdCcmVha0dsYXNzQWNjZXNzJyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgRW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgfSk7XG5cbiAgICAvLyBBbGFybSBmb3IgZXhjZXNzaXZlIGZhaWxlZCBhdXRoZW50aWNhdGlvbiBhdHRlbXB0c1xuICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdGYWlsZWRBdXRoQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGBJZGVudGl0eVNlY3VyaXR5LUZhaWxlZEF1dGgtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0FsZXJ0IHdoZW4gdGhlcmUgYXJlIGV4Y2Vzc2l2ZSBmYWlsZWQgYXV0aGVudGljYXRpb24gYXR0ZW1wdHMnLFxuICAgICAgbWV0cmljOiBmYWlsZWRBdXRoTWV0cmljLFxuICAgICAgdGhyZXNob2xkOiAxMCxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgfSkuYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hBY3Rpb25zLlNuc0FjdGlvbih0aGlzLnNlY3VyaXR5VG9waWMpKTtcblxuICAgIC8vIEFsYXJtIGZvciBicmVhay1nbGFzcyBhY2Nlc3NcbiAgICBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQnJlYWtHbGFzc0FsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgSWRlbnRpdHlTZWN1cml0eS1CcmVha0dsYXNzLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdJbW1lZGlhdGUgYWxlcnQgZm9yIGFueSBicmVhay1nbGFzcyBhY2Nlc3MnLFxuICAgICAgbWV0cmljOiBicmVha0dsYXNzTWV0cmljLFxuICAgICAgdGhyZXNob2xkOiAwLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICB9KS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKHRoaXMuc2VjdXJpdHlUb3BpYykpO1xuXG4gICAgLy8gQ29tcG9zaXRlIGFsYXJtIGZvciBpZGVudGl0eSBzZWN1cml0eVxuICAgIG5ldyBjbG91ZHdhdGNoLkNvbXBvc2l0ZUFsYXJtKHRoaXMsICdJZGVudGl0eVNlY3VyaXR5Q29tcG9zaXRlQWxhcm0nLCB7XG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQ29tcG9zaXRlIGFsYXJtIGZvciBpZGVudGl0eSBzZWN1cml0eSBldmVudHMnLFxuICAgICAgY29tcG9zaXRlQWxhcm1OYW1lOiBgSWRlbnRpdHlTZWN1cml0eS1Db21wb3NpdGUtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgYWxhcm1SdWxlOiBjbG91ZHdhdGNoLkFsYXJtUnVsZS5hbnlPZihcbiAgICAgICAgY2xvdWR3YXRjaC5BbGFybVJ1bGUuZnJvbUFsYXJtKFxuICAgICAgICAgIGNsb3Vkd2F0Y2guQWxhcm0uZnJvbUFsYXJtQXJuKFxuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgICdGYWlsZWRBdXRoQWxhcm1SZWYnLFxuICAgICAgICAgICAgYGFybjphd3M6Y2xvdWR3YXRjaDoke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9OmFsYXJtOklkZW50aXR5U2VjdXJpdHktRmFpbGVkQXV0aC0ke3Byb3BzLmVudmlyb25tZW50fWBcbiAgICAgICAgICApLFxuICAgICAgICAgIGNsb3Vkd2F0Y2guQWxhcm1TdGF0ZS5BTEFSTVxuICAgICAgICApLFxuICAgICAgICBjbG91ZHdhdGNoLkFsYXJtUnVsZS5mcm9tQWxhcm0oXG4gICAgICAgICAgY2xvdWR3YXRjaC5BbGFybS5mcm9tQWxhcm1Bcm4oXG4gICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgJ0JyZWFrR2xhc3NBbGFybVJlZicsXG4gICAgICAgICAgICBgYXJuOmF3czpjbG91ZHdhdGNoOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06YWxhcm06SWRlbnRpdHlTZWN1cml0eS1CcmVha0dsYXNzLSR7cHJvcHMuZW52aXJvbm1lbnR9YFxuICAgICAgICAgICksXG4gICAgICAgICAgY2xvdWR3YXRjaC5BbGFybVN0YXRlLkFMQVJNXG4gICAgICAgIClcbiAgICAgICksXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUV2ZW50UnVsZXMocHJvcHM6IE1vbml0b3JpbmdTdGFja1Byb3BzKTogdm9pZCB7XG4gICAgLy8gRXZlbnRCcmlkZ2UgcnVsZSBmb3IgQVdTIFNTTyBldmVudHNcbiAgICBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1NTT0V2ZW50c1J1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYFNTTy1FdmVudHMtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgZGVzY3JpcHRpb246ICdDYXB0dXJlIEFXUyBTU08gYXV0aGVudGljYXRpb24gZXZlbnRzJyxcbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnYXdzLnNzbyddLFxuICAgICAgICBkZXRhaWxUeXBlOiBbJ0FXUyBTU08gU2lnbi1pbiddLFxuICAgICAgICBkZXRhaWw6IHtcbiAgICAgICAgICBldmVudFNvdXJjZTogWydzc28uYW1hem9uYXdzLmNvbSddLFxuICAgICAgICAgIGV2ZW50TmFtZTogW1xuICAgICAgICAgICAgJ0F1dGhlbnRpY2F0ZScsXG4gICAgICAgICAgICAnQXNzdW1lUm9sZVdpdGhTQU1MJyxcbiAgICAgICAgICAgICdBc3N1bWVSb2xlV2l0aFdlYklkZW50aXR5JyxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHRhcmdldHM6IFtcbiAgICAgICAgbmV3IHRhcmdldHMuU25zVG9waWModGhpcy5zZWN1cml0eVRvcGljKSxcbiAgICAgICAgbmV3IHRhcmdldHMuQ2xvdWRXYXRjaExvZ0dyb3VwKFxuICAgICAgICAgIGxvZ3MuTG9nR3JvdXAuZnJvbUxvZ0dyb3VwTmFtZShcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICAnU1NPRXZlbnRzTG9nR3JvdXAnLFxuICAgICAgICAgICAgYC9hd3MvaWRlbnRpdHljZW50ZXIvc2lnbmluLyR7cHJvcHMuZW52aXJvbm1lbnR9YFxuICAgICAgICAgIClcbiAgICAgICAgKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBFdmVudEJyaWRnZSBydWxlIGZvciBJQU0gcm9sZSBhc3N1bXB0aW9uIGV2ZW50c1xuICAgIG5ldyBldmVudHMuUnVsZSh0aGlzLCAnSUFNUm9sZUFzc3VtcHRpb25SdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGBJQU0tUm9sZUFzc3VtcHRpb24tJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgZGVzY3JpcHRpb246ICdDYXB0dXJlIElBTSByb2xlIGFzc3VtcHRpb24gZXZlbnRzJyxcbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnYXdzLnN0cyddLFxuICAgICAgICBkZXRhaWxUeXBlOiBbJ0FXUyBBUEkgQ2FsbCB2aWEgQ2xvdWRUcmFpbCddLFxuICAgICAgICBkZXRhaWw6IHtcbiAgICAgICAgICBldmVudFNvdXJjZTogWydzdHMuYW1hem9uYXdzLmNvbSddLFxuICAgICAgICAgIGV2ZW50TmFtZTogW1xuICAgICAgICAgICAgJ0Fzc3VtZVJvbGUnLFxuICAgICAgICAgICAgJ0Fzc3VtZVJvbGVXaXRoU0FNTCcsXG4gICAgICAgICAgICAnQXNzdW1lUm9sZVdpdGhXZWJJZGVudGl0eScsXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB0YXJnZXRzOiBbXG4gICAgICAgIG5ldyB0YXJnZXRzLkNsb3VkV2F0Y2hMb2dHcm91cChcbiAgICAgICAgICBsb2dzLkxvZ0dyb3VwLmZyb21Mb2dHcm91cE5hbWUoXG4gICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgJ1JvbGVBc3N1bXB0aW9uTG9nR3JvdXBSZWYnLFxuICAgICAgICAgICAgYC9hd3MvaWFtL3JvbGUtYXNzdW1wdGlvbi8ke3Byb3BzLmVudmlyb25tZW50fWBcbiAgICAgICAgICApXG4gICAgICAgICksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gRXZlbnRCcmlkZ2UgcnVsZSBmb3IgYnJlYWstZ2xhc3MgYWNjZXNzXG4gICAgbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdCcmVha0dsYXNzUnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiBgQnJlYWtHbGFzcy1BY2Nlc3MtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgZGVzY3JpcHRpb246ICdJbW1lZGlhdGUgYWxlcnQgZm9yIGJyZWFrLWdsYXNzIGFjY2VzcycsXG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ2F3cy5zdHMnXSxcbiAgICAgICAgZGV0YWlsVHlwZTogWydBV1MgQVBJIENhbGwgdmlhIENsb3VkVHJhaWwnXSxcbiAgICAgICAgZGV0YWlsOiB7XG4gICAgICAgICAgZXZlbnRTb3VyY2U6IFsnc3RzLmFtYXpvbmF3cy5jb20nXSxcbiAgICAgICAgICBldmVudE5hbWU6IFsnQXNzdW1lUm9sZSddLFxuICAgICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICByb2xlQXJuOiBbe1xuICAgICAgICAgICAgICBwcmVmaXg6IGBhcm46YXdzOmlhbTo6JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06cm9sZS9CcmVha0dsYXNzLWBcbiAgICAgICAgICAgIH1dXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB0YXJnZXRzOiBbXG4gICAgICAgIG5ldyB0YXJnZXRzLlNuc1RvcGljKHRoaXMuc2VjdXJpdHlUb3BpYyksXG4gICAgICAgIG5ldyB0YXJnZXRzLkNsb3VkV2F0Y2hMb2dHcm91cChcbiAgICAgICAgICBsb2dzLkxvZ0dyb3VwLmZyb21Mb2dHcm91cE5hbWUoXG4gICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgJ0JyZWFrR2xhc3NMb2dHcm91cFJlZicsXG4gICAgICAgICAgICBgL2F3cy9lbWVyZ2VuY3kvYnJlYWstZ2xhc3MvJHtwcm9wcy5lbnZpcm9ubWVudH1gXG4gICAgICAgICAgKVxuICAgICAgICApLFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlRXZlbnRQcm9jZXNzb3IocHJvcHM6IE1vbml0b3JpbmdTdGFja1Byb3BzKTogdm9pZCB7XG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBwcm9jZXNzaW5nIGlkZW50aXR5IGV2ZW50c1xuICAgIGNvbnN0IGV2ZW50UHJvY2Vzc29yRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdFdmVudFByb2Nlc3NvcicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYElkZW50aXR5RXZlbnRQcm9jZXNzb3ItJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Byb2Nlc3MgaWRlbnRpdHkgYW5kIGFjY2VzcyBtYW5hZ2VtZW50IGV2ZW50cycsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuaW1wb3J0IGpzb25cbmltcG9ydCBib3RvM1xuaW1wb3J0IGxvZ2dpbmdcbmZyb20gZGF0ZXRpbWUgaW1wb3J0IGRhdGV0aW1lXG5cbmxvZ2dlciA9IGxvZ2dpbmcuZ2V0TG9nZ2VyKClcbmxvZ2dlci5zZXRMZXZlbChsb2dnaW5nLklORk8pXG5cbmNsb3Vkd2F0Y2ggPSBib3RvMy5jbGllbnQoJ2Nsb3Vkd2F0Y2gnKVxuc25zID0gYm90bzMuY2xpZW50KCdzbnMnKVxuXG5kZWYgaGFuZGxlcihldmVudCwgY29udGV4dCk6XG4gICAgdHJ5OlxuICAgICAgICAjIFBhcnNlIHRoZSBldmVudFxuICAgICAgICBkZXRhaWwgPSBldmVudC5nZXQoJ2RldGFpbCcsIHt9KVxuICAgICAgICBzb3VyY2UgPSBldmVudC5nZXQoJ3NvdXJjZScsICcnKVxuXG4gICAgICAgICMgRXh0cmFjdCByZWxldmFudCBpbmZvcm1hdGlvblxuICAgICAgICBldmVudF9uYW1lID0gZGV0YWlsLmdldCgnZXZlbnROYW1lJywgJycpXG4gICAgICAgIHNvdXJjZV9pcCA9IGRldGFpbC5nZXQoJ3NvdXJjZUlQQWRkcmVzcycsICcnKVxuICAgICAgICB1c2VyX2lkZW50aXR5ID0gZGV0YWlsLmdldCgndXNlcklkZW50aXR5Jywge30pXG5cbiAgICAgICAgbG9nZ2VyLmluZm8oZlwiUHJvY2Vzc2luZyBldmVudDoge2V2ZW50X25hbWV9IGZyb20ge3NvdXJjZX1cIilcblxuICAgICAgICAjIFNlbmQgY3VzdG9tIG1ldHJpY3NcbiAgICAgICAgbmFtZXNwYWNlID0gJ0lkZW50aXR5U2VjdXJpdHknXG4gICAgICAgIHRpbWVzdGFtcCA9IGRhdGV0aW1lLnV0Y25vdygpXG5cbiAgICAgICAgaWYgJ2ZhaWxlZCcgaW4gZXZlbnRfbmFtZS5sb3dlcigpIG9yIGRldGFpbC5nZXQoJ2Vycm9yQ29kZScpOlxuICAgICAgICAgICAgIyBGYWlsZWQgYXV0aGVudGljYXRpb25cbiAgICAgICAgICAgIGNsb3Vkd2F0Y2gucHV0X21ldHJpY19kYXRhKFxuICAgICAgICAgICAgICAgIE5hbWVzcGFjZT1uYW1lc3BhY2UsXG4gICAgICAgICAgICAgICAgTWV0cmljRGF0YT1bXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdNZXRyaWNOYW1lJzogJ0ZhaWxlZEF1dGhlbnRpY2F0aW9ucycsXG4gICAgICAgICAgICAgICAgICAgICAgICAnRGltZW5zaW9ucyc6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdOYW1lJzogJ0Vudmlyb25tZW50JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1ZhbHVlJzogJyR7cHJvcHMuZW52aXJvbm1lbnR9J1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnTmFtZSc6ICdTb3VyY2VJUCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdWYWx1ZSc6IHNvdXJjZV9pcFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAnVmFsdWUnOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ1RpbWVzdGFtcCc6IHRpbWVzdGFtcFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgKVxuXG4gICAgICAgIGVsaWYgJ0Fzc3VtZVJvbGUnIGluIGV2ZW50X25hbWU6XG4gICAgICAgICAgICByb2xlX2FybiA9IGRldGFpbC5nZXQoJ3JlcXVlc3RQYXJhbWV0ZXJzJywge30pLmdldCgncm9sZUFybicsICcnKVxuXG4gICAgICAgICAgICBpZiAnQnJlYWtHbGFzcycgaW4gcm9sZV9hcm46XG4gICAgICAgICAgICAgICAgIyBCcmVhay1nbGFzcyBhY2Nlc3NcbiAgICAgICAgICAgICAgICBjbG91ZHdhdGNoLnB1dF9tZXRyaWNfZGF0YShcbiAgICAgICAgICAgICAgICAgICAgTmFtZXNwYWNlPW5hbWVzcGFjZSxcbiAgICAgICAgICAgICAgICAgICAgTWV0cmljRGF0YT1bXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ01ldHJpY05hbWUnOiAnQnJlYWtHbGFzc0FjY2VzcycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0RpbWVuc2lvbnMnOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdOYW1lJzogJ0Vudmlyb25tZW50JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdWYWx1ZSc6ICcke3Byb3BzLmVudmlyb25tZW50fSdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ05hbWUnOiAnVXNlck5hbWUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1ZhbHVlJzogdXNlcl9pZGVudGl0eS5nZXQoJ3VzZXJOYW1lJywgJ1Vua25vd24nKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnVmFsdWUnOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdUaW1lc3RhbXAnOiB0aW1lc3RhbXBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgIClcblxuICAgICAgICAgICAgICAgICMgU2VuZCBpbW1lZGlhdGUgU05TIGFsZXJ0XG4gICAgICAgICAgICAgICAgc25zLnB1Ymxpc2goXG4gICAgICAgICAgICAgICAgICAgIFRvcGljQXJuPScke3RoaXMuc2VjdXJpdHlUb3BpYy50b3BpY0Fybn0nLFxuICAgICAgICAgICAgICAgICAgICBTdWJqZWN0PWYnQ1JJVElDQUw6IEJyZWFrLUdsYXNzIEFjY2VzcyBpbiB7cHJvcHMuZW52aXJvbm1lbnR9JyxcbiAgICAgICAgICAgICAgICAgICAgTWVzc2FnZT1mJycnQnJlYWstZ2xhc3MgYWNjZXNzIGRldGVjdGVkOlxuXG5Vc2VyOiB7dXNlcl9pZGVudGl0eS5nZXQoJ3VzZXJOYW1lJywgJ1Vua25vd24nKX1cbiAgICAgICAgICAgICAgICAgICAgUm9sZToge3JvbGVfYXJufVxuICAgICAgICAgICAgICAgICAgICBTb3VyY2UgSVA6IHtzb3VyY2VfaXB9XG4gICAgICAgICAgICAgICAgICAgIFRpbWU6IHt0aW1lc3RhbXB9XG4gICAgICAgICAgICAgICAgICAgIEVudmlyb25tZW50OiAke3Byb3BzLmVudmlyb25tZW50fVxuXG4gICAgICAgICAgICAgICAgICAgIFBsZWFzZSBpbnZlc3RpZ2F0ZSBpbW1lZGlhdGVseS4nJydcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICBlbHNlOlxuICAgICAgICAgICAgICAgICMgUmVndWxhciByb2xlIGFzc3VtcHRpb25cbiAgICAgICAgICAgICAgICBjbG91ZHdhdGNoLnB1dF9tZXRyaWNfZGF0YShcbiAgICAgICAgICAgICAgICAgICAgTmFtZXNwYWNlPW5hbWVzcGFjZSxcbiAgICAgICAgICAgICAgICAgICAgTWV0cmljRGF0YT1bXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ01ldHJpY05hbWUnOiAnUm9sZUFzc3VtcHRpb25zJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnRGltZW5zaW9ucyc6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ05hbWUnOiAnRW52aXJvbm1lbnQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1ZhbHVlJzogJyR7cHJvcHMuZW52aXJvbm1lbnR9J1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnTmFtZSc6ICdSb2xlTmFtZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnVmFsdWUnOiByb2xlX2Fybi5zcGxpdCgnLycpWy0xXSBpZiByb2xlX2FybiBlbHNlICdVbmtub3duJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnVmFsdWUnOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdUaW1lc3RhbXAnOiB0aW1lc3RhbXBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgIClcblxuICAgICAgICBlbGlmIGV2ZW50X25hbWUgaW4gWydBdXRoZW50aWNhdGUnLCAnTG9naW4nXTpcbiAgICAgICAgICAgICMgU3VjY2Vzc2Z1bCBhdXRoZW50aWNhdGlvblxuICAgICAgICAgICAgY2xvdWR3YXRjaC5wdXRfbWV0cmljX2RhdGEoXG4gICAgICAgICAgICAgICAgTmFtZXNwYWNlPW5hbWVzcGFjZSxcbiAgICAgICAgICAgICAgICBNZXRyaWNEYXRhPVtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ01ldHJpY05hbWUnOiAnU3VjY2Vzc2Z1bExvZ2lucycsXG4gICAgICAgICAgICAgICAgICAgICAgICAnRGltZW5zaW9ucyc6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdOYW1lJzogJ0Vudmlyb25tZW50JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1ZhbHVlJzogJyR7cHJvcHMuZW52aXJvbm1lbnR9J1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnTmFtZSc6ICdTb3VyY2VJUCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdWYWx1ZSc6IHNvdXJjZV9pcFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAnVmFsdWUnOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ1RpbWVzdGFtcCc6IHRpbWVzdGFtcFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgKVxuXG4gICAgICAgIHJldHVybiB7J3N0YXR1c0NvZGUnOiAyMDAsICdib2R5JzogJ0V2ZW50IHByb2Nlc3NlZCBzdWNjZXNzZnVsbHknfVxuXG4gICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOlxuICAgICAgICBsb2dnZXIuZXJyb3IoZlwiRXJyb3IgcHJvY2Vzc2luZyBldmVudDoge3N0cihlKX1cIilcbiAgICAgICAgcmV0dXJuIHsnc3RhdHVzQ29kZSc6IDUwMCwgJ2JvZHknOiBmJ0Vycm9yOiB7c3RyKGUpfSd9XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFNOU19UT1BJQ19BUk46IHRoaXMuc2VjdXJpdHlUb3BpYy50b3BpY0FybixcbiAgICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIHRvIHRoZSBMYW1iZGEgZnVuY3Rpb25cbiAgICBldmVudFByb2Nlc3NvckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2Nsb3Vkd2F0Y2g6UHV0TWV0cmljRGF0YScsXG4gICAgICAgICAgJ3NuczpQdWJsaXNoJyxcbiAgICAgICAgICAnbG9nczpDcmVhdGVMb2dHcm91cCcsXG4gICAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nU3RyZWFtJyxcbiAgICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQWRkIExhbWJkYSBhcyB0YXJnZXQgdG8gRXZlbnRCcmlkZ2UgcnVsZXNcbiAgICBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0lkZW50aXR5RXZlbnRzUnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiBgSWRlbnRpdHktRXZlbnRzLVByb2Nlc3Nvci0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JvdXRlIGlkZW50aXR5IGV2ZW50cyB0byBwcm9jZXNzb3IgZnVuY3Rpb24nLFxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogWydhd3Muc3NvJywgJ2F3cy5zdHMnXSxcbiAgICAgICAgZGV0YWlsVHlwZTogWydBV1MgQVBJIENhbGwgdmlhIENsb3VkVHJhaWwnLCAnQVdTIFNTTyBTaWduLWluJ10sXG4gICAgICB9LFxuICAgICAgdGFyZ2V0czogW25ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGV2ZW50UHJvY2Vzc29yRnVuY3Rpb24pXSxcbiAgICB9KTtcblxuICAgIC8vIENESyBOQUcgc3VwcHJlc3Npb25zXG4gICAgTmFnU3VwcHJlc3Npb25zLmFkZFJlc291cmNlU3VwcHJlc3Npb25zKFxuICAgICAgZXZlbnRQcm9jZXNzb3JGdW5jdGlvbixcbiAgICAgIFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnQXdzU29sdXRpb25zLUlBTTQnLFxuICAgICAgICAgIHJlYXNvbjogJ0xhbWJkYSBleGVjdXRpb24gcm9sZSB1c2VzIEFXUyBtYW5hZ2VkIHBvbGljeScsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0F3c1NvbHV0aW9ucy1JQU01JyxcbiAgICAgICAgICByZWFzb246ICdMYW1iZGEgbmVlZHMgd2lsZGNhcmQgcGVybWlzc2lvbnMgZm9yIENsb3VkV2F0Y2ggbWV0cmljcycsXG4gICAgICAgIH0sXG4gICAgICBdXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlU2VjdXJpdHlEYXNoYm9hcmQocHJvcHM6IE1vbml0b3JpbmdTdGFja1Byb3BzKTogdm9pZCB7XG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdJZGVudGl0eVNlY3VyaXR5RGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogYElkZW50aXR5U2VjdXJpdHktJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHdpZGdldHMgdG8gdGhlIGRhc2hib2FyZFxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ0F1dGhlbnRpY2F0aW9uIEV2ZW50cycsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnSWRlbnRpdHlTZWN1cml0eScsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnU3VjY2Vzc2Z1bExvZ2lucycsXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7IEVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCB9LFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgcmlnaHQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnSWRlbnRpdHlTZWN1cml0eScsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnRmFpbGVkQXV0aGVudGljYXRpb25zJyxcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHsgRW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50IH0sXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1JvbGUgQXNzdW1wdGlvbnMnLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ0lkZW50aXR5U2VjdXJpdHknLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1JvbGVBc3N1bXB0aW9ucycsXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7IEVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCB9LFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgcmlnaHQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnSWRlbnRpdHlTZWN1cml0eScsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnQnJlYWtHbGFzc0FjY2VzcycsXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7IEVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCB9LFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlNpbmdsZVZhbHVlV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdDdXJyZW50IFNlY3VyaXR5IFN0YXR1cycsXG4gICAgICAgIG1ldHJpY3M6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnSWRlbnRpdHlTZWN1cml0eScsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnRmFpbGVkQXV0aGVudGljYXRpb25zJyxcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHsgRW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50IH0sXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdJZGVudGl0eVNlY3VyaXR5JyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdCcmVha0dsYXNzQWNjZXNzJyxcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHsgRW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50IH0sXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogMyxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIE91dHB1dFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXNoYm9hcmRVUkwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufS5jb25zb2xlLmF3cy5hbWF6b24uY29tL2Nsb3Vkd2F0Y2gvaG9tZT9yZWdpb249JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufSNkYXNoYm9hcmRzOm5hbWU9JHtkYXNoYm9hcmQuZGFzaGJvYXJkTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdJZGVudGl0eSBTZWN1cml0eSBEYXNoYm9hcmQgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLmVudmlyb25tZW50fS1pZGVudGl0eS1kYXNoYm9hcmQtdXJsYCxcbiAgICB9KTtcbiAgfVxufVxuIl19