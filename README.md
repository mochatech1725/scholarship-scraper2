# Scholarship Scraper 2.0

A serverless AWS application that scrapes college scholarship websites and stores data in DynamoDB.

## Architecture

- **AWS CDK**: Infrastructure as Code
- **AWS Batch with Fargate**: Containerized scraping jobs
- **DynamoDB**: Scholarship data and job metadata storage
- **EventBridge**: Scheduled job triggers
- **Lambda**: Job orchestration
- **API Gateway**: Future API access
- **CloudWatch**: Monitoring and logging
- **Bedrock**: Intelligent search capabilities

## Development Steps

### Phase 1: Project Setup
1. Initialize CDK project
2. Set up development environment
3. Configure AWS credentials and policies

### Phase 2: Infrastructure Foundation
1. Create DynamoDB tables
2. Set up IAM roles and policies
3. Configure CloudWatch logging

### Phase 3: Core Services
1. Implement Lambda job orchestrator
2. Set up EventBridge scheduling
3. Create AWS Batch compute environment

### Phase 4: Scraping Logic
1. Create base scraper framework
2. Implement website-specific scrapers
3. Add deduplication logic

### Phase 5: Data Processing
1. Implement scholarship data parsing
2. Add Bedrock integration for intelligent search
3. Create data validation and storage logic

### Phase 6: Monitoring & Deployment
1. Add CloudWatch monitoring
2. Set up CI/CD pipeline
3. Deploy to production

## Project Structure

```
scholarship-scraper2/
├── cdk/                    # CDK configuration files
│   └── config/            # CDK-specific configuration files
├── src/                    # Application source code
│   ├── cdk/               # CDK infrastructure code
│   │   ├── bin/           # CDK app entry point
│   │   └── lib/           # CDK stack definitions
│   ├── scrapers/          # Website-specific scrapers
│   ├── lambda/            # Lambda functions
│   ├── batch/             # Batch job containers
│   └── utils/             # Shared utilities and types
├── scripts/               # AWS setup scripts
└── docs/                  # Documentation
```

## Getting Started

1. Install dependencies: `npm install`
2. Configure environment variables: `cp env.example .env` and update values
3. Configure AWS credentials
4. Run setup scripts: `./scripts/setup-aws.sh`
5. Deploy infrastructure: `npm run deploy:dev`

## Deployment

- **Development**: `npm run deploy:dev`
- **Staging**: `npm run deploy:staging`
- **Production**: `npm run deploy:prod`

## Other Commands

- **View Changes**: `npm run diff:dev|staging|prod`
- **Destroy Infrastructure**: `npm run destroy:dev|staging|prod`