# Project Structure Documentation

## Overview

The project has been reorganized to separate CDK-specific configuration from application source code, following AWS best practices.

## Directory Structure

```
scholarship-scraper2/
├── cdk/                          # CDK Configuration Files
│   └── config/                   # CDK-Specific Configuration
│       ├── environments.json     # Environment-specific settings
│       ├── websites.json         # Website scraping configuration
│       ├── tags.json            # AWS resource tagging
│       ├── iam-policies.json    # IAM policy definitions
│       ├── cdk.dev.json         # Development CDK configuration
│       ├── cdk.staging.json     # Staging CDK configuration
│       └── cdk.prod.json        # Production CDK configuration
├── src/                          # Application Source Code
│   ├── cdk/                      # CDK Infrastructure as Code
│   │   ├── bin/                  # CDK App Entry Points
│   │   │   └── scholarship-scraper.ts # Main CDK app
│   │   └── lib/                  # CDK Stack Definitions
│   │       └── scholarship-scraper-stack.ts # Main infrastructure stack
│   ├── scrapers/                 # Website-Specific Scrapers
│   │   ├── base-scraper.ts      # Abstract base class
│   │   ├── careerone-scraper.ts # CareerOne API integration
│   │   ├── collegescholarship-scraper.ts # CollegeScholarship API
│   │   └── general-search-scraper.ts # General web search
│   ├── lambda/                   # Lambda Functions
│   │   └── job-orchestrator/     # Job orchestration Lambda
│   │       └── index.ts
│   ├── batch/                    # Batch Job Containers
│   │   └── index.ts             # Main batch job entry point
│   └── utils/                    # Shared Utilities
│       ├── types.ts             # TypeScript type definitions
│       ├── config.ts            # Configuration loader utility
│       └── constants.ts         # Environment constants
├── scripts/                      # AWS Setup Scripts
│   └── setup-aws.sh             # Automated AWS configuration
├── docs/                         # Documentation
│   ├── architecture.md          # System architecture
│   ├── step-by-step-guide.md    # Implementation guide
│   ├── implementation-summary.md # Project summary
│   └── project-structure.md     # This file
├── package.json                  # Project dependencies
├── tsconfig.json                # TypeScript configuration
├── Dockerfile                   # Container definition
├── env.example                   # Environment variables example
└── .gitignore                   # Git ignore rules
```

## Configuration Files

### CDK Configuration (`cdk/config/`)

#### `environments.json`
Environment-specific settings for different deployment stages:
- **dev**: Development environment with minimal resources
- **staging**: Pre-production testing environment
- **prod**: Production environment with high availability

```json
{
  "dev": {
    "environment": "dev",
    "region": "us-east-1",
    "maxAzs": 2,
    "natGateways": 1,
    "batchMaxVcpus": 256,
    "dynamoBillingMode": "PAY_PER_REQUEST",
    "logRetentionDays": 30,
    "scrapingSchedule": "rate(1 hour)"
  }
}
```

#### `websites.json`
Configuration for different data sources:
- **API Sources**: CareerOne, CollegeScholarship
- **Search Sources**: General web search with Bedrock AI
- **Scraping Settings**: Rate limits, user agents, search terms

#### `tags.json`
AWS resource tagging strategy:
- **Common Tags**: Project, Owner, CostCenter
- **Environment Tags**: Environment-specific purpose and ownership

#### `iam-policies.json`
IAM policy definitions for different services:
- **Lambda Policies**: DynamoDB, Batch, Bedrock access
- **Batch Policies**: Container execution permissions

### Application Configuration

The application uses the `ConfigLoader` utility in `src/utils/config.ts` to access CDK configuration files:

```typescript
import { ConfigLoader } from '../utils/config';

// Load website configuration
const websiteConfig = ConfigLoader.getWebsiteConfig('careerone');

// Load environment settings
const envConfig = ConfigLoader.loadEnvironmentConfig('dev');
```

## Source Code Organization

### Scrapers (`src/scrapers/`)
- **Base Class**: Common functionality for all scrapers
- **Website-Specific**: Individual implementations for each data source
- **Extensible**: Easy to add new scrapers by extending base class

### Lambda Functions (`src/lambda/`)
- **Job Orchestrator**: Coordinates batch job submissions
- **Event-Driven**: Triggered by EventBridge scheduling
- **Stateless**: No persistent state, pure function

### Batch Jobs (`src/batch/`)
- **Containerized**: Docker-based execution
- **Scalable**: Fargate serverless containers
- **Configurable**: Environment variables for different websites

### Utilities (`src/utils/`)
- **Type Definitions**: TypeScript interfaces for all data structures
- **Configuration**: Utility to load and access config files
- **Shared Logic**: Common functions used across components

## Benefits of This Structure

### 1. **Separation of Concerns**
- CDK configuration separate from application code
- Clear distinction between infrastructure and business logic
- Environment-specific settings isolated

### 2. **Maintainability**
- Easy to add new environments (dev, staging, prod)
- Simple to modify scraping configuration
- Centralized IAM policy management

### 3. **Scalability**
- Modular scraper architecture
- Configurable resource allocation per environment
- Easy to add new data sources

### 4. **Security**
- IAM policies defined as code
- Environment-specific permissions
- Proper resource tagging for cost tracking

## Adding New Components

### New Scraper
1. Create new file in `src/scrapers/`
2. Extend `BaseScraper` class
3. Add configuration to `cdk/config/websites.json`
4. Update `src/batch/index.ts` switch statement

### New Environment
1. Add environment config to `cdk/config/environments.json`
2. Add tags to `cdk/config/tags.json`
3. Deploy with `npm run deploy:staging` (example)

### New Lambda Function
1. Create directory in `src/lambda/`
2. Add function definition to CDK stack
3. Configure IAM permissions in `cdk/config/iam-policies.json`

This structure provides a clean, maintainable, and scalable foundation for the scholarship scraper application. 