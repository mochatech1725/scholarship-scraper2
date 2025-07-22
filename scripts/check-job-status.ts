#!/usr/bin/env ts-node

import { BatchClient, DescribeJobsCommand } from '@aws-sdk/client-batch';

const JOB_ID = process.argv[2] || '3ee73528-566e-47d5-8346-ef6676c58ba2';

async function checkJobStatus(): Promise<void> {
  const batchClient = new BatchClient({ region: 'us-east-1' });
  
  const command = new DescribeJobsCommand({
    jobs: [JOB_ID]
  });

  try {
    const response = await batchClient.send(command);
    
    if (response.jobs && response.jobs.length > 0) {
      const job = response.jobs[0];
      console.log(`📋 Job ID: ${job.jobId}`);
      console.log(`📋 Job Name: ${job.jobName}`);
      console.log(`📋 Status: ${job.status}`);
      console.log(`📋 Created: ${job.createdAt}`);
      
      if (job.stoppedAt) {
        console.log(`📋 Stopped: ${job.stoppedAt}`);
      }
      
      if (job.statusReason) {
        console.log(`📋 Reason: ${job.statusReason}`);
      }
      
      if (job.container && job.container.logStreamName) {
        console.log(`📋 Log Stream: ${job.container.logStreamName}`);
      }
    } else {
      console.log('❌ Job not found');
    }
  } catch (error) {
    console.error('❌ Error checking job status:', error);
  }
}

checkJobStatus(); 