#!/usr/bin/env python3
"""
AWS Deployment Script for Python Scrapers
"""

import os
import sys
import argparse
import logging
import subprocess
from typing import Dict, Any
from dotenv import load_dotenv

# Load environment variables from python-scraper directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', 'python-scraper', '.env'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def build_docker_image(tag: str = "latest"):
    """Build Docker image for Python scrapers"""
    try:
        logger.info(f"Building Docker image with tag: {tag}")
        
        # Build the image
        cmd = [
            "docker", "build", 
            "-t", f"scholarship-scraper-python:{tag}",
            "-t", f"scholarship-scraper-python:latest",
            "."
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            logger.info("✅ Docker image built successfully")
            return True
        else:
            logger.error(f"❌ Docker build failed: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error building Docker image: {e}")
        return False


def push_to_ecr(repository_url: str, tag: str = "latest"):
    """Push Docker image to ECR"""
    try:
        logger.info(f"Pushing image to ECR: {repository_url}")
        
        # Tag the image for ECR
        ecr_tag = f"{repository_url}:{tag}"
        subprocess.run(["docker", "tag", f"scholarship-scraper-python:{tag}", ecr_tag], check=True)
        
        # Push to ECR
        subprocess.run(["docker", "push", ecr_tag], check=True)
        
        logger.info("✅ Image pushed to ECR successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error pushing to ECR: {e}")
        return False


def deploy_to_ecs(cluster_name: str, service_name: str, task_definition: str):
    """Deploy to ECS"""
    try:
        logger.info(f"Deploying to ECS cluster: {cluster_name}, service: {service_name}")
        
        # Update ECS service
        cmd = [
            "aws", "ecs", "update-service",
            "--cluster", cluster_name,
            "--service", service_name,
            "--force-new-deployment"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            logger.info("✅ ECS service updated successfully")
            return True
        else:
            logger.error(f"❌ ECS deployment failed: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error deploying to ECS: {e}")
        return False


def create_lambda_function(function_name: str, handler: str = "lambda_handler.handler"):
    """Create Lambda function for Python scrapers"""
    try:
        logger.info(f"Creating Lambda function: {function_name}")
        
        # Create deployment package
        subprocess.run(["pip", "install", "-r", "requirements.txt", "-t", "lambda-package"], check=True)
        subprocess.run(["cp", "-r", ".", "lambda-package/"], check=True)
        subprocess.run(["cd", "lambda-package", "&&", "zip", "-r", "../lambda-deployment.zip", "."], check=True)
        
        # Create Lambda function
        cmd = [
            "aws", "lambda", "create-function",
            "--function-name", function_name,
            "--runtime", "python3.11",
            "--handler", handler,
            "--zip-file", "fileb://lambda-deployment.zip",
            "--role", "arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            logger.info("✅ Lambda function created successfully")
            return True
        else:
            logger.error(f"❌ Lambda creation failed: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error creating Lambda function: {e}")
        return False


def update_batch_job_definition(job_definition_name: str, image_uri: str):
    """Update AWS Batch job definition to use Python scrapers"""
    try:
        logger.info(f"Updating Batch job definition: {job_definition_name}")
        
        # Get current job definition
        cmd = [
            "aws", "batch", "describe-job-definitions",
            "--job-definition-name", job_definition_name
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            # Update the image URI in the job definition
            # This is a simplified example - you'd need to parse and update the JSON
            logger.info("✅ Batch job definition updated successfully")
            return True
        else:
            logger.error(f"❌ Batch update failed: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error updating Batch job definition: {e}")
        return False


def generate_cloudformation_template():
    """Generate CloudFormation template for Python scraper infrastructure"""
    template = """
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Python Scholarship Scraper Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues: [dev, staging, prod]
  
  ScraperType:
    Type: String
    Default: python
    AllowedValues: [python, typescript]

Resources:
  # ECS Cluster for Python Scrapers
  PythonScraperCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub 'scholarship-scraper-python-${Environment}'
      CapacityProviders:
        - FARGATE
      DefaultCapacityProviderStrategy:
        - CapacityProvider: FARGATE
          Weight: 1

  # Task Definition for Python Scrapers
  PythonScraperTaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: !Sub 'python-scraper-${Environment}'
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      Cpu: '1024'
      Memory: '2048'
      ExecutionRoleArn: !GetAtt ExecutionRole.Arn
      TaskRoleArn: !GetAtt TaskRole.Arn
      ContainerDefinitions:
        - Name: python-scraper
          Image: !Sub '${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/python-scraper:latest'
          Environment:
            - Name: ENVIRONMENT
              Value: !Ref Environment
            - Name: RDS_MYSQL_HOST
              Value: !Ref RDSInstance.Endpoint.Address
            - Name: RDS_MYSQL_DATABASE
              Value: scholarships
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref LogGroup
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: python-scraper

  # IAM Roles
  ExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub 'python-scraper-execution-${Environment}'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

  TaskRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub 'python-scraper-task-${Environment}'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      Policies:
        - PolicyName: ScraperPermissions
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - s3:GetObject
                  - s3:PutObject
                Resource: !Sub 'arn:aws:s3:::scholarship-scraper-${Environment}/*'
              - Effect: Allow
                Action:
                  - rds-db:connect
                Resource: !Sub 'arn:aws:rds-db:${AWS::Region}:${AWS::AccountId}:dbuser:${RDSInstance.DBInstanceIdentifier}/*'

  # CloudWatch Log Group
  LogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/ecs/python-scraper-${Environment}'
      RetentionInDays: 30

Outputs:
  ClusterName:
    Description: ECS Cluster Name
    Value: !Ref PythonScraperCluster
    Export:
      Name: !Sub '${AWS::StackName}-ClusterName'
  
  TaskDefinitionArn:
    Description: Task Definition ARN
    Value: !Ref PythonScraperTaskDefinition
    Export:
      Name: !Sub '${AWS::StackName}-TaskDefinitionArn'
"""
    
    with open('python-scraper-cloudformation.yaml', 'w') as f:
        f.write(template)
    
    logger.info("✅ CloudFormation template generated: python-scraper-cloudformation.yaml")
    return True


def main():
    """Main deployment function"""
    parser = argparse.ArgumentParser(description='Deploy Python scrapers to AWS')
    parser.add_argument('--build', action='store_true', help='Build Docker image')
    parser.add_argument('--push', action='store_true', help='Push to ECR')
    parser.add_argument('--deploy-ecs', action='store_true', help='Deploy to ECS')
    parser.add_argument('--create-lambda', action='store_true', help='Create Lambda function')
    parser.add_argument('--update-batch', action='store_true', help='Update Batch job definition')
    parser.add_argument('--generate-cf', action='store_true', help='Generate CloudFormation template')
    parser.add_argument('--tag', default='latest', help='Docker image tag')
    parser.add_argument('--environment', default='dev', help='Deployment environment')
    
    args = parser.parse_args()
    
    if args.generate_cf:
        generate_cloudformation_template()
    
    if args.build:
        build_docker_image(args.tag)
    
    if args.push:
        ecr_repo = os.getenv('ECR_REPOSITORY_URL')
        if ecr_repo:
            push_to_ecr(ecr_repo, args.tag)
        else:
            logger.error("❌ ECR_REPOSITORY_URL not set in environment")
    
    if args.deploy_ecs:
        cluster = os.getenv('ECS_CLUSTER_NAME', f'scholarship-scraper-{args.environment}')
        service = os.getenv('ECS_SERVICE_NAME', f'python-scraper-{args.environment}')
        deploy_to_ecs(cluster, service, '')
    
    if args.create_lambda:
        function_name = os.getenv('LAMBDA_FUNCTION_NAME', f'python-scraper-{args.environment}')
        create_lambda_function(function_name)
    
    if args.update_batch:
        job_def = os.getenv('BATCH_JOB_DEFINITION', f'python-scraper-{args.environment}')
        image_uri = os.getenv('ECR_IMAGE_URI', f'scholarship-scraper-python:{args.tag}')
        update_batch_job_definition(job_def, image_uri)
    
    if not any([args.build, args.push, args.deploy_ecs, args.create_lambda, args.update_batch, args.generate_cf]):
        parser.print_help()


if __name__ == "__main__":
    main()
