# MongoDB Support for GeneralManagement Service

## Overview
The GeneralManagement service now supports both **Elasticsearch** and **MongoDB** as secondary databases without breaking functionality. You can switch between them using environment variables.

## Switching Between Databases

### Using Environment Variables
Set the `DATABASE_TYPE_SECONDARY` environment variable:

```bash
# For Elasticsearch
DATABASE_TYPE_SECONDARY=elasticsearch

# For MongoDB
DATABASE_TYPE_SECONDARY=mongodb
```

### In .env file
```env
NODE_ENV=local
DATABASE_TYPE_PRIMARY=mysql
DATABASE_TYPE_SECONDARY=mongodb
```

## Database Configuration

Configuration is managed in `configs/database.json`:

### MongoDB Configuration
```json
{
  "mongodb": {
    "local": {
      "username": "mongoadmin",
      "password": "1secure*password1",
      "database": "cyfast_general",
      "host": "127.0.0.1"
    },
    "staging": {
      "username": "mongoadmin",
      "password": "1secure*password1",
      "database": "cyfast_general",
      "host": "host.docker.internal"
    },
    "production": {
      "username": "mongoadmin",
      "password": "1secure*password1",
      "database": "cyfast_general",
      "host": "20.204.6.69"
    }
  }
}
```

## MongoDB Collections

The following collections are used:
- `report_design_templates` - Store design templates for reports
- `report_templates` - Store report template configurations
- `report_sections` - Store report section definitions

## Supported Operations

Both Elasticsearch and MongoDB implementations support the same API:

### Design Template Factory
- `getByFilter(filters, sort, page, size)` - Get templates with filters and pagination
- `getCountByFilter(filters)` - Get count of templates matching filters
- `getById(id)` - Get template by ID
- `getByOriginalName(originalname)` - Get templates by original filename
- `create(data)` - Create new template
- `remove(id)` - Delete template

### Report Template Factory
- `getByFilter(filters, sort, page, size)` - Get templates with filters and pagination
- `getCountByFilter(filters)` - Get count of templates matching filters
- `getById(id)` - Get template by ID
- `create(data)` - Create new template
- `update(id, data)` - Update existing template
- `remove(id)` - Delete template
- `setDefault(id, templates)` - Set a template as default
- `getDefaultTemplate(reportType)` - Get default template for a report type

### Report Section Factory
- `getByFilter(filters, sort, page, size)` - Get sections with filters and pagination
- `getCountByFilter(filters)` - Get count of sections matching filters
- `getById(id)` - Get section by ID
- `getByIds(ids)` - Get multiple sections by IDs
- `create(data)` - Create new section
- `update(id, data)` - Update existing section
- `remove(id)` - Delete section

## Filter Support

Both implementations support the same filter types:

### Exact Match
```javascript
{ field: "value" }
```

### Array/IN Query
```javascript
{ field: ["value1", "value2"] }
```

### Range Queries
```javascript
{
  field: {
    gte: "2024-01-01",  // Greater than or equal
    lte: "2024-12-31",  // Less than or equal
    gt: 100,            // Greater than
    lt: 200             // Less than
  }
}
```

## Sort Support

```javascript
// Ascending
{ field: "asc" }

// Descending
{ field: "desc" }
```

## Implementation Details

### MongoDB Implementation
- Uses **Mongoose** ODM for schema management
- Automatic timestamp handling (created_date, modified_date)
- Connection established in `models/index.js`
- Auto-reconnect and error handling built-in

### Elasticsearch Implementation
- Uses **@elastic/elasticsearch** client
- Indices created automatically on startup
- Full-text search capabilities
- Complex filtering with bool queries

## Testing

To test the MongoDB implementation:

1. Ensure MongoDB is running:
```bash
# Check if MongoDB is accessible
mongosh mongodb://mongoadmin:1secure*password1@127.0.0.1:27017/cyfast_general?authSource=admin
```

2. Set environment variable:
```bash
DATABASE_TYPE_SECONDARY=mongodb
```

3. Start the service:
```bash
npm start
```

4. Check logs for successful connection:
```
Connecting to MongoDB...
Connected to MongoDB successfully!
```

## Troubleshooting

### MongoDB Connection Issues
- Verify MongoDB is running on the configured host and port
- Check credentials in `configs/database.json`
- Ensure the database exists or user has permission to create it
- Check firewall rules allow connections on port 27017

### Elasticsearch Connection Issues
- Verify Elasticsearch is running on the configured host and port
- Check credentials in `configs/database.json`
- Ensure indices are created (check startup logs)
- Verify port 9200 is accessible

## Migration Notes

When switching from Elasticsearch to MongoDB (or vice versa):
- Data is **not automatically migrated**
- You may need to export/import data manually
- Ensure all required fields are present in both systems
- Test thoroughly before deploying to production
