import aws4 from "aws4";

const apiHost = process.env.REACT_APP_API_HOST;
const apiStage = process.env.REACT_APP_API_STAGE;
const apiKey = process.env.REACT_APP_API_KEY;
const region = process.env.REACT_APP_REGION;

export async function authenticatedCall(authStore) {
  const opts = {
    method: "GET",
    service: "execute-api",
    region: region,
    path: `/${apiStage}/require-auth`,
    host: apiHost,
    headers: { "x-api-key": apiKey },
    url: `https://${apiHost}/${apiStage}/require-auth`
  };
  const credentials = await authStore.getCredentials();
  const { accessKeyId, secretAccessKey, sessionToken } = credentials;
  const request = aws4.sign(opts, {
    accessKeyId,
    secretAccessKey,
    sessionToken
  });
  delete request.headers.Host;
  const response = await fetch(opts.url, {
    headers: request.headers
  });
  if (response.ok) {
    return await response.json();
  } else return { message: response.statusText };
}

export async function noAuthCall(authStore) {
  const response = await fetch(`https://${apiHost}/${apiStage}/no-auth`, {
    headers: { "x-api-key": apiKey }
  });
  return await response.json();
}
