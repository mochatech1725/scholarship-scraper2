# Scholarship Tracker System Design Document

## 1. System Overview

### 1.1 Project Description
The Scholarship Tracker is a comprehensive web application designed to help students discover, track, and manage scholarship opportunities. The system consists of three independent components:

1. **Scholarship Scraper (AWS Infrastructure)** - Automated scholarship discovery and data collection (runs independently)
2. **Scholarship Server (Backend API)** - User management and application tracking (consumes scraper data from database) - Located at `/Users/teial/Tutorials/scholarship-server`
3. **Scholarship Client (Frontend)** - User interface for scholarship search and application management - Located at `/Users/teial/Tutorials/scholarship-client`

### 1.2 Current Implementation Status
**✅ FULLY IMPLEMENTED**: This document reflects the current production-ready implementation.

**Implemented**:
- **Hybrid Scraper Architecture**: Python scrapers for local development, TypeScript scrapers for production
- **AWS CDK Infrastructure**: VPC, RDS MySQL, Batch, Lambda, S3, CloudWatch
- **4 Web Scrapers**: CareerOneStop, CollegeScholarship, General Search, RSS/API
- **AI Processing**: AWS Bedrock integration in TypeScript scrapers
- **Local Development Environment**: Python virtual environment with local MySQL
- **Database Migration**: Complete migration from DynamoDB to MySQL
- **Dynamic Scraper Selection**: Database-driven switching between Python/TypeScript
- **Job Orchestration**: Automated scheduling and monitoring
- **Server and Client Applications**: Separate repositories with Auth0 integration

**Production Ready**:
- TypeScript scrapers with AWS Bedrock AI processing
- Scalable AWS infrastructure with auto-scaling
- Comprehensive error handling and monitoring
- Security best practices with IAM, VPC, and secrets management

**Development Ready**:
- Python scrapers for local testing and development
- Environment switching (local/dev/staging/prod)
- Cost-effective local development without AWS charges

### 1.3 System Architecture
```
┌─────────────────┐    ┌─────────────────┐
│   Scholarship   │    │   Scholarship   │
│     Client      │◄──►│     Server      │
│   (Vue/Quasar)  │    │  (Express/TS)   │
│  /scholarship-  │    │ /scholarship-   │
│    client       │    │    server       │
└─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   Auth0 Auth    │    │   AWS RDS       │
│                 │    │   (MySQL)       │
│                 │    │   + Local MySQL │
└─────────────────┘    └─────────────────┘
                                ▲
                                │
                                │
                       ┌─────────────────┐
                       │   Scholarship   │
                       │    Scraper      │
                       │   (Hybrid)      │
                       │  /scholarship-  │
                       │   scraper2      │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   AWS Services  │
                       │   (Batch, S3,   │
                       │   Lambda, etc.) │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Local Python    │
                       │   Scrapers      │
                       │ (Development)   │
                       └─────────────────┘
```

**Hybrid Scraper Architecture:**
- **Production**: TypeScript scrapers with AWS Bedrock AI processing
- **Development**: Python scrapers with BeautifulSoup for local testing
- **Dynamic Switching**: Database-driven selection based on environment
- **Shared Database**: Both environments use MySQL (RDS for production, local for development)

### 1.4 Key Features
- **Hybrid Scraper Architecture**: Python scrapers for development, TypeScript scrapers for production
- **Automated Scholarship Discovery**: Web scraping of scholarship websites (independent service)
- **Dynamic Environment Switching**: Seamless transition between local development and production
- **User Authentication**: Secure Auth0 integration
- **Application Tracking**: Comprehensive scholarship application management
- **Recommender System**: Management of recommendation letters and references
- **Advanced Search**: Intelligent scholarship matching and filtering
- **Scheduled Data Updates**: Automated scholarship data refresh via independent scraper service
- **AI-Powered Processing**: AWS Bedrock integration in TypeScript scrapers
- **Cost-Effective Development**: Local testing without AWS charges

## 2. Component 1: Scholarship Scraper (Hybrid Architecture)

### 2.1 Technology Stack

#### Production Environment (TypeScript)
- **Infrastructure as Code**: AWS CDK with TypeScript
- **Compute**: AWS Batch with Fargate
- **Database**: AWS RDS MySQL (for all data)
- **Storage**: Amazon S3 for raw data
- **AI/ML**: AWS Bedrock for intelligent processing
- **Monitoring**: CloudWatch Logs
- **Security**: IAM roles, VPC, Security Groups

#### Development Environment (Python)
- **Runtime**: Python 3.13+ with virtual environment
- **Web Scraping**: BeautifulSoup, Requests, Selenium
- **Database**: Local MySQL instance
- **Storage**: Local file system for debugging
- **AI/ML**: Local processing (no AWS Bedrock)
- **Monitoring**: Local logging
- **Security**: Local development security

### 2.2 Architecture Details

#### 2.2.1 Hybrid Scraper Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                    │
│                    (TypeScript + AWS)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   VPC       │  │   ECS       │  │   Lambda    │         │
│  │ (Private/   │  │  Cluster    │  │ Orchestrator│         │
│  │  Public)    │  │             │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                │
│         ▼                ▼                ▼                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   NAT       │  │   Batch     │  │   Event     │         │
│  │ Gateway     │  │ Compute Env │  │  Bridge     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                │
│         ▼                ▼                ▼                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   RDS       │  │     S3      │  │   CloudWatch│         │
│  │   MySQL     │  │   Bucket    │  │    Logs     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Development Environment                    │
│                    (Python + Local)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Python    │  │ BeautifulSoup│  │   Local     │         │
│  │  Virtual    │  │   Requests   │  │   MySQL     │         │
│  │ Environment │  │   Selenium   │  │  Database   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                │
│         ▼                ▼                ▼                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Scraper   │  │   Config    │  │   Debug     │         │
│  │   Factory   │  │  Manager    │  │   Tools     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2.2 Dynamic Scraper Selection
- **Database-Driven Configuration**: `websites` table controls scraper type
- **Environment Switching**: `--environment local|dev|staging|prod` flag
- **Alias Support**: `careerone` → `careeronestop_python`, `collegescholarship` → `collegescholarship_python`
- **Fallback Logic**: Defaults to Python for unknown scrapers in local mode

#### 2.2.3 Data Flow

**Production Flow (TypeScript)**:
1. **Scheduled Trigger**: EventBridge triggers Lambda orchestrator
2. **Job Submission**: Lambda submits Batch jobs to ECS
3. **Web Scraping**: Fargate containers scrape scholarship websites
4. **AI Processing**: AWS Bedrock processes data for intelligent categorization
5. **Data Storage**: Results stored in S3 and RDS MySQL
6. **Monitoring**: CloudWatch tracks performance and errors

**Development Flow (Python)**:
1. **Manual Trigger**: Developer runs `python main.py --scraper <name> --environment local`
2. **Scraper Selection**: ConfigManager determines scraper type from database
3. **Web Scraping**: Python scrapers using BeautifulSoup scrape websites
4. **Local Processing**: Data processed locally without AI services
5. **Data Storage**: Results stored in local MySQL database
6. **Local Logging**: Console output and local log files

### 2.3 Key Features

#### Production Features (TypeScript)
- **Multi-Source Scraping**: CareerOneStop, CollegeScholarship, General Search, RSS/API
- **AI-Powered Processing**: AWS Bedrock for intelligent data extraction and categorization
- **Rate Limiting**: Respectful web scraping with delays
- **Error Handling**: Robust error recovery and retry mechanisms
- **Scalable Architecture**: Auto-scaling based on workload
- **Cloud Integration**: S3 storage, CloudWatch monitoring, Lambda orchestration

#### Development Features (Python)
- **Local Scraping**: Same websites as production but with Python scrapers
- **Fast Iteration**: Immediate feedback and debugging capabilities
- **Cost-Effective**: No AWS charges during development
- **Easy Testing**: Virtual environment with isolated dependencies
- **Debug Tools**: HTML structure analysis and local data inspection
- **Environment Switching**: Seamless transition between local and production

### 2.4 Database Architecture (Current State)
**✅ Complete MySQL Migration - Fully Implemented**:

**Production Database (AWS RDS MySQL)**:
- **scholarships**: Scholarship data with comprehensive fields
- **websites**: Scraper configuration and type selection
- **jobs**: Scraping job tracking and metadata
- **users**: User management (for server application)
- **applications**: Application tracking (for server application)
- **recommenders**: Recommender management (for server application)

**Development Database (Local MySQL)**:
- **Same schema as production** for consistency
- **Local instance** for development and testing
- **Isolated data** to prevent conflicts with production

**Migration Status**: 
- ✅ **Complete**: All data migrated from DynamoDB to MySQL
- ✅ **Unified**: Single database schema for all components
- ✅ **Consistent**: Same structure across production and development

### 2.5 Local Development Environment

#### 2.5.1 Setup and Configuration
- **Python Virtual Environment**: Isolated dependencies with `venv`
- **Local MySQL**: Development database with same schema as production
- **Environment Variables**: `.env.local` for local configuration
- **Dependencies**: `requirements.txt` with Python packages

#### 2.5.2 Development Workflow
1. **Environment Setup**: `python3 -m venv venv && source venv/bin/activate`
2. **Database Setup**: `mysql -u root < scripts/python/setup_local_db.sql`
3. **Scraper Testing**: `python main.py --scraper careerone --environment local`
4. **Debug Tools**: HTML analysis scripts for troubleshooting
5. **Environment Switching**: `--environment local|dev|staging|prod` flags

#### 2.5.3 Benefits
- **Cost Control**: No AWS charges during development
- **Fast Iteration**: Immediate feedback on changes
- **Easy Debugging**: Direct access to HTML structure and data
- **Isolated Testing**: Safe environment for experimentation
- **Consistent Data**: Same database schema as production

### 2.6 Security Considerations

#### Production Security
- **VPC Isolation**: Private subnets for compute resources
- **IAM Roles**: Least privilege access policies
- **Secrets Management**: AWS Secrets Manager for credentials
- **Network Security**: Security groups and VPC endpoints

#### Development Security
- **Local Isolation**: Virtual environment prevents conflicts
- **Database Security**: Local MySQL with development credentials
- **No External Dependencies**: Self-contained development environment
- **Safe Testing**: No risk to production data or services

## 3. Component 2: Scholarship Server (Backend API)

**Location**: `/Users/teial/Tutorials/scholarship-server`

### 3.1 Technology Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: AWS RDS MySQL with Knex.js ORM
- **Authentication**: Auth0 integration
- **Security**: Helmet, CORS, JWT validation
- **AWS Integration**: Secrets Manager, Bedrock, Comprehend

**Note**: The server is completely independent of the scraper service. It only reads scholarship data from the shared database that the scraper populates.

### 3.2 Architecture Details

#### 3.2.1 API Structure
```
┌─────────────────────────────────────────────────────────────┐
│                    Express.js Server                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Auth0     │  │   Routes    │  │ Controllers │         │
│  │ Middleware  │  │             │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                │
│         ▼                ▼                ▼                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Services  │  │   Utils     │  │   Types     │         │
│  │             │  │             │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                │
│         ▼                ▼                ▼                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Knex.js   │  │   AWS SDK   │  │   Error     │         │
│  │   ORM       │  │             │  │  Handling   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2.2 API Endpoints

**Authentication**
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

**Applications**
- `GET /api/applications` - List all applications
- `GET /api/applications/:id` - Get specific application
- `POST /api/applications` - Create new application
- `PUT /api/applications/:id` - Update application
- `DELETE /api/applications/:id` - Delete application

**Users**
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get specific user
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

**Recommenders**
- `GET /api/recommenders` - List all recommenders
- `GET /api/recommenders/:id` - Get specific recommender
- `GET /api/recommenders/getByUserId/:userId` - Get user's recommenders
- `POST /api/recommenders` - Create new recommender
- `PUT /api/recommenders/:id` - Update recommender
- `DELETE /api/recommenders/:id` - Delete recommender

**Scholarship Search**
- `POST /api/scholarships/find` - Search scholarships
- `GET /api/scholarships/sources` - Get available sources
- `GET /api/scholarships/health` - Service health check

### 3.3 Database Schema

#### 3.3.1 Core Tables
```sql
-- Users table
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Applications table
CREATE TABLE applications (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    scholarship_id VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('draft', 'submitted', 'accepted', 'rejected', 'waitlisted'),
    deadline DATE,
    amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Recommenders table
CREATE TABLE recommenders (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    title VARCHAR(255),
    institution VARCHAR(255),
    relationship VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 3.4 Security Features
- **Auth0 Integration**: Secure OAuth2/JWT authentication
- **CORS Configuration**: Cross-origin request handling
- **Helmet Security**: HTTP security headers
- **Input Validation**: Request sanitization and validation
- **Rate Limiting**: API request throttling

## 4. Component 3: Scholarship Client (Frontend)

**Location**: `/Users/teial/Tutorials/scholarship-client`

### 4.1 Technology Stack
- **Framework**: Vue.js 3 with Composition API
- **UI Framework**: Quasar Framework
- **State Management**: Pinia
- **Routing**: Vue Router
- **Authentication**: Auth0 Vue SDK
- **HTTP Client**: Axios
- **Build Tool**: Vite

### 4.2 Architecture Details

#### 4.2.1 Application Structure
```
┌─────────────────────────────────────────────────────────────┐
│                    Vue.js Application                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Layouts   │  │   Pages     │  │ Components  │         │
│  │             │  │             │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                │
│         ▼                ▼                ▼                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Router    │  │   Stores    │  │  Services   │         │
│  │             │  │  (Pinia)    │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                │
│         ▼                ▼                ▼                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Composables│  │   Utils     │  │   Types     │         │
│  │             │  │             │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.2 Key Pages and Features

**Authentication Pages**
- Login/Logout functionality
- User profile management
- Auth0 integration

**Dashboard**
- Overview of applications
- Recent scholarship matches
- Quick actions

**Application Management**
- Create new applications
- Track application status
- Edit application details
- Application timeline

**Scholarship Search**
- Advanced search filters
- AI-powered recommendations - **🔄 PARTIAL**
- Save favorite scholarships
- Export results

**Recommender Management**
- Add/edit recommenders
- Track recommendation status
- Send reminder emails



### 4.4 UI/UX Features
- **Responsive Design**: Mobile-first approach with Quasar
- **Material Design**: Consistent UI components
- **Dark/Light Theme**: User preference support
- **Progressive Web App**: Offline capabilities
- **Accessibility**: WCAG compliance

## 5. System Integration

### 5.1 Data Flow Between Components

```
1. Scraper Service (Independent)
   ├── Discovers scholarships via web scraping
   ├── Processes data with AI (Bedrock) (2/4 scrapers)
   └── Stores in RDS MySQL database
   └── Runs on scheduled intervals (no direct communication with server)

2. Server API
   ├── Queries scholarship database (populated by scraper)
   ├── Manages user applications
   ├── Handles authentication
   └── Provides RESTful endpoints

3. Client Application
   ├── Consumes API endpoints from server
   ├── Provides user interface
   ├── Manages application state
   └── Handles user interactions

Note: Server and Scraper are completely independent systems that share the same database.
```

### 5.2 Authentication Flow
```
1. User accesses client application
2. Auth0 handles authentication
3. JWT token provided to client
4. Client includes token in API requests
5. Server validates token with Auth0
6. Server processes authenticated requests
```

### 5.3 API Communication
- **RESTful APIs**: Standard HTTP methods
- **JSON Data Format**: Consistent data exchange
- **Error Handling**: Standardized error responses
- **Rate Limiting**: API usage controls

## 6. Deployment and DevOps

### 6.1 Infrastructure Deployment
- **AWS CDK**: Infrastructure as code
- **Environment Management**: Dev, staging, production
- **CI/CD Pipeline**: Automated deployment
- **Monitoring**: CloudWatch integration

### 6.2 Application Deployment
- **Server**: Node.js deployment with PM2
- **Client**: Static file hosting (S3 + CloudFront)
- **Database**: AWS RDS with automated backups
- **SSL/TLS**: HTTPS encryption

### 6.3 Environment Configuration
```bash
# Development
NODE_ENV=development
PORT=3000
DATABASE_URL=mysql://localhost:3307/scholarships_dev

# Production
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://rds-endpoint:3306/scholarships_prod
```

## 7. Security Considerations

### 7.1 Authentication & Authorization
- **Auth0 Integration**: Enterprise-grade authentication
- **JWT Tokens**: Secure session management
- **Role-based Access**: User permission levels
- **API Security**: Rate limiting and validation

### 7.2 Data Protection
- **Encryption at Rest**: Database and file encryption
- **Encryption in Transit**: HTTPS/TLS for all communications
- **Secrets Management**: AWS Secrets Manager
- **Data Privacy**: GDPR compliance considerations

### 7.3 Infrastructure Security
- **VPC Configuration**: Network isolation
- **Security Groups**: Firewall rules
- **IAM Policies**: Least privilege access
- **Regular Updates**: Security patch management

## 8. Monitoring and Logging

### 8.1 Application Monitoring
- **CloudWatch Logs**: Centralized logging
- **Error Tracking**: Exception monitoring
- **Performance Metrics**: Response time tracking
- **User Analytics**: Usage patterns

### 8.2 Infrastructure Monitoring
- **AWS CloudWatch**: Resource monitoring
- **Health Checks**: Service availability
- **Alerting**: Automated notifications
- **Dashboard**: Real-time metrics



The hybrid scraper architecture successfully bridges the gap between rapid development (Python) and production scalability (TypeScript), providing the best of both worlds for scholarship data collection and processing.
