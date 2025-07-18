#!/usr/bin/env ts-node

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const TABLE_NAME = `scholarship-websites-${ENVIRONMENT}`;

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Website configuration data
const websitesData = [
  {
    name: 'collegescholarship',
    url: 'https://collegescholarship.com',
    type: 'api',
    apiEndpoint: 'https://api.collegescholarship.com/scholarships',
    apiKey: 'ENV_VAR_COLLEGESCHOLARSHIP_API_KEY',
    enabled: true,
    scraperClass: 'CollegeScholarshipScraper',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'careeronestop',
    url: 'https://www.careeronestop.org',
    type: 'crawl',
    crawlUrl: 'https://www.careeronestop.org/scholarships',
    enabled: true,
    scraperClass: 'GumLoopScraper',
    selectors: {
      scholarshipLinks: "a[href*='/scholarship/']",
      title: "h1, h2, .scholarship-title",
      amount: ".amount, .award-amount",
      deadline: ".deadline, .due-date",
      description: ".description, .summary",
      organization: ".organization, .sponsor"
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'discovery_crawl',
    type: 'discovery',
    enabled: true,
    scraperClass: 'GumLoopDiscoveryScraper',
    discoveryConfig: {
      seedUrls: [
        'https://www.harvard.edu/financial-aid/scholarships',
        'https://www.stanford.edu/admission-aid/financial-aid/scholarships',
        'https://www.mit.edu/admissions-aid/financial-aid/scholarships',
        'https://www.yale.edu/admissions-aid/financial-aid/scholarships',
        'https://www.princeton.edu/admission-aid/financial-aid/scholarships'
      ],
      domainFilter: '.edu',
      keywordFilter: ['scholarship', 'financial aid', 'grant', 'award'],
      maxDepth: 3,
      maxPages: 100
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'general_search',
    type: 'search',
    enabled: true,
    scraperClass: 'GeneralSearchScraper',
    searchConfig: {
      searchTerms: [
        'college scholarships',
        'university financial aid',
        'student grants',
        'academic awards',
        'merit scholarships',
        'need-based aid',
        'undergraduate scholarships',
        'graduate fellowships'
      ],
      maxResultsPerTerm: 50,
      delayBetweenRequests: 2000
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

async function populateWebsitesTable(): Promise<void> {
  console.log(`Populating websites table: ${TABLE_NAME}`);
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Total websites to insert: ${websitesData.length}`);

  try {
    // Process websites in batches of 25 (DynamoDB BatchWrite limit)
    const batchSize = 25;
    for (let i = 0; i < websitesData.length; i += batchSize) {
      const batch = websitesData.slice(i, i + batchSize);
      
      const writeRequests = batch.map(website => ({
        PutRequest: {
          Item: website
        }
      }));

      const batchWriteCommand = new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: writeRequests
        }
      });

      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(websitesData.length / batchSize)}`);
      
      const result = await docClient.send(batchWriteCommand);
      
      if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
        console.warn('Some items were not processed:', result.UnprocessedItems);
      } else {
        console.log(`Successfully processed ${batch.length} websites`);
      }

      // Add a small delay between batches to avoid throttling
      if (i + batchSize < websitesData.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('✅ Successfully populated websites table!');
    
    // Verify the data was inserted
    console.log('\nVerifying data...');
    const verificationPromises = websitesData.map(async (website) => {
      try {
        const getCommand = new PutCommand({
          TableName: TABLE_NAME,
          Item: website,
          ConditionExpression: 'attribute_exists(#name)',
          ExpressionAttributeNames: {
            '#name': 'name'
          }
        });
        
        await docClient.send(getCommand);
        return { name: website.name, status: 'exists' };
      } catch (error) {
        return { name: website.name, status: 'missing', error };
      }
    });

    const verificationResults = await Promise.all(verificationPromises);
    const missingItems = verificationResults.filter(result => result.status === 'missing');
    
    if (missingItems.length > 0) {
      console.warn('⚠️  Some items may be missing:', missingItems);
    } else {
      console.log('✅ All websites verified successfully!');
    }

  } catch (error) {
    console.error('❌ Error populating websites table:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  populateWebsitesTable()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { populateWebsitesTable }; 