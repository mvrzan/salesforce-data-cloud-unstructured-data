/* global fetch */

import jwt from "jsonwebtoken";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// create global variables for cache
let cachedJwt; // JWT token
let cachedJwtExpiresAt; // JWT token expiration time
let dataCloudInstanceUrl; // Data Cloud instance URL
let fetchedDataCloudToken; // Data Cloud token fetched from the token exchange
let secret; // Secrets Manager object

// initialize DynamoDB client
const dynamodbClient = new DynamoDBClient();
const dynamo = DynamoDBDocumentClient.from(dynamodbClient);
const tableName = process.env.DYNAMODB_TABLE_NAME;

// initialize AWS Secrets Manager client
const secret_name = process.env.SECRET_NAME;
const client = new SecretsManagerClient({
  region: process.env.SECRET_REGION,
});

export const getToken = async () => {
  try {
    // check if the secret is empty
    if (!secret) {
      console.log("No cached secrets found. Fetching new secrets!");

      // get the secrets from AWS Secrets Manager
      const secretResponse = await client.send(
        new GetSecretValueCommand({
          SecretId: secret_name,
          VersionStage: "AWSCURRENT",
        })
      );

      // parse the secret string on a global variable
      secret = JSON.parse(secretResponse.SecretString);
    }

    // check if the JWT token is empty
    if (!cachedJwt) {
      console.log("No cached JWT token found. Fetching a new token!");

      // fetch the last JWT token from the DynamoDB table
      const { Items } = await dynamo.send(
        new ScanCommand({
          TableName: tableName,
        })
      );

      // check if there is a JWT token in the DynamoDB table
      if (Items.length >= 1) {
        const lastRecord = Items[Items.length - 1];
        cachedJwt = lastRecord.jwt;
        cachedJwtExpiresAt = lastRecord.expires_at;
        dataCloudInstanceUrl = lastRecord.dataCloudInstanceUrl;
      }
    }

    // check if the token is still valid
    if (!cachedJwtExpiresAt || cachedJwtExpiresAt - Math.round(Date.now() / 1000) < 3600) {
      console.log("Token is expired. Fetching a new token!");

      // define jwt payload
      const tokenPayload = {
        iss: secret.CLIENT_ID,
        sub: secret.USERNAME,
        aud: secret.LOGIN_URL,
        exp: Math.round(Date.now() / 1000),
      };

      // decode base64 encoded rsa key from the AWS Secret Manager
      const rsaKey = Buffer.from(secret.RSA_PRIVATE_KEY, "base64").toString("ascii");

      // create and sign jwt
      const token = jwt.sign(tokenPayload, rsaKey, {
        algorithm: "RS256",
      });

      // Salesforce CRM Access Token Payload
      const salesforceCrmTokenPayload = new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: token,
      });

      // Salesforce CRM Access Token Request
      const salesforceCrmResponse = await fetch(`https://${secret.LOGIN_URL}/services/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: salesforceCrmTokenPayload,
      });

      if (!salesforceCrmResponse.ok) {
        throw new Error("HTTP error, status = " + salesforceCrmResponse.status);
      }

      const salesforceCrmResponseData = await salesforceCrmResponse.json();

      // Data Cloud Token Exchange Payload
      const dataCloudPayload = new URLSearchParams({
        grant_type: "urn:salesforce:grant-type:external:cdp",
        subject_token: salesforceCrmResponseData.access_token,
        subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      });

      // Data Cloud Token Exchange Request
      const dataCloudResponse = await fetch(`${salesforceCrmResponseData.instance_url}/services/a360/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: dataCloudPayload,
      });

      if (!dataCloudResponse.ok) {
        const status = dataCloudResponse.status;
        const errorText = dataCloudResponse.statusText;
        console.error("Data Cloud Token Exchange Error:", errorText);
        throw new Error(`HTTP error when exchanging token with Data Cloud, status = ${status}`);
      }

      // parse the response from the Data Cloud token exchange
      const dataCloudResponseData = await dataCloudResponse.json();
      const dataCloudInstanceUrl = dataCloudResponseData.instance_url;

      // store the fetched JWT token and its expiration time
      fetchedDataCloudToken = dataCloudResponseData.access_token;

      // save jwt token to dynamodb
      const tokenExpiration = dataCloudResponseData.expires_in + Math.round(Date.now() / 1000);

      await dynamo.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            jwt: dataCloudResponseData.access_token,
            expires_at: tokenExpiration,
            dataCloudInstanceUrl,
          },
        })
      );

      return {
        token: fetchedDataCloudToken,
        dataCloudInstanceUrl,
      };
    }

    return {
      token: cachedJwt,
      dataCloudInstanceUrl,
    };
  } catch (error) {
    console.error("Error has occurred:", error);
    const errorResponse = {
      statusCode: 500,
      body: JSON.stringify(`There was an issue with the Lambda helper function: ${error}`),
    };

    return errorResponse;
  }
};
