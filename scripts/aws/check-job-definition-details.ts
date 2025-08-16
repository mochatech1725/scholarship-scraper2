#!/usr/bin/env ts-node

import { BatchClient, DescribeJobDefinitionsCommand } from '@aws-sdk/client-batch';

async function checkJobDefinitionDetails(): Promise<void> {
  const batchClient = new BatchClient({ region: 'us-east-1' });
  
  const command = new DescribeJobDefinitionsCommand({
    jobDefinitions: ['arn:aws:batch:us-east-1:703290033396:job-definition/ScraperJobDefinition-fY3HPA7QoYgwcTrY:2']
  });

  try {
    const response = await batchClient.send(command);
    
    if (response.jobDefinitions && response.jobDefinitions.length > 0) {
      const jobDef = response.jobDefinitions[0];
      console.log(`📋 Job Definition: ${jobDef.jobDefinitionName}`);
      console.log(`📋 Revision: ${jobDef.revision}`);
      console.log(`📋 Status: ${jobDef.status}`);
      console.log(`📋 Image: ${jobDef.containerProperties?.image}`);
      
      console.log('\n📋 Container Properties:');
      console.log(`  Command: ${jobDef.containerProperties?.command?.join(' ')}`);
      console.log(`  VCPUs: ${jobDef.containerProperties?.vcpus}`);
      console.log(`  Memory: ${jobDef.containerProperties?.memory}`);
      
      console.log('\n📋 Environment Variables:');
      jobDef.containerProperties?.environment?.forEach(env => {
        console.log(`  - ${env.name}: ${env.value}`);
      });
      
      console.log('\n📋 Job Role ARN:');
      console.log(`  - ${jobDef.containerProperties?.jobRoleArn}`);
      
      console.log('\n📋 Execution Role ARN:');
      console.log(`  - ${jobDef.containerProperties?.executionRoleArn}`);
      
      console.log('\n📋 Resource Requirements:');
      jobDef.containerProperties?.resourceRequirements?.forEach(req => {
        console.log(`  - ${req.type}: ${req.value}`);
      });
      
    } else {
      console.log('❌ Job definition not found');
    }
  } catch (error) {
    console.error('❌ Error checking job definition:', error);
  }
}

checkJobDefinitionDetails(); 