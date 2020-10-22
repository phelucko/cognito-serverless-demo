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

    // Setup CDN
    const distribution = new cloudfront.CloudFrontWebDistribution(this, 'CognitoServerlessDemoDistribution', {
      originConfigs: [
        {
          s3OriginSource: { s3BucketSource: bucket },
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
    });

    // Save distribution URL to output
    const entrypoint = new cdk.CfnOutput(this, 'CognitoServerlessDemoUrl', {
      value: `https://${distribution.distributionDomainName}`,
    });

    // Setup origin access identity
    const oai = new cloudfront.OriginAccessIdentity(this, 'CognitoServerlessDemoOai', {
      comment: 'Congito Serverless Demo OAI',
    });

    // Setup bucket permissions
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: 'Allow',
      actions: ['s3:GetObject'],
      principals: [
        new iam.CanonicalUserPrincipal(
          oai.cloudFrontOriginAccessIdentityS3CanonicalUserId,
        ),
      ],
      resources: [`arn:aws:s3:::${bucket.bucketName}/*`],
    }));

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
      autoVerify: {
        email: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    userPool.addClient('CognitoServerlessDemoUserPoolClient', {
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

    userPool.addDomain('CognitoServerlessDemoUserPoolDomain', {
      cognitoDomain: {
        domainPrefix: 'auth-serverless-demo',
      },
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
    noAuth.addMethod('GET', integration, {
      apiKeyRequired: true,
    });
    noAuth.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET', 'OPTIONS'],
    });

    const requireAuth = api.root.addResource('require-auth');
    requireAuth.addMethod('GET', integration, {
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
  }
}

module.exports = { CognitoServerlessDemoStack };
