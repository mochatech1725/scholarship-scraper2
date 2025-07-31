#!/bin/bash

echo "=== Stop VPC Charges Script ==="
echo "This script will clean up the most expensive VPC components to stop charges"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Function to check if AWS CLI is configured
check_aws_config() {
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        print_error "AWS CLI is not configured or credentials are invalid"
        print_error "Please run: aws configure"
        exit 1
    fi
    print_status "AWS CLI is configured"
}

# Function to get environment from context
get_environment() {
    # Try to get environment from CDK context
    ENV=$(node -e "
        try {
            const cdk = require('./cdk.json');
            console.log(cdk.context?.environment || 'dev');
        } catch (e) {
            console.log('dev');
        }
    " 2>/dev/null)
    echo $ENV
}

# Main cleanup function
main() {
    check_aws_config
    
    ENVIRONMENT=$(get_environment)
    print_status "Detected environment: $ENVIRONMENT"
    
    print_step "Step 1: Stop RDS MySQL Instance (Biggest cost saver)"
    cleanup_rds $ENVIRONMENT
    
    print_step "Step 2: Delete NAT Gateways (Major cost contributor)"
    cleanup_nat_gateways
    
    print_step "Step 3: Delete VPC Endpoints (Interface endpoints cost money)"
    cleanup_vpc_endpoints
    
    print_step "Step 4: Stop ECS Tasks and Batch Jobs"
    cleanup_compute_resources
    
    print_step "Step 5: Disable Batch Compute Environment"
    disable_batch_compute_environment
    
    print_step "Step 6: Check remaining VPC resources"
    check_remaining_resources
    
    print_status "✅ VPC charges should be significantly reduced!"
    print_warning "Note: VPC itself and subnets remain but don't cost money"
    print_warning "To completely remove VPC, run: ./scripts/cleanup-all-resources.sh"
}

cleanup_rds() {
    local env=$1
    print_status "Looking for RDS instances with 'scholarship' or 'scraper' in name..."
    
    RDS_INSTANCES=$(aws rds describe-db-instances --query "DBInstances[?contains(DBInstanceIdentifier, 'scholarship') || contains(DBInstanceIdentifier, 'scraper') || contains(DBInstanceIdentifier, 'MySQL')].DBInstanceIdentifier" --output text)
    
    if [ ! -z "$RDS_INSTANCES" ]; then
        print_status "Found RDS instances: $RDS_INSTANCES"
        for instance in $RDS_INSTANCES; do
            print_status "Stopping RDS instance: $instance"
            aws rds stop-db-instance --db-instance-identifier "$instance"
        done
    else
        print_status "No RDS instances found"
    fi
}

cleanup_nat_gateways() {
    print_status "Looking for NAT gateways..."
    
    NAT_GATEWAYS=$(aws ec2 describe-nat-gateways --query 'NatGateways[*].NatGatewayId' --output text)
    
    if [ ! -z "$NAT_GATEWAYS" ]; then
        print_status "Found NAT gateways: $NAT_GATEWAYS"
        
        for nat_id in $NAT_GATEWAYS; do
            STATE=$(aws ec2 describe-nat-gateways --nat-gateway-ids $nat_id --query 'NatGateways[0].State' --output text)
            print_status "NAT Gateway $nat_id state: $STATE"
            
            if [ "$STATE" = "available" ]; then
                print_status "Deleting NAT gateway: $nat_id"
                aws ec2 delete-nat-gateway --nat-gateway-id $nat_id
            else
                print_warning "NAT Gateway $nat_id is in state: $STATE - will be deleted when dependencies are removed"
            fi
        done
    else
        print_status "No NAT gateways found"
    fi
}

cleanup_vpc_endpoints() {
    print_status "Looking for VPC endpoints..."
    
    VPC_ENDPOINTS=$(aws ec2 describe-vpc-endpoints --query 'VpcEndpoints[*].VpcEndpointId' --output text)
    
    if [ ! -z "$VPC_ENDPOINTS" ]; then
        print_status "Found VPC endpoints: $VPC_ENDPOINTS"
        
        for endpoint_id in $VPC_ENDPOINTS; do
            print_status "Deleting VPC endpoint: $endpoint_id"
            aws ec2 delete-vpc-endpoints --vpc-endpoint-ids $endpoint_id
        done
    else
        print_status "No VPC endpoints found"
    fi
}

cleanup_compute_resources() {
    print_status "Stopping ECS tasks..."
    
    CLUSTERS=$(aws ecs list-clusters --query 'clusterArns[]' --output text)
    for cluster in $CLUSTERS; do
        TASKS=$(aws ecs list-tasks --cluster $cluster --query 'taskArns[]' --output text)
        if [ ! -z "$TASKS" ]; then
            print_status "Stopping tasks in cluster $cluster"
            for task in $TASKS; do
                aws ecs stop-task --cluster $cluster --task $task --reason "Cost optimization"
            done
        fi
    done
    
    print_status "Terminating running Batch jobs..."
    
    JOB_QUEUES=$(aws batch describe-job-queues --query 'jobQueues[*].jobQueueArn' --output text)
    for queue in $JOB_QUEUES; do
        RUNNING_JOBS=$(aws batch list-jobs --job-queue $queue --job-status RUNNING --query 'jobSummaryList[*].jobId' --output text)
        if [ ! -z "$RUNNING_JOBS" ]; then
            print_status "Terminating running jobs in queue $queue"
            for job in $RUNNING_JOBS; do
                aws batch terminate-job --job-id $job --reason "Cost optimization"
            done
        fi
    done
}

disable_batch_compute_environment() {
    print_status "Disabling Batch compute environments..."
    
    COMPUTE_ENVIRONMENTS=$(aws batch describe-compute-environments --query "computeEnvironments[?contains(computeEnvironmentName, 'Scraper')].computeEnvironmentName" --output text)
    
    if [ ! -z "$COMPUTE_ENVIRONMENTS" ]; then
        print_status "Found compute environments: $COMPUTE_ENVIRONMENTS"
        for ce in $COMPUTE_ENVIRONMENTS; do
            print_status "Disabling compute environment: $ce"
            aws batch update-compute-environment --compute-environment "$ce" --state DISABLED
        done
    else
        print_status "No Batch compute environments found"
    fi
}

check_remaining_resources() {
    print_status "Checking remaining resources that might incur charges..."
    
    # Check for running RDS instances
    RUNNING_RDS=$(aws rds describe-db-instances --query "DBInstances[?DBInstanceStatus=='available'].DBInstanceIdentifier" --output text)
    if [ ! -z "$RUNNING_RDS" ]; then
        print_warning "Running RDS instances: $RUNNING_RDS"
    fi
    
    # Check for NAT gateways
    REMAINING_NAT=$(aws ec2 describe-nat-gateways --query 'NatGateways[*].NatGatewayId' --output text)
    if [ ! -z "$REMAINING_NAT" ]; then
        print_warning "Remaining NAT gateways: $REMAINING_NAT"
    fi
    
    # Check for VPC endpoints
    REMAINING_ENDPOINTS=$(aws ec2 describe-vpc-endpoints --query 'VpcEndpoints[*].VpcEndpointId' --output text)
    if [ ! -z "$REMAINING_ENDPOINTS" ]; then
        print_warning "Remaining VPC endpoints: $REMAINING_ENDPOINTS"
    fi
    
    # Check for running ECS tasks
    RUNNING_TASKS=$(aws ecs list-tasks --cluster $(aws ecs list-clusters --query 'clusterArns[0]' --output text) --query 'taskArns[]' --output text 2>/dev/null)
    if [ ! -z "$RUNNING_TASKS" ]; then
        print_warning "Running ECS tasks: $RUNNING_TASKS"
    fi
    
    # Check for running Batch jobs
    RUNNING_JOBS=$(aws batch list-jobs --job-queue $(aws batch describe-job-queues --query 'jobQueues[0].jobQueueArn' --output text) --job-status RUNNING --query 'jobSummaryList[*].jobId' --output text 2>/dev/null)
    if [ ! -z "$RUNNING_JOBS" ]; then
        print_warning "Running Batch jobs: $RUNNING_JOBS"
    fi
}

# Run the main function
main "$@" 