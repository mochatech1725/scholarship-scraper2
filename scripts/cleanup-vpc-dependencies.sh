#!/bin/bash

echo "=== VPC Dependencies Cleanup Script ==="

# Get VPC IDs from the NAT gateways
VPC_IDS=$(aws ec2 describe-nat-gateways --query 'NatGateways[*].VpcId' --output text)
echo "VPCs to clean up: $VPC_IDS"

for vpc_id in $VPC_IDS; do
    echo ""
    echo "=== Cleaning up VPC: $vpc_id ==="
    
    # 1. Check for running ECS tasks
    echo "1. Checking for running ECS tasks..."
    CLUSTERS=$(aws ecs list-clusters --query 'clusterArns[]' --output text)
    for cluster in $CLUSTERS; do
        TASKS=$(aws ecs list-tasks --cluster $cluster --query 'taskArns[]' --output text)
        if [ ! -z "$TASKS" ]; then
            echo "   Found tasks in cluster $cluster: $TASKS"
            echo "   Stopping tasks..."
            aws ecs stop-task --cluster $cluster --task $TASKS --reason "VPC cleanup"
        fi
    done
    
    # 2. Check for running Batch jobs
    echo "2. Checking for running Batch jobs..."
    JOB_QUEUES=$(aws batch describe-job-queues --query 'jobQueues[*].jobQueueArn' --output text)
    for queue in $JOB_QUEUES; do
        RUNNING_JOBS=$(aws batch list-jobs --job-queue $queue --job-status RUNNING --query 'jobSummaryList[*].jobId' --output text)
        if [ ! -z "$RUNNING_JOBS" ]; then
            echo "   Found running jobs in queue $queue: $RUNNING_JOBS"
            echo "   Terminating jobs..."
            for job in $RUNNING_JOBS; do
                aws batch terminate-job --job-id $job --reason "VPC cleanup"
            done
        fi
    done
    
    # 3. Check for network interfaces
    echo "3. Checking for network interfaces..."
    ENIS=$(aws ec2 describe-network-interfaces --filters Name=vpc-id,Values=$vpc_id --query 'NetworkInterfaces[*].NetworkInterfaceId' --output text)
    if [ ! -z "$ENIS" ]; then
        echo "   Found network interfaces: $ENIS"
        for eni in $ENIS; do
            echo "   Deleting network interface: $eni"
            aws ec2 delete-network-interface --network-interface-id $eni
        done
    fi
    
    # 4. Check for route table associations
    echo "4. Checking for route table associations..."
    ROUTE_TABLES=$(aws ec2 describe-route-tables --filters Name=vpc-id,Values=$vpc_id --query 'RouteTables[*].RouteTableId' --output text)
    for rt_id in $ROUTE_TABLES; do
        echo "   Checking route table: $rt_id"
        
        # Check for NAT gateway routes
        NAT_ROUTES=$(aws ec2 describe-route-tables --route-table-ids $rt_id --query 'RouteTables[0].Routes[?NatGatewayId!=null].NatGatewayId' --output text)
        if [ ! -z "$NAT_ROUTES" ]; then
            echo "     Found NAT gateway routes: $NAT_ROUTES"
            echo "     Deleting NAT gateway routes..."
            aws ec2 delete-route --route-table-id $rt_id --destination-cidr-block 0.0.0.0/0
        fi
        
        # Check for subnet associations
        SUBNET_ASSOCIATIONS=$(aws ec2 describe-route-tables --route-table-ids $rt_id --query 'RouteTables[0].Associations[?SubnetId!=null].RouteTableAssociationId' --output text)
        if [ ! -z "$SUBNET_ASSOCIATIONS" ]; then
            echo "     Found subnet associations: $SUBNET_ASSOCIATIONS"
            for assoc in $SUBNET_ASSOCIATIONS; do
                echo "     Disassociating: $assoc"
                aws ec2 disassociate-route-table --association-id $assoc
            done
        fi
    done
    
    # 5. Check for subnets
    echo "5. Checking for subnets..."
    SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$vpc_id --query 'Subnets[*].SubnetId' --output text)
    if [ ! -z "$SUBNETS" ]; then
        echo "   Found subnets: $SUBNETS"
        for subnet in $SUBNETS; do
            echo "   Deleting subnet: $subnet"
            aws ec2 delete-subnet --subnet-id $subnet
        done
    fi
    
    # 6. Check for internet gateways
    echo "6. Checking for internet gateways..."
    IGW=$(aws ec2 describe-internet-gateways --filters Name=attachment.vpc-id,Values=$vpc_id --query 'InternetGateways[*].InternetGatewayId' --output text)
    if [ ! -z "$IGW" ]; then
        echo "   Found internet gateway: $IGW"
        echo "   Detaching internet gateway..."
        aws ec2 detach-internet-gateway --internet-gateway-id $IGW --vpc-id $vpc_id
        echo "   Deleting internet gateway..."
        aws ec2 delete-internet-gateway --internet-gateway-id $IGW
    fi
    
    # 7. Check for security groups
    echo "7. Checking for security groups..."
    SGS=$(aws ec2 describe-security-groups --filters Name=vpc-id,Values=$vpc_id --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text)
    if [ ! -z "$SGS" ]; then
        echo "   Found security groups: $SGS"
        for sg in $SGS; do
            echo "   Deleting security group: $sg"
            aws ec2 delete-security-group --group-id $sg
        done
    fi
    
    # 8. Delete route tables (except main)
    echo "8. Deleting route tables..."
    for rt_id in $ROUTE_TABLES; do
        echo "   Deleting route table: $rt_id"
        aws ec2 delete-route-table --route-table-id $rt_id
    done
    
    # 9. Finally, delete the VPC
    echo "9. Deleting VPC: $vpc_id"
    aws ec2 delete-vpc --vpc-id $vpc_id
    
    echo "=== VPC $vpc_id cleanup complete ==="
done

echo ""
echo "=== Cleanup Summary ==="
echo "If you still see NAT gateways in 'deleted' state, they will be automatically removed"
echo "once all dependencies are cleared. This can take a few minutes."
echo ""
echo "To check remaining resources:"
echo "aws ec2 describe-nat-gateways"
echo "aws ec2 describe-vpcs" 