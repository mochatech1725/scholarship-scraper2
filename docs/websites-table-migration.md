# Websites Configuration Migration Guide

## Overview

The scholarship scraper has been migrated from using a static `websites.json` file to a more scalable DynamoDB table approach. This change provides better flexibility, scalability, and runtime configuration management.

## What Changed

### Before: Static JSON File
- Configuration stored in `cdk/config/websites.json`
- Uploaded to S3 during CDK deployment
- Lambda function read from S3 bucket
- Limited to file size constraints
- No runtime updates possible

### After: DynamoDB Table
- Configuration stored in `scholarship-scraper-websites-{environment}` DynamoDB table
- Primary key: `name` (string)
- Lambda function reads directly from DynamoDB
- No size limitations
- Runtime updates possible
- Better querying and filtering capabilities

## New Infrastructure

### DynamoDB Table Structure

```typescript
interface WebsiteConfig {
  name: string;                    // Primary key
  url?: string;                    // Website URL
  type: 'api' | 'crawl' | 'discovery' | 'search';
  apiEndpoint?: string;            // For API type websites
  apiKey?: string;                 // Environment variable name for API key
  crawlUrl?: string;               // For crawl type websites
  enabled: boolean;                // Whether this website is active
  scraperClass: string;            // Scraper class to use
  selectors?: {                    // CSS selectors for crawling
    scholarshipLinks: string;
    title: string;
    amount: string;
    deadline: string;
    description: string;
    organization: string;
  };
  discoveryConfig?: {              // For discovery type websites
    seedUrls: string[];
    domainFilter: string;
    keywordFilter: string[];
    maxDepth: number;
    maxPages: number;
  };
  searchConfig?: {                 // For search type websites
    searchTerms: string[];
    maxResultsPerTerm: number;
    delayBetweenRequests: number;
  };
  createdAt: string;               // ISO timestamp
  updatedAt: string;               // ISO timestamp
}
```

### CDK Changes

The CDK stack now creates a new DynamoDB table:

```typescript
// Websites Configuration Table
this.websitesTable = new dynamodb.Table(this, 'WebsitesTable', {
  tableName: `scholarship-scraper-websites-${environment}`,
  partitionKey: { name: 'name', type: dynamodb.AttributeType.STRING },
  billingMode: envConfig.dynamoBillingMode === 'PROVISIONED' ? 
    dynamodb.BillingMode.PROVISIONED : dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: environment === 'prod' ? 
    cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
});
```

### Lambda Changes

The job orchestrator Lambda function now reads from DynamoDB instead of S3:

```typescript
// Load website configuration from DynamoDB
const websitesTableName = process.env.WEBSITES_TABLE;

const scanCommand = new DocScanCommand({
  TableName: websitesTableName,
  FilterExpression: '#enabled = :enabled',
  ExpressionAttributeNames: {
    '#enabled': 'enabled'
  },
  ExpressionAttributeValues: {
    ':enabled': true
  }
});

const scanResponse = await dynamoClient.send(scanCommand);
const enabledWebsites = scanResponse.Items || [];
```

## Migration Steps

### 1. Deploy Updated CDK Stack

```bash
# Deploy the updated stack with the new websites table
npm run deploy:dev
```

### 2. Populate the Websites Table

```bash
# Populate the table with the current configuration
npm run populate:websites:dev
```

### 3. Verify the Migration

```bash
# Check that the table was populated correctly
aws dynamodb scan --table-name scholarship-scraper-websites-dev --select COUNT
```

## Usage

### Adding New Websites

You can now add new websites by inserting records into the DynamoDB table:

```bash
aws dynamodb put-item \
  --table-name scholarship-scraper-websites-dev \
  --item '{
    "name": {"S": "new-website"},
    "url": {"S": "https://example.com"},
    "type": {"S": "crawl"},
    "crawlUrl": {"S": "https://example.com/scholarships"},
    "enabled": {"BOOL": true},
    "scraperClass": {"S": "GumLoopScraper"},
    "selectors": {"S": "{\"scholarshipLinks\": \"a[href*=\\\"/scholarship/\\\"]\"}"},
    "createdAt": {"S": "2024-01-01T00:00:00Z"},
    "updatedAt": {"S": "2024-01-01T00:00:00Z"}
  }'
```

### Updating Website Configuration

```bash
aws dynamodb update-item \
  --table-name scholarship-scraper-websites-dev \
  --key '{"name": {"S": "careerone"}}' \
  --update-expression "SET enabled = :enabled, updatedAt = :updatedAt" \
  --expression-attribute-values '{
    ":enabled": {"BOOL": false},
    ":updatedAt": {"S": "2024-01-01T00:00:00Z"}
  }'
```

### Querying Websites

```bash
# Get all enabled websites
aws dynamodb scan \
  --table-name scholarship-scraper-websites-dev \
  --filter-expression "enabled = :enabled" \
  --expression-attribute-values '{":enabled": {"BOOL": true}}'

# Get a specific website
aws dynamodb get-item \
  --table-name scholarship-scraper-websites-dev \
  --key '{"name": {"S": "careerone"}}'
```

## Benefits

### 1. **Scalability**
- No file size limitations
- Can handle thousands of website configurations
- Efficient querying and filtering

### 2. **Flexibility**
- Runtime configuration updates
- No need to redeploy for config changes
- Easy to enable/disable websites

### 3. **Performance**
- Fast reads from DynamoDB
- No S3 download overhead
- Efficient filtering of enabled websites

### 4. **Management**
- Easy to add/remove websites
- Version control through timestamps
- Audit trail of changes

### 5. **Cost Efficiency**
- Pay-per-request billing for small tables
- No S3 storage costs for config
- Minimal DynamoDB costs

## Backward Compatibility

The old `websites.json` file is still present in the codebase for reference, but it's no longer used by the application. The migration is complete and the new DynamoDB approach is fully functional.

## Troubleshooting

### Table Not Found
```bash
# Check if the table exists
aws dynamodb describe-table --table-name scholarship-scraper-websites-dev
```

### Permission Issues
Ensure the Lambda function has the correct IAM permissions:
- `dynamodb:GetItem`
- `dynamodb:Scan`
- `dynamodb:Query`

### Data Population Issues
If the population script fails, check:
1. AWS credentials are configured
2. The table exists
3. You have write permissions to the table

```bash
# Re-run the population script
npm run populate:websites:dev
```

## Future Enhancements

1. **Web Interface**: Create a web UI for managing website configurations
2. **Configuration Validation**: Add schema validation for website configurations
3. **Versioning**: Implement configuration versioning for rollback capabilities
4. **Monitoring**: Add CloudWatch metrics for configuration changes
5. **Backup**: Implement automated backups of the configuration table 