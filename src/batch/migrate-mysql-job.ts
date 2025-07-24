#!/usr/bin/env ts-node

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import mysql, { ConnectionOptions } from 'mysql2/promise';

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const SECRET_ID = `scholarships-${ENVIRONMENT}`;

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({});

type MySQLConfig = ConnectionOptions;

interface Scholarship {
  id: string;
  name: string;
  deadline: string; // ISO date string
  url: string;
  description: string;
  eligibility: string;
  organization: string;
  academicLevel: string;
  geographicRestrictions: string;
  targetType: 'need' | 'merit' | 'both';
  ethnicity: string;
  gender: string;
  minAward: number;
  maxAward: number;
  renewable: boolean;
  country: string;
  applyUrl: string;
  isActive: boolean;
  essayRequired: boolean;
  recommendationsRequired: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  source: string; // website name
}

interface Website {
  id: string;
  name: string;
  url: string;
  status: string;
  lastScraped: string;
  createdAt: string;
  updatedAt: string;
}

async function getMySQLConfig(): Promise<MySQLConfig> {
  console.log(`🔐 Loading MySQL config from secret: ${SECRET_ID}`);
  
  const command = new GetSecretValueCommand({ SecretId: SECRET_ID });
  const response = await secretsClient.send(command);
  
  if (!response.SecretString) {
    throw new Error('Secret has no value');
  }

  const secretConfig = JSON.parse(response.SecretString);
  
  return {
    host: secretConfig.host,
    port: secretConfig.port,
    user: secretConfig.username,
    password: secretConfig.password,
    database: secretConfig.database,
    ssl: secretConfig.ssl !== false ? 'Amazon RDS' : undefined,
  };
}

async function createTables(connection: mysql.Connection): Promise<void> {
  console.log('🏗️ Creating database tables...');

  // Create scholarships table
  const scholarshipsTableSQL = `
    CREATE TABLE IF NOT EXISTS scholarships (
      scholarship_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(500) NOT NULL,
      deadline DATE,
      url VARCHAR(1000),
      description LONGTEXT,
      eligibility TEXT,
      organization VARCHAR(500),
      academic_level VARCHAR(100),
      geographic_restrictions VARCHAR(500),
      target_type ENUM('need', 'merit', 'both'),
      ethnicity VARCHAR(200),
      gender VARCHAR(50),
      min_award DECIMAL(10,2),
      max_award DECIMAL(10,2),
      renewable BOOLEAN DEFAULT FALSE,
      country VARCHAR(100),
      apply_url VARCHAR(1000),
      is_active BOOLEAN DEFAULT TRUE,
      essay_required BOOLEAN DEFAULT FALSE,
      recommendations_required BOOLEAN DEFAULT FALSE,
      source VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_deadline (deadline),
      INDEX idx_source (source),
      INDEX idx_created_at (created_at),
      INDEX idx_organization (organization),
      INDEX idx_academic_level (academic_level),
      INDEX idx_target_type (target_type),
      INDEX idx_country (country),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // Create websites table
  const websitesTableSQL = `
    CREATE TABLE IF NOT EXISTS websites (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      url VARCHAR(500) NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      last_scraped TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_last_scraped (last_scraped)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await connection.execute(scholarshipsTableSQL);
    console.log('✅ Scholarships table created/verified');
    
    await connection.execute(websitesTableSQL);
    console.log('✅ Websites table created/verified');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  }
}

async function migrateScholarships(connection: mysql.Connection): Promise<void> {
  console.log('📚 Migrating scholarships from DynamoDB...');
  
  const tableName = `scholarships-${ENVIRONMENT}`;
  let lastEvaluatedKey: any = undefined;
  let totalMigrated = 0;
  let totalSkipped = 0;

  do {
    const scanParams: any = {
      TableName: tableName,
      Limit: 100,
    };

    if (lastEvaluatedKey) {
      scanParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    const scanCommand = new ScanCommand(scanParams);
    const response = await docClient.send(scanCommand);
    
    if (!response.Items || response.Items.length === 0) {
      break;
    }

    for (const item of response.Items) {
      try {
        // Check if scholarship is expired
        const deadline = new Date(item.deadline);
        const now = new Date();
        
        if (deadline < now) {
          console.log(`⏰ Skipping expired scholarship: ${item.name || item.title} (deadline: ${item.deadline})`);
          totalSkipped++;
          continue;
        }

        // Insert into MySQL
        const insertSQL = `
          INSERT INTO scholarships (
            name, deadline, url, description, eligibility, organization, 
            academic_level, geographic_restrictions, target_type, ethnicity, 
            gender, min_award, max_award, renewable, country, apply_url, 
            is_active, essay_required, recommendations_required, source, 
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            deadline = VALUES(deadline),
            url = VALUES(url),
            description = VALUES(description),
            eligibility = VALUES(eligibility),
            organization = VALUES(organization),
            academic_level = VALUES(academic_level),
            geographic_restrictions = VALUES(geographic_restrictions),
            target_type = VALUES(target_type),
            ethnicity = VALUES(ethnicity),
            gender = VALUES(gender),
            min_award = VALUES(min_award),
            max_award = VALUES(max_award),
            renewable = VALUES(renewable),
            country = VALUES(country),
            apply_url = VALUES(apply_url),
            is_active = VALUES(is_active),
            essay_required = VALUES(essay_required),
            recommendations_required = VALUES(recommendations_required),
            source = VALUES(source),
            updated_at = CURRENT_TIMESTAMP
        `;

        await connection.execute(insertSQL, [
          item.name || item.title || '', // Handle both name and title fields
          item.deadline,
          item.url || '',
          item.description || '',
          item.eligibility || '',
          item.organization || '',
          item.academicLevel || '',
          item.geographicRestrictions || '',
          item.targetType || null,
          item.ethnicity || '',
          item.gender || '',
          item.minAward || null,
          item.maxAward || null,
          item.renewable || false,
          item.country || '',
          item.applyUrl || '',
          item.isActive !== false, // Default to true if not specified
          item.essayRequired || false,
          item.recommendationsRequired || false,
          item.source || '',
          item.createdAt,
          item.updatedAt
        ]);

        totalMigrated++;
        console.log(`✅ Migrated scholarship: ${item.name || item.title}`);
      } catch (error) {
        console.error(`❌ Error migrating scholarship ${item.id}:`, error);
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`📊 Scholarships migration completed: ${totalMigrated} migrated, ${totalSkipped} skipped (expired)`);
}

async function migrateWebsites(connection: mysql.Connection): Promise<void> {
  console.log('🌐 Migrating websites from DynamoDB...');
  
  const tableName = `websites-${ENVIRONMENT}`;
  let lastEvaluatedKey: any = undefined;
  let totalMigrated = 0;

  do {
    const scanParams: any = {
      TableName: tableName,
      Limit: 100,
    };

    if (lastEvaluatedKey) {
      scanParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    const scanCommand = new ScanCommand(scanParams);
    const response = await docClient.send(scanCommand);
    
    if (!response.Items || response.Items.length === 0) {
      break;
    }

    for (const item of response.Items) {
      try {
        // Insert into MySQL
        const insertSQL = `
          INSERT INTO websites (id, name, url, status, last_scraped, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            url = VALUES(url),
            status = VALUES(status),
            last_scraped = VALUES(last_scraped),
            updated_at = CURRENT_TIMESTAMP
        `;

        await connection.execute(insertSQL, [
          item.id,
          item.name,
          item.url,
          item.status || 'active',
          item.lastScraped ? new Date(item.lastScraped) : null,
          item.createdAt,
          item.updatedAt
        ]);

        totalMigrated++;
        console.log(`✅ Migrated website: ${item.name}`);
      } catch (error) {
        console.error(`❌ Error migrating website ${item.id}:`, error);
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`📊 Websites migration completed: ${totalMigrated} migrated`);
}

async function showTableStats(connection: mysql.Connection): Promise<void> {
  console.log('\n📈 Database Statistics:');
  
  try {
    // Count scholarships
    const [scholarshipRows] = await connection.execute('SELECT COUNT(*) as count FROM scholarships');
    const scholarshipCount = (scholarshipRows as any)[0].count;
    console.log(`📚 Scholarships: ${scholarshipCount}`);

    // Count active scholarships
    const [activeScholarshipRows] = await connection.execute('SELECT COUNT(*) as count FROM scholarships WHERE is_active = TRUE');
    const activeScholarshipCount = (activeScholarshipRows as any)[0].count;
    console.log(`✅ Active Scholarships: ${activeScholarshipCount}`);

    // Count scholarships by target type
    const [targetTypeRows] = await connection.execute(`
      SELECT target_type, COUNT(*) as count 
      FROM scholarships 
      WHERE target_type IS NOT NULL 
      GROUP BY target_type
    `);
    console.log('\n🎯 Scholarships by Target Type:');
    (targetTypeRows as any[]).forEach(row => {
      console.log(`  - ${row.target_type}: ${row.count}`);
    });

    // Count websites
    const [websiteRows] = await connection.execute('SELECT COUNT(*) as count FROM websites');
    const websiteCount = (websiteRows as any)[0].count;
    console.log(`🌐 Websites: ${websiteCount}`);

    // Show recent scholarships
    const [recentScholarships] = await connection.execute(`
      SELECT scholarship_id, name, deadline, source, organization 
      FROM scholarships 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\n📋 Recent Scholarships:');
    (recentScholarships as any[]).forEach(scholarship => {
      console.log(`  - [ID: ${scholarship.scholarship_id}] ${scholarship.name} (${scholarship.organization || scholarship.source}) - Deadline: ${scholarship.deadline}`);
    });

  } catch (error) {
    console.error('❌ Error getting table stats:', error);
  }
}

async function main(): Promise<void> {
  console.log(`🚀 Starting DynamoDB to MySQL migration for environment: ${ENVIRONMENT}`);
  
  let connection: mysql.Connection | null = null;
  
  try {
    // Get MySQL configuration
    const config = await getMySQLConfig();
    console.log('✅ Loaded MySQL config from secret');

    // Connect to MySQL
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to MySQL database');

    // Create tables
    await createTables(connection);
    
    // Migrate data
    await migrateScholarships(connection);
    await migrateWebsites(connection);
    
    // Show statistics
    await showTableStats(connection);
    
    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 MySQL connection closed');
    }
  }
}

// Run the migration
if (require.main === module) {
  main()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { main as migrateToMySQL }; 