# Step-by-Step Implementation Guide

## Phase 1: Project Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure AWS Credentials
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and preferred region
```

### Step 3: Run AWS Setup Script
```bash
./scripts/setup-aws.sh
```

### Step 4: Bootstrap CDK
```bash
npm run bootstrap
```

## Phase 2: Infrastructure Deployment

### Step 1: Deploy Development Environment
```bash
npm run deploy:dev
```

### Step 2: Verify Resources Created
- Check DynamoDB tables in AWS Console:
  - `scholarships-dev`
  - `scholarship-scraper-jobs-dev`
  - `scholarship-scraper-websites-dev`
- Verify S3 bucket for raw data storage
- Verify IAM roles and policies (including S3 and DynamoDB permissions)
- Confirm EventBridge rule exists

### Step 3: Populate Websites Configuration Table
```bash
npm run populate:websites:dev
```

## Phase 3: Container Development

### Step 1: Build Docker Image
```bash
# Build from project root (Dockerfile is in root directory)
docker build -t scholarship-scraper:latest .
```

### Step 2: Test Locally
```bash
docker run -e WEBSITE=careeronestop -e JOB_ID=test-123 scholarship-scraper:latest
```

### Step 3: Deploy to ECR
```bash
npm run docker:build:dev
```

## Phase 4: Testing & Validation

### Step 1: Manual Lambda Test
1. Go to AWS Lambda Console
2. Find the JobOrchestrator function
3. Create test event and invoke
4. Check CloudWatch logs
5. Verify DynamoDB websites table is being read

### Step 2: Batch Job Testing
1. Submit manual batch job
2. Monitor job status in AWS Batch console
3. Check DynamoDB for processed results
4. Check S3 for raw data storage
5. Verify job metadata

### Step 3: End-to-End Testing
1. Trigger EventBridge rule manually
2. Monitor entire pipeline
3. Verify data quality in DynamoDB
4. Verify raw data storage in S3
5. Check deduplication logic

## Phase 5: Monitoring & Optimization

### Step 1: Set Up CloudWatch Dashboards
1. Create custom metrics
2. Set up alarms for failures
3. Monitor DynamoDB performance
4. Monitor S3 storage usage
5. Track batch job success rates
6. Monitor Container Insights V2 metrics

### Step 2: Performance Tuning
1. Optimize DynamoDB queries
2. Adjust batch job timeouts
3. Fine-tune scraping delays
4. Monitor S3 lifecycle policies
5. Monitor costs

## Phase 6: Production Deployment

### Step 1: Production Environment
```bash
npm run deploy:prod
```

### Step 2: Environment Variables
- Set production API keys (optional)
- Configure production Bedrock model
- Update monitoring thresholds
- Verify S3 bucket configuration

### Step 3: Populate Production Websites Table
```bash
npm run populate:websites:prod
```

### Step 4: Security Review
- Audit IAM permissions (including S3 and DynamoDB)
- Review VPC security groups
- Check CloudTrail logs
- Validate data encryption (S3 and DynamoDB)

## Completed Implementations

### ✅ CareerOneStop Scraper
- Web crawling for CareerOneStop.org
- Raw HTML storage in S3
- Intelligent data parsing
- Error handling and retry logic

### ✅ GumLoop Scrapers
- Known site crawling with AI filtering
- Discovery crawling for new opportunities
- Raw API request/response storage
- Intelligent content analysis

### ✅ General Search Scraper
- Bedrock AI-powered search
- Multiple search focuses
- Intelligent data extraction
- Rate limiting and error handling

### ✅ S3 Integration
- Raw data storage utilities
- Organized file structure
- Metadata tracking
- Lifecycle management

### ✅ DynamoDB Configuration Management
- Website configurations stored in DynamoDB table
- Runtime updates without redeployment
- Efficient querying and filtering
- No size limitations

## Data Flow Verification

### Website Configuration (DynamoDB)
1. Check websites table: `scholarship-scraper-websites-{env}`
2. Verify enabled websites are being read by Lambda
3. Test adding/updating website configurations
4. Confirm scraper class mappings are correct

### Raw Data Storage (S3)
1. Check S3 bucket: `scholarship-raw-data-{env}-{account}`
2. Verify file structure: `{scraper-name}/{year}/{month}/{day}/`
3. Confirm metadata files are created
4. Test presigned URL generation

### Processed Data Storage (DynamoDB)
1. Check scholarships table for processed data
2. Verify deduplication is working
3. Confirm all required fields are populated
4. Test GSI queries

## Website Configuration Management

### Adding New Websites
```bash
# Add via AWS CLI
aws dynamodb put-item \
  --table-name scholarship-scraper-websites-dev \
  --item '{
    "name": {"S": "new-website"},
    "url": {"S": "https://example.com"},
    "type": {"S": "crawl"},
    "enabled": {"BOOL": true},
    "scraperClass": {"S": "GumLoopScraper"}
  }'
```

### Updating Website Configuration
```bash
# Update via AWS CLI
aws dynamodb update-item \
  --table-name scholarship-scraper-websites-dev \
  --key '{"name": {"S": "careeronestop"}}' \
  --update-expression "SET enabled = :enabled" \
  --expression-attribute-values '{":enabled": {"BOOL": false}}'
```

### Population Script
```bash
# Populate table with initial configuration
npm run populate:websites:dev
```

## Troubleshooting Common Issues

### Lambda Timeout
- Increase timeout in CDK stack
- Optimize batch job submission logic
- Check for infinite loops

### DynamoDB Throttling
- Enable on-demand billing
- Add exponential backoff
- Optimize query patterns

### S3 Access Issues
- Check IAM roles have S3 permissions
- Verify bucket name in environment variables
- Test S3 utilities locally
- Check bucket lifecycle policies

### Batch Job Failures
- Check container logs
- Verify environment variables (including S3 bucket)
- Test Docker image locally
- Review IAM permissions

### Scraping Errors
- Check website availability
- Verify API credentials (optional)
- Review rate limiting
- Test with different user agents
- Check S3 storage for raw error data

### Website Configuration Issues
- Verify DynamoDB table exists
- Check Lambda has read permissions to websites table
- Confirm website configurations are properly formatted
- Test DynamoDB queries manually

## Cost Monitoring

- Set up AWS Cost Explorer alerts
- Monitor DynamoDB read/write units
- Monitor S3 storage costs and lifecycle transitions
- Track Batch job costs
- Review Lambda execution costs
- Monitor Container Insights V2 costs

## Security Best Practices

- Rotate API keys regularly (if using)
- Use AWS Secrets Manager for sensitive data
- Enable CloudTrail logging
- Regular security audits
- Implement least privilege access
- Monitor S3 bucket access logs
- Monitor DynamoDB table access

## Benefits of Current Implementation

### 1. Cost Efficiency
- S3 storage is ~90% cheaper than DynamoDB for raw data
- Automatic lifecycle policies reduce long-term costs
- Serverless architecture scales with demand
- Pay-per-request DynamoDB billing for configuration table

### 2. Data Preservation
- Raw HTML/JSON preserved for debugging
- Historical data available for analysis
- Easy to reprocess data if needed

### 3. Scalability
- S3 handles unlimited raw data growth
- DynamoDB optimized for application queries
- Parallel processing across multiple scrapers
- No configuration file size limitations

### 4. Runtime Flexibility
- Add/remove websites without redeployment
- Enable/disable scrapers dynamically
- Modify scraping parameters at runtime
- No downtime for configuration changes

## Next Steps

1. **API Gateway**: Add REST API for querying scholarships
2. **Advanced Search**: Implement Elasticsearch integration
3. **Notifications**: Add SNS for job completion alerts
4. **Analytics**: Create data analysis dashboard using S3 data
5. **Machine Learning**: Improve data extraction using S3 raw data
6. **Athena**: SQL queries on S3 raw data
7. **Glue**: ETL processing for raw data analytics
8. **Web UI**: Admin interface for managing website configurations

## Success Metrics

### Technical Metrics
- Successful job completion rate > 95%
- Average job duration < 30 minutes
- Data quality score > 90%
- Zero duplicate scholarships
- Raw data successfully stored in S3
- Website configuration updates take effect immediately

### Business Metrics
- Number of scholarships found per day
- Coverage of different scholarship types
- Geographic distribution of scholarships
- Cost per scholarship processed
- Raw data storage efficiency
- Configuration management efficiency

The system is now ready for production use with a robust, scalable, and cost-effective architecture that separates raw data storage from processed data access and provides flexible runtime configuration management. 