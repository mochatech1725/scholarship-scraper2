#!/usr/bin/env ts-node

import { BatchClient, DescribeJobDefinitionsCommand } from '@aws-sdk/client-batch';

async function listJobDefinitions(): Promise<void> {
  const batchClient = new BatchClient({ region: 'us-east-1' });
  
  const command = new DescribeJobDefinitionsCommand({});

  try {
    const response = await batchClient.send(command);
    
    console.log('📋 Available Job Definitions:');
    response.jobDefinitions?.forEach(jobDef => {
      console.log(`  - ${jobDef.jobDefinitionName} (Revision: ${jobDef.revision}, Status: ${jobDef.status})`);
      console.log(`    Image: ${jobDef.containerProperties?.image}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error listing job definitions:', error);
  }
}

listJobDefinitions(); 