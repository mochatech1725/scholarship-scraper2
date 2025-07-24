import mysql from 'mysql2/promise';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
}

export interface SecretConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl?: boolean;
}

// Field mapping from camelCase to snake_case for scholarships table
const SCHOLARSHIP_FIELD_MAPPING: Record<string, string> = {
  scholarshipId: 'scholarship_id', // Auto-generated primary key
  name: 'name',
  deadline: 'deadline',
  url: 'url',
  description: 'description',
  eligibility: 'eligibility',
  organization: 'organization',
  academicLevel: 'academic_level',
  geographicRestrictions: 'geographic_restrictions',
  targetType: 'target_type',
  ethnicity: 'ethnicity',
  gender: 'gender',
  minAward: 'min_award',
  maxAward: 'max_award',
  renewable: 'renewable',
  country: 'country',
  applyUrl: 'apply_url',
  isActive: 'is_active',
  essayRequired: 'essay_required',
  recommendationsRequired: 'recommendations_required',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  source: 'source'
};

export class MySQLDatabase {
  private config: MySQLConfig;
  private pool: mysql.Pool;

  constructor(config: MySQLConfig) {
    this.config = config;
    const poolConfig: any = {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 60000,
    };
    
    // Handle SSL configuration properly
    if (config.ssl) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    
    this.pool = mysql.createPool(poolConfig);
  }

  async connect(): Promise<void> {
    try {
      await this.pool.getConnection();
      console.log('✅ MySQL connection established');
    } catch (error) {
      console.error('❌ MySQL connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    console.log('🔌 MySQL connection closed');
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows as T[];
    } catch (error) {
      console.error('❌ MySQL query error:', error);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw error;
    }
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async insert(table: string, data: Record<string, any>): Promise<number> {
    // Map field names for scholarships table
    const mappedData: Record<string, any> = {};
    
    if (table === 'scholarships') {
      // Use field mapping for scholarships table
      Object.entries(data).forEach(([key, value]) => {
        const mappedKey = SCHOLARSHIP_FIELD_MAPPING[key] || key;
        mappedData[mappedKey] = value;
      });
    } else {
      // For other tables, use original field names
      Object.assign(mappedData, data);
    }
    
    const columns = Object.keys(mappedData);
    const values = Object.values(mappedData);
    const placeholders = columns.map(() => '?').join(', ');
    
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    const result = await this.pool.execute(sql, values);
    
    return (result[0] as any).insertId;
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    // Map field names for scholarships table
    let mappedData = data;
    let mappedWhere = where;
    
    if (table === 'scholarships') {
      // Use field mapping for scholarships table
      mappedData = {};
      Object.entries(data).forEach(([key, value]) => {
        const mappedKey = SCHOLARSHIP_FIELD_MAPPING[key] || key;
        mappedData[mappedKey] = value;
      });
      
      mappedWhere = {};
      Object.entries(where).forEach(([key, value]) => {
        const mappedKey = SCHOLARSHIP_FIELD_MAPPING[key] || key;
        mappedWhere[mappedKey] = value;
      });
    }
    
    const setColumns = Object.keys(mappedData).map(col => `${col} = ?`).join(', ');
    const whereColumns = Object.keys(mappedWhere).map(col => `${col} = ?`).join(' AND ');
    
    const sql = `UPDATE ${table} SET ${setColumns} WHERE ${whereColumns}`;
    const values = [...Object.values(mappedData), ...Object.values(mappedWhere)];
    
    const result = await this.pool.execute(sql, values);
    return (result[0] as any).affectedRows;
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    const whereColumns = Object.keys(where).map(col => `${col} = ?`).join(' AND ');
    const sql = `DELETE FROM ${table} WHERE ${whereColumns}`;
    const values = Object.values(where);
    
    const result = await this.pool.execute(sql, values);
    return (result[0] as any).affectedRows;
  }

  async transaction<T>(callback: (connection: mysql.Connection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

// Factory function to create database instance from environment variables or secrets
export async function createDatabaseFromEnv(): Promise<MySQLDatabase> {
  const environment = process.env.ENVIRONMENT || 'dev';
  const secretId = `scholarships-${environment}`;
  
  try {
    // Try to get config from AWS Secrets Manager
    const secretsClient = new SecretsManagerClient({});
    const command = new GetSecretValueCommand({ SecretId: secretId });
    const response = await secretsClient.send(command);
    
    if (response.SecretString) {
      const secretConfig: SecretConfig = JSON.parse(response.SecretString);
      
      const config: MySQLConfig = {
        host: secretConfig.host,
        port: secretConfig.port,
        user: secretConfig.username,
        password: secretConfig.password,
        database: secretConfig.database,
        ssl: secretConfig.ssl !== false, // Default to true for RDS
      };
      
      console.log(`✅ Loaded MySQL config from secret: ${secretId}`);
      return new MySQLDatabase(config);
    }
  } catch (error) {
    console.warn(`⚠️  Could not load from secret ${secretId}, falling back to environment variables:`, error);
  }
  
  // Fallback to environment variables
  const config: MySQLConfig = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'scholarships_dev',
    ssl: process.env.MYSQL_SSL === 'true',
  };

  console.log(`✅ Using MySQL config from environment variables`);
  return new MySQLDatabase(config);
}

// Factory function for synchronous usage (deprecated, use async version)
export function createDatabaseFromEnvSync(): MySQLDatabase {
  console.warn('⚠️  createDatabaseFromEnvSync is deprecated, use createDatabaseFromEnv() instead');
  const config: MySQLConfig = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || '',
    ssl: process.env.MYSQL_SSL === 'true',
  };

  return new MySQLDatabase(config);
} 