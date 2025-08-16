#!/bin/bash

echo "=== Checking Lambda Configuration ==="

# Get the Lambda function name
LAMBDA_FUNCTION=$(aws cloudformation describe-stacks \
  --stack-name ScholarshipScraperStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`JobOrchestratorFunctionName`].OutputValue' \
  --output text 2>/dev/null)

if [ -z "$LAMBDA_FUNCTION" ]; then
    echo "Error: Could not find Lambda function. Make sure the stack is deployed."
    exit 1
fi

echo "Found Lambda function: $LAMBDA_FUNCTION"

# Get function configuration
echo "Function configuration:"
aws lambda get-function --function-name "$LAMBDA_FUNCTION" --query 'Configuration.{Runtime:Runtime,Handler:Handler,CodeSize:CodeSize,Description:Description,Timeout:Timeout,MemorySize:MemorySize}' --output table

echo ""
echo "Function environment variables:"
aws lambda get-function --function-name "$LAMBDA_FUNCTION" --query 'Configuration.Environment.Variables' --output table

echo ""
echo "Function IAM role:"
aws lambda get-function --function-name "$LAMBDA_FUNCTION" --query 'Configuration.Role' --output text

echo ""
echo "=== Configuration Check Complete ===" 