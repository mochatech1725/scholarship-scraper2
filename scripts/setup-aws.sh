#!/bin/bash

# AWS Scholarship Scraper Setup Script
# This script sets up the necessary AWS resources and permissions

set -e

echo "🚀 Setting up AWS Scholarship Scraper..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS credentials verified"

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region || echo "us-east-1")

echo "📋 Account ID: $ACCOUNT_ID"
echo "🌍 Region: $REGION"

# Create IAM policy for the application
echo "🔐 Creating IAM policy..."

cat > /tmp/scholarship-scraper-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/scholarships-*",
                "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/scholarship-scraper-jobs-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "batch:SubmitJob",
                "batch:DescribeJobs",
                "batch:ListJobs"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ecs:RunTask",
                "ecs:StopTask",
                "ecs:DescribeTasks"
            ],
            "Resource": "*"
        }
    ]
}
EOF

# Create the policy
aws iam create-policy \
    --policy-name ScholarshipScraperPolicy \
    --policy-document file:///tmp/scholarship-scraper-policy.json \
    --description "Policy for Scholarship Scraper application" || echo "Policy already exists"

echo "✅ IAM policy created"

# Create IAM role for the application
echo "👤 Creating IAM role..."

cat > /tmp/scholarship-scraper-trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "lambda.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        },
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ecs-tasks.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF

# Create the role
aws iam create-role \
    --role-name ScholarshipScraperRole \
    --assume-role-policy-document file:///tmp/scholarship-scraper-trust-policy.json || echo "Role already exists"

# Attach the policy to the role
aws iam attach-role-policy \
    --role-name ScholarshipScraperRole \
    --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/ScholarshipScraperPolicy

# Attach basic execution role for Lambda
aws iam attach-role-policy \
    --role-name ScholarshipScraperRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

echo "✅ IAM role created and policies attached"

# Clean up temporary files
rm -f /tmp/scholarship-scraper-policy.json /tmp/scholarship-scraper-trust-policy.json

echo ""
echo "🎉 AWS setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Install dependencies: npm install"
echo "2. Bootstrap CDK: npm run bootstrap"
echo "3. Deploy infrastructure: npm run deploy:dev"
echo ""