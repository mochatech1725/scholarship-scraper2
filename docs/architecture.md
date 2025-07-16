# Scholarship Scraper Architecture

## Overview

The Scholarship Scraper is a serverless AWS application that automatically discovers and stores college scholarship opportunities. It uses a combination of API integrations, web scraping, and AI-powered search to find scholarships from various sources. The system employs a hybrid storage approach with S3 for raw data and DynamoDB for processed scholarship information.

## Architecture Components

### 1. Infrastructure (CDK)

- **VPC**: Private network for Batch jobs with NAT Gateway for internet access
- **S3 Bucket**: `scholarship-raw-data-{environment}-{account}` for storing raw scraping data
- **DynamoDB Tables**: 
  - `scholarships-{environment}`: Stores processed scholarship data with multiple GSIs
  - `scholarship-scraper-jobs-{environment}`: Tracks scraping job metadata
- **IAM Roles & Policies**: Secure access to AWS services including S3
- **CloudWatch**: Logging and monitoring

### 2. Scheduling & Orchestration

- **EventBridge**: Triggers scraping jobs every hour
- **Lambda (Job Orchestrator)**: Coordinates batch job submissions
- **AWS Batch**: Runs containerized scraping jobs on Fargate

### 3. Data Sources

#### API Sources
- **CareerOne**: Direct API integration
- **CollegeScholarship**: Direct API integration

#### Web Crawling
- **GumLoop**: AI-powered web crawling for known scholarship sites
- **GumLoop Discovery**: Intelligent discovery crawling for new opportunities
- **General Search**: Uses Bedrock AI to intelligently search and extract data

### 4. Data Processing

- **Raw Data Storage**: S3 for HTML, JSON, and API responses
- **AI Processing**: Bedrock for intelligent data extraction
- **Deduplication**: MD5 hash-based duplicate detection
- **Data Parsing**: Intelligent extraction of scholarship details
- **Validation**: Ensures data quality before storage

## Data Flow

```
1. EventBridge Trigger (hourly)
   ↓
2. Lambda Job Orchestrator
   ↓
3. AWS Batch Job Submission (parallel jobs per website)
   ↓
4. Container Execution (Fargate)
   ↓
5. Website-Specific Scraping/Crawling
   ↓
6. Raw Data Storage (S3)
   ↓
7. AI Processing & Data Extraction
   ↓
8. Data Processing & Deduplication
   ↓
9. DynamoDB Storage (processed data)
   ↓
10. Job Status Update
```

## Storage Architecture

### S3 Raw Data Storage
- **Purpose**: Store raw HTML, JSON responses, and API data
- **Organization**: `{scraper-name}/{year}/{month}/{day}/{timestamp}-{page-id}.html`
- **Lifecycle**: Automatic transition to IA (30 days) and Glacier (90 days)
- **Benefits**: Cost-effective storage for large raw data volumes

### DynamoDB Processed Data
- **Purpose**: Store structured, queryable scholarship information
- **Optimized**: For fast queries and application access
- **Indexed**: Multiple GSIs for efficient filtering

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

## Raw Data Storage Structure

```
s3://scholarship-raw-data-{env}-{account}/
├── CareerOneScraper/
│   ├── 2024/01/15/
│   │   ├── 2024-01-15T10-30-00-123Z-abc12345.html
│   │   └── 2024-01-15T10-30-00-123Z-abc12345-metadata.json
├── GumLoopScraper/
│   └── 2024/01/15/
│       ├── 2024-01-15T10-35-00-456Z-def67890.json
│       └── 2024-01-15T10-35-00-456Z-def67890-metadata.json
└── GumLoopDiscoveryScraper/
    └── 2024/01/15/
        └── ...
```

## Deduplication Strategy

1. **ID Generation**: MD5 hash of scholarship name + organization + deadline
2. **Duplicate Check**: Query DynamoDB before insertion
3. **Update Logic**: Only insert if not exists, track updates separately

## Security Considerations

- **IAM Roles**: Least privilege access to S3 and DynamoDB
- **VPC**: Private subnets for Batch jobs
- **S3 Encryption**: Server-side encryption enabled
- **Secrets**: Environment variables for API keys
- **User Agent**: Respectful web scraping headers

## Monitoring & Observability

- **CloudWatch Logs**: Application and infrastructure logs
- **S3 Metrics**: Storage usage and access patterns
- **DynamoDB Metrics**: Table performance and usage
- **Batch Job Status**: Job success/failure tracking
- **Custom Metrics**: Scholarships found, processed, inserted

## Scaling Considerations

- **Batch Jobs**: Parallel execution per website
- **S3**: Unlimited storage with automatic scaling
- **DynamoDB**: On-demand billing for variable load
- **Fargate**: Serverless container scaling
- **Lambda**: Automatic scaling for job orchestration

## Cost Optimization

- **S3**: Cost-effective storage for raw data with lifecycle policies
- **DynamoDB**: On-demand billing initially, provisioned for predictable loads
- **Batch**: Spot instances for cost savings
- **Lambda**: Pay per execution
- **EventBridge**: Minimal cost for scheduling

## Benefits of Hybrid Storage

1. **Cost Efficiency**: S3 is much cheaper for large raw data storage
2. **Performance**: DynamoDB optimized for fast application queries
3. **Scalability**: S3 handles unlimited raw data growth
4. **Flexibility**: Raw data available for reprocessing and analytics
5. **Compliance**: Data lifecycle management with S3 policies

## Future Enhancements

1. **API Gateway**: REST API for querying scholarships
2. **Elasticsearch**: Advanced search capabilities
3. **SNS/SQS**: Asynchronous processing
4. **CloudFront**: Caching for API responses
5. **WAF**: Web application firewall for API protection
6. **Athena**: SQL queries on S3 raw data
7. **Glue**: ETL processing for raw data analytics 