import { BatchClient, SubmitJobCommand } from '@aws-sdk/client-batch';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { 
  ENVIRONMENT, 
  SCHOLARSHIPS_TABLE, 
  JOBS_TABLE, 
  JOB_QUEUE_ARN, 
  JOB_DEFINITION_ARN,
  LAMBDA_TIMEOUT_MINUTES
} from '../../utils/constants';

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
      TableName: JOBS_TABLE,
      Item: jobRecord,
    }));

    // Submit batch job for each website
    const websites = ['careerone', 'collegescholarship', 'general_search'];
    
    for (const website of websites) {
      const batchJobParams = {
        jobName: `scholarship-scraper-${website}-${jobId}`,
        jobQueue: JOB_QUEUE_ARN,
        jobDefinition: JOB_DEFINITION_ARN,
        parameters: {
          website,
          jobId,
          environment,
        },
        containerOverrides: {
          environment: [
            {
              name: 'WEBSITE',
              value: website,
            },
            {
              name: 'JOB_ID',
              value: jobId,
            },
            {
              name: 'ENVIRONMENT',
              value: environment,
            },
            {
              name: 'SCHOLARSHIPS_TABLE',
              value: SCHOLARSHIPS_TABLE,
            },
            {
              name: 'JOBS_TABLE',
              value: JOBS_TABLE,
            },
          ],
        },
      };

      console.log(`Submitting batch job for ${website}:`, batchJobParams);

      await batchClient.send(new SubmitJobCommand(batchJobParams));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Batch jobs submitted successfully',
        jobId,
        websitesSubmitted: websites,
      }),
    };

  } catch (error) {
    console.error('Error in job orchestrator:', error);
    throw error;
  }
}; 