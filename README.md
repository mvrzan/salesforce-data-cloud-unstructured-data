<p align="center">
<a  href="https://www.salesforce.com/"><img  src="./screenshots/salesforce-logo.svg"  alt="Salesforce"  width="150" height="150" hspace="50" /></a>
<a  href="https://www.salesforce.com/data/"><img  src="./screenshots/data-cloud-logo.png"  alt="Data Cloud"  width="150" height="150" hspace="50"/></a>
<a  href="https://aws.amazon.com/"><img  src="./screenshots/aws-logo.png"  alt="Amazon Web Services"  width="150" height="150"  hspace="50"/></a>
<p/>

# Data Cloud and Unstructured Data Ingestion

This project showcases how to configure an S3 notification pipeline with Data Cloud's Unstructured endpoint with JavaScript and AWS SAM.

# Table of Contents

- [Data Cloud and Unstructured Data Ingestion](#data-cloud-and-unstructured-data-ingestion)
- [Table of Contents](#table-of-contents)
  - [What does it do?](#what-does-it-do)
  - [How does it work?](#how-does-it-work)
    - [Architecture diagram](#architecture-diagram)
- [Configuration](#configuration)
  - [Requirements](#requirements)
  - [Deployment to AWS](#deployment-to-aws)
    - [Where to get the variables](#where-to-get-the-variables)
    - [YAML template updates](#yaml-template-updates)
    - [AWS SAM deployment](#aws-sam-deployment)
- [License](#license)
- [Disclaimer](#disclaimer)

---

## What does it do?

Data Cloud has the capability to [bring unstructured data into Data Cloud](https://help.salesforce.com/s/articleView?id=sf.c360_a_unstructured_data_connect_overview.htm&type=5). It achieves this by [sending an upload file notification](https://help.salesforce.com/s/articleView?id=sf.c360_a_unstructured_data_creating_file_notifications.htm&type=5) from an external blob store (AWS, Azure, or GCP) to Data Cloud's unstructured endpoint.

It is worth mentioning that there is an [official documentation](https://help.salesforce.com/s/articleView?id=sf.c360_a_unstructured_data_s3_create_file_notification.htm&type=5) on how to create a notificaiton pipeline within AWS via a [bash script](https://github.com/forcedotcom/file-notifier-for-blob-store/tree/main/installers/aws) and a [python lambda function](https://github.com/forcedotcom/file-notifier-for-blob-store/blob/main/cloud_function_zips/aws_lambda_function.zip).

The main difference with this project is that it is using AWS SAM template for deployment rather than a bash script and the Lambda function is written in node rather than python.

The provided node.js function handles the following:

- Detects the incoming S3 file upload notification/event
- Reads from DynamoDB for the token value and expiration
- If the token has expired, it fetches sensitive environment variables from the Secrets Manager
- Fetches the Salesforce Access Token
- Exchanges the Salesforce Access Token for Data Cloud Access Token
- Caches the new token into the non-SQL database for future use
- Finally, it sends the S3 notification event to the Data Cloud unstructured API

After this flow is finished, Data Cloud will use the configured S3 connection to download the uploaded file into Data Cloud to perform vectorization of the unstructured file. The results of this operation are then seen in the [Unstructured Data Lake Objects (UDLOs)](https://help.salesforce.com/s/articleView?id=sf.c360_a_unstructured_data_udlo_overview.htm&language=en_US&type=5).

## How does it work?

### Architecture diagram

![](./screenshots/architecture-diagram.png)

# Configuration

## Requirements

In order to test this out, you will need several things:

- A valid [AWS account](https://aws.amazon.com/)
- A Salesforce account with [Data Cloud](https://www.salesforce.com/data/) deployed
- A [Basic Connected App](https://help.salesforce.com/s/articleView?id=sf.connected_app_create_basics.htm&type=5) within Salesforce
- [Enable Oauth settings for the API integration](https://help.salesforce.com/s/articleView?id=sf.connected_app_create_api_integration.htm&type=5)

## Deployment to AWS

As stated before, this is a simple example how to deploy this solution to AWS using the Serverless Application Model, also known as SAM. In this walkthrough, the [AWS CloudShell](https://docs.aws.amazon.com/cloudshell/latest/userguide/getting-started.html) will be used instead of a local terminal.

> NOTE: Read before you begin.
> In this example, the Connected App is configured to use a JWT and it uses the RSA_Private_Key. If you want to use a simple Oauth Flow, you will have to update the following:
>
> - update the [YAML file](./aws/template.yaml#108) with your `CLIENT_ID` and `CLIENT_SECRET`
> - update the [code logic](./aws/src/utils/getToken.mjs#77) to use the alternative payload. Uncomment the commented code
> - update the [code logic](./aws/src/utils/getToken.mjs#104) to send the altreantive payload instead of the previous payload. Make sure you comment or remove the previous line

The first step is to update the `template.yaml` file with your environment-specific secrets. The following values need to be updated in the `template.yaml` file:

```
        {
          "CLIENT_ID": "2MO_w2n1AqT7ItBzfdas342fdasf897fdas",
          "USERNAME": "john.doe@example.com",
          "LOGIN_URL": "login.salesforce.com",
          "RSA_PRIVATE_KEY": "V3Q2RQZm93eGFvZW13Vys5OGFnQ1dCQTErZGlNMTkrc...",
        }
```

### Where to get the variables

CLIENT_ID can be gathered from the Connect App within the Salesforce instance and it is labeled `Consumer Key` once the Connected App is created.
USERNAME is the email address of the user logging into Salesforce
LOGIN_URL is exactly as the variable states `login.salesforce.com` and you can leave that one as is.
RSA_PRIVATE_KEY is the private key generated by your certificate and it comes in the following format:

```
-----BEGIN RSA PRIVATE KEY-----
MIIBOgIBAAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf9Cnzj4p4WGeKLs1Pt8Qu
KUpRKfFLfRYC9AIKjbJTWit+CqvjWYzvQwECAwEAAQJAIJLixBy2qpFoS4DSmoEm
o3qGy0t6z09AIJtH+5OeRV1be+N4cDYJKffGzDa88vQENZiRm0GRq6a+HPGQMd2k
TQIhAKMSvzIBnni7ot/OSie2TmJLY4SwTQAevXysE2RbFDYdAiEBCUEaRQnMnbp7
9mxDXDf6AU0cN/RPBjb9qSHDcWZHGzUCIG2Es59z8ugGrDY+pxLQnwfotadxd+Uy
v/Ow5T0q5gIJAiEAyS4RaI9YG8EWx/2w0T67ZUVAw8eOMB6BIUg0Xcu+3okCIBOs
/5OiPgoTdSy7bcF9IGpSE8ZgGKzgYQVZeN97YE00
-----END RSA PRIVATE KEY-----
```

Make a copy of your key (yes, all of it) and encode it to a base64 format. This can be done by simply going to any base64 encode website (here's an example: https://www.base64encode.org/) and then take the note of the encoded string:

```
LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlCT2dJQkFBSkJBS2ozNEdreEZoRDkwdmNOTFlMSW5GRVg2UHB5MXRQZjlDbnpqNHA0V0dlS0xzMVB0OFF1CktVcFJLZkZMZlJZQzlBSUtqYkpUV2l0K0NxdmpXWXp2UXdFQ0F3RUFBUUpBSUpMaXhCeTJxcEZvUzREU21vRW0KbzNxR3kwdDZ6MDlBSUp0SCs1T2VSVjFiZStONGNEWUpLZmZHekRhODh2UUVOWmlSbTBHUnE2YStIUEdRTWQyawpUUUloQUtNU3Z6SUJubmk3b3QvT1NpZTJUbUpMWTRTd1RRQWV2WHlzRTJSYkZEWWRBaUVCQ1VFYVJRbk1uYnA3CjlteERYRGY2QVUwY04vUlBCamI5cVNIRGNXWkhHelVDSUcyRXM1OXo4dWdHckRZK3B4TFFud2ZvdGFkeGQrVXkKdi9PdzVUMHE1Z0lKQWlFQXlTNFJhSTlZRzhFV3gvMncwVDY3WlVWQXc4ZU9NQjZCSVVnMFhjdSszb2tDSUJPcwovNU9pUGdvVGRTeTdiY0Y5SUdwU0U4WmdHS3pnWVFWWmVOOTdZRTAwCi0tLS0tRU5EIFJTQSBQUklWQVRFIEtFWS0tLS0t
```

This encoded string is going to be your `RSA_PRIVATE_KEY` variable.

**Note:** We have encoded the key because otherwise, the Secrets Manager would break the formatting casing issues with the authentication.

### YAML template updates

Once you have all the variables in your `template.yaml` file, save the file and proceed to the next step.

The next step is to zip the `aws` folder. This means you will zip the following files and folders:

```
aws
  |-- template.yaml
  |-- node_modules/
  |-- src/
        |-- utils
              |-- getToken.mjs
  |-- index.mjs
  |-- package.json
  |-- package-lock.json
```

> Does this structure matter? Yes, it does matter as a specific folder structure has to be followed when uploading a Lambda function.

### AWS SAM deployment

Log into the AWS Console and open the AWS CloudShell by clicking on the CloudShell icon in the bottom left of the AWS Console.

Once the CloudShell terminal opens, on the right-hand side, you will see a button labeled **Actions**. Click on it and select **Upload file** and select your the newly created `zip` file.

Run the following commands in the CloudShell:

```
unzip <name-of-your-zip-file>
cd <name-of-your-unzipped-folder>
sam build
```

Once the build step finishes, run the following command:

```
sam deploy --guided
```

This step will guide you through the deployment and ask the following questions:

```
 Stack Name [sam-app]: the name of the CloudFormation stack that will be deployed

 AWS Region [us-east-2]: default AWS region where this stack will be deployed

 Shows you resources changes to be deployed and require a 'Y' to initiate deploy: do you want an extra validation step before deploying the resources

 SAM needs permission to be able to create roles to connect to the resources in your template: allow SAM to create roles to connect the necessary resources

 preserves the state of previously provisioned resources when an operation fails: do you want to keep the deployed resources in case something fails

 Save arguments to configuration file [Y/n]: Do you want to save the arguments for future use?

```

That is it! You have successfully deployed this project into an AWS account using SAM. Once this is done, you will fined the appropriate resources created within your AWS account. Now you can navigate to your newly created S3 bucket and upload a file to be picked up by Data Cloud's vectorization process.

# License

[MIT](http://www.opensource.org/licenses/mit-license.html)

# Disclaimer

This software is to be considered "sample code", a Type B Deliverable, and is delivered "as-is" to the user. Salesforce bears no responsibility to support the use or implementation of this software.
