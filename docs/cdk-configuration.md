# CDK Configuration Documentation

## Overview

The project uses environment-specific CDK configuration files to manage different deployment stages (development, staging, production). Each environment has its own configuration file with specific settings and context values.

## Configuration Files

### CDK Configuration Files (`cdk/config/`)

#### `cdk.dev.json` - Development Environment
- **Environment**: `dev`
- **Purpose**: Local development and testing
- **Resources**: Minimal resources for cost optimization
- **Removal Policy**: Resources are destroyed when stack is deleted

#### `cdk.staging.json` - Staging Environment
- **Environment**: `staging`
- **Purpose**: Pre-production testing and validation
- **Resources**: Moderate resources for testing
- **Removal Policy**: Resources are destroyed when stack is deleted

#### `cdk.prod.json` - Production Environment
- **Environment**: `prod`
- **Purpose**: Live production environment
- **Resources**: High availability and performance
- **Removal Policy**: Resources are retained when stack is deleted

## Configuration Structure

Each CDK configuration file contains:

```json
{
  "app": "npx ts-node --prefer-ts-exts src/cdk/bin/scholarship-scraper.ts",
  "watch": {
    "include": ["src/cdk/**"],
    "exclude": ["README.md", "src/cdk/**/*.d.ts", "src/cdk/**/*.js", ...]
  },
  "context": {
    "environment": "dev|staging|prod",
    // CDK feature flags and settings
  }
}
```

### Key Configuration Elements

1. **App Entry Point**: Points to the main CDK application
2. **Watch Configuration**: Files to monitor for changes during development
3. **Context**: Environment-specific variables and CDK feature flags

## Deployment Commands

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

## Other Commands

### View Changes
```bash
npm run diff:dev      # View changes for development
npm run diff:staging  # View changes for staging
npm run diff:prod     # View changes for production
```

### Destroy Infrastructure
```bash
npm run destroy:dev      # Destroy development environment
npm run destroy:staging  # Destroy staging environment
npm run destroy:prod     # Destroy production environment
```

## Environment-Specific Settings

### Development (`dev`)
- **DynamoDB Billing**: Pay-per-request
- **Batch vCPUs**: 256
- **Log Retention**: 30 days
- **Scraping Schedule**: Every hour
- **Resource Removal**: Destroy on stack deletion

### Staging (`staging`)
- **DynamoDB Billing**: Pay-per-request
- **Batch vCPUs**: 256
- **Log Retention**: 60 days
- **Scraping Schedule**: Every 2 hours
- **Resource Removal**: Destroy on stack deletion

### Production (`prod`)
- **DynamoDB Billing**: Provisioned (for predictable costs)
- **Batch vCPUs**: 512
- **Log Retention**: 90 days
- **Scraping Schedule**: Every hour
- **Resource Removal**: Retain on stack deletion

## Integration with Other Configuration

### Environment Variables
The CDK configuration works with environment variables defined in `.env`:
- `ENVIRONMENT`: Determines which environment is being deployed
- `AWS_REGION`: AWS region for deployment
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`: AWS credentials

### Application Configuration
The CDK stack reads from `cdk/config/environments.json` to get environment-specific settings:
- VPC configuration
- DynamoDB settings
- Batch job settings
- Logging configuration

## Best Practices

### 1. Environment Isolation
- Each environment has its own stack name
- Separate DynamoDB tables per environment
- Isolated IAM roles and policies

### 2. Cost Optimization
- Development uses minimal resources
- Staging uses moderate resources
- Production uses appropriate resources for performance

### 3. Security
- Production retains resources to prevent accidental deletion
- Environment-specific IAM policies
- Proper resource tagging for cost tracking

### 4. Monitoring
- Different log retention periods per environment
- Environment-specific CloudWatch configurations
- Separate monitoring and alerting

## Troubleshooting

### Common Issues

1. **Configuration Not Found**
   ```bash
   # Ensure you're using the correct config file
   npm run deploy:dev -c cdk/config/cdk.dev.json
   ```

2. **Environment Mismatch**
   ```bash
   # Check environment variable
   echo $ENVIRONMENT
   # Should match the environment in the CDK config
   ```

3. **Permission Issues**
   ```bash
   # Verify AWS credentials
   aws sts get-caller-identity
   ```

### Debugging

1. **View Configuration**
   ```bash
   # Check what configuration CDK is using
   npm run diff:dev
   ```

2. **Validate Configuration**
   ```bash
   # Validate CDK configuration
   cdk synth -c cdk/config/cdk.dev.json
   ```

3. **Check Context**
   ```bash
   # View context values
   cdk context -c cdk/config/cdk.dev.json
   ```

## Adding New Environments

To add a new environment (e.g., `test`):

1. **Create Configuration File**
   ```bash
   cp cdk/config/cdk.dev.json cdk/config/cdk.test.json
   ```

2. **Update Context**
   ```json
   {
     "context": {
       "environment": "test"
     }
   }
   ```

3. **Add Package Scripts**
   ```json
   {
     "scripts": {
       "deploy:test": "cdk deploy --profile default -c cdk/config/cdk.test.json",
       "destroy:test": "cdk destroy --profile default -c cdk/config/cdk.test.json",
       "diff:test": "cdk diff -c cdk/config/cdk.test.json"
     }
   }
   ```

4. **Update Environment Config**
   Add test environment settings to `cdk/config/environments.json`

This configuration structure provides a clean, maintainable way to manage multiple deployment environments with appropriate settings for each stage of the development lifecycle. 