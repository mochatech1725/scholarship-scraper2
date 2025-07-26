#!/usr/bin/env ts-node

import { EC2Client, DescribeSecurityGroupsCommand, DescribeNetworkInterfacesCommand } from '@aws-sdk/client-ec2';
import { LambdaClient, ListFunctionsCommand } from '@aws-sdk/client-lambda';
import { BatchClient, DescribeComputeEnvironmentsCommand } from '@aws-sdk/client-batch';

async function checkSecurityGroupDependencies(): Promise<void> {
  const securityGroupId = 'sg-04935f4cde8052d1e'; // From the error message
  const ec2Client = new EC2Client({});
  const lambdaClient = new LambdaClient({});
  const batchClient = new BatchClient({});
  
  console.log(`🔍 Checking dependencies for security group: ${securityGroupId}`);
  
  try {
    // Check security group details
    const sgCommand = new DescribeSecurityGroupsCommand({
      GroupIds: [securityGroupId]
    });
    const sgResponse = await ec2Client.send(sgCommand);
    
    if (sgResponse.SecurityGroups && sgResponse.SecurityGroups.length > 0) {
      const sg = sgResponse.SecurityGroups[0];
      console.log(`📋 Security Group: ${sg.GroupName} (${sg.GroupId})`);
      console.log(`📝 Description: ${sg.Description}`);
      console.log(`🏷️  VPC: ${sg.VpcId}`);
    }
    
    // Check network interfaces using this security group
    const eniCommand = new DescribeNetworkInterfacesCommand({
      Filters: [
        {
          Name: 'group-id',
          Values: [securityGroupId]
        }
      ]
    });
    const eniResponse = await ec2Client.send(eniCommand);
    
    if (eniResponse.NetworkInterfaces && eniResponse.NetworkInterfaces.length > 0) {
      console.log('\n🔗 Network Interfaces using this security group:');
      eniResponse.NetworkInterfaces.forEach((eni: any) => {
        console.log(`  - ${eni.NetworkInterfaceId} (${eni.Description})`);
        console.log(`    Status: ${eni.Status}`);
        console.log(`    Attachment: ${eni.Attachment?.InstanceId || 'Not attached'}`);
      });
    } else {
      console.log('\n✅ No network interfaces found using this security group');
    }
    
    // Check Lambda functions
    const lambdaCommand = new ListFunctionsCommand({});
    const lambdaResponse = await lambdaClient.send(lambdaCommand);
    
    if (lambdaResponse.Functions) {
      const functionsWithVpc = lambdaResponse.Functions.filter(func => 
        func.VpcConfig && func.VpcConfig.SecurityGroupIds?.includes(securityGroupId)
      );
      
      if (functionsWithVpc.length > 0) {
        console.log('\n🔧 Lambda functions using this security group:');
        functionsWithVpc.forEach(func => {
          console.log(`  - ${func.FunctionName}`);
          console.log(`    Runtime: ${func.Runtime}`);
          console.log(`    VPC: ${func.VpcConfig?.VpcId}`);
        });
      } else {
        console.log('\n✅ No Lambda functions found using this security group');
      }
    }
    
    // Check Batch compute environments
    const batchCommand = new DescribeComputeEnvironmentsCommand({});
    const batchResponse = await batchClient.send(batchCommand);
    
    if (batchResponse.computeEnvironments) {
      const computeEnvsWithSg = batchResponse.computeEnvironments.filter(env => 
        env.computeResources?.securityGroupIds?.includes(securityGroupId)
      );
      
      if (computeEnvsWithSg.length > 0) {
        console.log('\n⚙️  Batch compute environments using this security group:');
        computeEnvsWithSg.forEach(env => {
          console.log(`  - ${env.computeEnvironmentName}`);
          console.log(`    Status: ${env.status}`);
        });
      } else {
        console.log('\n✅ No Batch compute environments found using this security group');
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking security group dependencies:', error);
  }
}

// Run the check
checkSecurityGroupDependencies()
  .then(() => {
    console.log('\n✅ Dependency check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Dependency check failed:', error);
    process.exit(1);
  }); 