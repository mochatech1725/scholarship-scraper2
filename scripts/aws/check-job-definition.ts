#!/usr/bin/env ts-node

import { BatchClient, DescribeJobDefinitionsCommand } from '@aws-sdk/client-batch';

async function checkJobDefinition(): Promise<void> {
  const batchClient = new BatchClient({ region: 'us-east-1' });
  
  const command = new DescribeJobDefinitionsCommand({
    jobDefinitions: ['ScraperJobDefinition-fY3HPA7QoYgwcTrY']
  });

  try {
    const response = await batchClient.send(command);
    
    if (response.jobDefinitions && response.jobDefinitions.length > 0) {
      const jobDef = response.jobDefinitions[0];
      console.log(`📋 Job Definition: ${jobDef.jobDefinitionName}`);
      console.log(`📋 Revision: ${jobDef.revision}`);
      console.log(`📋 Status: ${jobDef.status}`);
      console.log(`📋 Image: ${jobDef.containerProperties?.image}`);
      console.log(`📋 Environment Variables:`);
      jobDef.containerProperties?.environment?.forEach(env => {
        console.log(`  - ${env.name}: ${env.value}`);
      });
    } else {
      console.log('❌ Job definition not found');
    }
  } catch (error) {
    console.error('❌ Error checking job definition:', error);
  }
}

checkJobDefinition(); 