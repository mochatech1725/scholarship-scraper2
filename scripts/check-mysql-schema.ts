import { MySQLDatabase, createDatabaseFromEnv } from '../src/utils/mysql-config';

async function checkMySQLSchema() {
  console.log('🔍 Checking MySQL table schema...');
  
  try {
    const db = await createDatabaseFromEnv();
    await db.connect();
    
    // Check if scholarships table exists
    const tables = await db.query('SHOW TABLES');
    console.log('📋 Available tables:', tables);
    
    // Get scholarships table schema
    const schema = await db.query('DESCRIBE scholarships');
    console.log('📋 Scholarships table schema:');
    schema.forEach((column: any) => {
      console.log(`  - ${column.Field} (${column.Type}) ${column.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check a few sample records
    const sampleRecords = await db.query('SELECT * FROM scholarships LIMIT 3');
    console.log('📋 Sample records:');
    sampleRecords.forEach((record: any, index: number) => {
      console.log(`  Record ${index + 1}:`, Object.keys(record));
    });
    
    await db.disconnect();
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
  }
}

checkMySQLSchema(); 