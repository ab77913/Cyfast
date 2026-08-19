# GeneralManagement Service Architecture

This document provides comprehensive technical details about the GeneralManagement service architecture, design decisions, and implementation specifics.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Layer](#database-layer)
3. [API Layer](#api-layer)
4. [Service Layer](#service-layer)
5. [Messaging Integration](#messaging-integration)
6. [Reporting System](#reporting-system)
7. [Repository Integration](#repository-integration)
8. [Data Flow](#data-flow)
9. [Database Comparison](#database-comparison)
10. [Design Patterns](#design-patterns)
11. [Performance Considerations](#performance-considerations)
12. [Security](#security)
13. [Future Enhancements](#future-enhancements)

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Applications                    │
│              (Web UI, Mobile, API Consumers)                 │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Express.js Application Server                   │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │  Routes   │──│ Controllers  │──│    Services         │  │
│  │ (13 APIs) │  │  (20 Types)  │  │  (Business Logic)   │  │
│  └───────────┘  └──────┬───────┘  └─────────┬───────────┘  │
│                        │                     │               │
│                        ▼                     ▼               │
│              ┌──────────────────┐  ┌──────────────────┐    │
│              │    Factories     │  │   Middlewares    │    │
│              │  (Data Access)   │  │ (Auth, Upload)   │    │
│              └────────┬─────────┘  └──────────────────┘    │
└───────────────────────┼──────────────────────────────────────┘
                        │
         ┌──────────────┴────────────────┐
         │                               │
         ▼                               ▼
┌──────────────────┐          ┌──────────────────────┐
│  Primary DB      │          │    Secondary DB      │
│ (MySQL/MSSQL)    │          │ (Elasticsearch/      │
│                  │          │    MongoDB)          │
│ • Projects       │          │ • Design Templates   │
│ • Test Cases     │          │ • Report Templates   │
│ • Orchestrations │          │ • Report Sections    │
│ • Requirements   │          │                      │
│ • Test Agents    │          │                      │
│ • Executions     │          │                      │
└──────────────────┘          └──────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 External Integrations                        │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │   RabbitMQ   │  │   Repositories  │  │  File Storage │  │
│  │   Messages   │  │ (GitHub,Azure,  │  │   (Local)     │  │
│  │              │  │  Bitbucket)     │  │               │  │
│  └──────────────┘  └─────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Core Responsibilities

The GeneralManagement service is the central orchestration service responsible for:

1. **Project Management** - CRUD operations for test projects
2. **Test Management** - Test sources, suites, cases, scripts
3. **Orchestration** - Test execution orchestration and monitoring
4. **Requirements Management** - Test requirements and traceability
5. **Risk Management** - Test risk tracking and analysis
6. **Test Agent Management** - Agent registration, heartbeat, monitoring
7. **Report Generation** - HTML, PDF, Word report generation
8. **Dashboard Analytics** - Test execution statistics and metrics
9. **Repository Integration** - GitHub, Azure DevOps, Bitbucket
10. **Message Queue Coordination** - RabbitMQ listeners and producers

### Component Layers

```
┌──────────────────────────────────────────────────────────────┐
│                     API Layer (Routes)                        │
│  Main, Dashboard, Projects, Orchestrations, Requirements,     │
│  Risks, Test Sources, Test Suites, Test Cases, Test Scripts, │
│  Test Agents, Reports, Design Templates                       │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────┴─────────────────────────────────────┐
│                  Controller Layer                             │
│  Request handling, validation, response formatting            │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────┴─────────────────────────────────────┐
│                   Service Layer                               │
│  • Project Service       • Report Service                     │
│  • Orchestration Service • Traceability Service               │
│  • Test Agent Service    • Repository Services                │
│  • Background Service    • Execution Service                  │
│  • Requirement Service   • Risk Service                       │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────┴─────────────────────────────────────┐
│              Data Access Layer (Factories)                    │
│  Database abstraction with factory pattern                    │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────┴─────────────────────────────────────┐
│               Database/Persistence Layer                      │
│  MySQL/MSSQL (Primary) + Elasticsearch/MongoDB (Secondary)    │
└──────────────────────────────────────────────────────────────┘
```

## Database Layer

### Dual Database Architecture

The service implements a **dual database architecture** with distinct purposes:

**Primary Database (MySQL/MSSQL)**
- Relational data requiring ACID properties
- Transactional operations
- Complex joins and relationships
- Structured test management data

**Secondary Database (Elasticsearch/MongoDB)**
- Document storage (templates, reports)
- Full-text search capabilities
- Flexible schema requirements
- High-performance read operations

### Architecture Pattern

The service implements **Factory Pattern** with **Strategy Pattern** for database abstraction:

```
database/
├── mysql/
│   ├── factories/              # MySQL implementations
│   │   ├── project-factory.js
│   │   ├── test-case-factory.js
│   │   ├── orchestration-factory.js
│   │   ├── requirement-factory.js
│   │   ├── risk-factory.js
│   │   ├── test-agent-factory.js
│   │   └── ... (20+ factories)
│   └── models/                 # Sequelize models
│       └── index.js
├── mssql/
│   ├── factories/              # MSSQL implementations
│   ├── models/
│   └── migrations/
├── elasticsearch/
│   ├── factories/              # Elasticsearch implementations
│   │   ├── design-template-factory.js
│   │   ├── report-template-factory.js
│   │   └── report-section-factory.js
│   └── models/
│       └── index.js            # Elasticsearch client
└── mongodb/
    ├── factories/              # MongoDB implementations
    │   ├── design-template-factory.js
    │   ├── report-template-factory.js
    │   └── report-section-factory.js
    └── models/                 # Mongoose schemas
        ├── reportDesignTemplate.js
        ├── reportTemplate.js
        ├── reportSection.js
        └── index.js
```

### Database Selection

Databases are selected at runtime based on environment configuration:

```javascript
// Primary database for transactional data
const dbTypePrimary = process.env.DATABASE_TYPE_PRIMARY || "mysql";

// Secondary database for documents/templates
const dbTypeSecondary = process.env.DATABASE_TYPE_SECONDARY || "elasticsearch";

// Controller usage
const projectFactory = require("../database/" + 
  config.db_type_primary + 
  "/factories/project-factory");

const designTemplateFactory = require("../database/" + 
  config.db_type_secondary + 
  "/factories/design-template-factory");
```

### Primary Database (MySQL/MSSQL)

#### Key Entities

**Project Management:**
- `projects` - Test project definitions
- `project_configurations` - Project settings and configurations
- `project_test_agents` - Agent assignments to projects

**Test Management:**
- `test_sources` - Test source repositories
- `test_suites` - Test suite definitions
- `test_cases` - Test case specifications
- `test_scripts` - Test script implementations

**Orchestration:**
- `orchestrations` - Orchestration definitions
- `orchestration_configurations` - Orchestration settings
- `orchestration_test_cases` - Test case assignments
- `orchestration_executions` - Execution records

**Execution Tracking:**
- `test_case_executions` - Test case execution results
- `test_script_executions` - Script execution details

**Requirements & Risks:**
- `requirements` - Test requirements
- `requirement_test_cases` - Requirement-test mapping
- `requirement_executions` - Requirement execution status
- `risks` - Risk definitions

**Agent Management:**
- `test_agents` - Registered test agents
- Agent status and heartbeat tracking

#### Connection Setup

```javascript
// MySQL/MSSQL Connection (Sequelize)
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging || false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);
```

### Secondary Database (Elasticsearch/MongoDB)

#### Collections/Indices

**Report Design Templates:**
- File templates for report generation
- HTML, DOCX templates
- Metadata: filename, filepath, mimetype

**Report Templates:**
- Report structure definitions
- Section ordering
- Default templates by report type

**Report Sections:**
- Reusable report sections
- Section data and configuration
- Display order

#### MongoDB Implementation

**Connection Setup:**

```javascript
// database/mongodb/models/index.js
const mongoose = require("mongoose");

const db = {};
db.mongoose = mongoose;
db.url = "mongodb://" + dbConfig.username + ":" + 
         dbConfig.password + "@" + dbConfig.host + 
         ":27017/" + dbConfig.database + "?authSource=admin";

db.reportDesignTemplate = require("./reportDesignTemplate.js");
db.reportTemplate = require("./reportTemplate.js");
db.reportSection = require("./reportSection.js");

// Auto-connect
db.mongoose.connect(db.url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

module.exports = db;
```

**Schema Design:**

```javascript
// Example: Report Template Schema
const schema = mongoose.Schema(
  {
    template_name: String,
    report_type: String,
    sections: [String],
    is_default: { type: Boolean, default: false },
    created_by: String,
    modified_by: String,
  },
  {
    timestamps: {
      createdAt: "created_date",
      updatedAt: "modified_date",
    },
  }
);

schema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});
```

**Factory Pattern:**

```javascript
// Unified interface across both databases
const getByFilter = async (filters, sort, page, size) => {
  // MongoDB implementation
  const conditions = buildMongooseQuery(filters);
  const sortCondition = buildSort(sort);
  const limit = parseInt(size) || 10;
  const offset = (parseInt(page) - 1) * limit;

  const data = await ReportTemplate.find(conditions)
    .limit(limit)
    .skip(offset)
    .sort(sortCondition);

  const totalItems = await ReportTemplate.countDocuments(conditions);
  
  return {
    data: data,
    pagination: {
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: parseInt(page),
    },
  };
};
```

#### Elasticsearch Implementation

**Client Setup:**

```javascript
// database/elasticsearch/models/index.js
const { Client } = require("@elastic/elasticsearch");

const elasticClient = new Client({
  node: "http://" + dbConfig.host + ":" + dbConfig.port,
  auth: {
    username: dbConfig.username,
    password: dbConfig.password,
  },
});

// Index creation
const indices = [
  "report_sections", 
  "report_design_templates", 
  "report_templates"
];

indices.forEach(async (index) => {
  if (!(await elasticClient.indices.exists({ index }))) {
    await elasticClient.indices.create({ index });
  }
});
```

**Query Building:**

```javascript
// Complex Elasticsearch queries
const extractFilters = (filters) => {
  let searchQuery = {};
  let queryFilters = [];
  let rangeFilters = [];
  let termFilters = [];

  Object.keys(filters).forEach((key) => {
    if (typeof filters[key] === "object") {
      // Range queries
      let rangeFilter = {};
      rangeFilter[key] = filters[key];
      rangeFilters.push({ range: rangeFilter });
    } else if (Array.isArray(filters[key])) {
      // Terms queries
      let termFilter = {};
      termFilter[key] = filters[key];
      termFilters.push({ terms: termFilter });
    } else {
      // Match queries
      let queryFilter = {};
      queryFilter[key] = filters[key];
      queryFilters.push({ match: queryFilter });
    }
  });

  return {
    query: {
      bool: {
        must: [...queryFilters],
        filter: { bool: { must: [...rangeFilters, ...termFilters] } }
      }
    }
  };
};
```

## API Layer

### Routes Overview

The service exposes 13 major API route groups:

| Route Group | Base Path | Purpose |
|-------------|-----------|---------|
| Main | `/` | Health check, root endpoints |
| Dashboard | `/dashboard` | Analytics and statistics |
| Projects | `/projects` | Project CRUD operations |
| Orchestrations | `/orchestrations` | Orchestration management |
| Traceability | `/traceability` | Requirement traceability |
| Requirements | `/requirements` | Requirements management |
| Risks | `/risks` | Risk management |
| Test Sources | `/test_sources` | Source repository management |
| Test Suites | `/test_suites` | Test suite management |
| Test Cases | `/test_cases` | Test case management |
| Test Scripts | `/test_scripts` | Test script management |
| Test Agents | `/test_agents` | Agent management |
| Design Templates | `/design_templates` | Report design templates |
| Report Sections | `/report_sections` | Report sections |
| Report Templates | `/report_templates` | Report templates |
| Reports | `/reports` | Report generation |

### RESTful API Design

**Standard Operations:**

```javascript
// Standard CRUD routes
router.get("", controller.getAll);                    // GET /resources
router.get("/:id", controller.getById);               // GET /resources/:id
router.post("", controller.create);                   // POST /resources
router.post("/:id", controller.update);               // POST /resources/:id
router.delete("/:id", controller.delete);             // DELETE /resources/:id

// Nested resources
router.get("/:projectId/test_agents", controller.getTestAgents);
router.post("/:projectId/test_agents", controller.updateTestAgents);

// Specialized operations
router.get("/:projectId/summary", controller.getSummary);
router.get("/:projectId/executions/statistics", controller.getStats);
```

### Query Parameters

**Filtering:**
```
GET /projects?filters={"status":"active","type":"automation"}
```

**Sorting:**
```
GET /projects?sort={"created_date":"desc"}
```

**Pagination:**
```
GET /projects?page=1&size=20
```

**Includes (Eager Loading):**
```
GET /projects?include=["configuration","test_agents"]
```

### Middleware

**Authentication Middleware:**
```javascript
// middlewares/auth.js
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, config.secret, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};
```

**File Upload Middleware:**
```javascript
// middlewares/file-upload.js
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './storage/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });
```

## Service Layer

### Service Architecture

Services contain business logic separated from controllers:

```
services/
├── background-service.js          # Background tasks
├── execution-service.js           # Execution management
├── orchestration-service.js       # Orchestration logic
├── project-service.js             # Project operations
├── requirement-service.js         # Requirements logic
├── risk-service.js                # Risk management
├── test-agent-service.js          # Agent operations
├── test-service.js                # Test management
├── traceability-service.js        # Traceability logic
├── reports/                       # Report generation
│   ├── boot-service.js            # Initialize defaults
│   ├── dataset-service.js         # Data preparation
│   ├── html-service.js            # HTML generation
│   ├── pdf-service.js             # PDF generation
│   ├── word-service.js            # DOCX generation
│   └── report-service.js          # Main report service
├── repositories/                  # Repository integrations
│   ├── github-service.js
│   ├── azure-service.js
│   ├── bitbucket-service.js
│   └── repositoryService.js
└── traceability/                  # Traceability utilities
```

### Background Service

**Test Agent Monitoring:**

```javascript
// services/background-service.js
const monitorTestAgents = async () => {
  const runningTestAgents = await testAgentFactory.getAlive();
  const now = Date.now();
  
  for (let testAgent of runningTestAgents) {
    const lastHeartbeat = new Date(testAgent.last_heartbeat).getTime();
    
    // Mark as dead if no heartbeat in 10 seconds
    if (now - lastHeartbeat > 10000) {
      await testAgentFactory.update(testAgent.test_agent_id, {
        status: "DEAD",
      });
      console.log(`Test agent ${testAgent.name} marked as dead.`);
    }
  }
};

// Run every 10 seconds
setInterval(backgroundService.monitorTestAgents, 10000);
```

### Report Generation Services

**Multi-Format Support:**

1. **HTML Reports** (`html-service.js`)
   - Template-based generation
   - Dynamic data injection
   - CSS styling

2. **PDF Reports** (`pdf-service.js`)
   - HTML to PDF conversion
   - Puppeteer integration
   - Custom page layouts

3. **Word Reports** (`word-service.js`)
   - DOCX template processing
   - Dynamic content injection
   - docxtemplater library

**Report Service Workflow:**

```javascript
// services/reports/report-service.js
const generateReport = async (reportType, data) => {
  // 1. Get report template
  const template = await templateFactory.getDefaultTemplate(reportType);
  
  // 2. Prepare dataset
  const dataset = await datasetService.prepare(data);
  
  // 3. Generate based on format
  switch (format) {
    case 'HTML':
      return await htmlService.generate(template, dataset);
    case 'PDF':
      return await pdfService.generate(template, dataset);
    case 'DOCX':
      return await wordService.generate(template, dataset);
  }
};
```

### Repository Integration Services

**GitHub Service:**
- Repository browsing
- File operations
- Branch management
- Pull request integration

**Azure DevOps Service:**
- Repository access
- Work item integration
- Pipeline triggers

**Bitbucket Service:**
- Repository management
- Branch operations
- Webhook support

## Messaging Integration

### RabbitMQ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   RabbitMQ Message Broker                     │
│                                                               │
│  ┌───────────────────┐        ┌───────────────────┐         │
│  │    Exchanges      │        │      Queues       │         │
│  │  ┌─────────────┐  │        │  ┌─────────────┐ │         │
│  │  │ agent_reg   │──┼───────▶│  │ parser      │ │         │
│  │  │ agent_hb    │  │        │  │ project     │ │         │
│  │  │ execution   │  │        │  │ execution   │ │         │
│  │  │ orchestrate │  │        │  │             │ │         │
│  │  └─────────────┘  │        │  └─────────────┘ │         │
│  └───────────────────┘        └───────────────────┘         │
└──────────────────────────────────────────────────────────────┘
                         ▲              │
                         │              │
                    Publish        Subscribe
                         │              │
                         │              ▼
┌──────────────────────────────────────────────────────────────┐
│              GeneralManagement Service                        │
│                                                               │
│  Producer (mq-producer.js)         Listeners                 │
│  ├─ Publish test execution         ├─ listener-parser.js     │
│  ├─ Publish orchestration          ├─ listener-agent-*.js    │
│  └─ Publish agent commands         ├─ listener-execution.js  │
│                                     └─ listener-status.js     │
└──────────────────────────────────────────────────────────────┘
```

### Message Listeners

**1. Agent Registration Listener**
```javascript
// messaging/rabbitmq/listener-test-agent-registration.js
const listenToExchange = async (mqUrl, exchange) => {
  const connection = await amqp.connect(mqUrl);
  const channel = await connection.createChannel();
  
  await channel.assertExchange(exchange, 'fanout', { durable: true });
  const queue = await channel.assertQueue('', { exclusive: true });
  await channel.bindQueue(queue.queue, exchange, '');
  
  channel.consume(queue.queue, async (msg) => {
    const agentData = JSON.parse(msg.content.toString());
    await testAgentService.register(agentData);
    channel.ack(msg);
  });
};
```

**2. Agent Heartbeat Listener**
```javascript
// Updates last_heartbeat timestamp
// Marks agent as alive
```

**3. Test Case Execution Listener**
```javascript
// Receives execution results
// Updates execution status
// Triggers next steps in orchestration
```

**4. Orchestration Status Listener**
```javascript
// Monitors orchestration progress
// Updates orchestration status
// Handles completion/failure
```

**5. Parser Response Listener**
```javascript
// Receives parsed test files
// Updates test case definitions
// Stores parsed data
```

### Message Producer

```javascript
// messaging/rabbitmq/mq-producer.js
const publishToQueue = async (queueName, message) => {
  const connection = await amqp.connect(mqUrl);
  const channel = await connection.createChannel();
  
  await channel.assertQueue(queueName, { durable: true });
  channel.sendToQueue(
    queueName, 
    Buffer.from(JSON.stringify(message)),
    { persistent: true }
  );
  
  await channel.close();
  await connection.close();
};

const publishToExchange = async (exchange, message) => {
  const connection = await amqp.connect(mqUrl);
  const channel = await connection.createChannel();
  
  await channel.assertExchange(exchange, 'fanout', { durable: true });
  channel.publish(
    exchange, 
    '', 
    Buffer.from(JSON.stringify(message))
  );
  
  await channel.close();
  await connection.close();
};
```

## Reporting System

### Report Types

1. **Console Log Reports**
   - Test execution console output
   - Error logs and stack traces
   - Debug information

2. **Orchestration Execution Log**
   - Orchestration run details
   - Test case results
   - Timing information

3. **Orchestration Test Summary**
   - Pass/fail statistics
   - Test coverage
   - Execution trends

4. **Test Summary Reports**
   - Overall test results
   - Requirement coverage
   - Risk assessment

### Report Generation Pipeline

```
┌──────────────┐     ┌────────────────┐     ┌─────────────┐
│   Request    │────▶│  Get Template  │────▶│  Prepare    │
│   Report     │     │   (Default/    │     │  Dataset    │
│              │     │    Custom)     │     │             │
└──────────────┘     └────────────────┘     └──────┬──────┘
                                                    │
                                                    ▼
┌──────────────┐     ┌────────────────┐     ┌─────────────┐
│   Return     │◀────│    Render      │◀────│   Select    │
│   File/URL   │     │   Template     │     │   Format    │
│              │     │  (HTML/PDF/    │     │ (HTML/PDF/  │
│              │     │    DOCX)       │     │  DOCX)      │
└──────────────┘     └────────────────┘     └─────────────┘
```

### Template System

**Design Templates:**
- Stored in database (secondary DB)
- File-based templates (HTML, DOCX)
- Uploaded via API
- Versioned templates

**Report Templates:**
- Template structure definitions
- Section composition
- Default templates per report type
- Customizable per project

**Report Sections:**
- Reusable components
- Data-driven sections
- Ordered display
- Dynamic content

### Default Templates

```javascript
// config.js
const DEFAULT_TEMPLATES = {
  CONSOLE_LOG: {
    name: "Default Console Log",
    filename: "default-console-log.html",
    dirpath: __dirname + path.sep + "storage",
  },
  ORCHESTRATION_EXECUTION_LOG: {
    name: "Default Orchestration Execution Log",
    filename: "default-orchestration-execution-log.html",
    dirpath: __dirname + path.sep + "storage",
  },
  ORCHESTRATION_TEST_SUMMARY: {
    name: "Default Orchestration Test Summary",
    filename: "default-orchestration-test-summary.html",
    dirpath: __dirname + path.sep + "storage",
  },
  TEST_SUMMARY: {
    name: "Default Test Summary",
    filename: "default-test-summary.html",
    dirpath: __dirname + path.sep + "storage",
  },
};
```

## Repository Integration

### Supported Platforms

1. **GitHub**
   - OAuth authentication
   - Repository operations
   - File CRUD
   - Branch management

2. **Azure DevOps**
   - Personal access token auth
   - Repository browsing
   - Work item integration

3. **Bitbucket**
   - API key authentication
   - Repository management
   - Webhook integration

### Repository Service Interface

```javascript
// Unified interface across platforms
const repositoryService = {
  // Authentication
  authenticate: async (credentials) => {},
  
  // Repository operations
  listRepositories: async () => {},
  getRepository: async (repoId) => {},
  
  // File operations
  getFile: async (path) => {},
  createFile: async (path, content) => {},
  updateFile: async (path, content) => {},
  deleteFile: async (path) => {},
  
  // Branch operations
  listBranches: async () => {},
  createBranch: async (branchName) => {},
  
  // Commit operations
  getCommits: async () => {},
  getCommit: async (sha) => {},
};
```

## Data Flow

### Project Creation Flow

```
1. Client Request
   └─▶ POST /projects { name, description, ... }
       │
2. Route Handler
   └─▶ routes/project-routes.js
       │
3. Controller
   └─▶ controllers/project-controller.js
       ├─ Validate input
       ├─ Call factory
       │  └─▶ database/mysql/factories/project-factory.js
       │      └─▶ Insert into projects table
       └─ Return response
```

### Test Execution Flow

```
1. Start Orchestration
   └─▶ POST /orchestrations/:id/execute
       │
2. Orchestration Controller
   └─▶ Load orchestration configuration
       └─▶ Get assigned test agents
           │
3. Message Queue
   └─▶ Publish to execution exchange
       └─▶ RabbitMQ distributes to agents
           │
4. Test Agents
   └─▶ Execute test cases
       └─▶ Publish results to exchange
           │
5. Execution Listener
   └─▶ listener-test-case-execution.js
       └─▶ Store results in database
           └─▶ Update orchestration status
               │
6. Status Update
   └─▶ listener-orchestration-status.js
       └─▶ Mark orchestration complete
           └─▶ Trigger report generation
```

### Report Generation Flow

```
1. Report Request
   └─▶ GET /reports/generate
       │
2. Report Controller
   └─▶ Validate parameters
       └─▶ Call report service
           │
3. Report Service
   ├─▶ Get default template (from secondary DB)
   ├─▶ Prepare dataset (from primary DB)
   │   └─▶ dataset-service.js
   │       ├─ Fetch execution data
   │       ├─ Calculate statistics
   │       └─ Format data
   │
   ├─▶ Select format service
   │   ├─ HTML: html-service.js
   │   ├─ PDF: pdf-service.js
   │   └─ DOCX: word-service.js
   │
   └─▶ Generate report
       ├─ Render template with data
       ├─ Save to storage
       └─ Return file path/URL
```

## Database Comparison

### Primary Database: MySQL vs MSSQL

Both use Sequelize ORM with identical interfaces:

| Feature | MySQL | MSSQL |
|---------|-------|-------|
| **Connection** | mysql2 driver | tedious driver |
| **Dialect** | 'mysql' | 'mssql' |
| **Port** | 3306 | 1433 |
| **Performance** | Excellent read | Excellent enterprise features |
| **JSON Support** | Native JSON type | JSON functions (2016+) |
| **Full-Text Search** | FULLTEXT indexes | Full-text search |

**When to use:**
- **MySQL**: Development, lightweight deployments, cost-sensitive
- **MSSQL**: Enterprise deployments, Azure integration, advanced features

### Secondary Database: Elasticsearch vs MongoDB

| Feature | Elasticsearch | MongoDB |
|---------|---------------|---------|
| **Primary Use** | Search, analytics | Document storage |
| **Query Language** | JSON-based DSL | MongoDB Query Language |
| **Full-Text Search** | Excellent | Good (text indexes) |
| **Aggregation** | Very powerful | Very powerful |
| **Scalability** | Horizontal | Horizontal |
| **ACID** | Limited | Multi-document (4.0+) |
| **Schema** | Schema-less | Flexible schema |
| **Performance** | Optimized for search | Optimized for CRUD |

**When to use:**
- **Elasticsearch**: Need full-text search, analytics, log aggregation
- **MongoDB**: Need flexible schemas, document storage, ACID transactions

### Switching Between Databases

**Primary Database:**
```bash
# .env file
DATABASE_TYPE_PRIMARY=mysql    # or mssql
```

**Secondary Database:**
```bash
# .env file
DATABASE_TYPE_SECONDARY=elasticsearch    # or mongodb
```

**No code changes required** - Factory pattern ensures identical interfaces.

## Design Patterns

### 1. Factory Pattern

**Purpose:** Abstract database selection and instantiation

```javascript
// Dynamic factory loading
const factory = require("../database/" + 
  config.db_type_primary + 
  "/factories/project-factory");

// Usage remains identical
const projects = await factory.getByFilter(filters);
```

### 2. Strategy Pattern

**Purpose:** Interchangeable database implementations

```javascript
// Each factory implements the same interface
interface Factory {
  getByFilter(filters, sort, page, size): Promise<Result>
  getById(id): Promise<Entity>
  create(data): Promise<Entity>
  update(id, data): Promise<Entity>
  remove(id): Promise<boolean>
}
```

### 3. Repository Pattern

**Purpose:** Separate data access logic from business logic

```javascript
// Business logic in service
const projectService = {
  createProject: async (data) => {
    // Validation
    if (!data.name) throw new Error("Name required");
    
    // Business rules
    data.status = data.status || "ACTIVE";
    data.created_date = new Date();
    
    // Delegate to repository (factory)
    return await projectFactory.create(data);
  }
};
```

### 4. Middleware Pattern

**Purpose:** Chain request processing

```javascript
// Express middleware chain
router.post("/upload",
  authMiddleware.authenticate,
  fileUploadMiddleware.single('file'),
  controller.uploadFile
);
```

### 5. Observer Pattern

**Purpose:** Event-driven architecture with messaging

```javascript
// Publish event
messageProducer.publish('test.execution.complete', executionResult);

// Multiple listeners observe
listener1.subscribe('test.execution.complete'); // Update DB
listener2.subscribe('test.execution.complete'); // Send notification
listener3.subscribe('test.execution.complete'); // Generate report
```

### 6. Service Layer Pattern

**Purpose:** Encapsulate business logic

```javascript
// Controllers are thin
const controller = {
  createProject: async (req, res) => {
    const project = await projectService.createProject(req.body);
    res.json(project);
  }
};

// Services contain logic
const service = {
  createProject: async (data) => {
    // Complex business logic here
    // Validation, transformations, orchestration
  }
};
```

## Performance Considerations

### Database Optimization

**1. Indexing Strategy**

```javascript
// Primary database indexes
indexes: [
  { fields: ['project_id'] },
  { fields: ['status'] },
  { fields: ['created_date'] },
  { fields: ['project_id', 'status'] }, // Composite
]

// Elasticsearch mapping
{
  "mappings": {
    "properties": {
      "template_name": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "created_date": { "type": "date" }
    }
  }
}
```

**2. Query Optimization**

```javascript
// Eager loading to avoid N+1
const projects = await projectFactory.getByFilter(
  filters,
  sort,
  page,
  size,
  ["configuration", "test_agents"] // Include associations
);

// Pagination
const page = req.query.page || 1;
const size = req.query.size || 20; // Limit results
```

**3. Caching Strategy**

```javascript
// Consider implementing:
// - Redis for session/token caching
// - In-memory caching for static data
// - Query result caching for expensive operations

const cache = require('node-cache');
const projectCache = new cache({ stdTTL: 600 }); // 10 min TTL

const getProject = async (id) => {
  const cached = projectCache.get(`project_${id}`);
  if (cached) return cached;
  
  const project = await projectFactory.getById(id);
  projectCache.set(`project_${id}`, project);
  return project;
};
```

### API Performance

**1. Request Size Limits**

```javascript
// config.js
const MAX_GET_SIZE = process.env.MAX_GET_SIZE || "2MB";
const MAX_POST_SIZE = process.env.MAX_POST_SIZE || "8MB";

// Prevent memory exhaustion
app.use(bodyParser.json({ limit: MAX_POST_SIZE }));
```

**2. Compression**

```javascript
// Consider adding
const compression = require('compression');
app.use(compression());
```

**3. Connection Pooling**

```javascript
// Sequelize pools
pool: {
  max: 5,      // Maximum connections
  min: 0,      // Minimum connections
  acquire: 30000,
  idle: 10000
}

// MongoDB connection pooling (automatic)
mongoose.connect(url, {
  poolSize: 10,
  useNewUrlParser: true
});
```

### Background Processing

**1. Agent Monitoring**

```javascript
// Efficient interval-based monitoring
setInterval(backgroundService.monitorTestAgents, 10000);

// Only check "ALIVE" agents
const runningTestAgents = await testAgentFactory.getAlive();
```

**2. Async Processing**

```javascript
// Don't block API responses
const generateReport = async (req, res) => {
  // Return immediately
  res.json({ status: "generating", jobId: uuid() });
  
  // Process in background
  reportService.generate(params).then(result => {
    // Notify via webhook or store result
  });
};
```

## Security

### Current Implementation

**1. CORS Configuration**

```javascript
app.use(cors("*")); // Currently allows all origins
// TODO: Restrict to specific domains
```

**2. File Upload Security**

```javascript
// File type validation
const allowedMimeTypes = [
  'text/html',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

if (!allowedMimeTypes.includes(file.mimetype)) {
  throw new Error("Invalid file type");
}
```

### Recommended Enhancements

**1. Authentication & Authorization**

```javascript
// JWT-based authentication
const authMiddleware = require('./middlewares/auth');

// Protect routes
router.post("/projects", 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'manager']),
  controller.createProject
);
```

**2. Input Validation**

```javascript
const { body, validationResult } = require('express-validator');

router.post("/projects", [
  body('name').isLength({ min: 3 }).trim().escape(),
  body('description').optional().trim(),
], controller.createProject);
```

**3. SQL Injection Prevention**

```javascript
// Sequelize automatically parameterizes queries
// Avoid raw queries when possible
await Project.findAll({
  where: { status: userInput } // Safe - parameterized
});

// If raw queries needed, use parameterization
await sequelize.query(
  "SELECT * FROM projects WHERE status = :status",
  { replacements: { status: userInput } }
);
```

**4. Rate Limiting**

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

**5. Environment Variables**

```javascript
// Never commit credentials
// Use .env files (not in git)
DATABASE_USERNAME=admin
DATABASE_PASSWORD=secure_password
JWT_SECRET=random_secret_key
```

## Future Enhancements

### 1. Microservices Architecture

**Current:** Monolithic service with all functionality

**Proposed:**
```
GeneralManagement (Core)
├── ProjectService (Projects, configurations)
├── TestManagementService (Test cases, suites, scripts)
├── OrchestrationService (Execution management)
├── ReportingService (Report generation)
├── AgentService (Agent management)
└── IntegrationService (Repository, messaging)
```

**Benefits:**
- Independent scaling
- Technology diversity
- Fault isolation
- Easier deployment

### 2. Event Sourcing

**Pattern:** Store all changes as events

```javascript
// Current: Update state directly
await projectFactory.update(id, { status: "ARCHIVED" });

// Event Sourcing: Store event
await eventStore.append({
  aggregateId: projectId,
  eventType: "ProjectArchived",
  data: { archivedBy: userId, reason: "Completed" },
  timestamp: new Date()
});

// Rebuild state from events
const project = await projectAggregate.rehydrate(projectId);
```

**Benefits:**
- Complete audit trail
- Time travel debugging
- Event replay
- CQRS compatibility

### 3. GraphQL API

**Add GraphQL alongside REST:**

```graphql
type Project {
  id: ID!
  name: String!
  configuration: ProjectConfiguration
  testAgents: [TestAgent]
  executions(page: Int, size: Int): ExecutionPage
}

type Query {
  project(id: ID!): Project
  projects(filters: ProjectFilters): [Project]
}

type Mutation {
  createProject(input: ProjectInput!): Project
  updateProject(id: ID!, input: ProjectInput!): Project
}
```

**Benefits:**
- Flexible queries
- Single endpoint
- Type safety
- Better client experience

### 4. Real-time Updates

**WebSocket Integration:**

```javascript
const io = require('socket.io')(server);

// Emit execution updates
io.to(`orchestration_${id}`).emit('execution_update', {
  status: "RUNNING",
  progress: 45,
  currentTest: "test_login"
});

// Client subscribes
socket.on('connect', () => {
  socket.emit('subscribe', `orchestration_${id}`);
});
```

**Benefits:**
- Live dashboards
- Real-time notifications
- Better UX

### 5. Advanced Analytics

**Implement:**
- Test execution trends
- Failure pattern analysis
- Predictive analytics (ML models)
- Coverage heatmaps
- Performance metrics

### 6. Multi-tenancy

**Tenant Isolation:**

```javascript
// Schema: Add tenant_id to all tables
// Middleware: Extract tenant from auth token
// Queries: Automatic tenant filtering

const getTenantId = (req) => req.user.tenantId;

const getProjects = async (req) => {
  const tenantId = getTenantId(req);
  return await projectFactory.getByFilter({ tenant_id: tenantId });
};
```

### 7. Enhanced Security

- **OAuth 2.0** integration
- **RBAC** (Role-Based Access Control)
- **API Gateway** with authentication
- **Secrets Management** (HashiCorp Vault)
- **Audit Logging** for compliance

### 8. Cloud-Native Features

- **Kubernetes** deployment
- **Service Mesh** (Istio)
- **Distributed Tracing** (Jaeger)
- **Centralized Logging** (ELK Stack)
- **Metrics** (Prometheus + Grafana)

### 9. Testing Infrastructure

- **Unit Tests** (Jest)
- **Integration Tests**
- **E2E Tests** (Supertest)
- **Load Testing** (k6)
- **Contract Testing** (Pact)

### 10. CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy GeneralManagement

on:
  push:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm test
      
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: docker build -t general-management .
      - run: docker push general-management
      - run: kubectl apply -f k8s/
```

---

## Appendix

### Configuration Files

**database.json:**
```json
{
  "mysql": { "local": {...}, "staging": {...}, "production": {...} },
  "mssql": { "local": {...}, "staging": {...}, "production": {...} },
  "elasticsearch": { "local": {...}, "staging": {...}, "production": {...} },
  "mongodb": { "local": {...}, "staging": {...}, "production": {...} }
}
```

**messaging.json:**
```json
{
  "rabbitmq": { "local": {...}, "staging": {...}, "production": {...} },
  "queues": {
    "parser_response": "parser_response_queue",
    "execution_status_response": "execution_status_response_queue"
  },
  "exchanges": {
    "agent_registration_response": "agent_registration_response_exchange",
    "agent_heartbeat_response": "agent_heartbeat_response_exchange",
    "execution_testcase": "execution_testcase_exchange"
  }
}
```

### Environment Variables

```bash
# Application
NODE_ENV=local|staging|production
PORT=3000

# Databases
DATABASE_TYPE_PRIMARY=mysql|mssql
DATABASE_TYPE_SECONDARY=elasticsearch|mongodb

# Messaging
MESSAGING_TYPE=rabbitmq

# Limits
MAX_GET_SIZE=2MB
MAX_POST_SIZE=8MB

# Secrets (use .env file, not committed)
JWT_SECRET=your_secret_key
DATABASE_PASSWORD=your_password
```

### Deployment

**Docker:**
```dockerfile
FROM node:14
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  general-management:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_TYPE_PRIMARY=mysql
    depends_on:
      - mysql
      - elasticsearch
      - rabbitmq
```

---

**Document Version:** 1.0  
**Last Updated:** February 18, 2026  
**Maintainer:** Development Team
