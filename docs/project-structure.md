# Project Structure Documentation

## Overview

The project has been reorganized to separate CDK-specific configuration from application source code, following AWS best practices. The system now includes a hybrid storage architecture with S3 for raw data and DynamoDB for processed scholarship information.

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
│   │   ├── base-scraper.ts      # Abstract base class with S3 integration
│   │   ├── careeronestop-scraper.ts # CareerOneStop web crawling
│   │   ├── collegescholarship-scraper.ts # CollegeScholarship API
│   │   ├── gumloop-scraper.ts   # GumLoop web crawling for known sites
│   │   ├── gumloop-discovery-scraper.ts # GumLoop discovery crawling
│   │   ├── general-search-scraper.ts # Bedrock AI-powered search
│   │   └── RateLimiter.ts       # Rate limiting utility
│   ├── lambda/                   # Lambda Functions
│   │   └── job-orchestrator/     # Job orchestration Lambda
│   │       └── index.ts
│   ├── batch/                    # Batch Job Containers
│   │   └── index.ts             # Main batch job entry point
│   └── utils/                    # Shared Utilities
│       ├── types.ts             # TypeScript type definitions
│       ├── config.ts            # Configuration loader utility
│       ├── constants.ts         # Environment constants
│       ├── helper.ts            # Shared utility functions
│       ├── scraper-utils.ts     # Scraping utilities
│       └── s3-utils.ts          # S3 raw data storage utilities
├── scripts/                      # AWS Setup Scripts
│   └── setup-aws.sh             # Automated AWS configuration
├── docs/                         # Documentation
│   ├── architecture.md          # System architecture
│   ├── step-by-step-guide.md    # Implementation guide
│   ├── implementation-summary.md # Project summary
│   ├── project-structure.md     # This file
│   └── cdk-configuration.md     # CDK configuration guide
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
- **API Sources**: CollegeScholarship
- **Crawling Sources**: GumLoop for known and discovery sites
- **AI Sources**: General web search with Bedrock AI
- **Scraping Settings**: Rate limits, user agents, search terms

#### `tags.json`
AWS resource tagging strategy:
- **Common Tags**: Project, Owner, CostCenter
- **Environment Tags**: Environment-specific purpose and ownership

#### `iam-policies.json`
IAM policy definitions for different services:
- **Lambda Policies**: DynamoDB, S3, Batch, Bedrock access
- **Batch Policies**: Container execution permissions

### Application Configuration

The application uses the `ConfigLoader` utility in `src/utils/config.ts` to access CDK configuration files:

```typescript
import { ConfigLoader } from '../utils/config';

// Load website configuration
const websiteConfig = ConfigLoader.getWebsiteConfig('careeronestop');

// Load environment settings
const envConfig = ConfigLoader.loadEnvironmentConfig('dev');
```

## Source Code Organization

### Scrapers (`src/scrapers/`)
- **Base Class**: Common functionality for all scrapers with S3 integration
- **CareerOneStopScraper**: Web crawling for CareerOneStop.org
- **CollegeScholarshipScraper**: API integration
- **GumLoopScraper**: AI-powered web crawling for known sites
- **GumLoopDiscoveryScraper**: Intelligent discovery crawling
- **GeneralSearchScraper**: Bedrock AI-powered search
- **RateLimiter**: Utility for managing API rate limits
- **Extensible**: Easy to add new scrapers by extending base class

### Lambda Functions (`src/lambda/`)
- **Job Orchestrator**: Coordinates batch job submissions with S3 configuration
- **Event-Driven**: Triggered by EventBridge scheduling
- **Stateless**: No persistent state, pure function

### Batch Jobs (`src/batch/`)
- **Containerized**: Docker-based execution
- **Scalable**: Fargate serverless containers
- **Configurable**: Environment variables for different websites and S3 bucket

### Utilities (`src/utils/`)
- **Type Definitions**: TypeScript interfaces for all data structures
- **Configuration**: Utility to load and access config files
- **S3 Utilities**: Raw data storage and retrieval functions
- **Shared Logic**: Common functions used across components
- **Helper Functions**: Text processing, scholarship utilities, network utilities

## Storage Architecture

### S3 Raw Data Storage (`src/utils/s3-utils.ts`)
- **Purpose**: Store raw HTML, JSON responses, and API data
- **Organization**: `{scraper-name}/{year}/{month}/{day}/{timestamp}-{page-id}.html`
- **Features**: 
  - Metadata tracking
  - Presigned URL generation
  - Lifecycle management
  - Error handling

### DynamoDB Processed Data
- **Purpose**: Store structured, queryable scholarship information
- **Optimized**: For fast queries and application access
- **Indexed**: Multiple GSIs for efficient filtering

## Benefits of This Structure

### 1. **Separation of Concerns**
- CDK configuration separate from application code
- Clear distinction between infrastructure and business logic
- Environment-specific settings isolated
- Raw data storage separate from processed data

### 2. **Maintainability**
- Easy to add new environments (dev, staging, prod)
- Simple to modify scraping configuration
- Centralized IAM policy management
- Modular scraper architecture

### 3. **Scalability**
- S3 handles unlimited raw data growth
- DynamoDB optimized for application queries
- Parallel processing across multiple scrapers
- Serverless architecture scales with demand

### 4. **Security**
- IAM policies defined as code
- Environment-specific permissions
- Proper resource tagging for cost tracking
- S3 encryption and access controls

### 5. **Cost Efficiency**
- S3 storage is much cheaper than DynamoDB for raw data
- Automatic lifecycle policies reduce long-term costs
- Hybrid storage approach optimizes for both cost and performance

## Adding New Components

### New Scraper
1. Create new file in `src/scrapers/`
2. Extend `BaseScraper` class
3. Add configuration to `cdk/config/websites.json`
4. Update `src/batch/index.ts` switch statement
5. Implement raw data storage using `storeRawData()` method

### New Environment
1. Add environment config to `cdk/config/environments.json`
2. Add tags to `cdk/config/tags.json`
3. Deploy with `npm run deploy:staging` (example)

### New Lambda Function
1. Create directory in `src/lambda/`
2. Add function definition to CDK stack
3. Configure IAM permissions in `cdk/config/iam-policies.json`

### New Data Source
1. Add website configuration to `cdk/config/websites.json`
2. Create scraper implementation in `src/scrapers/`
3. Update batch job routing in `src/batch/index.ts`
4. Test raw data storage in S3

## Data Flow

```
1. EventBridge Trigger
   ↓
2. Lambda Job Orchestrator
   ↓
3. AWS Batch Job Submission
   ↓
4. Container Execution
   ↓
5. Website-Specific Scraping/Crawling
   ↓
6. Raw Data Storage (S3)
   ↓
7. AI Processing & Data Extraction
   ↓
8. Processed Data Storage (DynamoDB)
   ↓
9. Job Status Update
```

This structure provides a clean, maintainable, and scalable foundation for the scholarship scraper application with cost-effective raw data storage and fast application data access. 