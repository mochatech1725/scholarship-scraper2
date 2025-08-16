# Docker Deployment Guide

This guide explains how to deploy the scholarship scraper with Docker containers running in AWS Batch.

## Architecture Overview

The system works as follows:

1. **Lambda Function** (`job-orchestrator`) is triggered by EventBridge schedule
2. **Lambda** submits batch jobs for each website to AWS Batch
3. **AWS Batch** runs Docker containers with the scraper code
4. **Docker containers** execute the appropriate scraper based on the website parameter
5. **Scrapers** make API calls and save data to MySQL

## Prerequisites

- AWS CLI configured with appropriate permissions
- Docker installed and running
- Node.js 18+ installed
- CDK bootstrapped in your AWS account

## Docker-Specific Deployment

### Build and Push Docker Image

The Docker image contains all scraper code and dependencies:

```bash
# For development environment
npm run docker:build:dev

# For staging environment
npm run docker:build:staging

# For production environment
npm run docker:build:prod
```

This script will:
- Create an ECR repository if it doesn't exist
- Build the Docker image with your scraper code
- Push the image to ECR with environment-specific tags

### Verify Deployment

Check the CDK outputs to verify everything is deployed correctly:

```bash
aws cloudformation describe-stacks \
  --stack-name ScholarshipScraperStack-dev \
  --query 'Stacks[0].Outputs'
```

You should see outputs for:
- `ScholarshipsTableName` - MySQL table for scholarships
- `JobsTableName` - MySQL table for jobs
- `JobQueueArn` - AWS Batch job queue
- `JobDefinitionArn` - AWS Batch job definition
- `EcrImageUri` - ECR image URI

## How It Works

### Lambda Function (`job-orchestrator`)

The Lambda function:
1. Creates a job record in MySQL
2. Submits batch jobs for each website (`careerone`, `collegescholarship`, `general_search`)
3. Passes environment variables to the batch jobs

### Batch Job Entry Point (`src/batch/index.ts`)

The batch job entry point:
1. Reads environment variables (`WEBSITE`, `JOB_ID`, etc.)
2. Routes to the appropriate scraper based on the `WEBSITE` parameter
3. Runs the scraper and handles errors

### Scrapers

Each scraper:
1. Extends `BaseScraper` for common functionality
2. Implements the `scrape()` method
3. Saves results to MySQL
4. Updates job status in the jobs table

## Testing the Deployment

### 1. Test Lambda Function

Invoke the Lambda function manually:

```bash
aws lambda invoke \
  --function-name ScholarshipScraperStack-dev-JobOrchestrator \
  --payload '{}' \
  response.json
```

### 2. Monitor Batch Jobs

Check the status of batch jobs:

```bash
aws batch list-jobs --job-queue ScholarshipScraperStack-dev-ScraperJobQueue
```

### 3. Check MySQL

Query the jobs table to see job status:

```bash
mysql -u root -e "USE scholarships; SELECT * FROM jobs ORDER BY created_at DESC LIMIT 5;"
```

Query the scholarships table to see scraped data:

```bash
mysql -u root -e "USE scholarships; SELECT COUNT(*) as total_scholarships FROM scholarships;"
```

## Docker-Specific Troubleshooting

### Common Issues

1. **Docker build fails**
   - Ensure Docker is running
   - Check that all dependencies are in `package.json`
   - Verify the Dockerfile is correct

2. **ECR push fails**
   - Ensure AWS CLI is configured correctly
   - Check that you have ECR permissions
   - Verify the ECR repository exists

3. **Batch jobs fail**
   - Check CloudWatch logs for the batch job
   - Verify the Docker image URI is correct
   - Ensure IAM roles have necessary permissions

4. **Lambda fails to submit batch jobs**
   - Check Lambda CloudWatch logs
   - Verify Lambda has Batch permissions
   - Ensure job queue and job definition ARNs are correct

### Logs and Monitoring

- **Lambda logs**: CloudWatch log group `/aws/lambda/ScholarshipScraperStack-dev-JobOrchestrator`
- **Batch job logs**: CloudWatch log group `/aws/batch/jobs`
- **ECS task logs**: CloudWatch log group `/aws/ecs/scholarship-scraper`

## Updating the Scraper

To update the scraper code:

1. Make your changes to the scraper code
2. Build and push a new Docker image:
   ```bash
   npm run docker:build:dev
   ```
3. The CDK stack will automatically use the new image on the next deployment

## Cleanup

To clean up all resources:

```bash
# Destroy the CDK stack
npm run destroy:dev

# Delete the ECR repository (optional)
aws ecr delete-repository --repository-name scholarship-scraper --force
```

## Docker Security Considerations

- The Docker container runs as a non-root user
- IAM roles follow the principle of least privilege
- All sensitive data is stored in MySQL with encryption at rest
- Network access is restricted to private subnets
- Container images are scanned for vulnerabilities 