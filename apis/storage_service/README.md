# Storage Service

A Fastify-based file storage service that provides Azure Blob Storage-like functionality.

## Features

- ✅ Upload single or multiple files
- ✅ Partition-based organization (similar to Azure containers)
- ✅ Folder path support within partitions
- ✅ HTTP-accessible files via static URLs
- ✅ File metadata storage in MongoDB
- ✅ Soft and hard delete operations
- ✅ File search and filtering
- ✅ Storage statistics
- ✅ Comprehensive logging with Pino
- ✅ Error handling and validation

## Architecture

```
storage/
├── partition_key_1/
│   ├── folder1/
│   │   └── file1.jpg
│   └── folder2/
│       └── file2.pdf
└── partition_key_2/
    └── file3.png
```

## Installation

```bash
cd StorageService
npm install
```

## Configuration

Edit `.env` file:

```env
NODE_ENV=local
PORT=3005
HOST=localhost
LOG_LEVEL=info
```

Edit `configs/database.json` for MongoDB settings.

## Running the Service

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### 1. Upload File(s)

**POST** `/storage/upload`

Upload single or multiple files with partition and folder organization.

**Request (multipart/form-data):**
- `file` or `files[]` - File(s) to upload
- `partition_key` - Partition/container name (default: "default")
- `folder_path` - Folder path within partition (optional)
- `uploaded_by` - User identifier (optional)

**Example with cURL:**
```bash
# Single file
curl -X POST http://localhost:3005/storage/upload \
  -F "file=@document.pdf" \
  -F "partition_key=project-123" \
  -F "folder_path=documents/reports"

# Multiple files
curl -X POST http://localhost:3005/storage/upload \
  -F "files=@file1.jpg" \
  -F "files=@file2.png" \
  -F "partition_key=images" \
  -F "folder_path=gallery"
```

**Response:**
```json
{
  "success": true,
  "message": "1 file(s) uploaded successfully",
  "data": [{
    "file_id": "uuid-here",
    "partition_key": "project-123",
    "folder_path": "documents/reports",
    "original_filename": "document.pdf",
    "stored_filename": "uuid.pdf",
    "file_url": "http://localhost:3005/files/project-123/documents/reports/uuid.pdf",
    "file_path": "./storage/project-123/documents/reports/uuid.pdf",
    "mime_type": "application/pdf",
    "file_size": 102400,
    "created_at": "2026-02-18T10:30:00.000Z"
  }],
  "urls": ["http://localhost:3005/files/project-123/documents/reports/uuid.pdf"],
  "paths": ["./storage/project-123/documents/reports/uuid.pdf"]
}
```

### 2. List Files

**GET** `/storage/list?partition_key=<key>&folder_path=<path>&page=1&limit=50`

List files in a partition with optional folder filtering.

**Query Parameters:**
- `partition_key` (required) - Partition to list files from
- `folder_path` (optional) - Filter by folder path
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 50) - Items per page

**Example:**
```bash
curl "http://localhost:3005/storage/list?partition_key=project-123&folder_path=documents"
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

### 3. Get File Metadata

**GET** `/storage/files/:fileId`

Get file metadata by file ID.

**Example:**
```bash
curl http://localhost:3005/storage/files/uuid-here
```

**Response:**
```json
{
  "success": true,
  "data": {
    "file_id": "uuid-here",
    "partition_key": "project-123",
    "original_filename": "document.pdf",
    "file_url": "http://localhost:3005/files/...",
    ...
  }
}
```

### 4. Access File (HTTP)

**GET** `/files/:partition_key/:folder_path?/:filename`

Direct HTTP access to files (served as static content).

**Example:**
```bash
# Open in browser or download
http://localhost:3005/files/project-123/documents/reports/uuid.pdf
```

### 5. Delete File

**DELETE** `/storage/files/:fileId?hard_delete=false`

Delete a file by ID.

**Query Parameters:**
- `hard_delete` (optional, default: false) - If true, permanently deletes file and metadata

**Example:**
```bash
# Soft delete (marks as deleted)
curl -X DELETE http://localhost:3005/storage/files/uuid-here

# Hard delete (removes file from disk)
curl -X DELETE "http://localhost:3005/storage/files/uuid-here?hard_delete=true"
```

**Response:**
```json
{
  "success": true,
  "message": "File marked as deleted",
  "fileId": "uuid-here"
}
```

### 6. Bulk Delete

**DELETE** `/storage/delete`

Delete multiple files at once.

**Request Body:**
```json
{
  "file_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "hard_delete": false
}
```

**Example:**
```bash
curl -X DELETE http://localhost:3005/storage/delete \
  -H "Content-Type: application/json" \
  -d '{"file_ids": ["uuid-1", "uuid-2"], "hard_delete": true}'
```

**Response:**
```json
{
  "success": true,
  "success": [
    {"success": true, "message": "File deleted permanently", "fileId": "uuid-1"}
  ],
  "failed": []
}
```

### 7. Search Files

**POST** `/storage/search`

Search files by metadata criteria.

**Request Body:**
```json
{
  "partition_key": "project-123",
  "mime_type": "application/pdf",
  "original_filename": {"$regex": ".pdf$"}
}
```

**Example:**
```bash
curl -X POST http://localhost:3005/storage/search \
  -H "Content-Type: application/json" \
  -d '{"partition_key": "project-123", "mime_type": "image/jpeg"}'
```

### 8. Storage Statistics

**GET** `/storage/stats?partition_key=<key>`

Get storage usage statistics.

**Example:**
```bash
curl "http://localhost:3005/storage/stats?partition_key=project-123"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "project-123",
    "total_files": 150,
    "total_size": 52428800
  }
}
```

### 9. Health Check

**GET** `/health`

Check service health.

**Example:**
```bash
curl http://localhost:3005/health
```

**Response:**
```json
{
  "success": true,
  "message": "Storage service is running",
  "timestamp": "2026-02-18T10:30:00.000Z"
}
```

## File Organization

Files are organized in the following structure:

```
storage/
├── partition_key/
│   ├── folder_path/
│   │   └── uuid.extension
│   └── uuid.extension
```

- **Partition Key**: Top-level organization (similar to Azure containers)
- **Folder Path**: Optional subdirectory structure
- **UUID Filename**: Unique identifier to prevent conflicts

## MongoDB Schema

```javascript
{
  file_id: String (UUID),
  partition_key: String (indexed),
  folder_path: String,
  original_filename: String,
  stored_filename: String,
  file_path: String,
  file_url: String,
  mime_type: String,
  file_size: Number,
  encoding: String,
  metadata: Object,
  is_deleted: Boolean,
  deleted_at: Date,
  uploaded_by: String,
  created_at: Date,
  updated_at: Date
}
```

## Error Handling

All endpoints return structured error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created (file uploaded)
- `400` - Bad Request (validation error)
- `404` - Not Found
- `500` - Internal Server Error

## Logging

The service uses Pino logger with pretty printing:

- Request/Response logging
- Error tracking with stack traces
- File operation logging
- Performance metrics

Logs include:
- Request ID for tracing
- HTTP method and URL
- User actions
- File operations
- Error details

## Security Considerations

For production:

1. **Authentication**: Add JWT or API key middleware
2. **Authorization**: Implement role-based access control
3. **File Validation**: 
   - Validate MIME types
   - Scan for malware
   - Limit file sizes per user
4. **CORS**: Restrict origins in production
5. **Rate Limiting**: Add rate limiting middleware
6. **Encryption**: Encrypt sensitive files at rest
7. **HTTPS**: Use HTTPS in production

## Comparison with Azure Blob Storage

| Feature | Azure Blob Storage | This Service |
|---------|-------------------|--------------|
| Containers | ✅ | ✅ (Partition Keys) |
| Blob Types | Block, Page, Append | Single type |
| HTTP Access | ✅ | ✅ |
| Metadata | ✅ | ✅ (MongoDB) |
| Soft Delete | ✅ | ✅ |
| Versioning | ✅ | ❌ (can be added) |
| Tiered Storage | ✅ | ❌ |
| CDN Integration | ✅ | Manual |

## Environment Variables

```env
NODE_ENV=local|staging|production
PORT=3005
HOST=localhost
LOG_LEVEL=info|debug|warn|error
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run tests (add tests as needed)
npm test
```

## Docker Support

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p storage

EXPOSE 3005

CMD ["node", "index.js"]
```

## License

ISC
