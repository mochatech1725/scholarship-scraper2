# Scholarship Tracker System Design Document

## 1. System Overview

### 1.1 Project Description
The Scholarship Tracker is a comprehensive web application designed to help students discover, track, and manage scholarship opportunities. The system consists of three independent components:

1. **Scholarship Scraper (AWS Infrastructure)** - Automated scholarship discovery and data collection (runs independently)
2. **Scholarship Server (Backend API)** - User management and application tracking (consumes scraper data from database) - Located at `/Users/teial/Tutorials/scholarship-server`
3. **Scholarship Client (Frontend)** - User interface for scholarship search and application management - Located at `/Users/teial/Tutorials/scholarship-client`

### 1.2 Current Implementation Status
**⚠️ IMPORTANT**: This document has been updated to reflect the actual implementation state. Some features described are planned but not yet implemented.

**Implemented**:
- AWS CDK infrastructure with VPC, RDS, DynamoDB, Batch, Lambda
- 4 web scrapers (CareerOneStop, CollegeScholarship, General Search, GumLoop)
- Basic AI processing (Bedrock) in 2 scrapers
- Job orchestration and scheduling
- Database migration from DynamoDB to MySQL (partially complete)
- Server and client applications (separate repositories)

**In Progress**:
- Complete migration from DynamoDB to MySQL
- Enhanced AI processing across all scrapers

**Planned**:
- Advanced AI-powered data categorization
- Real-time data processing
- Enhanced monitoring and analytics

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
│                 │    │   + DynamoDB    │
└─────────────────┘    └─────────────────┘
                                ▲
                                │
                                │
                       ┌─────────────────┐
                       │   Scholarship   │
                       │    Scraper      │
                       │   (AWS/CDK)     │
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
```

### 1.4 Key Features
- **Automated Scholarship Discovery**: Web scraping of scholarship websites (independent service)
- **User Authentication**: Secure Auth0 integration
- **Application Tracking**: Comprehensive scholarship application management
- **Recommender System**: Management of recommendation letters and references
- **Advanced Search**: Intelligent scholarship matching and filtering
- **Scheduled Data Updates**: Automated scholarship data refresh via independent scraper service
- **AI-Powered Processing**: Limited implementation in 2 scrapers

## 2. Component 1: Scholarship Scraper (AWS Infrastructure)

### 2.1 Technology Stack
- **Infrastructure as Code**: AWS CDK with TypeScript
- **Compute**: AWS Batch with Fargate
- **Database**: Hybrid approach
  - AWS RDS MySQL (for scholarship data)
  - AWS DynamoDB (for job tracking and website configurations)
- **Storage**: Amazon S3 for raw data
- **AI/ML**: AWS Bedrock for intelligent processing (2/4 scrapers)
- **Monitoring**: CloudWatch Logs
- **Security**: IAM roles, VPC, Security Groups

### 2.2 Architecture Details

#### 2.2.1 Core Components
```
┌─────────────────────────────────────────────────────────────┐
│                    AWS Infrastructure                        │
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
```

#### 2.2.2 Data Flow
1. **Scheduled Trigger**: EventBridge triggers Lambda orchestrator
2. **Job Submission**: Lambda submits Batch jobs to ECS
3. **Web Scraping**: Fargate containers scrape scholarship websites
4. **AI Processing**: Bedrock processes data (limited to 2 scrapers)
5. **Data Storage**: Results stored in S3 and RDS MySQL
6. **Monitoring**: CloudWatch tracks performance and errors

### 2.3 Key Features
- **Multi-Source Scraping**: CareerOneStop, CollegeScholarship, General Search, GumLoop
- **AI-Powered Processing**: Intelligent data extraction and categorization (2/4 scrapers)
- **Rate Limiting**: Respectful web scraping with delays
- **Error Handling**: Robust error recovery and retry mechanisms
- **Scalable Architecture**: Auto-scaling based on workload

### 2.4 Database Architecture (Current State)
**Hybrid Approach - Migration in Progress**:

**MySQL (RDS)**:
- Scholarship data (migrated from DynamoDB)
- Website configurations (recently migrated)

**DynamoDB**:
- Job tracking and metadata
- Operational data

**Migration Status**: 
- Scholarship data: Migrated to MySQL
- Website configurations: Migrated to MySQL  
- Job tracking: Remains in DynamoDB (planned to stay)

### 2.5 Security Considerations
- **VPC Isolation**: Private subnets for compute resources
- **IAM Roles**: Least privilege access policies
- **Secrets Management**: AWS Secrets Manager for credentials
- **Network Security**: Security groups and VPC endpoints

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

## 9. Conclusion

The Scholarship Tracker system represents a **substantially implemented** solution for scholarship discovery and application management. The three-component architecture provides:

- **✅ Scalability**: AWS infrastructure supports growth
- **✅ Security**: Enterprise-grade authentication and data protection
- **✅ User Experience**: Modern, responsive web application
- **✅ Maintainability**: Well-structured codebase with clear separation of concerns
- **✅ Independence**: Server and scraper operate independently, sharing only the database
