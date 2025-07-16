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
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { ConfigUtils } from '../../utils/helper';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export interface ScholarshipScraperStackProps extends cdk.StackProps {
  environment: string;
  description?: string;
}

export class ScholarshipScraperStack extends cdk.Stack {
  private scholarshipsTable: dynamodb.Table;
  private jobsTable: dynamodb.Table;
  private websitesTable: dynamodb.Table;
  private rawDataBucket: s3.Bucket;
  private configBucket: s3.Bucket;
  private batchJobRole: iam.Role;
  private batchServiceRole: iam.Role;
  private lambdaRole: iam.Role;
  private vpc: ec2.Vpc;
  private cluster: ecs.Cluster;
  private computeEnvironment: batch.CfnComputeEnvironment;
  private jobQueue: batch.CfnJobQueue;
  private jobDefinition: batch.CfnJobDefinition;
  private jobOrchestrator: NodejsFunction;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get environment from context (passed via -c environment=dev)
    const environment = cdk.Stack.of(this).node.tryGetContext('environment') || 'dev';

    // Load configuration files
    const { environment: envConfig, tags: tagsConfig, iamPolicies } = ConfigUtils.loadAllConfigs(environment);

    this.applyTags(tagsConfig, environment);

    this.setupS3(environment);
    this.setupConfigBucket(environment);
    this.setupDynamoDB(environment, envConfig);
    this.setupIAMRoles();
    this.setupCompute(envConfig);
    this.setupBatch(environment, envConfig);
    this.setupLambda(environment);
    this.setupEventBridge();
    this.setupCloudWatch(environment, envConfig);
    this.setupOutputs();
  }

  private applyTags(tagsConfig: any, environment: string): void {
    Object.entries(tagsConfig.common).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value as string);
    });

    Object.entries(tagsConfig[environment]).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value as string);
    });
  }

  private setupS3(environment: string): void {
    // S3 Bucket for raw scraping data
    this.rawDataBucket = new s3.Bucket(this, 'RawDataBucket', {
      bucketName: `scholarship-raw-data-${environment}-${cdk.Stack.of(this).account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          id: 'TransitionToIA',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
    });
  }

  private setupConfigBucket(environment: string): void {
    // S3 Bucket for configuration files
    this.configBucket = new s3.Bucket(this, 'ConfigBucket', {
      bucketName: `scholarship-config-${environment}-${cdk.Stack.of(this).account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Upload the websites.json configuration file
    new s3deploy.BucketDeployment(this, 'WebsitesConfigDeployment', {
      sources: [s3deploy.Source.asset('cdk/config')],
      destinationBucket: this.configBucket,
      destinationKeyPrefix: '',
    });
  }

  private setupDynamoDB(environment: string, envConfig: any): void {
    this.scholarshipsTable = new dynamodb.Table(this, 'ScholarshipsTable', {
      tableName: `scholarships-${environment}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'deadline', type: dynamodb.AttributeType.STRING },
      billingMode: envConfig.dynamoBillingMode === 'PROVISIONED' ? dynamodb.BillingMode.PROVISIONED : dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Jobs Table
    this.jobsTable = new dynamodb.Table(this, 'ScrapingJobsTable', {
      tableName: `scholarship-scraper-jobs-${environment}`,
      partitionKey: { name: 'jobId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startTime', type: dynamodb.AttributeType.STRING },
      billingMode: envConfig.dynamoBillingMode === 'PROVISIONED' ? dynamodb.BillingMode.PROVISIONED : dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Websites Configuration Table
    this.websitesTable = new dynamodb.Table(this, 'WebsitesTable', {
      tableName: `scholarship-scraper-websites-${environment}`,
      partitionKey: { name: 'name', type: dynamodb.AttributeType.STRING },
      billingMode: envConfig.dynamoBillingMode === 'PROVISIONED' ? dynamodb.BillingMode.PROVISIONED : dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.setupScholarshipTableIndexes();
  }

  private setupScholarshipTableIndexes(): void {
    this.scholarshipsTable.addGlobalSecondaryIndex({
      indexName: 'DeadlineIndex',
      partitionKey: { name: 'deadline', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'targetType', type: dynamodb.AttributeType.STRING },
    });

    this.scholarshipsTable.addGlobalSecondaryIndex({
      indexName: 'TargetTypeIndex',
      partitionKey: { name: 'targetType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'deadline', type: dynamodb.AttributeType.STRING },
    });

    this.scholarshipsTable.addGlobalSecondaryIndex({
      indexName: 'EthnicityIndex',
      partitionKey: { name: 'ethnicity', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'deadline', type: dynamodb.AttributeType.STRING },
    });

    this.scholarshipsTable.addGlobalSecondaryIndex({
      indexName: 'GenderIndex',
      partitionKey: { name: 'gender', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'deadline', type: dynamodb.AttributeType.STRING },
    });
  }

  private setupIAMRoles(): void {
    // Batch Job Role for ECS tasks
    this.batchJobRole = new iam.Role(this, 'BatchJobRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'),
      ],
    });

    // Batch Service Role for Compute Environment
    this.batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
      assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'),
      ],
    });

    this.lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    this.grantPermissions();
  }

  private grantPermissions(): void {
    // Grant DynamoDB permissions
    this.scholarshipsTable.grantReadWriteData(this.batchJobRole);
    this.jobsTable.grantReadWriteData(this.batchJobRole);
    this.websitesTable.grantReadData(this.batchJobRole);
    this.scholarshipsTable.grantReadWriteData(this.lambdaRole);
    this.jobsTable.grantReadWriteData(this.lambdaRole);
    this.websitesTable.grantReadData(this.lambdaRole);

    // Grant S3 permissions for raw data storage
    this.rawDataBucket.grantReadWrite(this.batchJobRole);
    this.rawDataBucket.grantReadWrite(this.lambdaRole);

    // Grant S3 permissions for config bucket
    this.configBucket.grantRead(this.lambdaRole);

    // Grant Batch permissions to Lambda role
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'batch:SubmitJob',
        'batch:DescribeJobs',
        'batch:ListJobs'
      ],
      resources: ['*']
    }));

    // Grant ECR permissions to batch job role
    this.batchJobRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage'
      ],
      resources: ['*']
    }));

    // Grant Bedrock permissions
    this.batchJobRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')
    );
    this.lambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')
    );
  }

  private setupCompute(envConfig: any): void {
    // VPC for Batch jobs
    this.vpc = new ec2.Vpc(this, 'ScraperVPC', {
      maxAzs: envConfig.maxAzs,
      natGateways: envConfig.natGateways,
    });

    // ECS Cluster for Batch
    this.cluster = new ecs.Cluster(this, 'ScraperCluster', {
      vpc: this.vpc,
      containerInsights: true,
    });
  }

  private setupBatch(environment: string, envConfig: any): void {
    this.computeEnvironment = new batch.CfnComputeEnvironment(this, 'ScraperComputeEnvironment', {
      type: 'MANAGED',
      computeResources: {
        type: 'FARGATE',
        maxvCpus: envConfig.batchMaxVcpus,
        subnets: this.vpc.privateSubnets.map((subnet: ec2.ISubnet) => subnet.subnetId),
        securityGroupIds: [this.vpc.vpcDefaultSecurityGroup],
      },
      serviceRole: this.batchServiceRole.roleArn,
      state: 'ENABLED',
    });

    // Batch Job Queue
    this.jobQueue = new batch.CfnJobQueue(this, 'ScraperJobQueue', {
      priority: 1,
      computeEnvironmentOrder: [{
        computeEnvironment: this.computeEnvironment.ref,
        order: 1,
      }],
      state: 'ENABLED',
    });

    // Get ECR repository URI
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;
    const ecrImageUri = `${accountId}.dkr.ecr.${region}.amazonaws.com/scholarship-scraper:${environment}`;

    // Batch Job Definition
    this.jobDefinition = new batch.CfnJobDefinition(this, 'ScraperJobDefinition', {
      type: 'container',
      containerProperties: {
        image: ecrImageUri,
        jobRoleArn: this.batchJobRole.roleArn,
        executionRoleArn: this.batchJobRole.roleArn, // Fargate jobs need both jobRoleArn and executionRoleArn
        resourceRequirements: [
          {
            type: 'VCPU',
            value: '1',
          },
          {
            type: 'MEMORY',
            value: '2048',
          },
        ],
        environment: [
          {
            name: 'ENVIRONMENT',
            value: environment,
          },
          {
            name: 'S3_RAW_DATA_BUCKET',
            value: this.rawDataBucket.bucketName,
          },
        ],
      },
      platformCapabilities: ['FARGATE'],
    });
  }

    private setupLambda(environment: string): void {
    // Lambda Function for job orchestration
    this.jobOrchestrator = new NodejsFunction(this, 'JobOrchestrator', {
      entry: 'src/lambda/job-orchestrator/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        SCHOLARSHIPS_TABLE: this.scholarshipsTable.tableName,
        JOBS_TABLE: this.jobsTable.tableName,
        WEBSITES_TABLE: this.websitesTable.tableName,
        ENVIRONMENT: environment,
        JOB_QUEUE_ARN: this.jobQueue.ref,
        JOB_DEFINITION_ARN: this.jobDefinition.ref,
        S3_RAW_DATA_BUCKET: this.rawDataBucket.bucketName,
      },
      timeout: cdk.Duration.minutes(5),
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2022',
      },
      role: this.lambdaRole,
    });
  }

  private setupEventBridge(): void {
    // EventBridge Rule for scheduling
    const rule = new events.Rule(this, 'ScrapingSchedule', {
      schedule: events.Schedule.expression('rate(1 hour)'), // This will be loaded from config
      targets: [new targets.LambdaFunction(this.jobOrchestrator)],
    });
  }

  private setupCloudWatch(environment: string, envConfig: any): void {
    const logGroup = new logs.LogGroup(this, 'ScraperLogGroup', {
      logGroupName: `/aws/scholarship-scraper/${environment}`,
      retention: logs.RetentionDays[`DAYS_${envConfig.logRetentionDays}` as keyof typeof logs.RetentionDays],
    });
  }

  private setupOutputs(): void {
    // Outputs
    new cdk.CfnOutput(this, 'ScholarshipsTableName', {
      value: this.scholarshipsTable.tableName,
      description: 'DynamoDB table for scholarships',
    });

    new cdk.CfnOutput(this, 'JobsTableName', {
      value: this.jobsTable.tableName,
      description: 'DynamoDB table for scraping jobs',
    });

    new cdk.CfnOutput(this, 'WebsitesTableName', {
      value: this.websitesTable.tableName,
      description: 'DynamoDB table for website configurations',
    });

    new cdk.CfnOutput(this, 'RawDataBucketName', {
      value: this.rawDataBucket.bucketName,
      description: 'S3 bucket for raw scraping data',
    });

    new cdk.CfnOutput(this, 'JobQueueArn', {
      value: this.jobQueue.ref,
      description: 'AWS Batch Job Queue ARN',
    });

    new cdk.CfnOutput(this, 'JobDefinitionArn', {
      value: this.jobDefinition.ref,
      description: 'AWS Batch Job Definition ARN',
    });

    new cdk.CfnOutput(this, 'JobOrchestratorFunctionName', {
      value: this.jobOrchestrator.functionName,
      description: 'Lambda function name for job orchestration',
    });

    // ECR Image URI output
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;
    const environment = cdk.Stack.of(this).node.tryGetContext('environment') || 'dev';
    const ecrImageUri = `${accountId}.dkr.ecr.${region}.amazonaws.com/scholarship-scraper:${environment}`;
    
    new cdk.CfnOutput(this, 'EcrImageUri', {
      value: ecrImageUri,
      description: 'ECR Image URI for the scraper container',
    });
  }
} 