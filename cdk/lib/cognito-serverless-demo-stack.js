const path = require('path');
const cdk = require('@aws-cdk/core');
const cognito = require('@aws-cdk/aws-cognito');
const lambda = require('@aws-cdk/aws-lambda');
const apigateway = require('@aws-cdk/aws-apigateway');
const s3 = require('@aws-cdk/aws-s3');
const cloudfront = require('@aws-cdk/aws-cloudfront');
const iam = require('@aws-cdk/aws-iam');

class CognitoServerlessDemoStack extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // Setup static frontend
    const bucket = new s3.Bucket(this, 'CognitoServerlessDemoWeb', {
      bucketName: 'cognito-serverless-demo-web',
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
    });

    // Setup origin access identity
    const oai = new cloudfront.OriginAccessIdentity(this, 'CognitoServerlessDemoOai', {
      comment: 'Congito Serverless Demo OAI',
    });

    // Setup CDN
    const distribution = new cloudfront.CloudFrontWebDistribution(
      this,
      'CognitoServerlessDemoDistribution',
      {
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: bucket,
              originAccessIdentity: oai,
            },
            behaviors: [{ isDefaultBehavior: true }],
          },
        ],
        errorConfigurations: [
          {
            errorCode: 403,
            responseCode: 200,
            responsePagePath: '/index.html',
            errorCachingMinTtl: 86400,
          },
          {
            errorCode: 404,
            responseCode: 200,
            responsePagePath: '/index.html',
            errorCachingMinTtl: 86400,
          },
        ],
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    );

    // Save distribution URL to output
    const entrypoint = new cdk.CfnOutput(this, 'CognitoServerlessDemoUrl', {
      value: `https://${distribution.distributionDomainName}`,
    });

    // Setup lambda
    const backend = new lambda.Function(this, 'CognitoServerlessDemoLambda', {
      runtime: lambda.Runtime.NODEJS_10_X,
      handler: 'api.proxyRouter',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../assets/lambda')),
    });

    // Setup API Gateway
    const api = new apigateway.LambdaRestApi(this, 'CognitoServerlessDemoApi', {
      handler: backend,
      proxy: false,
    });

    const integration = new apigateway.LambdaIntegration(backend);

    const noAuth = api.root.addResource('no-auth');
    const noAuthMethod = noAuth.addMethod('GET', integration, {
      apiKeyRequired: true,
    });
    noAuth.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET', 'OPTIONS'],
    });

    const requireAuth = api.root.addResource('require-auth');
    const requireAuthMethod = requireAuth.addMethod('GET', integration, {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.IAM,
    });
    requireAuth.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET', 'OPTIONS'],
    });

    const key = api.addApiKey('CognitoServerlessDemoApiKey', {
      apiKeyName: 'cognito-severless-demo',
    });

    const plan = api.addUsagePlan('CognitoServerlessDemoApiUsagePlan', {
      name: 'Basic',
      apiKey: key,
      throttle: {
        rateLimit: 5,
        burstLimit: 10,
      },
      quota: {
        limit: 100,
        period: apigateway.Period.DAY,
      },
    });

    plan.addApiStage({
      stage: api.deploymentStage,
    });

    // Setup user pool
    const userPool = new cognito.UserPool(this, 'CognitoServerlessDemoUserPool', {
      userPoolName: 'cognito-serverless-demo',
      signInAliases: {
        email: true,
        username: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        familyName: {
          required: true,
        },
        givenName: {
          required: true,
        },
      },
      selfSignUpEnabled: false,
      signInCaseSensitive: false,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 6,
        requireDigits: false,
        requireSymbols: false,
        requireUppercase: false,
      },
    });

    const userPoolClient = userPool.addClient('CognitoServerlessDemoUserPoolClient', {
      userPoolClientName: 'cognito-serverless-demo-client',
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      preventUserExistenceErrors: true,
      oAuth: {
        callbackUrls: [
          'http://localhost:3000/authenticated',
          `${entrypoint.value}/authenticated`,
        ],
        logoutUrls: [
          'http://localhost:3000/signedout',
          `${entrypoint.value}/signedout`,
        ],
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PHONE,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
      },
      authFlows: {
        adminUserPassword: false,
        custom: false,
        userPassword: false,
        userSrp: false,
      },
    });

    // Save user pool id to output
    new cdk.CfnOutput(this, 'CognitoServerlessDemoUserPoolId', {
      value: userPool.userPoolId,
    });

    // Save user pool client id to output
    new cdk.CfnOutput(this, 'CognitoServerlessDemoUserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });

    userPool.addDomain('CognitoServerlessDemoUserPoolDomain', {
      cognitoDomain: {
        domainPrefix: 'auth-serverless-demo',
      },
    });

    // Setup identity pool
    const identityPool = new cognito.CfnIdentityPool(
      this,
      'CognitoServerlessDemoIdentityPool',
      {
        identityPoolName: 'cognito_serverless_demo',
        allowUnauthenticatedIdentities: true,
        cognitoIdentityProviders: [
          {
            clientId: userPoolClient.userPoolClientId,
            providerName: `cognito-idp.us-east-1.amazonaws.com/${userPool.userPoolId}`,
            serverSideTokenCheck: true,
          },
        ],
      },
    );

    // Save identity pool id to output
    new cdk.CfnOutput(this, 'CognitoServerlessDemoIdentityPoolId', {
      value: identityPool.ref,
    });

    const authRole = new iam.Role(
      this,
      'CognitoServerlessDemoIdentityPoolAuthRole',
      {
        assumedBy: new iam.FederatedPrincipal(
          'cognito-identity.amazonaws.com',
          {
            StringEquals: {
              'cognito-identity.amazonaws.com:aud': identityPool.ref,
            },
            'ForAnyValue:StringLike': {
              'cognito-identity.amazonaws.com:amr': 'authenticated',
            },
          },
          'sts:AssumeRoleWithWebIdentity',
        ),
      },
    );

    authRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'mobileanalytics:PutEvents',
          'cognito-sync:*',
          'cognito-identity:*',
        ],
        resources: ['*'],
      }),
    );

    authRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:invoke'],
        resources: [requireAuthMethod.methodArn],
      }),
    );

    const unauthRole = new iam.Role(
      this,
      'CognitoServerlessDemoIdentityPoolUnauthRole',
      {
        assumedBy: new iam.FederatedPrincipal(
          'cognito-identity.amazonaws.com',
          {
            StringEquals: {
              'cognito-identity.amazonaws.com:aud': identityPool.ref,
            },
            'ForAnyValue:StringLike': {
              'cognito-identity.amazonaws.com:amr': 'unauthenticated',
            },
          },
          'sts:AssumeRoleWithWebIdentity',
        ),
      },
    );

    unauthRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'mobileanalytics:PutEvents',
          'cognito-sync:*',
        ],
        resources: ['*'],
      }),
    );

    unauthRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:invoke'],
        resources: [noAuthMethod.methodArn],
      }),
    );

    new cognito.CfnIdentityPoolRoleAttachment(
      this,
      'CognitoServerlessDemoIdentityPoolRoleAttachment',
      {
        identityPoolId: identityPool.ref,
        roles: {
          authenticated: authRole.roleArn,
          unauthenticated: unauthRole.roleArn,
        },
      },
    );
  }
}

module.exports = { CognitoServerlessDemoStack };
