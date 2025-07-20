#!/usr/bin/env ts-node

import { MySQLDatabase, createDatabaseFromEnv } from '../src/utils/mysql-config';

async function testMySQLConnection(): Promise<void> {
  console.log('🧪 Testing MySQL connection...');
  
  try {
    // Initialize MySQL database
    const mysqlDb = await createDatabaseFromEnv();
    
    // Test connection
    await mysqlDb.connect();
    console.log('✅ MySQL connection successful!');
    
    // Test a simple query
    const result = await mysqlDb.query('SELECT 1 as test');
    console.log('✅ Query test successful:', result);
    
    // Test database creation
    try {
      await mysqlDb.query('CREATE DATABASE IF NOT EXISTS `scholarships_dev`');
      console.log('✅ Database creation test successful');
    } catch (error) {
      console.log('⚠️ Database creation test failed (might already exist):', error);
    }
    
    // Disconnect
    await mysqlDb.disconnect();
    console.log('🔌 MySQL connection closed');
    
  } catch (error) {
    console.error('❌ MySQL connection test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testMySQLConnection()
    .then(() => {
      console.log('🎉 MySQL connection test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 MySQL connection test failed:', error);
      process.exit(1);
    });
}

export { testMySQLConnection }; 