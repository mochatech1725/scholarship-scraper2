# Scholarship Tracker Technical Design Document

## Table of Contents
1. [Overview](#1-overview)
   1.1. [Project](#11-project)
   1.2. [Description](#12-description)
   1.3. [Assumptions](#13-assumptions)
2. [Requirements](#2-requirements)
   2.1. [Features and Functionalities](#21-features-and-functionalities)
   2.2. [Non functional requirements](#22-non-functional-requirements)
3. [System Architecture](#3-system-architecture)
   3.1. [High Level Design](#31-high-level-design)
   3.2. [Technology Stack](#32-technology-stack)
   3.3. [System Components](#33-system-components)
4. [Module Design](#4-module-design)
5. [Database Design](#5-database-design)
6. [API Design](#6-api-design)
7. [Security Design](#7-security-design)
8. [Deployment Architecture](#8-deployment-architecture)
9. [Future Enhancements](#9-future-enhancements)

---

## 1. Overview

### 1.1. Project
**Project Name**: Scholarship Tracker System  
**Version**: 1.0.0  
**Project Type**: Web Application  
**Architecture**: Microservices with Independent Components  

### 1.2. Description
The Scholarship Tracker is a comprehensive web application designed to help students discover, track, and manage scholarship opportunities. The system consists of three independent components that work together through a shared database:

1. **Scholarship Scraper (AWS Infrastructure)** - Automated scholarship discovery and data collection service
2. **Scholarship Server (Backend API)** - User management and application tracking service
3. **Scholarship Client (Frontend)** - User interface for scholarship search and application management

The system provides automated scholarship discovery through AI-powered web scraping, secure user authentication, comprehensive application tracking, and an intuitive user interface for managing scholarship applications.

### 1.3. Assumptions
- Users have basic internet connectivity and modern web browsers
- AWS services are available and properly configured
- Auth0 service is available for authentication
- Scholarship websites remain accessible for scraping
- Users are primarily students seeking scholarship opportunities
- Database performance is sufficient for expected user load
- AWS infrastructure costs are acceptable for the project scope

---

## 2. Requirements

### 2.1. Features and Functionalities

#### Core Features
- **User Authentication**: Secure login/logout with Auth0 integration
- **Scholarship Discovery**: Automated scraping and AI-powered processing
- **Application Management**: Create, read, update, delete scholarship applications
- **Recommender System**: Management of recommendation letters and references
- **Advanced Search**: Intelligent scholarship matching and filtering
- **User Profile Management**: Personal information and preferences
- **Dashboard**: Overview of applications and recent scholarship matches

#### Functional Requirements
- Users can register and authenticate securely
- Users can search for scholarships using various criteria
- Users can create and track scholarship applications
- Users can manage recommender information
- System automatically discovers and updates scholarship data
- System provides intelligent scholarship recommendations
- Users can export scholarship data and application information

### 2.2. Non functional requirements

#### 2.2.1. Performance
- **Response Time**: API endpoints should respond within 500ms for 95% of requests
- **Throughput**: System should handle 1000 concurrent users
- **Database Performance**: Query response time under 200ms for standard operations
- **Frontend Performance**: Page load times under 3 seconds
- **Scraper Performance**: Process 1000+ scholarships per hour

#### 2.2.2. Scalability
- **Horizontal Scaling**: Support for multiple server instances
- **Database Scaling**: RDS read replicas for read-heavy operations
- **Auto-scaling**: AWS Batch and ECS auto-scaling based on workload
- **Load Distribution**: CDN for static assets and API load balancing
- **Microservices Ready**: Independent deployment of components

#### 2.2.3. Security
- **Authentication**: OAuth2/JWT with Auth0
- **Authorization**: Role-based access control
- **Data Encryption**: TLS/SSL for data in transit, encryption at rest
- **Input Validation**: Comprehensive request sanitization
- **Rate Limiting**: API request throttling
- **Audit Logging**: Complete audit trail for security events

#### 2.2.4. Maintainability
- **Code Quality**: TypeScript for type safety and better development experience
- **Documentation**: Comprehensive API documentation and code comments
- **Modular Architecture**: Clear separation of concerns
- **Version Control**: Git-based development workflow
- **Testing**: Comprehensive test coverage
- **Monitoring**: Real-time system monitoring and alerting

---

## 3. System Architecture

### 3.1. High Level Design

#### System Architecture Diagram
```
┌─────────────────┐    ┌─────────────────┐
│   Scholarship   │    │   Scholarship   │
│     Client      │◄──►│     Server      │
│   (Vue/Quasar)  │    │  (Express/TS)   │
└─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   Auth0 Auth    │    │   AWS RDS       │
│                 │    │   (MySQL)       │
│                 │    │                 │
└─────────────────┘    └─────────────────┘
                                ▲
                                │
                                │
                       ┌─────────────────┐
                       │   Scholarship   │
                       │    Scraper      │
                       │   (AWS/CDK)     │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   AWS Services  │
                       │   (Batch, S3,   │
                       │   Lambda, etc.) │
                       └─────────────────┘
```

#### Architecture Type
- **Microservices Architecture**: Three independent services
- **Database-Centric Integration**: Shared MySQL database
- **Event-Driven**: Scheduled scraping and processing
- **Cloud-Native**: AWS infrastructure and services

### 3.2. Technology Stack

#### 3.2.1. Frontend
- **Framework**: Vue.js 3 with Composition API
- **UI Framework**: Quasar Framework v2.16.0
- **State Management**: Pinia v3.0.1
- **Routing**: Vue Router v4.0.12
- **Authentication**: Auth0 Vue SDK v2.4.0
- **HTTP Client**: Axios v1.2.1
- **Build Tool**: Vite with Quasar CLI
- **Styling**: SCSS with Material Design components
- **TypeScript**: v5.5.3 for type safety

#### 3.2.2. Backend
- **Runtime**: Node.js v18+
- **Framework**: Express.js v4.18.2
- **Language**: TypeScript v5.3.3
- **ORM**: Knex.js v3.1.0
- **Authentication**: Auth0 with express-oauth2-jwt-bearer
- **Security**: Helmet v7.1.0, CORS v2.8.5
- **Logging**: Morgan v1.10.0
- **Process Management**: PM2 for production

#### 3.2.3. Database
- **Database**: AWS RDS MySQL v8.0.35
- **ORM**: Knex.js for query building
- **Connection Pooling**: Built-in MySQL2 pooling
- **Backup**: Automated daily backups with 7-day retention
- **Encryption**: AES-256 encryption at rest
- **SSL**: TLS 1.2+ for connections

#### 3.2.4. Infrastructure
- **Infrastructure as Code**: AWS CDK with TypeScript
- **Compute**: AWS Batch with Fargate
- **Container Registry**: Amazon ECR
- **Storage**: Amazon S3 for raw data
- **AI/ML**: AWS Bedrock for intelligent processing
- **Monitoring**: CloudWatch Logs and Metrics
- **Secrets Management**: AWS Secrets Manager
- **Networking**: VPC with private/public subnets

### 3.3. System Components

#### 3.3.1. Describe the major components

**Scholarship Client (Frontend)**
- **Purpose**: User interface for scholarship management
- **Responsibilities**: 
  - User authentication and session management
  - Scholarship search and filtering
  - Application creation and tracking
  - Recommender management
  - Dashboard and reporting

**Scholarship Server (Backend API)**
- **Purpose**: RESTful API for business logic and data management
- **Responsibilities**:
  - User management and authentication
  - Application CRUD operations
  - Recommender management
  - Scholarship search and filtering
  - Data validation and business rules

**Scholarship Scraper (Data Collection)**
- **Purpose**: Automated scholarship discovery and data processing
- **Responsibilities**:
  - Web scraping of scholarship websites
  - AI-powered data extraction and categorization
  - Data cleaning and normalization
  - Database population and updates
  - Error handling and retry mechanisms

**Shared Database (Data Layer)**
- **Purpose**: Central data store for all components
- **Responsibilities**:
  - User data storage
  - Application data management
  - Scholarship data repository
  - Recommender information
  - Audit logging

#### 3.3.2. Third-party services

**Authentication Services**
- **Auth0**: OAuth2/JWT authentication and user management
- **Purpose**: Secure user authentication and authorization

**AWS Services**
- **AWS RDS**: Managed MySQL database service
- **AWS S3**: Object storage for raw data and assets
- **AWS Batch**: Containerized batch processing
- **AWS Lambda**: Serverless function execution
- **AWS Bedrock**: AI/ML processing capabilities
- **AWS Secrets Manager**: Secure credential management
- **AWS CloudWatch**: Monitoring and logging

**External APIs**
- **Scholarship Websites**: CareerOneStop, CollegeScholarship, etc.
- **Purpose**: Data source for scholarship information

---

## 4. Module Design

### Frontend Modules

**Authentication Module**
- User login/logout functionality
- Session management
- Profile management
- Auth0 integration

**Dashboard Module**
- Application overview
- Recent scholarship matches
- Quick actions and shortcuts
- Statistics and metrics

**Application Management Module**
- Create new applications
- Edit existing applications
- Track application status
- Application timeline and history

**Scholarship Search Module**
- Advanced search filters
- AI-powered recommendations
- Save favorite scholarships
- Export functionality

**Recommender Management Module**
- Add/edit recommenders
- Track recommendation status
- Send reminder emails
- Recommender profiles

**State Management Module**
- Pinia store management
- User state management
- Application state management
- Scholarship state management

### Backend Modules

**User Management Module**
- User CRUD operations
- Profile management
- Authentication integration
- Role-based access control

**Application Management Module**
- Application CRUD operations
- Status tracking
- Validation and business rules
- Data relationships

**Scholarship Search Module**
- Database querying
- Filtering and sorting
- Search optimization
- Data aggregation

**Recommender Module**
- Recommender CRUD operations
- Relationship management
- Email integration
- Status tracking

### Scraper Modules

**Web Scraping Module**
- Multi-source scraping
- Rate limiting and respect
- Error handling and retries
- Data extraction

**AI Processing Module**
- Data categorization
- Intelligent filtering
- Content analysis
- Quality assessment

**Data Management Module**
- Database operations
- Data cleaning
- Conflict resolution
- Update strategies

### 4.1. Frontend State Management (Pinia)

The frontend application uses Pinia for state management with the following store structure:

#### 4.1.1. User Store
```typescript
interface UserStore {
  user: User | null;
  isAuthenticated: boolean;
  login(): Promise<void>;
  logout(): Promise<void>;
  fetchProfile(): Promise<void>;
}
```

#### 4.1.2. Application Store
```typescript
interface ApplicationStore {
  applications: Application[];
  currentApplication: Application | null;
  fetchApplications(): Promise<void>;
  createApplication(app: Application): Promise<void>;
  updateApplication(id: string, app: Application): Promise<void>;
  deleteApplication(id: string): Promise<void>;
}
```

#### 4.1.3. Scholarship Store
```typescript
interface ScholarshipStore {
  scholarships: Scholarship[];
  searchResults: Scholarship[];
  searchScholarships(criteria: SearchCriteria): Promise<void>;
  saveScholarship(scholarship: Scholarship): Promise<void>;
}
```

---

## 5. Database Design

### 5.1. ER Diagram

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Users    │    │Applications │    │Recommenders │
├─────────────┤    ├─────────────┤    ├─────────────┤
│ id (PK)     │    │ id (PK)     │    │ id (PK)     │
│ email       │◄───┤ user_id (FK)│    │ user_id (FK)│
│ first_name  │    │ scholarship │    │ name        │
│ last_name   │    │ title       │    │ email       │
│ created_at  │    │ description │    │ title       │
│ updated_at  │    │ status      │    │ institution │
└─────────────┘    │ deadline    │    │ relationship│
                   │ amount      │    │ created_at  │
                   │ created_at  │    │ updated_at  │
                   │ updated_at  │    └─────────────┘
                   └─────────────┘
```

### 5.2. Schema Design

#### Users Table
```sql
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### Applications Table
```sql
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Recommenders Table
```sql
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Scholarships Table (Populated by Scraper)
```sql
CREATE TABLE scholarships (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    amount DECIMAL(10,2),
    deadline DATE,
    eligibility TEXT,
    source VARCHAR(255),
    url VARCHAR(1000),
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 5.3. Indexes

#### Performance Indexes
```sql
-- Users table
CREATE INDEX idx_users_email ON users(email);

-- Applications table
CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_deadline ON applications(deadline);

-- Recommenders table
CREATE INDEX idx_recommenders_user_id ON recommenders(user_id);

-- Scholarships table
CREATE INDEX idx_scholarships_category ON scholarships(category);
CREATE INDEX idx_scholarships_deadline ON scholarships(deadline);
CREATE INDEX idx_scholarships_amount ON scholarships(amount);
CREATE FULLTEXT INDEX idx_scholarships_search ON scholarships(title, description, eligibility);
```

### 5.4. Transactions

#### Transaction Management Strategies
- **Read Operations**: No explicit transactions needed for simple queries
- **Write Operations**: Use transactions for multi-table operations
- **Application Creation**: Transaction to ensure data consistency
- **Bulk Operations**: Batch transactions for scraper data updates
- **Error Handling**: Automatic rollback on transaction failures

---

## 6. API Design

### 6.1. Endpoints

#### Authentication Endpoints
```
POST   /api/auth/login          # User authentication
POST   /api/auth/logout         # User logout
GET    /api/auth/profile        # Get user profile
```

#### User Management Endpoints
```
GET    /api/users               # List all users
GET    /api/users/:id           # Get specific user
POST   /api/users               # Create new user
PUT    /api/users/:id           # Update user
DELETE /api/users/:id           # Delete user
```

#### Application Management Endpoints
```
GET    /api/applications                    # List all applications
GET    /api/applications/:id                # Get specific application
POST   /api/applications                    # Create new application
PUT    /api/applications/:id                # Update application
DELETE /api/applications/:id                # Delete application
GET    /api/applications/user/:userId       # Get user's applications
```

#### Recommender Management Endpoints
```
GET    /api/recommenders                    # List all recommenders
GET    /api/recommenders/:id                # Get specific recommender
GET    /api/recommenders/user/:userId       # Get user's recommenders
POST   /api/recommenders                    # Create new recommender
PUT    /api/recommenders/:id                # Update recommender
DELETE /api/recommenders/:id                # Delete recommender
```

#### Scholarship Search Endpoints
```
POST   /api/scholarships/find               # Search scholarships
GET    /api/scholarships/sources            # Get available sources
GET    /api/scholarships/health             # Service health check
GET    /api/scholarships/categories         # Get scholarship categories
```

### 6.2. URL schemas, naming conventions

#### URL Schema
- **Base URL**: `https://api.scholarshiptracker.com/v1`
- **Resource-based URLs**: `/api/{resource}/{id}`
- **Nested Resources**: `/api/{resource}/{id}/{sub-resource}`
- **Query Parameters**: `?filter=value&sort=field&page=1`

#### Naming Conventions
- **Endpoints**: kebab-case (e.g., `/api/user-profiles`)
- **Parameters**: camelCase (e.g., `userId`, `firstName`)
- **Headers**: kebab-case (e.g., `Content-Type`, `Authorization`)
- **Response Fields**: camelCase (e.g., `firstName`, `lastName`)

### 6.3. Authentication

#### Authentication Flow
1. **Client Request**: User attempts to access protected resource
2. **Token Validation**: Server validates JWT token with Auth0
3. **User Context**: Server extracts user information from token
4. **Authorization**: Server checks user permissions
5. **Response**: Server returns requested data or error

#### JWT Token Structure
```json
{
  "iss": "https://auth0.com/",
  "sub": "auth0|user-id",
  "aud": "api-identifier",
  "iat": 1234567890,
  "exp": 1234567890,
  "scope": "read:applications write:applications"
}
```


---

## 7. Security Design

### 7.1. Authentication/Authorization

#### OAuth2/JWT Implementation
- **Provider**: Auth0
- **Flow**: Authorization Code Flow with PKCE
- **Token Type**: JWT (JSON Web Tokens)
- **Token Expiry**: 24 hours for access tokens
- **Refresh Tokens**: 30 days with automatic renewal


### 7.2. Vulnerabilities

#### Common Vulnerabilities and Mitigations

**SQL Injection**
- **Risk**: High
- **Mitigation**: Parameterized queries with Knex.js
- **Monitoring**: Query logging and analysis

**Cross-Site Scripting (XSS)**
- **Risk**: Medium
- **Mitigation**: Input sanitization, CSP headers
- **Monitoring**: Content Security Policy violations

**Cross-Site Request Forgery (CSRF)**
- **Risk**: Low
- **Mitigation**: JWT tokens, SameSite cookies
- **Monitoring**: Unusual request patterns

**Authentication Bypass**
- **Risk**: High
- **Mitigation**: Auth0 integration, token validation
- **Monitoring**: Failed authentication attempts


---

## 8. Deployment Architecture

### 8.1. Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS Cloud Infrastructure                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Route 53  │  │ CloudFront  │  │   ALB       │         │
│  │   DNS       │  │    CDN      │  │ Load Balancer│         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                │
│         ▼                ▼                ▼                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │     S3      │  │   ECS       │  │   Lambda    │         │
│  │  Static     │  │  Fargate    │  │ Orchestrator│         │
│  │  Assets     │  │  Containers │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                │
│         ▼                ▼                ▼                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   RDS       │  │   Batch     │  │   Event     │         │
│  │   MySQL     │  │ Compute Env │  │  Bridge     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 8.2. Scaling Strategy

#### Horizontal Scaling
- **Application Servers**: Multiple ECS Fargate instances
- **Load Balancer**: Application Load Balancer with health checks
- **Auto Scaling**: Scale based on CPU/memory utilization
- **Database**: RDS read replicas for read-heavy operations

#### Vertical Scaling
- **Instance Types**: Upgrade to larger instance types as needed
- **Database**: Scale RDS instance size for increased capacity
- **Storage**: Increase EBS volumes and S3 storage

---