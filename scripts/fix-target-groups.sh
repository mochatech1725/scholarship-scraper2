#!/bin/bash

# Script to fix AWS Batch Target Group health check settings
# This addresses the issue where jobs are terminated early due to aggressive health checks

set -e

# Configuration
ENVIRONMENT=${ENVIRONMENT:-"dev"}
REGION=${AWS_REGION:-"us-east-1"}

echo "🔧 Fixing Target Group health check settings for environment: $ENVIRONMENT"

# Get the VPC ID from CloudFormation outputs
echo "📋 Getting VPC ID from CloudFormation stack..."
VPC_ID=$(aws cloudformation describe-stacks \
  --stack-name "ScholarshipScraperStack-$ENVIRONMENT" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' \
  --output text)

if [ -z "$VPC_ID" ] || [ "$VPC_ID" == "None" ]; then
  echo "❌ Could not find VPC ID. Make sure the stack is deployed and you have the correct environment."
  exit 1
fi

echo "✅ Found VPC: $VPC_ID"

# Get all Target Groups in the VPC
echo "🔍 Finding Target Groups in VPC..."
TARGET_GROUPS=$(aws elbv2 describe-target-groups \
  --region "$REGION" \
  --query "TargetGroups[?VpcId=='$VPC_ID'].TargetGroupArn" \
  --output text)

if [ -z "$TARGET_GROUPS" ]; then
  echo "⚠️  No Target Groups found in VPC. This might be normal if no jobs have run yet."
  exit 0
fi

echo "📋 Found Target Groups:"
echo "$TARGET_GROUPS"

# Update each Target Group with better health check settings
for TG_ARN in $TARGET_GROUPS; do
  echo "🔧 Updating Target Group: $TG_ARN"
  
  # Extract Target Group name for logging
  TG_NAME=$(echo "$TG_ARN" | cut -d'/' -f2)
  
  # Update health check settings
  aws elbv2 modify-target-group \
    --target-group-arn "$TG_ARN" \
    --region "$REGION" \
    --health-check-timeout-seconds 30 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 10 \
    --health-check-interval-seconds 60 \
    --health-check-path "/" \
    --health-check-port "traffic-port" \
    --health-check-protocol "HTTP" \
    --matcher HttpCode=200-399

  echo "✅ Updated Target Group: $TG_NAME"
done

echo "🎉 Target Group health check settings updated successfully!"
echo ""
echo "📝 Summary of changes:"
echo "   - Health check timeout: 30 seconds (was 5)"
echo "   - Unhealthy threshold: 10 consecutive failures (was 2)"
echo "   - Health check interval: 60 seconds (was 30)"
echo "   - Health check path: / (root path)"
echo "   - Success codes: 200-399"
echo ""
echo "💡 These settings will prevent jobs from being terminated prematurely due to temporary network issues or slow startup times." 