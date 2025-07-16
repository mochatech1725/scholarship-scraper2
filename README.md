# Scholarship Scraper 2.0

A serverless AWS application that automatically discovers and stores college scholarship opportunities using web scraping, API integrations, and AI-powered search.

## Quick Start

```bash
# Install dependencies
npm install

# Configure AWS credentials
aws configure

# Setup AWS resources
./scripts/setup-aws.sh

# Deploy development environment
npm run deploy:dev

# Populate website configurations
npm run populate:websites:dev
```

## Architecture

- **AWS CDK**: Infrastructure as Code
- **AWS Batch with Fargate**: Containerized scraping jobs
- **DynamoDB**: Scholarship data and job metadata storage
- **S3**: Raw data storage with lifecycle policies
- **EventBridge**: Scheduled job triggers (hourly)
- **Lambda**: Job orchestration
- **CloudWatch**: Monitoring and logging
- **Bedrock**: Intelligent search capabilities

## Documentation

📖 **Complete documentation is available in [docs/README.md](docs/README.md)**

The documentation includes:
- Detailed architecture overview
- Step-by-step setup instructions
- Configuration management
- Monitoring and troubleshooting
- API integration guides
- Cost optimization strategies

## Project Structure

```
scholarship-scraper2/
├── cdk/                    # CDK configuration files
├── src/                    # Application source code
│   ├── cdk/               # CDK infrastructure code
│   ├── scrapers/          # Website-specific scrapers
│   ├── lambda/            # Lambda functions
│   ├── batch/             # Batch job containers
│   └── utils/             # Shared utilities and types
├── scripts/               # AWS setup scripts
├── docs/                  # Documentation
└── package.json           # Project dependencies
```

## Deployment

- **Development**: `npm run deploy:dev`
- **Staging**: `npm run deploy:staging`
- **Production**: `npm run deploy:prod`

## Other Commands

- **View Changes**: `npm run diff:dev|staging|prod`
- **Destroy Infrastructure**: `npm run destroy:dev|staging|prod`
- **Build Docker**: `docker build -t scholarship-scraper:latest .`
- **Deploy to ECR**: `npm run docker:build:dev`