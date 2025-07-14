import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { loadAllConfigs } from '../../utils/helper';

export interface ScholarshipScraperStackProps extends cdk.StackProps {
  environment: string;
  description?: string;
}

export class ScholarshipScraperStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get environment from context (passed via -c environment=dev)
    const environment = this.node.tryGetContext('environment') || 'dev';

    // Load configuration files
    const { environment: envConfig, tags: tagsConfig, iamPolicies } = loadAllConfigs(environment);

    // Apply common tags
    Object.entries(tagsConfig.common).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value as string);
    });

    // Apply environment-specific tags
    Object.entries(tagsConfig[environment]).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value as string);
    });

    // VPC for Batch jobs
    const vpc = new ec2.Vpc(this, 'ScraperVPC', {
      maxAzs: envConfig.maxAzs,
      natGateways: envConfig.natGateways,
    });

    // DynamoDB Tables
    const scholarshipsTable = new dynamodb.Table(this, 'ScholarshipsTable', {
      tableName: `scholarships-${environment}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'deadline', type: dynamodb.AttributeType.STRING },
      billingMode: envConfig.dynamoBillingMode === 'PROVISIONED' ? dynamodb.BillingMode.PROVISIONED : dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const jobsTable = new dynamodb.Table(this, 'ScrapingJobsTable', {
      tableName: `scholarship-scraper-jobs-${environment}`,
      partitionKey: { name: 'jobId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startTime', type: dynamodb.AttributeType.STRING },
      billingMode: envConfig.dynamoBillingMode === 'PROVISIONED' ? dynamodb.BillingMode.PROVISIONED : dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create GSI for scholarships table
    scholarshipsTable.addGlobalSecondaryIndex({
      indexName: 'DeadlineIndex',
      partitionKey: { name: 'deadline', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'targetType', type: dynamodb.AttributeType.STRING },
    });

    scholarshipsTable.addGlobalSecondaryIndex({
      indexName: 'TargetTypeIndex',
      partitionKey: { name: 'targetType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'deadline', type: dynamodb.AttributeType.STRING },
    });

    scholarshipsTable.addGlobalSecondaryIndex({
      indexName: 'EthnicityIndex',
      partitionKey: { name: 'ethnicity', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'deadline', type: dynamodb.AttributeType.STRING },
    });

    scholarshipsTable.addGlobalSecondaryIndex({
      indexName: 'GenderIndex',
      partitionKey: { name: 'gender', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'deadline', type: dynamodb.AttributeType.STRING },
    });

    // IAM Roles
    const batchJobRole = new iam.Role(this, 'BatchJobRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'),
      ],
    });

    // Separate role for Batch Compute Environment service
    const batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
      assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'),
      ],
    });

    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant DynamoDB permissions
    scholarshipsTable.grantReadWriteData(batchJobRole);
    jobsTable.grantReadWriteData(batchJobRole);
    scholarshipsTable.grantReadWriteData(lambdaRole);
    jobsTable.grantReadWriteData(lambdaRole);

    // Grant Bedrock permissions
    batchJobRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')
    );
    lambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')
    );

    // Lambda Function for job orchestration
    const jobOrchestrator = new lambda.Function(this, 'JobOrchestrator', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('src/lambda/job-orchestrator'),
      role: lambdaRole,
      environment: {
        SCHOLARSHIPS_TABLE: scholarshipsTable.tableName,
        JOBS_TABLE: jobsTable.tableName,
        ENVIRONMENT: environment,
      },
      timeout: cdk.Duration.minutes(5),
    });

    // ECS Cluster for Batch
    const cluster = new ecs.Cluster(this, 'ScraperCluster', {
      vpc,
      containerInsights: true,
    });

    // Batch Compute Environment
    const computeEnvironment = new batch.CfnComputeEnvironment(this, 'ScraperComputeEnvironment', {
      type: 'MANAGED',
      computeResources: {
        type: 'FARGATE',
        maxvCpus: envConfig.batchMaxVcpus,
        subnets: vpc.privateSubnets.map(subnet => subnet.subnetId),
        securityGroupIds: [vpc.vpcDefaultSecurityGroup],
      },
      serviceRole: batchServiceRole.roleArn,
      state: 'ENABLED',
    });

    // Batch Job Queue
    const jobQueue = new batch.CfnJobQueue(this, 'ScraperJobQueue', {
      priority: 1,
      computeEnvironmentOrder: [{
        computeEnvironment: computeEnvironment.ref,
        order: 1,
      }],
      state: 'ENABLED',
    });

    // EventBridge Rule for scheduling
    const rule = new events.Rule(this, 'ScrapingSchedule', {
      schedule: events.Schedule.expression(envConfig.scrapingSchedule),
      targets: [new targets.LambdaFunction(jobOrchestrator)],
    });

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'ScraperLogGroup', {
      logGroupName: `/aws/scholarship-scraper/${environment}`,
      retention: logs.RetentionDays[`DAYS_${envConfig.logRetentionDays}` as keyof typeof logs.RetentionDays],
    });

    // Outputs
    new cdk.CfnOutput(this, 'ScholarshipsTableName', {
      value: scholarshipsTable.tableName,
      description: 'DynamoDB table for scholarships',
    });

    new cdk.CfnOutput(this, 'JobsTableName', {
      value: jobsTable.tableName,
      description: 'DynamoDB table for scraping jobs',
    });

    new cdk.CfnOutput(this, 'JobQueueArn', {
      value: jobQueue.ref,
      description: 'AWS Batch Job Queue ARN',
    });
  }
} 