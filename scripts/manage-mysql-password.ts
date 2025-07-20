#!/usr/bin/env ts-node

import { SecretsManagerClient, GetSecretValueCommand, UpdateSecretCommand } from '@aws-sdk/client-secrets-manager';
import * as readline from 'readline';

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const SECRET_ID = `scholarships-${ENVIRONMENT}`;

// Initialize Secrets Manager client
const secretsClient = new SecretsManagerClient({});

// Create readline interface for password input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function getCurrentSecret(): Promise<any> {
  try {
    const getCommand = new GetSecretValueCommand({ SecretId: SECRET_ID });
    const response = await secretsClient.send(getCommand);
    
    if (!response.SecretString) {
      throw new Error('Secret has no value');
    }

    return JSON.parse(response.SecretString);
  } catch (error) {
    console.error('❌ Error getting secret:', error);
    throw error;
  }
}

async function updateSecret(updatedConfig: any): Promise<void> {
  try {
    const updateCommand = new UpdateSecretCommand({
      SecretId: SECRET_ID,
      SecretString: JSON.stringify(updatedConfig, null, 2),
    });

    await secretsClient.send(updateCommand);
    console.log('✅ Secret updated successfully!');
  } catch (error) {
    console.error('❌ Error updating secret:', error);
    throw error;
  }
}

async function setMySQLPassword(): Promise<void> {
  console.log(`🔐 Setting MySQL password for secret: ${SECRET_ID}`);
  
  try {
    const currentConfig = await getCurrentSecret();
    console.log('📋 Current secret configuration:', currentConfig);

    const password = await question('Enter new MySQL password: ');
    const confirmPassword = await question('Confirm MySQL password: ');

    if (password !== confirmPassword) {
      console.log('❌ Passwords do not match!');
      return;
    }

    const updatedConfig = {
      ...currentConfig,
      password: password
    };

    await updateSecret(updatedConfig);
    console.log('✅ MySQL password updated successfully!');

  } catch (error) {
    console.error('❌ Error setting MySQL password:', error);
  } finally {
    rl.close();
  }
}

async function getMySQLPassword(): Promise<void> {
  console.log(`🔍 Getting MySQL password from secret: ${SECRET_ID}`);
  
  try {
    const currentConfig = await getCurrentSecret();
    
    if (currentConfig.password) {
      console.log('✅ MySQL password found in secret');
      console.log(`Password: ${currentConfig.password}`);
    } else {
      console.log('⚠️  No MySQL password found in secret');
    }

  } catch (error) {
    console.error('❌ Error getting MySQL password:', error);
  } finally {
    rl.close();
  }
}

async function showSecretInfo(): Promise<void> {
  console.log(`📋 Secret information for: ${SECRET_ID}`);
  
  try {
    const currentConfig = await getCurrentSecret();
    console.log('Current configuration:');
    console.log(JSON.stringify(currentConfig, null, 2));

  } catch (error) {
    console.error('❌ Error getting secret info:', error);
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const action = process.argv[2];

  switch (action) {
    case 'set':
      await setMySQLPassword();
      break;
    case 'get':
      await getMySQLPassword();
      break;
    case 'info':
      await showSecretInfo();
      break;
    default:
      console.log('Usage:');
      console.log('  npm run mysql:password:set:dev  - Set MySQL password');
      console.log('  npm run mysql:password:get:dev  - Get MySQL password');
      console.log('  npm run mysql:password:info:dev - Show secret info');
      rl.close();
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { setMySQLPassword, getMySQLPassword, showSecretInfo }; 