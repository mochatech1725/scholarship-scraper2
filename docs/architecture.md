# Scholarship Scraper Architecture

## Overview

The Scholarship Scraper is a serverless AWS application that automatically discovers and stores college scholarship opportunities. It uses a combination of API integrations, web scraping, and AI-powered search to find scholarships from various sources.

## Architecture Components

### 1. Infrastructure (CDK)

- **VPC**: Private network for Batch jobs with NAT Gateway for internet access
- **DynamoDB Tables**: 
  - `scholarships-{environment}`: Stores scholarship data with multiple GSIs
  - `scholarship-scraper-jobs-{environment}`: Tracks scraping job metadata
- **IAM Roles & Policies**: Secure access to AWS services
- **CloudWatch**: Logging and monitoring

### 2. Scheduling & Orchestration

- **EventBridge**: Triggers scraping jobs every hour
- **Lambda (Job Orchestrator)**: Coordinates batch job submissions
- **AWS Batch**: Runs containerized scraping jobs on Fargate

### 3. Data Sources

#### API Sources
- **CareerOne**: Direct API integration
- **CollegeScholarship**: Direct API integration

#### Web Search
- **General Search**: Uses Bedrock AI to intelligently search and extract data
- **Puppeteer**: Browser automation for web scraping

### 4. Data Processing

- **Deduplication**: MD5 hash-based duplicate detection
- **Data Parsing**: Intelligent extraction of scholarship details
- **Validation**: Ensures data quality before storage

## Data Flow

```
1. EventBridge Trigger (hourly)
   ↓
2. Lambda Job Orchestrator
   ↓
3. AWS Batch Job Submission (3 parallel jobs)
   ↓
4. Container Execution (Fargate)
   ↓
5. Website-Specific Scraping
   ↓
6. Data Processing & Deduplication
   ↓
7. DynamoDB Storage
   ↓
8. Job Status Update
```

## Database Schema

### Scholarships Table
- **Partition Key**: `id` (MD5 hash of name + organization + deadline)
- **Sort Key**: `deadline` (ISO date string)
- **GSIs**: 
  - DeadlineIndex: deadline + targetType
  - TargetTypeIndex: targetType + deadline
  - EthnicityIndex: ethnicity + deadline
  - GenderIndex: gender + deadline

### Jobs Table
- **Partition Key**: `jobId` (UUID)
- **Sort Key**: `startTime` (ISO date string)

## Deduplication Strategy

1. **ID Generation**: MD5 hash of scholarship name + organization + deadline
2. **Duplicate Check**: Query DynamoDB before insertion
3. **Update Logic**: Only insert if not exists, track updates separately

## Security Considerations

- **IAM Roles**: Least privilege access
- **VPC**: Private subnets for Batch jobs
- **Secrets**: Environment variables for API keys
- **User Agent**: Respectful web scraping headers

## Monitoring & Observability

- **CloudWatch Logs**: Application and infrastructure logs
- **DynamoDB Metrics**: Table performance and usage
- **Batch Job Status**: Job success/failure tracking
- **Custom Metrics**: Scholarships found, processed, inserted

## Scaling Considerations

- **Batch Jobs**: Parallel execution per website
- **DynamoDB**: On-demand billing for variable load
- **Fargate**: Serverless container scaling
- **Lambda**: Automatic scaling for job orchestration

## Cost Optimization

- **DynamoDB**: On-demand billing initially, provisioned for predictable loads
- **Batch**: Spot instances for cost savings
- **Lambda**: Pay per execution
- **EventBridge**: Minimal cost for scheduling

## Future Enhancements

1. **API Gateway**: REST API for querying scholarships
2. **Elasticsearch**: Advanced search capabilities
3. **SNS/SQS**: Asynchronous processing
4. **CloudFront**: Caching for API responses
5. **WAF**: Web application firewall for API protection 