#!/bin/bash
# cleanup-and-deploy.sh

echo "🧹 Cleaning up existing resources..."

# Delete the log group if it exists
# Note: Removed unused log group cleanup - Lambda and Batch create their own log groups

# Wait for any ongoing operations
echo "⏳ Waiting for any ongoing operations..."
sleep 30

# Destroy the stack completely
echo "🗑️  Destroying existing stack..."
npm run destroy:dev

# Wait for destruction to complete
echo "⏳ Waiting for stack destruction..."
aws cloudformation wait stack-delete-complete --stack-name ScholarshipScraperStack-dev --profile default

# Build the TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Deploy fresh
echo "🚀 Deploying fresh stack..."
npm run deploy:dev

echo "✅ Done!" 