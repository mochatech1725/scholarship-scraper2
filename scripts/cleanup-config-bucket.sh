#!/bin/bash

# Cleanup script for the unused S3 config bucket
# This bucket was created but never used - configurations are now in DynamoDB

set -e

echo "Cleaning up unused S3 config bucket..."

# Get the account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile default)
echo "Account ID: $ACCOUNT_ID"

# Config bucket name pattern
CONFIG_BUCKET="scholarship-config-dev-$ACCOUNT_ID"

echo "Checking if config bucket exists: $CONFIG_BUCKET"

# Check if bucket exists
if aws s3 ls "s3://$CONFIG_BUCKET" --profile default 2>/dev/null; then
    echo "Found config bucket. Listing contents:"
    aws s3 ls "s3://$CONFIG_BUCKET" --recursive --profile default
    
    echo "Deleting all objects in config bucket..."
    aws s3 rm "s3://$CONFIG_BUCKET" --recursive --profile default
    
    echo "Deleting config bucket..."
    aws s3 rb "s3://$CONFIG_BUCKET" --profile default
    
    echo "Config bucket cleanup completed successfully!"
else
    echo "Config bucket does not exist or has already been cleaned up."
fi

echo "Cleanup script completed." 