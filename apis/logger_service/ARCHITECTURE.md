# LoggerService Architecture

This document provides technical details about the LoggerService architecture, design decisions, and implementation specifics.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Layer](#database-layer)
3. [API Layer](#api-layer)
4. [Messaging Integration](#messaging-integration)
5. [Data Flow](#data-flow)
6. [Database Comparison](#database-comparison)
7. [Design Patterns](#design-patterns)
8. [Performance Considerations](#performance-considerations)
9. [Migration Guide](#migration-guide)
10. [Future Enhancements](#future-enhancements)

## System Architecture

### High-Level Overview

```
┌─────────────────┐
│  Client Apps    │
│  (REST API)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     Express.js Application          │
│  ┌──────────┐  ┌────────────────┐  │
│  │  Routes  │──│  Controllers   │  │
│  └──────────┘  └────────┬───────┘  │
│                         │           │
│                         ▼           │
│              ┌──────────────────┐  │
│              │   Factories      │  │
│              │  (Data Layer)    │  │
│              └────────┬─────────┘  │
└───────────────────────┼─────────────┘
                        │
         ┌──────────────┴──────────────┐
         │                             │
         ▼                             ▼
┌─────────────────┐          ┌──────────────────┐
│    MongoDB      │          │  Elasticsearch   │
│  (Primary DB)   │          │  (Alternative)   │
└─────────────────┘          └──────────────────┘

┌─────────────────┐
│   RabbitMQ      │──► Console Log Listener
│  (Messaging)    │
└─────────────────┘
```

### Component Layers

1. **API Layer** (Routes + Controllers)
   - HTTP request handling
   - Input validation
   - Response formatting

2. **Business Logic Layer** (Controllers)
   - Request processing
   - Factory method invocation
   - Error handling

3. **Data Access Layer** (Factories)
   - Database operations
   - Query building
   - Data transformation

4. **Database Layer** (Models)
   - Schema definitions
   - Database connections
   - Index management

5. **Integration Layer** (Messaging)
   - RabbitMQ listeners
   - Message processing
   - Queue management

## Database Layer

### Architecture Pattern

The service implements a **Factory Pattern** with **Strategy Pattern** for database abstraction:

```
database/
├── elasticsearch/
│   ├── factories/          # Elasticsearch implementations
│   │   ├── activityLogFactory.js
│   │   ├── applicationLogFactory.js
│   │   ├── auditLogFactory.js
│   │   ├── consoleLogFactory.js
│   │   └── executionLogFactory.js
│   └── models/
│       └── index.js        # Elasticsearch client setup
└── mongodb/
    ├── factories/          # MongoDB implementations
    │   ├── activityLogFactory.js
    │   ├── applicationLogFactory.js
    │   ├── auditLogFactory.js
    │   ├── consoleLogFactory.js
    │   └── executionLogFactory.js
    └── models/            # Mongoose schemas
        ├── activityLog.js
        ├── applicationLog.js
        ├── auditLog.js
        ├── consoleLog.js
        ├── executionLog.js
        └── index.js       # MongoDB connection setup
```

### Database Selection

The database is selected at runtime based on configuration:

```javascript
// In controller
const config = require("../config.js");
const factory = require("../database/" + config.db_type_secondary + "/factories/logFactory");
```

**Configuration:**
```javascript
// config.js
const dbTypeSecondary = process.env.DATABASE_TYPE_SECONDARY || "elasticsearch";
```

### MongoDB Implementation

#### Connection Setup

```javascript
// database/mongodb/models/index.js
const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const db = {};
db.mongoose = mongoose;
db.url = "mongodb://" + dbConfig.username + ":" + dbConfig.password + 
         "@" + dbConfig.host + ":27017/" + dbConfig.database + 
         "?authSource=admin";

// Connection with retry
db.mongoose.connect(db.url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("Connected to the Mongo database!"))
.catch((err) => {
  console.log("Cannot connect to the Mongo database!", err);
  process.exit();
});
```

#### Schema Design

**Example: Application Log Schema**

```javascript
const schema = mongoose.Schema(
  {
    source: String,
    type: String,
    server: Object,
    message: String,
    details: String,
    file: String,
    line: Number,
    username: String,
  },
  {
    timestamps: {
      createdAt: "created_date",
      updatedAt: "modified_date",
    },
  }
);

// Custom toJSON to rename _id to id
schema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});

const ApplicationLog = mongoose.model("application_logs", schema);
```

**Key Design Decisions:**
- **Flexible Schema**: Uses `Object` type for nested documents (server, agent, environment)
- **Automatic Timestamps**: Mongoose manages `created_date` and `modified_date`
- **ID Transformation**: Converts `_id` to `id` for consistent API responses
- **Collection Names**: Match Elasticsearch index names for consistency

#### Factory Pattern Implementation

**MongoDB Factory Example:**

```javascript
const getByFilter = async (filters, sort = null, page = null, size = null) => {
  // Sort handling
  const sortCondition = sort
    ? { [sort.split(":")[0]]: sort.split(":")[1] === "asc" ? 1 : -1 }
    : { created_date: -1 }; // Default: newest first

  // Pagination
  const { limit, offset } = helpers.getPagination(page, size);
  
  // Query execution
  const logsData = ApplicationLog.find(filters || {})
    .limit(limit)
    .skip(offset)
    .sort(sortCondition);

  const totalItems = ApplicationLog.countDocuments(filters || {});

  // Execute in parallel
  const [data, count] = await Promise.all([logsData, totalItems]);

  return {
    data: data,
    pagination: {
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page ? +page : 1,
    },
  };
};
```

**Special Methods:**

Console Log Factory includes additional methods:
```javascript
// Find by execution ID and agent ID
const getLogByExecutionIdByAgentId = async (executionId, agentId) => {
  return await ConsoleLog.findOne({
    orchestration_execution_id: executionId,
    "agent.id": agentId,
  });
};

// Update log
const updateLog = async (consoleLogId, data) => {
  return await ConsoleLog.findByIdAndUpdate(
    consoleLogId,
    data,
    { new: true, runValidators: true }
  );
};
```

Execution Log Factory includes:
```javascript
// Get all logs for an execution
const getByExecutionId = async (executionId) => {
  return await ExecutionLog.find({
    orchestration_execution_id: executionId,
  });
};
```

### Elasticsearch Implementation

#### Client Setup

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

// Index creation on startup
const indices = ["activity_logs", "application_logs", "audit_logs", 
                 "console_logs", "execution_logs"];

indices.forEach(async (index) => {
  if (!(await elasticClient.indices.exists({ index }))) {
    await elasticClient.indices.create({ index });
  }
});
```

#### Query Building

**Complex Filter Extraction:**

```javascript
const extractFilters = (filters) => {
  let queryFilters = [];
  let rangeFilters = [];
  let termFilters = [];

  Object.keys(filters).forEach((key) => {
    if (typeof filters[key] === "object") {
      // Range query (gte, lte, gt, lt)
      if (filters[key]["gte"] || filters[key]["lte"]) {
        rangeFilters.push({ range: { [key]: filters[key] } });
      }
    } else if (Array.isArray(filters[key])) {
      // Terms query (multiple values)
      termFilters.push({ 
        terms: { [key]: filters[key].map(v => v.toLowerCase()) } 
      });
    } else {
      // Match query (single value)
      queryFilters.push({ match: { [key]: filters[key] } });
    }
  });

  // Build bool query
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

### Route Structure

```javascript
// routes/applicationLogRoutes.js
const router = express.Router();

router.get("/", applicationLogController.getLogs);
router.get("/:id", applicationLogController.getLog);
router.post("/", applicationLogController.createLog);

exports.routes = router;
```

### Controller Pattern

Controllers are thin layers that delegate to factories:

```javascript
const applicationLogController = {
  getLogs: async (req, res) => {
    const { page, size, filters, sort } = req.query;
    const logs = await applicationLogFactory.getByFilter(filters, sort, page, size);
    res.send(logs);
  },

  getLog: async (req, res) => {
    const log = await applicationLogFactory.getLogById(req.params.id);
    res.send(log);
  },

  createLog: async (req, res) => {
    const log = await applicationLogFactory.createLog(req.body);
    res.send(log);
  },
};
```

### Error Handling

Current implementation uses basic error handling. Production should include:
- Try-catch blocks in controllers
- Centralized error handler middleware
- Proper HTTP status codes
- Error logging

## Messaging Integration

### RabbitMQ Console Log Listener

```javascript
// messaging/rabbitmq/listenerConsoleLog.js

const listenToExchange = async (url, exchange) => {
  amqp.connect(url, (error0, connection) => {
    connection.createChannel((error1, channel) => {
      channel.assertExchange(exchange, "topic", { durable: false });
      
      channel.assertQueue("", { exclusive: true }, (error2, q) => {
        channel.bindQueue(q.queue, exchange, "#.consolelogs");
        
        channel.consume(q.queue, (message) => {
          let data = JSON.parse(message.content.toString());
          
          let consoleLog = {
            orchestration_execution_id: data.orchestration_execution_id,
            agent: { id: data.agent_id, name: data.agent_name },
            logs: [{ text: data.log_text }],
            // ... other fields
          };
          
          consoleLogFactory.createLog(consoleLog);
          channel.ack(message);
        });
      });
    });
  });
};
```

**Message Flow:**
1. External service publishes to `console_log_exchange`
2. Listener receives message on routing key `*.consolelogs`
3. Message parsed and transformed
4. ConsoleLog created via factory (database-agnostic)
5. Message acknowledged

**Retry Logic:**
```javascript
connection.on("close", () => {
  setTimeout(() => listenToExchange(url, exchange), 5000);
});
```

## Data Flow

### Write Operation Flow

```
Client Request (POST /logs/application)
         │
         ▼
   Express Middleware
         │
         ▼
    Body Parser
         │
         ▼
 Application Controller
         │
         ▼
Application Log Factory
         │
         ▼
   Database (MongoDB/ES)
         │
         ▼
    Response to Client
```

### Read Operation Flow

```
Client Request (GET /logs/application?filters={...})
         │
         ▼
    Query Parser
         │
         ▼
 Application Controller
         │
         ▼
Application Log Factory
         │
         ├─► Build Query
         ├─► Execute Query
         ├─► Count Total
         └─► Format Response
         │
         ▼
    Response to Client
    {
      data: [...],
      pagination: {...}
    }
```

### File Upload Flow

```
Client (Multipart Upload)
         │
         ▼
  Multer Middleware
         │
         ├─► Validate File
         └─► Store Temp File
         │
         ▼
Execution Log Controller
         │
         ├─► Create Directory
         ├─► Move File
         └─► Create Log Record
         │
         ▼
    Response to Client
```

## Database Comparison

### MongoDB vs Elasticsearch

#### Write Performance

**MongoDB:**
- Direct writes to collection
- No indexing delay
- Better for high-frequency writes
- No synchronization issues

**Elasticsearch:**
- Near real-time indexing (~1 second delay)
- Can have sync issues under heavy load
- Better for bulk operations

#### Read Performance

**MongoDB:**
- Fast for indexed queries
- Requires proper index design
- Aggregation framework available

**Elasticsearch:**
- Optimized for full-text search
- Better for complex text queries
- Built-in relevance scoring

#### Query Capabilities

**MongoDB:**
```javascript
// Range query
{ created_date: { $gte: startDate, $lte: endDate } }

// Nested field query
{ "agent.id": 1 }

// Array contains
{ logs: { $elemMatch: { text: /error/i } } }
```

**Elasticsearch:**
```javascript
// Range query
{ range: { created_date: { gte: startDate, lte: endDate } } }

// Nested query
{ match: { "agent.id": 1 } }

// Full-text search
{ match: { message: { query: "error", operator: "and" } } }
```

#### Operational Complexity

| Aspect | MongoDB | Elasticsearch |
|--------|---------|---------------|
| Setup | Simple | Moderate |
| Maintenance | Low | Moderate-High |
| Backup | Standard tools | Snapshot API |
| Monitoring | Standard tools | Built-in monitoring |
| Scaling | Sharding | Automatic |
| Resource Usage | Lower | Higher |

### When to Use Each

**Use MongoDB when:**
- High-frequency writes from multiple services
- Standard log storage and retrieval
- Lower operational complexity desired
- Cost optimization is priority
- ACID transactions needed

**Use Elasticsearch when:**
- Full-text search is critical
- Complex text analysis required
- Real-time search analytics needed
- Already using ELK stack
- Have dedicated DevOps resources

## Design Patterns

### 1. Factory Pattern

Each log type has a factory with standardized interface:
```javascript
{
  getByFilter: async (filters, sort, page, size) => {},
  getCountByFilter: async (filters) => {},
  getLogById: async (id) => {},
  createLog: async (data) => {}
}
```

**Benefits:**
- Consistent API across log types
- Easy to add new log types
- Testable in isolation

### 2. Strategy Pattern

Database selection is a runtime strategy:
```javascript
const factory = require("../database/" + config.db_type_secondary + "/factories/...");
```

**Benefits:**
- No code changes to switch databases
- Can run A/B tests
- Easy migration path

### 3. Repository Pattern

Factories act as repositories, abstracting data access:
- Controllers don't know about database implementation
- Business logic separated from data access
- Can add caching layer without changing controllers

### 4. Configuration Pattern

Centralized configuration management:
```javascript
// config.js loads from:
- config/*.json files
- Environment variables
- Defaults
```

## Performance Considerations

### MongoDB Optimization

#### Index Strategy

**Critical Indexes:**
```javascript
// Queries by time range
db.application_logs.createIndex({ created_date: -1 });

// Queries by source and type
db.application_logs.createIndex({ source: 1, type: 1 });

// Console log lookups
db.console_logs.createIndex({ orchestration_execution_id: 1 });
db.console_logs.createIndex({ "agent.id": 1 });
```

**Compound Indexes:**
```javascript
// For filtered and sorted queries
db.application_logs.createIndex({ 
  source: 1, 
  type: 1, 
  created_date: -1 
});
```

#### Query Optimization

**Efficient Pagination:**
```javascript
const { limit, offset } = getPagination(page, size);

// Execute count and query in parallel
const [data, totalItems] = await Promise.all([
  Model.find(conditions).limit(limit).skip(offset).sort(sortCondition),
  Model.countDocuments(conditions)
]);
```

**Projection (when needed):**
```javascript
// Return only required fields
Model.find(conditions, { message: 1, created_date: 1 });
```

#### Connection Pooling

```javascript
mongoose.connect(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,  // Max connections in pool
  minPoolSize: 5,   // Min connections in pool
});
```

### Elasticsearch Optimization

#### Bulk Operations

```javascript
// For high-volume inserts
const bulkBody = logs.flatMap(doc => [
  { index: { _index: 'application_logs' } },
  doc
]);

await elasticClient.bulk({ body: bulkBody });
```

#### Query Optimization

```javascript
// Use _source filtering
elasticClient.search({
  index: 'application_logs',
  _source: ['message', 'created_date'],
  body: { query: {...} }
});
```

### Application-Level Optimization

#### Caching Strategy (Future Enhancement)

```javascript
// Redis cache for frequently accessed logs
const getCachedLog = async (id) => {
  let cached = await redis.get(`log:${id}`);
  if (cached) return JSON.parse(cached);
  
  let log = await factory.getLogById(id);
  await redis.set(`log:${id}`, JSON.stringify(log), 'EX', 300);
  return log;
};
```

#### Request Batching (Future Enhancement)

```javascript
// Batch multiple create requests
const batchCreateLogs = async (logsArray) => {
  return await Model.insertMany(logsArray, { ordered: false });
};
```

## Migration Guide

### Migrating from Elasticsearch to MongoDB

#### Pre-Migration Checklist

1. **Backup Elasticsearch Data**
   ```bash
   curl -X PUT "localhost:9200/_snapshot/backup/snapshot_1?wait_for_completion=true"
   ```

2. **Setup MongoDB**
   - Install MongoDB
   - Create admin user
   - Create database and user with readWrite permissions

3. **Test MongoDB Configuration**
   ```bash
   # Update .env
   DATABASE_TYPE_SECONDARY=mongodb
   
   # Start service (test environment)
   npm start
   
   # Verify connection
   # Check logs for "Connected to the Mongo database!"
   ```

#### Migration Options

**Option 1: Fresh Start (No Data Migration)**
1. Switch configuration to MongoDB
2. Start logging to MongoDB
3. Keep Elasticsearch read-only for historical data
4. Archive Elasticsearch data after retention period

**Option 2: Full Migration**

Create migration script:

```javascript
// migrate.js
const elasticClient = require('./database/elasticsearch/models');
const db = require('./database/mongodb/models');

async function migrateCollection(collectionName) {
  console.log(`Migrating ${collectionName}...`);
  
  let scrollId;
  let count = 0;
  
  // Initial search with scroll
  let response = await elasticClient.search({
    index: collectionName,
    scroll: '5m',
    size: 1000,
    body: { query: { match_all: {} } }
  });
  
  scrollId = response._scroll_id;
  
  while (response.hits.hits.length > 0) {
    // Transform and insert documents
    const documents = response.hits.hits.map(hit => {
      const doc = hit._source;
      // Transform if needed
      return doc;
    });
    
    // Bulk insert to MongoDB
    const Model = db[collectionName.replace('_logs', 'Log')];
    await Model.insertMany(documents, { ordered: false });
    
    count += documents.length;
    console.log(`Migrated ${count} documents...`);
    
    // Get next batch
    response = await elasticClient.scroll({
      scroll_id: scrollId,
      scroll: '5m'
    });
  }
  
  console.log(`Completed: ${count} documents migrated`);
}

async function migrate() {
  await db.mongoose.connect(db.url);
  
  const collections = [
    'activity_logs',
    'application_logs', 
    'audit_logs',
    'console_logs',
    'execution_logs'
  ];
  
  for (const collection of collections) {
    await migrateCollection(collection);
  }
  
  console.log('Migration completed!');
  process.exit(0);
}

migrate().catch(console.error);
```

**Run Migration:**
```bash
node migrate.js
```

#### Post-Migration Steps

1. **Create Indexes**
   ```javascript
   // Run index creation script
   node scripts/createIndexes.js
   ```

2. **Verify Data Integrity**
   ```javascript
   // Compare counts
   db.application_logs.countDocuments();
   // vs Elasticsearch count
   ```

3. **Update Configuration**
   ```env
   DATABASE_TYPE_SECONDARY=mongodb
   ```

4. **Monitor Performance**
   - Check query response times
   - Monitor memory usage
   - Verify write throughput

5. **Decommission Elasticsearch** (after validation)
   - Stop Elasticsearch service
   - Archive data if needed
   - Remove from infrastructure

### Rollback Plan

If issues arise:

1. **Immediate Rollback**
   ```env
   DATABASE_TYPE_SECONDARY=elasticsearch
   ```
   Restart service - takes effect immediately

2. **Data Sync** (if MongoDB has new data)
   - Export new MongoDB logs
   - Import to Elasticsearch
   - Switch configuration back

## Future Enhancements

### High Priority

#### 1. Advanced Filtering for MongoDB

Implement filter extraction similar to Elasticsearch:

```javascript
const extractFilters = (filters) => {
  const mongoQuery = {};
  
  Object.keys(filters).forEach(key => {
    if (typeof filters[key] === 'object' && !Array.isArray(filters[key])) {
      // Range query
      if (filters[key].gte || filters[key].lte) {
        mongoQuery[key] = {};
        if (filters[key].gte) mongoQuery[key].$gte = filters[key].gte;
        if (filters[key].lte) mongoQuery[key].$lte = filters[key].lte;
      }
    } else if (Array.isArray(filters[key])) {
      // Array filter (IN query)
      mongoQuery[key] = { $in: filters[key] };
    } else {
      // Exact match
      mongoQuery[key] = filters[key];
    }
  });
  
  return mongoQuery;
};
```

#### 2. Data Retention Policies

```javascript
// Automatic cleanup with TTL indexes
db.application_logs.createIndex(
  { created_date: 1 },
  { expireAfterSeconds: 7776000 } // 90 days
);

// Or cron-based cleanup
const cleanupOldLogs = async () => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  
  await ApplicationLog.deleteMany({
    created_date: { $lt: cutoffDate }
  });
};
```

#### 3. Connection Retry Logic

```javascript
// database/mongodb/models/index.js
const connectWithRetry = () => {
  mongoose.connect(db.url, options)
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => {
      console.error("MongoDB connection failed, retrying in 5s...", err);
      setTimeout(connectWithRetry, 5000);
    });
};

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected, attempting to reconnect...');
  setTimeout(connectWithRetry, 5000);
});
```

### Medium Priority

#### 4. Bulk Operations

```javascript
const bulkCreateLogs = async (logsArray) => {
  return await ApplicationLog.insertMany(logsArray, { 
    ordered: false,  // Continue on error
    rawResult: true  // Return detailed results
  });
};
```

#### 5. Aggregation Support

```javascript
const getLogStatistics = async (groupBy = 'type') => {
  return await ApplicationLog.aggregate([
    {
      $group: {
        _id: `$${groupBy}`,
        count: { $sum: 1 },
        latestLog: { $max: '$created_date' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};
```

#### 6. Full-Text Search (MongoDB)

```javascript
// Add text index
schema.index({ message: 'text', details: 'text' });

// Search method
const searchLogs = async (searchText) => {
  return await ApplicationLog.find(
    { $text: { $search: searchText } },
    { score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } });
};
```

### Low Priority

#### 7. Caching Layer

```javascript
// Using Redis
const getCachedLogs = async (filters, page, size) => {
  const cacheKey = `logs:${JSON.stringify({filters, page, size})}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) return JSON.parse(cached);
  
  const logs = await factory.getByFilter(filters, null, page, size);
  await redis.setex(cacheKey, 300, JSON.stringify(logs));
  
  return logs;
};
```

#### 8. Authentication & Authorization

```javascript
// JWT middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Apply to routes
router.get("/", authenticateToken, controller.getLogs);
```

#### 9. Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/logs/', limiter);
```

#### 10. Monitoring & Metrics

```javascript
// Prometheus metrics
const promClient = require('prom-client');

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

// Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.path, res.statusCode).observe(duration);
  });
  next();
});
```

## Testing Strategy

### Unit Tests

```javascript
// Test factory methods
describe('ApplicationLogFactory', () => {
  it('should create a log', async () => {
    const data = { source: 'TEST', type: 'INFO', message: 'Test' };
    const log = await factory.createLog(data);
    expect(log).toHaveProperty('id');
    expect(log.source).toBe('TEST');
  });

  it('should filter logs by source', async () => {
    const result = await factory.getByFilter({ source: 'TEST' });
    expect(result.data).toBeInstanceOf(Array);
    expect(result.pagination).toHaveProperty('totalItems');
  });
});
```

### Integration Tests

```javascript
// Test API endpoints
describe('Application Log API', () => {
  it('POST /logs/application should create a log', async () => {
    const response = await request(app)
      .post('/logs/application')
      .send({ source: 'TEST', type: 'INFO', message: 'Test' })
      .expect(200);
    
    expect(response.body).toHaveProperty('id');
  });
});
```

### Load Tests

```javascript
// Using Artillery
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: 'Create logs'
    flow:
      - post:
          url: '/logs/application'
          json:
            source: 'LoadTest'
            type: 'INFO'
            message: 'Test log'
```

## Security Best Practices

### 1. Input Validation

```javascript
const { body, query, validationResult } = require('express-validator');

router.post('/', [
  body('source').isString().trim().notEmpty(),
  body('type').isIn(['INFO', 'WARN', 'ERROR', 'DEBUG']),
  body('message').isString().trim().notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Process request
});
```

### 2. SQL/NoSQL Injection Prevention

MongoDB automatically escapes queries, but validate input:
```javascript
// Avoid
const query = { $where: userInput };  // DANGEROUS

// Use
const query = { source: sanitize(userInput) };
```

### 3. Rate Limiting

Protect against abuse:
```javascript
const rateLimit = require('express-rate-limit');

const createLogLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: 'Too many log creation requests'
});

router.post('/', createLogLimiter, controller.createLog);
```

### 4. HTTPS/TLS

```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(443);
```

### 5. Environment Variables

Never commit credentials:
```javascript
// Use .env file (add to .gitignore)
DATABASE_PASSWORD=secret123

// Access in code
const password = process.env.DATABASE_PASSWORD;
```

## Conclusion

The LoggerService architecture is designed for:
- **Flexibility**: Easy database switching
- **Scalability**: Handles high-volume logging
- **Maintainability**: Clean separation of concerns
- **Extensibility**: Simple to add new log types

The MongoDB integration provides a production-ready solution for high-frequency logging scenarios with better write performance and lower operational complexity compared to Elasticsearch.
