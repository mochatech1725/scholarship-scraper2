# Scholarship Scraper Documentation

## Overview

The Scholarship Scraper is a serverless AWS application that automatically discovers and stores college scholarship opportunities. It uses a combination of API integrations, web scraping, and AI-powered search to find scholarships from various sources. The system employs a hybrid storage approach with S3 for raw data and MySQL for processed scholarship information.

## Quick Start

### 1. Setup & Deployment
```bash
# Install dependencies
npm install

# Configure AWS credentials
aws configure

# Setup AWS resources
./scripts/setup-aws.sh

# Bootstrap CDK
npm run bootstrap

# Deploy development environment
npm run deploy:dev

# Populate website configurations
npm run populate:websites:dev
```

### 2. Build & Deploy Container
```bash
# Build Docker image locally
docker build -t scholarship-scraper:latest .

# Deploy to ECR (creates repository and pushes image)
npm run docker:build:dev
```

**Note**: The Docker image contains all scraper code and dependencies. It's automatically used by AWS Batch jobs. See [Docker Deployment Guide](docker-deployment-guide.md) for detailed deployment information.

### 3. Test & Monitor
- Check MySQL database for processed data
- Verify S3 bucket for raw data storage
- Monitor CloudWatch logs for job execution
- Use AWS Batch console to track job status

## Architecture

### Core Components
- **AWS CDK**: Infrastructure as Code
- **AWS Batch with Fargate**: Containerized scraping jobs
- **MySQL**: Scholarship data and job metadata storage
- **S3**: Raw data storage with lifecycle policies
- **EventBridge**: Scheduled job triggers (hourly)
- **Lambda**: Job orchestration
- **CloudWatch**: Monitoring and logging
- **Bedrock**: Intelligent search capabilities

### Data Flow
```
1. EventBridge Trigger (hourly)
   ↓
2. Lambda Job Orchestrator (reads from MySQL websites table)
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
8. MySQL Storage (processed data)
   ↓
9. Job Status Update
```

### Storage Architecture

#### MySQL Tables
- **`scholarship-scholarships-{environment}`**: Processed scholarship data with GSIs
- **`scholarship-jobs-{environment}`**: Job metadata and status tracking
- **`scholarship-websites-{environment}`**: Website configurations

#### S3 Raw Data Storage
- **Bucket**: `scholarship-raw-data-{environment}-{account}`
- **Structure**: `{scraper-name}/{year}/{month}/{day}/{timestamp}-{page-id}.html`
- **Lifecycle**: IA after 30 days, Glacier after 90 days

## Project Structure

```
scholarship-scraper2/
├── cdk/                          # CDK Configuration Files
│   └── config/                   # Environment-specific settings
├── src/                          # Application Source Code
│   ├── cdk/                      # CDK Infrastructure as Code
│   ├── scrapers/                 # Website-Specific Scrapers
│   ├── lambda/                   # Lambda Functions
│   ├── batch/                    # Batch Job Containers
│   └── utils/                    # Shared Utilities
├── scripts/                      # AWS Setup Scripts
├── docs/                         # Documentation
├── package.json                  # Project dependencies
├── Dockerfile                    # Container definition
└── env.example                   # Environment variables example
```

## Scrapers

### Implemented Scrapers
- **CareerOneStopScraper**: Web crawling for CareerOneStop.org
- **CollegeScholarshipScraper**: Web crawling for collegescholarships.com
- **GumLoopScraper**: AI-powered web crawling for known sites
- **GumLoopDiscoveryScraper**: Intelligent discovery crawling
- **GeneralSearchScraper**: Bedrock AI-powered search

### Adding New Scrapers
1. Create new scraper class extending `BaseScraper`
2. Implement the `scrape()` method
3. Add to batch job routing in `src/batch/index.ts`
4. Add website configuration to MySQL table

## Configuration

### Environment Variables
Key environment variables (see `env.example` for complete list):
- `ENVIRONMENT`: dev/staging/prod
- `SCHOLARSHIPS_TABLE`: MySQL table for scholarship data
- `JOBS_TABLE`: MySQL table for job metadata
- `WEBSITES_TABLE`: MySQL table for website configurations
- `S3_RAW_DATA_BUCKET`: S3 bucket for raw data storage

### Website Configuration Management
Website configurations are stored in MySQL for runtime updates:

```bash
# Add new website
mysql -u root -e "USE scholarships; INSERT INTO websites (website_id, name, url, enabled, scraper_type) VALUES ('newwebsite', 'New Website', 'https://example.com', 1, 'python');"
```

## Deployment

### Development
```bash
npm run deploy:dev
```

### Staging
```bash
npm run deploy:staging
```

### Production
```bash
npm run deploy:prod
```

### View Changes
```bash
npm run diff:dev      # View changes for development
npm run diff:staging  # View changes for staging
npm run diff:prod     # View changes for production
```

## Monitoring & Troubleshooting

### CloudWatch Logs
- **Lambda**: Job orchestrator execution logs
- **Batch**: Container execution logs
- **S3**: Access logs (if enabled)

### Key Metrics to Monitor
- Batch job success/failure rates
- MySQL database performance
- S3 storage usage and lifecycle transitions
- Lambda execution times and errors

### Common Issues
1. **CDK Deployment Failures**: Check IAM permissions
2. **Lambda Timeouts**: Increase timeout in CDK stack
3. **Batch Job Failures**: Check container logs and IAM roles
4. **MySQL Errors**: Verify database connection and permissions
5. **S3 Access Issues**: Check IAM roles and bucket permissions
6. **Docker Build Failures**: Ensure Docker is running and dependencies are correct
7. **ECR Push Failures**: Check AWS CLI configuration and ECR permissions

## API Keys & External Services

### Required
- **Bedrock**: For AI-powered search and data extraction
- **AWS Credentials**: For all AWS services

### Optional
- **CareerOne API**: Enhanced CareerOneStop data
- **CollegeScholarship API**: Additional scholarship data
- **GumLoop API**: Free tier available for web crawling

## Cost Optimization

### Development Environment
- Uses minimal resources for cost optimization
- Pay-per-use MySQL billing
- Standard S3 lifecycle policies
- Resources destroyed on stack deletion

### Production Environment
- Provisioned MySQL for predictable costs
- Enhanced S3 lifecycle policies
- Resources retained on stack deletion
- Higher resource limits for performance

## Security

### IAM Roles
- Least privilege access for all services
- Separate roles for Lambda, Batch, and application
- Environment-specific permissions

### Data Protection
- S3 encryption at rest and in transit
- MySQL encryption at rest
- Private VPC for Batch jobs
- No public access to data stores

## Contributing

### Development Workflow
1. Create feature branch
2. Implement changes
3. Test locally with Docker
4. Deploy to development environment
5. Create pull request

### Code Standards
- TypeScript for all application code
- CDK for infrastructure
- Comprehensive error handling
- Proper logging and monitoring 