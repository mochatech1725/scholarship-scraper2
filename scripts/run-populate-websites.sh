#!/bin/bash

# Script to populate the scholarship-websites DynamoDB table
# This script can be run multiple times safely

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT=${ENVIRONMENT:-dev}

echo -e "${GREEN}🚀 Starting website table population for environment: ${ENVIRONMENT}${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials are not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if ts-node is installed
if ! command -v ts-node &> /dev/null; then
    echo -e "${YELLOW}⚠️  ts-node is not installed. Installing it globally...${NC}"
    npm install -g ts-node
fi

# Check if the table exists
TABLE_NAME="scholarship-websites-${ENVIRONMENT}"
echo -e "${YELLOW}🔍 Checking if table ${TABLE_NAME} exists...${NC}"

if ! aws dynamodb describe-table --table-name "$TABLE_NAME" &> /dev/null; then
    echo -e "${RED}❌ Table ${TABLE_NAME} does not exist. Please deploy the CDK stack first.${NC}"
    echo -e "${YELLOW}💡 Run: npm run cdk:deploy${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Table ${TABLE_NAME} exists${NC}"

# Set environment variable for the script
export ENVIRONMENT=$ENVIRONMENT

# Run the TypeScript population script
echo -e "${YELLOW}📝 Running website table population script...${NC}"

# Change to the project root directory
cd "$(dirname "$0")/.."

# Run the TypeScript script
npx ts-node scripts/populate-websites-table.ts

echo -e "${GREEN}✅ Website table population completed successfully!${NC}"

# Verify the data was inserted
echo -e "${YELLOW}🔍 Verifying data...${NC}"
aws dynamodb scan \
    --table-name "$TABLE_NAME" \
    --select COUNT \
    --query "Count" \
    --output text

echo -e "${GREEN}🎉 All done! The websites table has been populated.${NC}"
echo -e "${YELLOW}💡 You can now run the scraper jobs.${NC}" 