# AWS Scripts

This directory contains scripts for managing AWS infrastructure and services.

## Infrastructure Management

- **`build-and-push-docker.sh`** - Build and push Docker images to ECR
- **`cleanup-all-resources.sh`** - Clean up all AWS resources (use with caution)
- **`cleanup-and-deploy.sh`** - Clean up resources and redeploy
- **`cleanup-nat-gateways.sh`** - Clean up NAT gateways to reduce costs
- **`cleanup-vpc-dependencies.sh`** - Clean up VPC dependencies
- **`stop-vpc-charges.sh`** - Stop VPC-related charges

## Lambda Management

- **`check-lambda-config.sh`** - Check Lambda function configuration
- **`check-lambda-logs.sh`** - Check Lambda function logs
- **`check-lambda-logs.ts`** - TypeScript version of Lambda logs checker
- **`test-lambda-direct.sh`** - Test Lambda functions directly

## Batch Job Management

- **`check-job-definition.ts`** - Check AWS Batch job definitions
- **`check-job-definition-details.ts`** - Get detailed job definition info
- **`check-job-status.ts`** - Check AWS Batch job status

## Security & Networking

- **`check-security-group-dependencies.ts`** - Check security group dependencies
- **`launch-bastion.sh`** - Launch bastion host for secure access

## Usage

Most scripts can be run directly from this directory:

```bash
cd scripts/aws
./cleanup-nat-gateways.sh
./check-lambda-config.sh
```

For TypeScript scripts, make sure you have the required dependencies installed:

```bash
npm install
npx ts-node check-job-status.ts
```
