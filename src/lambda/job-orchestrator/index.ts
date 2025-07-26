import { BatchClient, SubmitJobCommand } from '@aws-sdk/client-batch';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand as DocScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { 
  ENVIRONMENT, 
  LAMBDA_TIMEOUT_MINUTES
} from '../../utils/constants';
import { createDatabaseFromEnv } from '../../utils/mysql-config';

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
      jobId, // <-- Use camelCase to match DynamoDB schema
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

    // Load website configuration from MySQL
    const db = await createDatabaseFromEnv();
    await db.connect();
    
    const enabledWebsites = await db.query(
      'SELECT * FROM websites WHERE enabled = TRUE'
    );
    
    await db.disconnect();

    // Submit batch job for each enabled website
    const jobPromises = enabledWebsites.map(async (website: any) => {
      const website_job_id = `${jobId}-${website.name}`;
      
      console.log(`Submitting job for ${website.name} (${website.scraperClass})`);
      
      const jobParams = {
        jobName: `scholarship-scraper-${website.name}-${Date.now()}`,
        jobQueue: process.env.JOB_QUEUE_ARN!,
        jobDefinition: process.env.JOB_DEFINITION_ARN!,
        parameters: {
          website: website.name,
          job_id: website_job_id,
          environment: environment,
          jobs_table: process.env.JOBS_TABLE!,
        },
        containerOverrides: {
          environment: [
            {
              name: 'WEBSITE',
              value: website.name,
            },
            {
              name: 'JOB_ID',
              value: website_job_id,
            },
            {
              name: 'ENVIRONMENT',
              value: environment,
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
      };

      return batchClient.send(new SubmitJobCommand(jobParams));
    });

    const jobResults = await Promise.allSettled(jobPromises);
    const successfulJobs = jobResults.filter(result => result.status === 'fulfilled');

    console.log(`Submitted ${jobResults.length} jobs, ${successfulJobs.length} successful`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Jobs submitted successfully',
        job_id: jobId,
        totalJobs: jobResults.length,
        successfulJobs: successfulJobs.length,
        failedJobs: jobResults.length - successfulJobs.length,
      }),
    };

  } catch (error) {
    console.error('Error in job orchestrator:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error orchestrating jobs',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}; 