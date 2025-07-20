#!/usr/bin/env ts-node

import { BatchClient, SubmitJobCommand } from '@aws-sdk/client-batch';

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

// Initialize Batch client
const batchClient = new BatchClient({});

async function submitMySQLTestJob(): Promise<void> {
  console.log(`🚀 Submitting MySQL test job for environment: ${ENVIRONMENT}`);
  
  try {
    const submitCommand = new SubmitJobCommand({
      jobName: `mysql-test-${Date.now()}`,
      jobQueue: `arn:aws:batch:us-east-1:703290033396:job-queue/ScraperJobQueue-NZfnjCVRxhSGFIbe`,
      jobDefinition: `arn:aws:batch:us-east-1:703290033396:job-definition/ScraperJobDefinition-fY3HPA7QoYgwcTrY:2`,
      parameters: {
        WEBSITE: 'mysql_test',
        JOB_ID: `mysql-test-${Date.now()}`,
        ENVIRONMENT: ENVIRONMENT,
        SCHOLARSHIPS_TABLE: `scholarships-${ENVIRONMENT}`,
        JOBS_TABLE: `scholarship-jobs-${ENVIRONMENT}`,
        S3_RAW_DATA_BUCKET: `scholarship-raw-data-${ENVIRONMENT}-703290033396`,
      },
    });

    const response = await batchClient.send(submitCommand);
    console.log('✅ MySQL test job submitted successfully!');
    console.log(`Job ID: ${response.jobId}`);
    console.log(`Job Name: ${response.jobName}`);
    console.log('\n📋 You can monitor the job in the AWS Console or check logs in CloudWatch');
    
  } catch (error) {
    console.error('❌ Error submitting MySQL test job:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  submitMySQLTestJob()
    .then(() => {
      console.log('🎉 MySQL test job submission completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 MySQL test job submission failed:', error);
      process.exit(1);
    });
}

export { submitMySQLTestJob }; 