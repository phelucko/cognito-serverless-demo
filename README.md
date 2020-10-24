# Securing Microservices on AWS with Cognito, API Gateway and Lambda

This demo is based on [https://github.com/csepulv/auth-api-demo](https://github.com/csepulv/auth-api-demo). All the steps are automated using AWS CDK.

# Lambda Setup

Go to the `assets/lambda` directory and run `npm install` to install the required packages for the lambda function.

# CDK Deployment

Go to the `cdk` directory and run the following commands.

1. Run `npm install` to install the required packages.
2. Run `cdk bootstrap`. This is required to deploy the necessary resources (e.g. S3 bucket) required by CDK.
3. Run `cdk deploy`. This deploys all the resources used in this demo.

# Web UI

To deploy the React app:

1. Go to the `web-ui` directory.
2. Run `npm install`.
3. Copy `sample.env` to `.env` and update the parameters.
4. Run `npm run build`.
5. Run `aws s3 cp build s3://cognito-serverless-demo-web --recursive`.
