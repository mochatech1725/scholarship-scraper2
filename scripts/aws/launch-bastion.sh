#!/bin/bash

# === CONFIGURATION ===
VPC_ID="vpc-079b75c89375da584"  # Your VPC ID (from CDK output)
SUBNET_ID=""                    # Will auto-select a public subnet below
KEY_NAME="bastion-key"          # Name for the SSH key pair
INSTANCE_TYPE="t3.micro"
AMI_ID=""                       # Will auto-select latest Amazon Linux 2 AMI
SECURITY_GROUP_NAME="bastion-ssh-access"
REGION="us-east-1"

# === 1. Find a public subnet in your VPC ===
echo "Finding a public subnet in VPC $VPC_ID..."
SUBNET_ID=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=map-public-ip-on-launch,Values=true" \
  --query "Subnets[0].SubnetId" --output text --region $REGION)

if [[ "$SUBNET_ID" == "None" || -z "$SUBNET_ID" ]]; then
  echo "ERROR: No public subnet found in VPC $VPC_ID"
  exit 1
fi
echo "Using public subnet: $SUBNET_ID"

# === 2. Find latest Amazon Linux 2 AMI ===
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" "Name=state,Values=available" \
  --query "Images | sort_by(@, &CreationDate)[-1].ImageId" --output text --region $REGION)
echo "Using AMI: $AMI_ID"

# === 3. Create SSH key pair (if not exists) ===
if ! aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region $REGION &>/dev/null; then
  echo "Creating SSH key pair: $KEY_NAME"
  aws ec2 create-key-pair --key-name "$KEY_NAME" --query "KeyMaterial" --output text --region $REGION > "$KEY_NAME.pem"
  chmod 400 "$KEY_NAME.pem"
  echo "Key saved to $KEY_NAME.pem"
else
  echo "SSH key pair $KEY_NAME already exists. Skipping creation."
fi

# === 4. Create security group for SSH (if not exists) ===
SG_ID=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$SECURITY_GROUP_NAME" "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[0].GroupId" --output text --region $REGION)
if [[ "$SG_ID" == "None" || -z "$SG_ID" ]]; then
  echo "Creating security group: $SECURITY_GROUP_NAME"
  SG_ID=$(aws ec2 create-security-group --group-name "$SECURITY_GROUP_NAME" --description "SSH access for bastion" --vpc-id "$VPC_ID" --region $REGION --query "GroupId" --output text)
  # Allow SSH from your current IP
  MYIP=$(curl -s https://checkip.amazonaws.com)
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 22 --cidr "$MYIP/32" --region $REGION
  echo "Security group $SG_ID created and SSH allowed from $MYIP"
else
  echo "Security group $SG_ID already exists. Skipping creation."
fi

# === 5. Launch EC2 instance ===
echo "Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI_ID" \
  --count 1 \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --subnet-id "$SUBNET_ID" \
  --associate-public-ip-address \
  --query "Instances[0].InstanceId" \
  --output text --region $REGION)

echo "Waiting for instance $INSTANCE_ID to be running..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region $REGION

PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --query "Reservations[0].Instances[0].PublicIpAddress" --output text --region $REGION)
echo "Bastion host launched: $INSTANCE_ID ($PUBLIC_IP)"

# === 6. Print SSH and MySQL tunnel instructions ===
echo
echo "=============================================="
echo "SSH into your bastion host:"
echo "ssh -i $KEY_NAME.pem ec2-user@$PUBLIC_IP"
echo
echo "To use MySQL Workbench via SSH tunnel, run:"
echo "ssh -i $KEY_NAME.pem -L 3307:scholarshipscraper-dev-mysqlinstance216dd474-5wsgcciykpks.cynq0w8k0976.us-east-1.rds.amazonaws.com:3306 ec2-user@$PUBLIC_IP"
echo
echo "Then connect MySQL Workbench to:"
echo "  Host: 127.0.0.1"
echo "  Port: 3307"
echo "  Username: root"
echo "  Password: (from AWS Secrets Manager: scholarships-dev)"
echo "  Database: scholarships_dev"
echo "=============================================="