# Python Scripts

This directory contains Python-specific setup and configuration scripts for the scholarship scraper system.

## Setup Scripts

- **`setup.sh`** - Main setup script for the Python scraper environment
  - Creates virtual environment
  - Installs dependencies
  - Sets up local MySQL database
  - Creates .env file

- **`setup_local_db.sql`** - SQL script to create the local MySQL database schema
  - Creates scholarships, jobs, and websites tables
  - Inserts initial website configurations

## Configuration Scripts

- **`configure_scrapers.py`** - Main configuration management script
  - Show current configuration
  - Set global scraper type (python/typescript)
  - Configure per-website scraper types
  - Enable/disable websites
  - Add new websites

- **`configure_rds.py`** - RDS MySQL configuration helper
  - Test RDS MySQL connection
  - Set up database schema on RDS
  - Configure RDS environment variables

## Deployment Scripts

- **`deploy_to_aws.py`** - AWS deployment automation
  - Build and push Docker images to ECR
  - Deploy to ECS/Fargate
  - Create Lambda functions
  - Update Batch job definitions
  - Generate CloudFormation templates

## Usage

### Initial Setup

```bash
cd scripts/python
./setup.sh
```

### Configuration Management

```bash
cd scripts/python
python configure_scrapers.py --show
python configure_scrapers.py --global-type python
python configure_scrapers.py --website-type fastweb python
```

### RDS Configuration

```bash
cd scripts/python
python configure_rds.py --test-connection
python configure_rds.py --setup-schema
```

### AWS Deployment

```bash
cd scripts/python
python deploy_to_aws.py --help
python deploy_to_aws.py --deploy
```

## Prerequisites

- Python 3.13+
- MySQL (local or RDS)
- AWS CLI configured (for deployment)
- Docker (for containerization)
