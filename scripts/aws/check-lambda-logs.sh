#!/bin/bash

echo "=== Checking Lambda Logs ==="

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

# Get the log group name
LOG_GROUP="/aws/lambda/$LAMBDA_FUNCTION"

echo "Checking log group: $LOG_GROUP"

# Check if log group exists
if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --query 'logGroups[0].logGroupName' --output text | grep -q "$LOG_GROUP"; then
    echo "Log group exists. Fetching recent logs..."
    
    # Get the most recent log stream
    LOG_STREAM=$(aws logs describe-log-streams \
      --log-group-name "$LOG_GROUP" \
      --order-by LastEventTime \
      --descending \
      --max-items 1 \
      --query 'logStreams[0].logStreamName' \
      --output text)
    
    if [ "$LOG_STREAM" != "None" ] && [ ! -z "$LOG_STREAM" ]; then
        echo "Most recent log stream: $LOG_STREAM"
        echo "Recent log events:"
        aws logs get-log-events \
          --log-group-name "$LOG_GROUP" \
          --log-stream-name "$LOG_STREAM" \
          --start-time $(date -d '1 hour ago' +%s)000 \
          --query 'events[*].message' \
          --output text
    else
        echo "No log streams found"
    fi
else
    echo "Log group does not exist yet"
fi

echo "=== Log Check Complete ===" 