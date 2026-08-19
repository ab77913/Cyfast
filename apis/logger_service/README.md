# LoggerService

A high-performance, scalable logging service for distributed systems that supports multiple database backends (MongoDB and Elasticsearch) and handles activity, application, audit, console, and execution logs.

## Features

- **Multiple Log Types**: Activity, Application, Audit, Console, and Execution logs
- **Dual Database Support**: MongoDB and Elasticsearch with seamless switching
- **Message Queue Integration**: RabbitMQ support for real-time console log ingestion
- **RESTful API**: Complete REST API for log management
- **File Upload Support**: Handle execution log file uploads (HTML, XML, images)
- **Flexible Querying**: Filtering, sorting, and pagination support
- **Hot-Swappable Database**: Switch databases via configuration without code changes

## Quick Start

### Prerequisites

- Node.js 18 or higher
- MongoDB or Elasticsearch
- RabbitMQ (optional, for console log streaming)

### Installation

```bash
# Clone the repository
cd LoggerService

# Install dependencies
npm install
```

### Configuration

1. **Copy environment template** (if exists) or create `.env` file:
```env
NODE_ENV=local
DATABASE_TYPE_SECONDARY=mongodb
MESSAGING_TYPE=rabbitmq
```

2. **Update database configuration** in `config/database.json`:
```json
{
  "mongodb": {
    "local": {
      "username": "mongoadmin",
      "password": "your-password",
      "database": "cyfastlogsdb",
      "host": "127.0.0.1"
    }
  }
}
```

3. **Update messaging configuration** in `config/messaging.json` (if using RabbitMQ)

### Running the Service

```bash
# Development mode (with auto-reload)
npm start

# Production mode
node index.js
```

The service will start on the configured port (default: 3000) and log connection status:
```
Environment- local
Database- mongodb
Messaging- rabbitmq
MongoDB URL- mongodb://mongoadmin:****@127.0.0.1:27017/cyfastlogsdb?authSource=admin
Connected to the Mongo database!
RabbitMQ connected!
app listening on url http://localhost:3000
```

## Database Setup

### MongoDB (Recommended)

**Why MongoDB?**
- Better handling of concurrent writes from multiple services
- No synchronization issues during high-volume logging
- Simpler setup and lower resource requirements
- Standard backup and recovery tools

**Using Docker:**
```bash
docker run -d --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=mongoadmin \
  -e MONGO_INITDB_ROOT_PASSWORD=1secure*password1 \
  mongo:latest
```

**Manual Installation:**
- Follow [MongoDB installation guide](https://docs.mongodb.com/manual/installation/)
- Create admin user with readWrite permissions
- Update `config/database.json` with credentials

### Elasticsearch (Alternative)

**Using Docker:**
```bash
docker run -d --name elasticsearch \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=true" \
  -e "ELASTIC_PASSWORD=elastic" \
  docker.elastic.co/elasticsearch/elasticsearch:8.7.0
```

**Switching to Elasticsearch:**
```env
DATABASE_TYPE_SECONDARY=elasticsearch
```

## API Endpoints

### Activity Logs
```bash
# Get all activity logs
GET /logs/activity?page=1&size=10

# Get specific activity log
GET /logs/activity/:id

# Create activity log
POST /logs/activity
Content-Type: application/json
{
  "source": "UserService",
  "group": "Authentication",
  "type": "LOGIN",
  "message": "User logged in successfully",
  "username": "john.doe"
}
```

### Application Logs
```bash
# Get all application logs
GET /logs/application?page=1&size=10&filters={"type":"ERROR"}

# Get specific application log
GET /logs/application/:id

# Create application log
POST /logs/application
Content-Type: application/json
{
  "source": "API",
  "type": "ERROR",
  "message": "Database connection failed",
  "details": "Connection timeout after 5000ms",
  "file": "db.js",
  "line": 45
}
```

### Audit Logs
```bash
# Get all audit logs
GET /logs/audit?page=1&size=10

# Get specific audit log
GET /logs/audit/:id

# Create audit log
POST /logs/audit
Content-Type: application/json
{
  "source": "AdminPanel",
  "group": "UserManagement",
  "type": "UPDATE",
  "message": "User role updated",
  "old_value": {"role": "user"},
  "new_value": {"role": "admin"},
  "username": "admin"
}
```

### Console Logs
```bash
# Get console logs (supports format: merged, merged_agentwise, separate)
GET /logs/console?page=1&size=10&format=separate

# Get specific console log
GET /logs/console/:id

# Create console log
POST /logs/console
Content-Type: application/json
{
  "orchestration_execution_id": "exec-123",
  "agent": {"id": 1, "name": "Agent-1"},
  "project_id": 100,
  "logs": [{"text": "Test started", "generated_time": "2026-02-03T10:00:00Z"}]
}

# Publish console log to RabbitMQ
POST /logs/console/publish
```

### Execution Logs
```bash
# Get execution logs
GET /logs/execution?page=1&size=10

# Get logs by execution ID
GET /logs/execution/orchestration/:execution_id

# Upload execution log file
POST /logs/execution/upload
Content-Type: multipart/form-data
{
  "file": <binary>,
  "orchestration_execution_id": "exec-123",
  "project_id": 100,
  "agent_id": 1,
  "agent_name": "Agent-1"
}

# Get execution report
GET /logs/execution/orchestration/:execution_id/report/:report_file

# Download execution reports (zip)
GET /logs/execution/orchestration/:execution_id/download
```

## Query Parameters

### Filtering
```javascript
// Simple filter
?filters={"source":"API","type":"ERROR"}

// Nested object filter
?filters={"agent.id":1}
```

### Sorting
```javascript
// Descending (default)
?sort=created_date:desc

// Ascending
?sort=created_date:asc
```

### Pagination
```javascript
?page=1&size=20
```

### Combined Example
```bash
GET /logs/application?filters={"source":"API","type":"ERROR"}&sort=created_date:desc&page=1&size=10
```

## Data Models

### Activity Log
```javascript
{
  source: String,           // Service/module that generated the log
  group: String,            // Logical grouping (e.g., Authentication)
  type: String,             // Action type (e.g., LOGIN, LOGOUT)
  server: Object,           // Server information
  message: String,          // Human-readable message
  details: String,          // Additional details
  username: String,         // User who performed the action
  created_date: Date,       // Auto-generated
  modified_date: Date       // Auto-updated
}
```

### Application Log
```javascript
{
  source: String,           // Application/service name
  type: String,             // Log level (INFO, WARN, ERROR, DEBUG)
  server: Object,           // Server information
  message: String,          // Log message
  details: String,          // Stack trace or additional info
  file: String,             // Source file
  line: Number,             // Line number
  username: String,         // Associated user (optional)
  created_date: Date,
  modified_date: Date
}
```

### Audit Log
```javascript
{
  source: String,           // Service that generated the audit
  group: String,            // Category (e.g., UserManagement)
  type: String,             // Operation (CREATE, UPDATE, DELETE)
  server: Object,           // Server information
  message: String,          // Audit message
  old_value: Object,        // Previous state
  new_value: Object,        // New state
  username: String,         // User who made the change
  created_date: Date,
  modified_date: Date
}
```

### Console Log
```javascript
{
  test_execution_id: Number,
  orchestration_execution_id: String,  // Unique execution identifier
  agent: Object,                       // {id, name, type}
  environment: Object,                 // {id, name}
  project_id: Number,
  orchestration_id: Number,
  logs: Array,                         // [{text, generated_time}]
  details: String,
  username: String,
  created_date: Date,
  modified_date: Date
}
```

### Execution Log
```javascript
{
  project_id: Number,
  orchestration_id: Number,
  orchestration_execution_id: String,
  agent: Object,                       // {id, name}
  file_name: String,                   // Uploaded file name
  mime_type: String,                   // File MIME type
  file_extension: String,              // .html, .xml, .jpg, etc.
  format: String,                      // File format
  source_file_path: String,            // Storage path
  log_content: String,                 // File content (optional)
  username: String,
  created_date: Date,
  modified_date: Date
}
```

## Storage

### File Storage
Execution logs and reports are stored in the `storage/execution_logs/` directory, organized by `orchestration_execution_id`.

**Configuration** in `config/storage.json`:
```json
{
  "local": {
    "dir_path": "./storage/execution_logs"
  }
}
```

**Environment Variable Override:**
```env
STORAGE_DIR_PATH=/custom/path/to/storage
```

## RabbitMQ Integration

The service listens to RabbitMQ for real-time console log ingestion.

### Configuration

Update `config/messaging.json`:
```json
{
  "rabbitmq": {
    "local": {
      "host": "localhost",
      "port": "5672"
    }
  }
}
```

### Message Format

Publish console logs to exchange `console_log_exchange` with routing key `*.consolelogs`:

```json
{
  "orchestration_execution_id": "exec-123",
  "agent_id": 1,
  "agent_name": "Agent-1",
  "agent_type": "selenium",
  "environment_id": 1,
  "environment_name": "Production",
  "project_id": 100,
  "orchestration_id": 50,
  "user_id": "john.doe",
  "log_text": "Test execution started",
  "log_generated_time": "2026-02-03T10:00:00Z"
}
```

## Environment Variables

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `NODE_ENV` | Environment mode | `local` | `local`, `staging`, `production` |
| `DATABASE_TYPE_SECONDARY` | Database backend | `elasticsearch` | `mongodb`, `elasticsearch` |
| `MESSAGING_TYPE` | Message queue type | `rabbitmq` | `rabbitmq` |
| `STORAGE_DIR_PATH` | File storage path | `./storage/execution_logs` | Any valid path |
| `MAX_GET_SIZE` | Max GET request size | `2MB` | Any valid size |
| `MAX_POST_SIZE` | Max POST request size | `8MB` | Any valid size |

## Performance Optimization

### MongoDB Indexes

For optimal query performance, create indexes:

```javascript
// Activity Logs
db.activity_logs.createIndex({ created_date: -1 });
db.activity_logs.createIndex({ source: 1, type: 1 });
db.activity_logs.createIndex({ username: 1 });

// Application Logs
db.application_logs.createIndex({ created_date: -1 });
db.application_logs.createIndex({ source: 1, type: 1 });

// Audit Logs
db.audit_logs.createIndex({ created_date: -1 });
db.audit_logs.createIndex({ username: 1 });

// Console Logs
db.console_logs.createIndex({ orchestration_execution_id: 1 });
db.console_logs.createIndex({ "agent.id": 1 });
db.console_logs.createIndex({ created_date: -1 });

// Execution Logs
db.execution_logs.createIndex({ orchestration_execution_id: 1 });
db.execution_logs.createIndex({ created_date: -1 });
```

### Data Retention

Implement TTL indexes for automatic cleanup:

```javascript
// Delete logs older than 90 days
db.application_logs.createIndex(
  { "created_date": 1 }, 
  { expireAfterSeconds: 7776000 }
);
```

## Monitoring

### Health Check

```bash
GET /logs
```

Returns basic service information.

### Database Connection Status

Check startup logs:
```
Connected to the Mongo database!
# or
Elasticsearch cluster is up!
```

### Collection Statistics (MongoDB)

```bash
mongo mongodb://mongoadmin:password@localhost:27017/cyfastlogsdb?authSource=admin

use cyfastlogsdb
db.stats()
db.application_logs.stats()
```

## Troubleshooting

### Database Connection Issues

**MongoDB:**
```bash
# Test connection
mongo mongodb://mongoadmin:password@localhost:27017/admin

# Check if service is running
docker ps | grep mongodb
# or
systemctl status mongod
```

**Elasticsearch:**
```bash
# Test connection
curl http://localhost:9200 -u elastic:password

# Check cluster health
curl http://localhost:9200/_cluster/health -u elastic:password
```

### Common Errors

**"Cannot connect to the Mongo database!"**
- Verify MongoDB is running
- Check credentials in `config/database.json`
- Verify network connectivity and firewall rules

**"RabbitMQ connection failed"**
- Verify RabbitMQ is running
- Check host and port in `config/messaging.json`
- Verify network connectivity

**File upload fails**
- Check `STORAGE_DIR_PATH` has write permissions
- Verify disk space availability
- Check `MAX_POST_SIZE` configuration

## Development

### Project Structure

```
LoggerService/
├── config/                 # Configuration files
│   ├── app.json
│   ├── database.json
│   ├── messaging.json
│   └── storage.json
├── controllers/            # Request handlers
├── database/              # Database implementations
│   ├── elasticsearch/
│   │   ├── factories/     # Data access layer
│   │   └── models/        # Connection setup
│   └── mongodb/
│       ├── factories/     # Data access layer
│       └── models/        # Mongoose schemas
├── helpers/               # Utility functions
├── messaging/             # Message queue integrations
│   └── rabbitmq/
├── middlewares/           # Express middlewares
├── routes/                # API routes
├── storage/               # File storage
│   └── execution_logs/
├── config.js              # Config loader
├── index.js               # Application entry point
└── package.json
```

### Adding New Log Types

1. Create model in `database/mongodb/models/` and `database/elasticsearch/models/`
2. Create factory in `database/mongodb/factories/` and `database/elasticsearch/factories/`
3. Create controller in `controllers/`
4. Create routes in `routes/`
5. Register routes in `index.js`

## Docker Deployment

### Docker Compose Example

```yaml
version: '3.8'
services:
  logger-service:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_TYPE_SECONDARY=mongodb
    depends_on:
      - mongodb
      - rabbitmq
  
  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=mongoadmin
      - MONGO_INITDB_ROOT_PASSWORD=1secure*password1
    volumes:
      - mongodb_data:/data/db
  
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"

volumes:
  mongodb_data:
```

## Testing

### Basic API Test

```bash
# Create a test log
curl -X POST http://localhost:3000/logs/application \
  -H "Content-Type: application/json" \
  -d '{
    "source": "TEST",
    "type": "INFO",
    "message": "Test log entry",
    "details": "Testing the logging service"
  }'

# Retrieve the log
curl http://localhost:3000/logs/application?filters={"source":"TEST"}
```

### Load Testing

Use tools like Apache Bench or Artillery for load testing:
```bash
ab -n 1000 -c 10 -p test-data.json -T application/json http://localhost:3000/logs/application
```

## Security Considerations

1. **Authentication**: Add authentication middleware for production use
2. **Authorization**: Implement role-based access control
3. **Database Credentials**: Use environment variables or secrets management
4. **Network Security**: Restrict database access to application servers only
5. **Input Validation**: Validate all input data before processing
6. **CORS**: Configure CORS properly (currently allows all origins)

## License

ISC

## Support

For issues, feature requests, or questions, please refer to the ARCHITECTURE.md document for technical details.
