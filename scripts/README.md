# Scripts Directory

This directory contains various utility scripts organized by category.

## Directory Structure

### `aws/` - AWS Infrastructure Scripts
Contains scripts for managing AWS services, infrastructure, and deployments.

**Key Scripts:**
- Infrastructure management (cleanup, deployment)
- Lambda function management
- Batch job management
- Security and networking

See [aws/README.md](aws/README.md) for detailed documentation.

### `python/` - Python Scraper Scripts
Contains Python-specific setup, configuration, and deployment scripts.

**Key Scripts:**
- Environment setup and configuration
- Database schema management
- AWS deployment automation

See [python/README.md](python/README.md) for detailed documentation.

## General Scripts (Root Level)

### Database Scripts
- **`check-mysql-schema.ts`** - Check MySQL database schema
- **`migrate-to-mysql.ts`** - Migrate data to MySQL
- **`mysql-migration.sql`** - MySQL migration SQL
- **`recreate-websites-table.sql`** - Recreate websites table
- **`test-mysql-batch.ts`** - Test MySQL batch operations
- **`test-mysql-connection.ts`** - Test MySQL connection

### Data Management
- **`cleanup-expired-scholarships.ts`** - Clean up expired scholarships
- **`run-populate-websites.sh`** - Populate websites table
- **`update-secret-with-mysql.ts`** - Update secrets with MySQL credentials

### Development
- **`test-system.sh`** - Test system functionality
- **`update-shared-types.sh`** - Update shared TypeScript types

## Usage

### AWS Operations
```bash
cd scripts/aws
./cleanup-nat-gateways.sh
./check-lambda-config.sh
```

### Python Scraper Setup
```bash
cd scripts/python
./setup.sh
python configure_scrapers.py --show
```

### Database Operations
```bash
cd scripts
npx ts-node check-mysql-schema.ts
npx ts-node migrate-to-mysql.ts
```

## Prerequisites

- **For AWS scripts:** AWS CLI configured, appropriate permissions
- **For Python scripts:** Python 3.13+, MySQL, Docker
- **For TypeScript scripts:** Node.js, npm dependencies installed
