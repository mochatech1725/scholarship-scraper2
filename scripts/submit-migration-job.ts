#!/usr/bin/env ts-node

import { BatchClient, SubmitJobCommand } from '@aws-sdk/client-batch';

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const JOB_QUEUE = `arn:aws:batch:us-east-1:703290033396:job-queue/ScraperJobQueue-NZfnjCVRxhSGFIbe`;
const JOB_DEFINITION = `arn:aws:batch:us-east-1:703290033396:job-definition/ScraperJobDefinition-fY3HPA7QoYgwcTrY:5`;

// Initialize Batch client
const batchClient = new BatchClient({});

async function submitMigrationJob(): Promise<void> {
  console.log(`🚀 Submitting MySQL migration job for environment: ${ENVIRONMENT}`);
  console.log(`📋 Job Queue: ${JOB_QUEUE}`);
  console.log(`📋 Job Definition: ${JOB_DEFINITION}`);

  const jobName = `mysql-migration-${Date.now()}`;
  
  const command = new SubmitJobCommand({
    jobName,
    jobQueue: JOB_QUEUE,
    jobDefinition: JOB_DEFINITION,
    containerOverrides: {
      environment: [
        {
          name: 'WEBSITE',
          value: 'mysql_migrate'
        },
        {
          name: 'JOB_ID',
          value: jobName
        }
      ]
    },
    timeout: {
      attemptDurationSeconds: 3600 // 1 hour timeout
    }
  });

  try {
    const response = await batchClient.send(command);
    
    console.log('✅ MySQL migration job submitted successfully!');
    console.log(`📋 Job ID: ${response.jobId}`);
    console.log(`📋 Job Name: ${response.jobName}`);
    
    console.log('\n📋 You can monitor the job in the AWS Console or check logs in CloudWatch');
    console.log('🎉 MySQL migration job submission completed');

  } catch (error) {
    console.error('❌ Error submitting migration job:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  submitMigrationJob()
    .then(() => {
      console.log('🎉 Migration job submission completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration job submission failed:', error);
      process.exit(1);
    });
}

export { submitMigrationJob }; 