#!/bin/bash

echo "=== Complete AWS Resource Cleanup Script ==="
echo "This script will clean up all remaining resources from the scholarship scraper deployment"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "=== Step 1: Cleanup Lambda Functions ==="
LAMBDA_FUNCTIONS=$(aws lambda list-functions --query "Functions[?contains(FunctionName, 'ScholarshipScraper')].FunctionName" --output text)
if [ ! -z "$LAMBDA_FUNCTIONS" ]; then
    print_status "Found Lambda functions: $LAMBDA_FUNCTIONS"
    for func in $LAMBDA_FUNCTIONS; do
        print_status "Deleting Lambda function: $func"
        aws lambda delete-function --function-name "$func"
    done
else
    print_status "No Lambda functions found"
fi

echo ""
echo "=== Step 2: Cleanup AWS Batch Resources ==="

# Disable and delete job queues
JOB_QUEUES=$(aws batch describe-job-queues --query "jobQueues[?contains(jobQueueName, 'Scraper')].jobQueueName" --output text)
if [ ! -z "$JOB_QUEUES" ]; then
    print_status "Found job queues: $JOB_QUEUES"
    for queue in $JOB_QUEUES; do
        print_status "Disabling job queue: $queue"
        aws batch update-job-queue --job-queue "$queue" --state DISABLED
        print_status "Deleting job queue: $queue"
        aws batch delete-job-queue --job-queue "$queue"
    done
else
    print_status "No job queues found"
fi

# Disable and delete compute environments
COMPUTE_ENVIRONMENTS=$(aws batch describe-compute-environments --query "computeEnvironments[?contains(computeEnvironmentName, 'Scraper')].computeEnvironmentName" --output text)
if [ ! -z "$COMPUTE_ENVIRONMENTS" ]; then
    print_status "Found compute environments: $COMPUTE_ENVIRONMENTS"
    for ce in $COMPUTE_ENVIRONMENTS; do
        print_status "Disabling compute environment: $ce"
        aws batch update-compute-environment --compute-environment "$ce" --state DISABLED
        print_status "Deleting compute environment: $ce"
        aws batch delete-compute-environment --compute-environment "$ce"
    done
else
    print_status "No compute environments found"
fi

# Delete job definitions
JOB_DEFINITIONS=$(aws batch describe-job-definitions --query "jobDefinitions[?contains(jobDefinitionName, 'Scraper')].jobDefinitionName" --output text)
if [ ! -z "$JOB_DEFINITIONS" ]; then
    print_status "Found job definitions: $JOB_DEFINITIONS"
    for jd in $JOB_DEFINITIONS; do
        print_status "Deregistering job definition: $jd"
        aws batch deregister-job-definition --job-definition "$jd"
    done
else
    print_status "No job definitions found"
fi

echo ""
echo "=== Step 3: Cleanup ECS Clusters ==="
ECS_CLUSTERS=$(aws ecs list-clusters --query "clusterArns[]" --output text)
if [ ! -z "$ECS_CLUSTERS" ]; then
    for cluster in $ECS_CLUSTERS; do
        if [[ $cluster == *Scraper* ]]; then
            print_status "Found ECS cluster: $cluster"
            print_status "Deleting ECS cluster: $cluster"
            aws ecs delete-cluster --cluster "$cluster"
        fi
    done
else
    print_status "No ECS clusters found"
fi

echo ""
echo "=== Step 4: Cleanup DynamoDB Tables ==="
DYNAMODB_TABLES=$(aws dynamodb list-tables --query "TableNames[?contains(@, 'scholarship') || contains(@, 'scraper')]" --output text)
if [ ! -z "$DYNAMODB_TABLES" ]; then
    print_status "Found DynamoDB tables: $DYNAMODB_TABLES"
    for table in $DYNAMODB_TABLES; do
        print_status "Deleting DynamoDB table: $table"
        aws dynamodb delete-table --table-name "$table"
    done
else
    print_status "No DynamoDB tables found"
fi

echo ""
echo "=== Step 5: Cleanup CloudWatch Log Groups ==="
LOG_GROUPS=$(aws logs describe-log-groups --query "logGroups[?contains(logGroupName, 'scholarship') || contains(logGroupName, 'scraper')].logGroupName" --output text)
if [ ! -z "$LOG_GROUPS" ]; then
    print_status "Found log groups: $LOG_GROUPS"
    for lg in $LOG_GROUPS; do
        print_status "Deleting log group: $lg"
        aws logs delete-log-group --log-group-name "$lg"
    done
else
    print_status "No log groups found"
fi

echo ""
echo "=== Step 6: Cleanup VPC Resources ==="

# Get all VPCs that might be from our deployment
VPCS=$(aws ec2 describe-vpcs --query "Vpcs[?not_null(Tags[?Key=='Name'].Value) && (contains(Tags[?Key=='Name'].Value, 'Scraper') || contains(Tags[?Key=='Name'].Value, 'Scholarship'))].VpcId" --output text)

if [ ! -z "$VPCS" ]; then
    print_status "Found VPCs: $VPCS"
    
    for vpc_id in $VPCS; do
        print_status "Cleaning up VPC: $vpc_id"
        
        # Stop any running ECS tasks
        CLUSTERS=$(aws ecs list-clusters --query "clusterArns[]" --output text)
        for cluster in $CLUSTERS; do
            TASKS=$(aws ecs list-tasks --cluster $cluster --query "taskArns[]" --output text)
            if [ ! -z "$TASKS" ]; then
                print_status "Stopping tasks in cluster $cluster"
                aws ecs stop-task --cluster $cluster --task $TASKS --reason "VPC cleanup"
            fi
        done
        
        # Delete network interfaces
        ENIS=$(aws ec2 describe-network-interfaces --filters Name=vpc-id,Values=$vpc_id --query "NetworkInterfaces[*].NetworkInterfaceId" --output text)
        if [ ! -z "$ENIS" ]; then
            print_status "Deleting network interfaces: $ENIS"
            for eni in $ENIS; do
                aws ec2 delete-network-interface --network-interface-id $eni
            done
        fi
        
        # Delete route table associations and routes
        ROUTE_TABLES=$(aws ec2 describe-route-tables --filters Name=vpc-id,Values=$vpc_id --query "RouteTables[*].RouteTableId" --output text)
        for rt_id in $ROUTE_TABLES; do
            # Delete NAT gateway routes
            aws ec2 delete-route --route-table-id $rt_id --destination-cidr-block 0.0.0.0/0 2>/dev/null || true
            
            # Disassociate subnets
            ASSOCIATIONS=$(aws ec2 describe-route-tables --route-table-ids $rt_id --query "RouteTables[0].Associations[?SubnetId!=null].RouteTableAssociationId" --output text)
            for assoc in $ASSOCIATIONS; do
                aws ec2 disassociate-route-table --association-id $assoc
            done
        done
        
        # Delete subnets
        SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$vpc_id --query "Subnets[*].SubnetId" --output text)
        if [ ! -z "$SUBNETS" ]; then
            print_status "Deleting subnets: $SUBNETS"
            for subnet in $SUBNETS; do
                aws ec2 delete-subnet --subnet-id $subnet
            done
        fi
        
        # Delete internet gateways
        IGW=$(aws ec2 describe-internet-gateways --filters Name=attachment.vpc-id,Values=$vpc_id --query "InternetGateways[*].InternetGatewayId" --output text)
        if [ ! -z "$IGW" ]; then
            print_status "Detaching and deleting internet gateway: $IGW"
            aws ec2 detach-internet-gateway --internet-gateway-id $IGW --vpc-id $vpc_id
            aws ec2 delete-internet-gateway --internet-gateway-id $IGW
        fi
        
        # Delete security groups (except default)
        SGS=$(aws ec2 describe-security-groups --filters Name=vpc-id,Values=$vpc_id --query "SecurityGroups[?GroupName!='default'].GroupId" --output text)
        if [ ! -z "$SGS" ]; then
            print_status "Deleting security groups: $SGS"
            for sg in $SGS; do
                aws ec2 delete-security-group --group-id $sg
            done
        fi
        
        # Delete route tables
        for rt_id in $ROUTE_TABLES; do
            aws ec2 delete-route-table --route-table-id $rt_id
        done
        
        # Finally delete the VPC
        print_status "Deleting VPC: $vpc_id"
        aws ec2 delete-vpc --vpc-id $vpc_id
    done
else
    print_status "No VPCs found"
fi

echo ""
echo "=== Step 7: Cleanup ECR Repository ==="
ECR_REPOS=$(aws ecr describe-repositories --query "repositories[?contains(repositoryName, 'scholarship')].repositoryName" --output text)
if [ ! -z "$ECR_REPOS" ]; then
    print_status "Found ECR repositories: $ECR_REPOS"
    for repo in $ECR_REPOS; do
        print_status "Deleting ECR repository: $repo"
        aws ecr delete-repository --repository-name "$repo" --force
    done
else
    print_status "No ECR repositories found"
fi

echo ""
echo "=== Step 8: Cleanup EventBridge Rules ==="
EVENTBRIDGE_RULES=$(aws events list-rules --query "Rules[?contains(Name, 'Scraper') || contains(Name, 'Scholarship')].Name" --output text)
if [ ! -z "$EVENTBRIDGE_RULES" ]; then
    print_status "Found EventBridge rules: $EVENTBRIDGE_RULES"
    for rule in $EVENTBRIDGE_RULES; do
        print_status "Deleting EventBridge rule: $rule"
        aws events remove-targets --rule "$rule" --ids "*"
        aws events delete-rule --name "$rule"
    done
else
    print_status "No EventBridge rules found"
fi

echo ""
echo "=== Step 9: Final Verification ==="
print_status "Checking for remaining resources..."

# Check for any remaining resources
REMAINING_LAMBDA=$(aws lambda list-functions --query "Functions[?contains(FunctionName, 'ScholarshipScraper')].FunctionName" --output text)
REMAINING_BATCH=$(aws batch describe-job-queues --query "jobQueues[?contains(jobQueueName, 'Scraper')].jobQueueName" --output text)
REMAINING_VPCS=$(aws ec2 describe-vpcs --query "Vpcs[?not_null(Tags[?Key=='Name'].Value) && contains(Tags[?Key=='Name'].Value, 'Scraper')].VpcId" --output text)
REMAINING_TABLES=$(aws dynamodb list-tables --query "TableNames[?contains(@, 'scholarship')]" --output text)

if [ -z "$REMAINING_LAMBDA" ] && [ -z "$REMAINING_BATCH" ] && [ -z "$REMAINING_VPCS" ] && [ -z "$REMAINING_TABLES" ]; then
    print_status "✅ All resources have been cleaned up successfully!"
else
    print_warning "Some resources may still remain:"
    [ ! -z "$REMAINING_LAMBDA" ] && print_warning "Lambda: $REMAINING_LAMBDA"
    [ ! -z "$REMAINING_BATCH" ] && print_warning "Batch: $REMAINING_BATCH"
    [ ! -z "$REMAINING_VPCS" ] && print_warning "VPCs: $REMAINING_VPCS"
    [ ! -z "$REMAINING_TABLES" ] && print_warning "DynamoDB: $REMAINING_TABLES"
fi

echo ""
echo "=== Cleanup Complete ==="
print_status "You can now redeploy the stack from scratch!"
print_status "Use: npm run deploy:dev" 