#!/bin/bash

echo "=== Direct Lambda Test ==="

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

# Test with direct JSON payload (automatically base64 encoded)
echo "Testing with direct JSON payload..."
PAYLOAD=$(echo '{"test": "event"}' | base64)
aws lambda invoke \
  --function-name "$LAMBDA_FUNCTION" \
  --payload "$PAYLOAD" \
  response.json

echo "Exit code: $?"
echo "Response:"
if [ -f response.json ]; then
    cat response.json
    rm -f response.json
else
    echo "No response file created"
fi
echo ""

echo "=== Test Complete ===" 