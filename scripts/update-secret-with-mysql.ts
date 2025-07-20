#!/usr/bin/env ts-node

import { SecretsManagerClient, GetSecretValueCommand, UpdateSecretCommand } from '@aws-sdk/client-secrets-manager';

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const SECRET_ID = `scholarships-${ENVIRONMENT}`;

// Initialize Secrets Manager client
const secretsClient = new SecretsManagerClient({});

async function updateSecretWithMySQL(): Promise<void> {
  console.log(`🔄 Updating secret ${SECRET_ID} with MySQL configuration...`);

  try {
    // Get current secret value
    const getCommand = new GetSecretValueCommand({ SecretId: SECRET_ID });
    const response = await secretsClient.send(getCommand);
    
    if (!response.SecretString) {
      throw new Error('Secret has no value');
    }

    const currentConfig = JSON.parse(response.SecretString);
    console.log('📋 Current secret configuration:', currentConfig);

    // Add MySQL configuration
    const updatedConfig = {
      ...currentConfig,
      // MySQL RDS configuration
      host: process.env.MYSQL_HOST || `${ENVIRONMENT}-mysql.cluster-xyz.us-east-1.rds.amazonaws.com`,
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      username: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'your_rds_password_here',
      database: process.env.MYSQL_DATABASE || 'scholarships_dev',
      ssl: process.env.MYSQL_SSL !== 'false', // Default to true for RDS
    };

    console.log('📋 Updated secret configuration:', updatedConfig);

    // Update the secret
    const updateCommand = new UpdateSecretCommand({
      SecretId: SECRET_ID,
      SecretString: JSON.stringify(updatedConfig, null, 2),
    });

    await secretsClient.send(updateCommand);
    console.log('✅ Secret updated successfully!');

    console.log('\n📝 Next steps:');
    console.log('1. Update the MySQL configuration values above with your actual RDS details');
    console.log('2. Run this script again with the correct values');
    console.log('3. Or manually update the secret in AWS Console');

  } catch (error) {
    console.error('❌ Error updating secret:', error);
    
    if (error instanceof Error && 'name' in error && error.name === 'ResourceNotFoundException') {
      console.log('\n💡 Secret not found. You may need to:');
      console.log('1. Create the secret first in AWS Secrets Manager');
      console.log('2. Or check the secret name/region');
    }
  }
}

// Run the script
if (require.main === module) {
  updateSecretWithMySQL()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { updateSecretWithMySQL }; 