import { BatchClient, SubmitJobCommand } from '@aws-sdk/client-batch';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand as DocScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { 
  ENVIRONMENT, 
  LAMBDA_TIMEOUT_MINUTES
} from '../../utils/constants';
import { ConfigUtils } from '../../utils/helper';

const batchClient = new BatchClient({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: any): Promise<any> => {
  console.log('Job orchestrator triggered:', JSON.stringify(event, null, 2));

  try {
    const jobId = uuidv4();
    const startTime = new Date().toISOString();
    const environment = ENVIRONMENT;

    // Create job record in DynamoDB
    const jobRecord = {
      jobId,
      startTime,
      status: 'pending',
      website: 'all',
      recordsFound: 0,
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      errors: [],
      environment,
    };

    await dynamoClient.send(new PutCommand({
      TableName: process.env.JOBS_TABLE!,
      Item: jobRecord,
    }));

    // Load website configuration from DynamoDB
    const websitesTableName = process.env.WEBSITES_TABLE;
    
    if (!websitesTableName) {
      throw new Error('WEBSITES_TABLE environment variable is not set');
    }
    
    const scanCommand = new DocScanCommand({
      TableName: websitesTableName,
      FilterExpression: '#enabled = :enabled',
      ExpressionAttributeNames: {
        '#enabled': 'enabled'
      },
      ExpressionAttributeValues: {
        ':enabled': true
      }
    });
    
    const scanResponse = await dynamoClient.send(scanCommand);
    const enabledWebsites = scanResponse.Items || [];

    // Submit batch job for each enabled website
    const jobPromises = enabledWebsites.map(async (website: any) => {
      const websiteJobId = `${jobId}-${website.name}`;
      
      console.log(`Submitting job for ${website.name} (${website.scraperClass})`);
      
      const jobParams = {
        jobName: `scholarship-scraper-${website.name}-${Date.now()}`,
        jobQueue: process.env.JOB_QUEUE_ARN!,
        jobDefinition: process.env.JOB_DEFINITION_ARN!,
        parameters: {
          website: website.name,
          jobId: websiteJobId,
          environment: environment,
          scholarshipsTable: process.env.SCHOLARSHIPS_TABLE!,
          jobsTable: process.env.JOBS_TABLE!,
        },
        containerOverrides: {
          environment: [
            {
              name: 'WEBSITE',
              value: website.name,
            },
            {
              name: 'JOB_ID',
              value: websiteJobId,
            },
            {
              name: 'ENVIRONMENT',
              value: environment,
            },
            {
              name: 'SCHOLARSHIPS_TABLE',
              value: process.env.SCHOLARSHIPS_TABLE!,
            },
            {
              name: 'JOBS_TABLE',
              value: process.env.JOBS_TABLE!,
            },
            {
              name: 'S3_RAW_DATA_BUCKET',
              value: process.env.S3_RAW_DATA_BUCKET!,
            },
          ],
        },
        timeout: {
          attemptDurationSeconds: LAMBDA_TIMEOUT_MINUTES * 60,
        },
      };

      try {
        const submitJobCommand = new SubmitJobCommand(jobParams);
        const submitJobResponse = await batchClient.send(submitJobCommand);
        
        console.log(`Successfully submitted job for ${website.name}:`, submitJobResponse.jobId);
        
        return {
          website: website.name,
          jobId: submitJobResponse.jobId,
          status: 'submitted',
        };
      } catch (error) {
        console.error(`Failed to submit job for ${website.name}:`, error);
        return {
          website: website.name,
          jobId: null,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    const jobResults = await Promise.all(jobPromises);
    
    const successfulJobs = jobResults.filter(result => result.status === 'submitted');
    const failedJobs = jobResults.filter(result => result.status === 'failed');

    console.log(`Job submission completed:`, {
      total: jobResults.length,
      successful: successfulJobs.length,
      failed: failedJobs.length,
    });

    if (failedJobs.length > 0) {
      console.warn('Some jobs failed to submit:', failedJobs);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Jobs submitted successfully',
        jobId,
        totalJobs: jobResults.length,
        successfulJobs: successfulJobs.length,
        failedJobs: failedJobs.length,
        results: jobResults,
      }),
    };

  } catch (error) {
    console.error('Error in job orchestrator:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error submitting jobs',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}; 