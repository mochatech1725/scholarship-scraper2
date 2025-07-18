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
    url: 'https://www.collegescholarships.org',
    type: 'crawl',
    crawlUrl: 'https://www.collegescholarships.org/scholarships/',
    enabled: true,
    scraperClass: 'CollegeScholarshipScraper',
    selectors: {
      scholarshipLinks: ".scholarship-description h4 a",
      title: ".scholarship-description h4 a",
      amount: ".scholarship-summary .lead strong",
      deadline: ".scholarship-summary p:last-child strong",
      description: ".scholarship-description p:first-child",
      organization: ".sponsor p"
    },
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
    name: 'college_scholarship_search',
    type: 'search',
    enabled: true,
    scraperClass: 'GeneralSearchScraper',
    searchConfig: {
      searchTerms: [
        'college scholarships 2025',
        'university scholarships for students',
        'undergraduate scholarship opportunities',
        'merit-based college scholarships',
        'need-based financial aid scholarships',
        'academic excellence scholarships',
        'first-generation college student scholarships',
        'minority student scholarships',
        'women in STEM scholarships',
        'engineering student scholarships',
        'business student scholarships',
        'arts and humanities scholarships',
        'community service scholarships',
        'leadership scholarships for college',
        'athletic scholarships for college students',
        'international student scholarships USA',
        'transfer student scholarships',
        'graduate school scholarships',
        'PhD funding opportunities',
        'fellowship programs for students'
      ],
      maxResultsPerTerm: 30,
      delayBetweenRequests: 3000,
      searchEngine: 'google',
      includeNews: false,
      includeForums: false,
      dateRange: 'past_year'
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
        'scholarship opportunities 2025',
        'student financial aid programs',
        'academic scholarship programs',
        'merit-based financial aid',
        'need-based scholarship programs',
        'undergraduate funding opportunities',
        'graduate student funding',
        'fellowship opportunities',
        'research grant opportunities',
        'academic excellence awards'
      ],
      maxResultsPerTerm: 25,
      delayBetweenRequests: 2500,
      searchEngine: 'google',
      includeNews: false,
      includeForums: false,
      dateRange: 'past_year'
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