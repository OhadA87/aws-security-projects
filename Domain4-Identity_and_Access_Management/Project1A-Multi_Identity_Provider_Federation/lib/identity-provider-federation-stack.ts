import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { getAuth0Config } from '../config/auth0-config';

export interface IdentityProviderFederationStackProps extends cdk.StackProps {
  environment: string;
  config: {
    enableCloudTrail: boolean;
    enableGuardDuty: boolean;
    retentionDays: number;
  };
}

export class IdentityProviderFederationStack extends cdk.Stack {
  public readonly identityCenterArn: string;
  public readonly identityStoreId: string;
  public readonly kmsKey: kms.Key;

  constructor(scope: Construct, id: string, props: IdentityProviderFederationStackProps) {
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
      // Note: AWSSSODirectoryReadOnlyAccess policy may not exist in all accounts
      // Using basic read permissions instead
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

    // SAML Identity Provider configuration for Auth0
    const samlProvider = new iam.SamlProvider(this, 'SAMLProvider', {
      name: `Auth0-SAML-${props.environment}`,
      metadataDocument: iam.SamlMetadataDocument.fromXml(
        // Real Auth0 SAML metadata
        '<EntityDescriptor entityID="urn:aws-security-project-0an.us.auth0.com" xmlns="urn:oasis:names:tc:SAML:2.0:metadata"><IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"><KeyDescriptor use="signing"><KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><X509Data><X509Certificate>MIIDJTCCAg2gAwIBAgIJENKReOgvuzXBMA0GCSqGSIb3DQEBCwUAMDAxLjAsBgNVBAMTJWF3cy1zZWN1cml0eS1wcm9qZWN0LTBhbi51cy5hdXRoMC5jb20wHhcNMjUwNzMxMTY1ODQxWhcNMzkwNDA5MTY1ODQxWjAwMS4wLAYDVQQDEyVhd3Mtc2VjdXJpdHktcHJvamVjdC0wYW4udXMuYXV0aDAuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA8OIBL79A6x548gINxWvsc0mHwkfvr8TohrXQtn/y5EGZ2PsGf008kwKvp60rE+FmjQ2MwovOIjugxEQ15mvjEePORKva3VCwXYJjNwt8mK+qScNz9u9lf11CMIcylD7m1QuyRglk55aFgp8eiRN/PFjvgw/6kAKNrwpO+L6Ocew8iRCklgFRjJaLrK9rMmqRcrBM3d50CfF0X4qDhz/2QBAsW5y04/I4rEzb7tFKZ35MUxbHyCY21jqqCgUeTBE8TXqnlfbf+1fgHyurJnyej78j6DRT1iyg2o0OKVgZwp7GJP8oLkk13pdm4xiYR7PmpYEcHUCw3UXdxVjBTbhfQQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSwVXq0HBvZhYGxaePNvBkVvX+DSzAOBgNVHQ8BAf8EBAMCAoQwDQYJKoZIhvcNAQELBQADggEBAJ9OVpCMp2dGiU/LQCTxy8fUOtAMcYYwdk3gvGLsASk6Y3Ojnm0EmwE4lY3M2+seZh8igMFuf+/LwqMSn/NMKn5VutGifmeY9X6t53xQJKoagDnqBdn4CLY6faQ9LSl5AG+nvU3kJiuqkNcMGBLTv6ezgIaDiic8quiEUcHtZ62imMuy0I7ja7GKTC00e9ZIwpbAEGgea3sR8g/9tsEUwf1guALmbm+G+3ukKsLQAuOc+P3JaeouP8P4L5o60BqjQqjd/PzM787bKh+/NpGW4NpUPbhvf2ZLCnOmEPMfDdDAWD5ADaMaRODNVNb3mVZ+jcRv27RmeVs4CUows38bHsk=</X509Certificate></X509Data></KeyInfo></KeyDescriptor><SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://aws-security-project-0an.us.auth0.com/samlp/MQz6OQsZNq64hNIsjQ9mTteDFL3iLKgS/logout"/><SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://aws-security-project-0an.us.auth0.com/samlp/MQz6OQsZNq64hNIsjQ9mTteDFL3iLKgS/logout"/><NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat><NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</NameIDFormat><NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:transient</NameIDFormat><SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://aws-security-project-0an.us.auth0.com/samlp/MQz6OQsZNq64hNIsjQ9mTteDFL3iLKgS"/><SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://aws-security-project-0an.us.auth0.com/samlp/MQz6OQsZNq64hNIsjQ9mTteDFL3iLKgS"/><Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" FriendlyName="E-Mail Address" xmlns="urn:oasis:names:tc:SAML:2.0:assertion"/><Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" FriendlyName="Given Name" xmlns="urn:oasis:names:tc:SAML:2.0:assertion"/><Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" FriendlyName="Name" xmlns="urn:oasis:names:tc:SAML:2.0:assertion"/><Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" FriendlyName="Surname" xmlns="urn:oasis:names:tc:SAML:2.0:assertion"/><Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" FriendlyName="Name ID" xmlns="urn:oasis:names:tc:SAML:2.0:assertion"/></IDPSSODescriptor></EntityDescriptor>'
      ),
    });

    // OIDC Identity Provider configuration for Auth0
    const auth0Config = getAuth0Config(props.environment);
    const oidcProvider = new iam.OpenIdConnectProvider(this, 'Auth0OIDCProvider', {
      url: `https://${auth0Config.domain}`,
      clientIds: [auth0Config.clientId],
      thumbprints: ['9e99a48a9960b14926bb7e3b6e3f1c478a45c21b'], // Auth0 thumbprint
    });

    // Cross-account access role for identity federation (supports both SAML and OIDC)
    const federationRole = new iam.Role(this, 'FederationRole', {
      roleName: `IdentityFederation-${props.environment}`,
      assumedBy: new iam.CompositePrincipal(
        // SAML Identity Provider
        new iam.SamlPrincipal(samlProvider, {
          'StringEquals': {
            'SAML:aud': 'https://signin.aws.amazon.com/saml',
          },
        }),
        // OIDC Identity Provider  
        new iam.WebIdentityPrincipal(oidcProvider.openIdConnectProviderArn, {
          'StringEquals': {
            [`${auth0Config.domain}:aud`]: auth0Config.clientId,
          },
        })
      ),
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
    federationRole.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
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
      })
    );

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
    NagSuppressions.addResourceSuppressions(
      samlProvider,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Demo SAML metadata document - would be real in production',
        },
      ]
    );

    NagSuppressions.addResourceSuppressions(
      oidcProvider,
      [
        {
          id: 'AwsSolutions-IAM3',
          reason: 'Demo OIDC configuration - would be real thumbprints in production',
        },
      ]
    );
  }
}