# Securing Microservices on AWS with Cognito, API Gateway and Lambda

This demo is based on [https://github.com/csepulv/auth-api-demo](https://github.com/csepulv/auth-api-demo). Most of the manual setups are automated using AWS CDK.

# Lambda Setup

Go to the `assets/lambda` directory and run `npm install` to install the required packages for the lambda function.

# CDK Deployment

Go to the `cdk` directory and run the following commands.

1. Run `npm install` to install the required packages.
2. Run `cdk bootstrap`. This is required to deploy the necessary resources (e.g. S3 bucket) required by CDK.
3. Run `cdk deploy`. This deploys most of the resources used in this demo including Cognito User Pool, Lambda function, API Gateway.

# Identity Pool

Because the current version of CDK doesn't support Cognito Identity Pool, we need to create and configure it manually.

1. From the Cognito main page, click **Manage Identity Pools**, then click **Create new identity pool**.
2. Under Authentication Providers, enter the `User Pool ID` and `App Client ID` created in the earlier steps.
3. Check `Enable access to unauthenticated identities`.
4. Click **Create new role** for `Unauthenticated Role` and `Authenticated Role`.

# IAM

The `authenticated user role` needs to be edited to provide access to appropriate API resources.

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "execute-api:Invoke"
      ],
      "Resource": "<ARN FOR REQUIRE-AUTH API RESOURCE>",
      "Effect": "Allow"
    }
  ]
}
```

# Web UI

The front end of this demo is a React app. We will deploy it as an S3 static website and create a CloudFront distribution.

To deploy the React app:

1. Go to the `web-ui` directory.
2. Run `npm install`.
3. Copy `sample.env` to `.env` and update the parameters.
4. Run `npm run build`.
5. Run `aws s3 cp build s3://cognito-serverless-demo-web --recursive`.
