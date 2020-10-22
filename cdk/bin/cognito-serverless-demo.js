#!/usr/bin/env node

const cdk = require('@aws-cdk/core');
const { CognitoServerlessDemoStack } = require('../lib/cognito-serverless-demo-stack');

const app = new cdk.App();
new CognitoServerlessDemoStack(app, 'CognitoServerlessDemoStack');
