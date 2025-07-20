# MySQL Migration Guide

## Overview
This guide covers migrating the scholarship scraper from DynamoDB to MySQL for better query performance and analytics capabilities.

## Prerequisites
1. MySQL server running (local or RDS)
2. Node.js dependencies installed (`npm install`)
3. Environment variables configured

## Migration Steps

### 1. Set up MySQL Database
```bash
# Connect to your MySQL server
mysql -u root -p

# Run the DDL script
source scripts/mysql-migration.sql
```

### 2. Configure Environment Variables
Add these to your environment:
```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=scholarships_dev
MYSQL_SSL=false
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Migration
```bash
# For dev environment
npm run migrate:mysql:dev

# For staging environment
npm run migrate:mysql:staging

# For production environment
npm run migrate:mysql:prod
```

## What Gets Migrated

### ✅ Migrated to MySQL:
- **Scholarships table**: All scholarship data with proper indexing
- **Websites table**: Scraper configuration data

### ❌ Stays in DynamoDB:
- **Jobs table**: Operational job tracking (keeps DynamoDB for efficiency)

## Benefits
- Better query performance
- Complex search capabilities
- Rich analytics and reporting
- Cost-effective for predictable workloads
- Full SQL capabilities

## Rollback
If needed, you can revert by:
1. Updating scrapers to use DynamoDB again
2. Removing MySQL dependencies
3. Keeping existing DynamoDB tables intact 