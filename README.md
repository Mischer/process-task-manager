# Process Task Manager

A fault-tolerant backend system built with AWS Lambda, API Gateway, SQS, and DynamoDB.  
It processes tasks asynchronously with retries, exponential backoff, and DLQ monitoring.

## Features

- **API Gateway + Lambda** — Task submission endpoint
- **SQS** — Asynchronous task queue
- **DynamoDB** — Task persistence & idempotency
- **Dead Letter Queue (DLQ)** — Failed task inspection
- **CloudWatch Logs** — Monitoring and debugging
- **Exponential Backoff** — Retry failed tasks
- **Smoke Test Script** — Quick E2E testing

## Requirements

- Node.js **20+**
- Serverless Framework **4.18+**
- AWS CLI configured with a profile that has permissions for:
  - CloudFormation
  - IAM
  - Lambda
  - API Gateway
  - SQS
  - DynamoDB
  - CloudWatch

## Deploy

```sh
npm ci
npm run deploy -- --stage dev --region eu-central-1 --aws-profile <your-profile>
```

## Smoke Test

### Full configuration
```sh
AWS_PROFILE=<your-profile> \
AWS_REGION="eu-central-1" \
AWS_SDK_LOAD_CONFIG=1 \
TASKS_ENDPOINT="https://<api_id>.execute-api.eu-central-1.amazonaws.com/tasks" \
TASKS_TABLE="process-task-manager-dev-tasks" \
SMOKE_TASK_COUNT=10 \
SMOKE_TIMEOUT_MS=60000 \
SMOKE_INTERVAL_MS=3000 \
npm run smoke
```

## Logs

```sh
npm run info -- --stage dev --region eu-central-1 --aws-profile <your-profile>
serverless logs -f submitTask -t --stage dev --region eu-central-1 --aws-profile <your-profile>
serverless logs -f processTask -t --stage dev --region eu-central-1 --aws-profile <your-profile>
serverless logs -f dlqMonitor -t --stage dev --region eu-central-1 --aws-profile <your-profile>
```

## Cleanup

```sh
npm run remove -- --stage dev --region eu-central-1 --aws-profile <your-profile>
```

## Architecture Overview

```plaintext
[Client] -> [API Gateway] -> [Lambda: submitTask] -> [SQS Queue] -> [Lambda: processTask] -> [DynamoDB]
                                                           |-- failure --> retry with exponential backoff
                                                           |-- after max retries --> [DLQ] -> [Lambda: dlqMonitor]
```

## Testing Failures

The system simulates task failures randomly in ~30% of cases.  
These tasks will be retried twice with exponential backoff before moving to DLQ.
