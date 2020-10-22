const { expect, matchTemplate, MatchStyle } = require('@aws-cdk/assert');
const cdk = require('@aws-cdk/core');
const CognitoApiDemo = require('../lib/cognito-api-demo-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new CognitoApiDemo.CognitoApiDemoStack(app, 'MyTestStack');
    // THEN
    expect(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
