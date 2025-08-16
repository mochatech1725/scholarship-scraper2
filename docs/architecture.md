# Scholarship Scraper Technical Architecture

## Detailed Architecture Components

### 1. Infrastructure (CDK)

- **VPC**: Private network for Batch jobs with NAT Gateway for internet access
- **S3 Bucket**: `scholarship-raw-data-{environment}-{account}` for storing raw scraping data
- **MySQL Tables**: 
  - `scholarship-scholarships-{environment}`: Stores processed scholarship data with multiple GSIs
  - `scholarship-jobs-{environment}`: Tracks scraping job metadata
  - `scholarship-websites-{environment}`: Stores website configurations
- **IAM Roles & Policies**: Secure access to AWS services including S3 and RDS MySQL
- **CloudWatch**: Logging and monitoring with Container Insights V2

### 2. Scheduling & Orchestration

- **EventBridge**: Triggers scraping jobs every hour
- **Lambda (Job Orchestrator)**: Coordinates batch job submissions by reading from MySQL websites table
- **AWS Batch**: Runs containerized scraping jobs on Fargate

### 3. Data Sources

#### Web Crawling
- **CareerOneStop**: Web crawling for CareerOneStop.org
- **CollegeScholarship**:  Web crawling for CollegeScholarships.com
- **GumLoop**: AI-powered web crawling for known scholarship sites
- **GumLoop Discovery**: Intelligent discovery crawling for new opportunities
- **General Search**: Uses Bedrock AI to intelligently search and extract data

### 4. Data Processing

- **Raw Data Storage**: S3 for HTML, JSON, and API responses
- **AI Processing**: Bedrock for intelligent data extraction
- **Deduplication**: MD5 hash-based duplicate detection
- **Data Parsing**: Intelligent extraction of scholarship details
- **Validation**: Ensures data quality before storage

## Raw Data Storage Structure

```
s3://scholarship-raw-data-{env}-{account}/
├── CareerOneStopScraper/
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

## Website Configuration Management

## Deduplication Strategy

1. **ID Generation**: MD5 hash of scholarship name + organization + deadline
2. **Duplicate Check**: Query MySQL before insertion
3. **Update Logic**: Only insert if not exists, track updates separately

## Security Considerations

- **IAM Roles**: Least privilege access to S3 and RDS MySQL
- **VPC**: Private subnets for Batch jobs
- **S3 Encryption**: Server-side encryption enabled
- **RDS MySQL Encryption**: Server-side encryption enabled
- **Secrets**: Environment variables for API keys
- **User Agent**: Respectful web scraping headers

## Monitoring & Observability

- **CloudWatch Logs**: Application and infrastructure logs
- **Container Insights V2**: Enhanced ECS monitoring
- **S3 Metrics**: Storage usage and access patterns
- **RDS MySQL Metrics**: Database performance and usage
- **Batch Job Status**: Job success/failure tracking
- **Custom Metrics**: Scholarships found, processed, inserted

## Scaling Considerations

- **Batch Jobs**: Parallel execution per website
- **S3**: Unlimited storage with automatic scaling
- **RDS MySQL**: On-demand billing for variable load
- **Fargate**: Serverless container scaling
- **Lambda**: Automatic scaling for job orchestration
- **Website Config**: No size limitations, efficient querying

## Cost Optimization

- **S3**: Cost-effective storage for raw data with lifecycle policies
- **RDS MySQL**: On-demand billing initially, provisioned for predictable loads
- **Batch**: Spot instances for cost savings
- **Lambda**: Pay per execution
- **EventBridge**: Minimal cost for scheduling
- **Container Insights V2**: Lower CloudWatch costs

## Benefits of Hybrid Storage

1. **Cost Efficiency**: S3 is much cheaper for large raw data storage
2. **Performance**: MySQL optimized for fast application queries
3. **Scalability**: S3 handles unlimited raw data growth
4. **Flexibility**: Raw data available for reprocessing and analytics
5. **Compliance**: Data lifecycle management with S3 policies
6. **Configuration Management**: Runtime updates without redeployment

## Benefits of MySQL Configuration

1. **No Size Limits**: Can handle thousands of website configurations
2. **Runtime Updates**: Enable/disable websites without redeployment
3. **Better Performance**: Fast reads from MySQL vs S3 downloads
4. **Efficient Querying**: Filter enabled websites, query by type
5. **Scalability**: No configuration file size limitations
6. **Cost Effective**: Pay-per-request billing for small tables

## Future Enhancements

1. **API Gateway**: REST API for querying scholarships
2. **Elasticsearch**: Advanced search capabilities
3. **SNS/SQS**: Asynchronous processing
4. **CloudFront**: Caching for API responses
5. **WAF**: Web application firewall for API protection
6. **Athena**: SQL queries on S3 raw data
7. **Glue**: ETL processing for raw data analytics
8. **Web UI**: Admin interface for managing website configurations 