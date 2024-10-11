/* global fetch */

import { getToken } from "./src/utils/getToken.mjs";

export const handler = async (event) => {
  try {
    console.log("Lambda Function handler called");
    const { token, dataCloudInstanceUrl } = await getToken();
    const s3Event = JSON.stringify(event);

    // Data Cloud Unstructured data API URL
    const dataCloudRagNotificationUrl = `https://${dataCloudInstanceUrl}/api/v1/unstructuredIngest?sourceType=aws`;

    // Send data to Data Cloud Unstructured data API endpoint
    const dataCloudUnstructuredCallResponse = await fetch(dataCloudRagNotificationUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: s3Event,
    });

    // Check if the response is not successful
    if (!dataCloudUnstructuredCallResponse.ok) {
      const status = dataCloudUnstructuredCallResponse.status;
      const errorText = dataCloudUnstructuredCallResponse.statusText;
      console.error("Data Cloud Unstructured API call Error:", errorText);
      throw new Error(`HTTP error when sending data to Data Cloud Ingestion API, status = ${status}`);
    }

    const data = await dataCloudUnstructuredCallResponse.json();

    console.log("Data Cloud Unstructured API response data:", data);
  } catch (error) {
    console.error("Error has occurred:", error);
  }
};
