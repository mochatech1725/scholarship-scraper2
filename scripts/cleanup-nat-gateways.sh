#!/bin/bash

echo "=== NAT Gateway Cleanup Script ==="

# Get all NAT gateways
echo "1. Checking for NAT gateways..."
NAT_GATEWAYS=$(aws ec2 describe-nat-gateways --query 'NatGateways[*].NatGatewayId' --output text)

if [ -z "$NAT_GATEWAYS" ]; then
    echo "No NAT gateways found."
    exit 0
fi

echo "Found NAT gateways: $NAT_GATEWAYS"

# Check the state of each NAT gateway
for nat_id in $NAT_GATEWAYS; do
    echo "2. Checking state of NAT gateway: $nat_id"
    STATE=$(aws ec2 describe-nat-gateways --nat-gateway-ids $nat_id --query 'NatGateways[0].State' --output text)
    echo "   State: $STATE"
    
    if [ "$STATE" = "available" ]; then
        echo "3. Attempting to delete NAT gateway: $nat_id"
        aws ec2 delete-nat-gateway --nat-gateway-id $nat_id
        echo "   Delete request submitted. NAT gateway will be deleted when dependencies are removed."
    else
        echo "   NAT gateway is in state: $STATE - cannot delete yet"
    fi
done

echo ""
echo "4. Checking for route table associations that might be blocking deletion..."
VPC_IDS=$(aws ec2 describe-nat-gateways --query 'NatGateways[*].VpcId' --output text)

for vpc_id in $VPC_IDS; do
    echo "   Checking VPC: $vpc_id"
    
    # Get route tables in this VPC
    ROUTE_TABLES=$(aws ec2 describe-route-tables --filters Name=vpc-id,Values=$vpc_id --query 'RouteTables[*].RouteTableId' --output text)
    
    for rt_id in $ROUTE_TABLES; do
        echo "   Checking route table: $rt_id"
        
        # Check if this route table has routes pointing to NAT gateways
        NAT_ROUTES=$(aws ec2 describe-route-tables --route-table-ids $rt_id --query 'RouteTables[0].Routes[?NatGatewayId!=null].NatGatewayId' --output text)
        
        if [ ! -z "$NAT_ROUTES" ]; then
            echo "     Found NAT gateway routes in route table $rt_id: $NAT_ROUTES"
            echo "     You need to delete these routes first:"
            echo "     aws ec2 delete-route --route-table-id $rt_id --destination-cidr-block 0.0.0.0/0"
        fi
    done
done

echo ""
echo "5. Common issues and solutions:"
echo "   - If NAT gateway is 'pending' or 'failed', wait for it to become 'available'"
echo "   - If route tables have routes pointing to NAT gateways, delete those routes first"
echo "   - If subnets are associated with route tables that use NAT gateways, disassociate them"
echo "   - If ECS tasks or Batch jobs are running, they might be using the NAT gateway"

echo ""
echo "6. To force delete a route pointing to a NAT gateway:"
echo "   aws ec2 delete-route --route-table-id <route-table-id> --destination-cidr-block 0.0.0.0/0" 