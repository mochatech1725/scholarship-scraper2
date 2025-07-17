#!/bin/bash

# Build and push Docker image to ECR
# Usage: ./scripts/build-and-push-docker.sh [environment]

set -e

# Default to dev environment
ENVIRONMENT=${1:-dev}

# Load environment configuration
if [ ! -f "cdk/config/cdk.${ENVIRONMENT}.json" ]; then
    echo "Error: Environment configuration file cdk/config/cdk.${ENVIRONMENT}.json not found"
    exit 1
fi

# Extract AWS account ID and region from CDK context
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)

if [ -z "$ACCOUNT_ID" ] || [ -z "$REGION" ]; then
    echo "Error: Could not determine AWS account ID or region"
    exit 1
fi

# ECR repository name
REPO_NAME="scholarship-scraper"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}"

echo "Building and pushing Docker image for environment: ${ENVIRONMENT}"
echo "Account ID: ${ACCOUNT_ID}"
echo "Region: ${REGION}"
echo "ECR URI: ${ECR_URI}"

# Create ECR repository if it doesn't exist
echo "Creating ECR repository if it doesn't exist..."
aws ecr describe-repositories --repository-names ${REPO_NAME} --region ${REGION} 2>/dev/null || \
aws ecr create-repository --repository-name ${REPO_NAME} --region ${REGION}

# Get ECR login token
echo "Logging in to ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URI}

# Build Docker image for AMD64 platform
echo "Building Docker image for AMD64 platform..."
docker buildx build --platform linux/amd64 --load -t ${REPO_NAME}:latest .

# Tag image for ECR
echo "Tagging image for ECR..."
docker tag ${REPO_NAME}:latest ${ECR_URI}:latest
docker tag ${REPO_NAME}:latest ${ECR_URI}:${ENVIRONMENT}

# Push images to ECR
echo "Pushing images to ECR..."
docker push ${ECR_URI}:latest
docker push ${ECR_URI}:${ENVIRONMENT}

echo "Successfully built and pushed Docker image:"
echo "  - ${ECR_URI}:latest"
echo "  - ${ECR_URI}:${ENVIRONMENT}"

# Output the image URI for CDK deployment
echo ""
echo "Use this image URI in your CDK stack:"
echo "${ECR_URI}:${ENVIRONMENT}" 