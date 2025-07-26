#!/usr/bin/env ts-node

import { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { ENVIRONMENT } from '../src/utils/constants';

async function checkLambdaLogs(): Promise<void> {
  const environment = ENVIRONMENT;
  const functionName = `scholarship-scraper-orchestrator-${environment}`;
  const logGroupName = `/aws/lambda/${functionName}`;
  
  const logsClient = new CloudWatchLogsClient({});
  
  console.log(`🔍 Checking logs for: ${functionName}`);
  console.log(`📋 Log group: ${logGroupName}`);
  
  try {
    // Get the latest log stream
    const describeCommand = new DescribeLogStreamsCommand({
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 1,
    });
    
    const describeResponse = await logsClient.send(describeCommand);
    
    if (!describeResponse.logStreams || describeResponse.logStreams.length === 0) {
      console.log('❌ No log streams found');
      return;
    }
    
    const latestStream = describeResponse.logStreams[0];
    console.log(`📝 Latest log stream: ${latestStream.logStreamName}`);
    console.log(`🕐 Last event time: ${latestStream.lastEventTimestamp ? new Date(latestStream.lastEventTimestamp).toISOString() : 'N/A'}`);
    
    // Get the log events
    const eventsCommand = new GetLogEventsCommand({
      logGroupName,
      logStreamName: latestStream.logStreamName!,
      startFromHead: false,
      limit: 50, // Get last 50 events
    });
    
    const eventsResponse = await logsClient.send(eventsCommand);
    
    if (!eventsResponse.events || eventsResponse.events.length === 0) {
      console.log('❌ No log events found');
      return;
    }
    
    console.log('\n📄 Recent log events:');
    console.log('=' .repeat(80));
    
    eventsResponse.events.forEach((event, index) => {
      const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : 'N/A';
      console.log(`[${timestamp}] ${event.message}`);
      
      // Highlight secret-related messages
      if (event.message?.includes('secret')) {
        console.log(`🔐 SECRET MESSAGE: ${event.message}`);
      }
      if (event.message?.includes('MySQL')) {
        console.log(`🗄️  MYSQL MESSAGE: ${event.message}`);
      }
      if (event.message?.includes('Error') || event.message?.includes('ERROR')) {
        console.log(`❌ ERROR MESSAGE: ${event.message}`);
      }
    });
    
    // Check for specific secret loading messages
    const secretMessages = eventsResponse.events.filter(event => 
      event.message?.includes('secret') || 
      event.message?.includes('MySQL config')
    );
    
    if (secretMessages.length > 0) {
      console.log('\n🔐 Secret-related messages found:');
      secretMessages.forEach(event => {
        console.log(`  ${event.message}`);
      });
    } else {
      console.log('\n⚠️  No secret-related messages found in recent logs');
    }
    
  } catch (error) {
    console.error('❌ Error checking logs:', error);
  }
}

// Run the check
checkLambdaLogs()
  .then(() => {
    console.log('\n✅ Log check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Log check failed:', error);
    process.exit(1);
  }); 