#!/usr/bin/env ts-node

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { MySQLDatabase, createDatabaseFromEnv } from '../src/utils/mysql-config';
import { ScholarshipUtils } from '../src/utils/helper';

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const SCHOLARSHIPS_TABLE = `scholarships-${ENVIRONMENT}`;
const WEBSITES_TABLE = `scholarship-websites-${ENVIRONMENT}`;

// Initialize clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
let mysqlDb: MySQLDatabase;

async function migrateScholarships(): Promise<void> {
  console.log(`🔄 Migrating scholarships from DynamoDB to MySQL...`);
  console.log(`Source table: ${SCHOLARSHIPS_TABLE}`);

  try {
    let totalScanned = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    let lastEvaluatedKey: any = undefined;

    do {
      console.log(`\n📋 Scanning batch ${Math.floor(totalScanned / 1000) + 1}...`);
      
      const scanCommand = new ScanCommand({
        TableName: SCHOLARSHIPS_TABLE,
        Limit: 1000,
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const response = await dynamoClient.send(scanCommand);
      const items = response.Items || [];
      totalScanned += items.length;

      console.log(`📊 Found ${items.length} scholarships in this batch`);

      // Process items in parallel for better performance
      const migrationPromises: Promise<void>[] = [];
      
      for (const item of items) {
        const migrationPromise = migrateScholarshipItem(item)
          .then(() => {
            migratedCount++;
          })
          .catch((error) => {
            console.error(`❌ Error migrating scholarship ${item.name}:`, error);
            skippedCount++;
          });
        
        migrationPromises.push(migrationPromise);
      }

      // Wait for all migrations to complete
      if (migrationPromises.length > 0) {
        console.log(`🔄 Migrating ${migrationPromises.length} scholarships...`);
        await Promise.all(migrationPromises);
      }

      lastEvaluatedKey = response.LastEvaluatedKey;

      // Add a small delay to avoid overwhelming the database
      if (lastEvaluatedKey) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } while (lastEvaluatedKey);

    console.log('\n🎉 Scholarships migration completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total scanned: ${totalScanned}`);
    console.log(`   - Successfully migrated: ${migratedCount}`);
    console.log(`   - Skipped: ${skippedCount}`);

  } catch (error) {
    console.error('❌ Error during scholarships migration:', error);
    throw error;
  }
}

async function migrateScholarshipItem(item: any): Promise<void> {
  // Check if scholarship already exists in MySQL
  const existing = await mysqlDb.queryOne(
    'SELECT scholarship_id FROM scholarships WHERE scholarship_id = ?',
    [item.id]
  );

  if (existing) {
    console.log(`⏭️  Scholarship ${item.name} already exists in MySQL, skipping`);
    return;
  }

  // Filter out expired scholarships
  if (item.deadline && ScholarshipUtils.isDeadlineExpired(item.deadline)) {
    console.log(`⏭️  Skipping expired scholarship: ${item.name} (deadline: ${item.deadline})`);
    return;
  }

  // Transform DynamoDB item to MySQL format
  const mysqlItem = {
    id: item.id,
    name: item.name || '',
    deadline: item.deadline || null,
    url: item.url || null,
    description: item.description || null,
    eligibility: item.eligibility || null,
    organization: item.organization || null,
    academic_level: item.academicLevel || null,
    geographic_restrictions: item.geographicRestrictions || null,
    target_type: item.targetType || 'both',
    ethnicity: item.ethnicity || 'unspecified',
    gender: item.gender || 'unspecified',
    min_award: item.minAward || 0,
    max_award: item.maxAward || 0,
    renewable: item.renewable || false,
    country: item.country || 'US',
    apply_url: item.applyUrl || null,
    is_active: item.isActive !== undefined ? item.isActive : true,
    essay_required: item.essayRequired || false,
    recommendations_required: item.recommendationsRequired || false,
    source: item.source || null,
    job_id: item.jobId || null,
    created_at: item.createdAt || new Date().toISOString(),
    updated_at: item.updatedAt || new Date().toISOString(),
  };

  // Insert into MySQL
  await mysqlDb.insert('scholarships', mysqlItem);
  console.log(`✅ Migrated scholarship: ${item.name}`);
}

async function migrateWebsites(): Promise<void> {
  console.log(`\n🔄 Migrating websites from DynamoDB to MySQL...`);
  console.log(`Source table: ${WEBSITES_TABLE}`);

  try {
    const scanCommand = new ScanCommand({
      TableName: WEBSITES_TABLE,
    });

    const response = await dynamoClient.send(scanCommand);
    const items = response.Items || [];

    console.log(`📊 Found ${items.length} websites to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      try {
        // Check if website already exists in MySQL
        const existing = await mysqlDb.queryOne(
          'SELECT name FROM websites WHERE name = ?',
          [item.name]
        );

        if (existing) {
          console.log(`⏭️  Website ${item.name} already exists in MySQL, skipping`);
          skippedCount++;
          continue;
        }

        // Transform DynamoDB item to MySQL format
        const mysqlItem = {
          name: item.name,
          url: item.url || null,
          type: item.type,
          enabled: item.enabled || true,
          scraper_class: item.scraperClass || null,
          api_endpoint: item.apiEndpoint || null,
          api_key: item.apiKey || null,
          crawl_url: item.crawlUrl || null,
          selectors: item.selectors ? JSON.stringify(item.selectors) : null,
          search_config: item.searchConfig ? JSON.stringify(item.searchConfig) : null,
          discovery_config: item.discoveryConfig ? JSON.stringify(item.discoveryConfig) : null,
          created_at: item.createdAt || new Date().toISOString(),
          updated_at: item.updatedAt || new Date().toISOString(),
        };

        // Insert into MySQL
        await mysqlDb.insert('websites', mysqlItem);
        console.log(`✅ Migrated website: ${item.name}`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Error migrating website ${item.name}:`, error);
        skippedCount++;
      }
    }

    console.log('\n🎉 Websites migration completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total found: ${items.length}`);
    console.log(`   - Successfully migrated: ${migratedCount}`);
    console.log(`   - Skipped: ${skippedCount}`);

  } catch (error) {
    console.error('❌ Error during websites migration:', error);
    throw error;
  }
}

async function runMigration(): Promise<void> {
  console.log(`🚀 Starting DynamoDB to MySQL migration for environment: ${ENVIRONMENT}`);
  
  try {
    // Initialize MySQL database
    mysqlDb = await createDatabaseFromEnv();
    
    // Connect to MySQL
    await mysqlDb.connect();
    
    // Migrate data
    await migrateScholarships();
    await migrateWebsites();
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Disconnect from MySQL
    if (mysqlDb) {
      await mysqlDb.disconnect();
    }
  }
}

// Run the migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { runMigration }; 