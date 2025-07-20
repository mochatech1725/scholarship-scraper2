#!/usr/bin/env ts-node

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ScholarshipUtils } from '../src/utils/helper';

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const TABLE_NAME = `scholarships-${ENVIRONMENT}`;

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function cleanupExpiredScholarships(): Promise<void> {
  console.log(`🧹 Cleaning up expired scholarships from table: ${TABLE_NAME}`);
  console.log(`Environment: ${ENVIRONMENT}`);

  try {
    let totalScanned = 0;
    let expiredFound = 0;
    let deletedCount = 0;
    let lastEvaluatedKey: any = undefined;

    do {
      console.log(`\n📋 Scanning batch ${Math.floor(totalScanned / 1000) + 1}...`);
      
      const scanCommand = new ScanCommand({
        TableName: TABLE_NAME,
        Limit: 1000,
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const response = await docClient.send(scanCommand);
      const items = response.Items || [];
      totalScanned += items.length;

      console.log(`📊 Scanned ${items.length} items in this batch`);

      // Process items in parallel for better performance
      const deletePromises: Promise<void>[] = [];
      
      for (const item of items) {
        if (item.deadline && ScholarshipUtils.isDeadlineExpired(item.deadline)) {
          expiredFound++;
          console.log(`🗑️  Found expired scholarship: ${item.name} (deadline: ${item.deadline})`);
          
          const deletePromise = docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              id: item.id,
              deadline: item.deadline,
            },
          })).then(() => {
            deletedCount++;
          }).catch((error) => {
            console.error(`❌ Error deleting expired scholarship ${item.name}:`, error);
          });
          
          deletePromises.push(deletePromise);
        }
      }

      // Wait for all deletions to complete
      if (deletePromises.length > 0) {
        console.log(`🔄 Deleting ${deletePromises.length} expired scholarships...`);
        await Promise.all(deletePromises);
      }

      lastEvaluatedKey = response.LastEvaluatedKey;

      // Add a small delay to avoid overwhelming the database
      if (lastEvaluatedKey) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } while (lastEvaluatedKey);

    console.log('\n🎉 Cleanup completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total items scanned: ${totalScanned}`);
    console.log(`   - Expired scholarships found: ${expiredFound}`);
    console.log(`   - Successfully deleted: ${deletedCount}`);
    console.log(`   - Failed deletions: ${expiredFound - deletedCount}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  cleanupExpiredScholarships()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { cleanupExpiredScholarships }; 