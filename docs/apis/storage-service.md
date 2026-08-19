# Storage Service API

**Base URL:** configured `config.url` (default local port **8092**).  
**Runtime:** Fastify.

There is no global `/api` prefix. Static binaries are exposed under **`/files/`**.

## OpenAPI / Swagger

- **UI:** `{baseUrl}/api-docs` (e.g. `http://localhost:8092/api-docs`).
- **Spec:** `{baseUrl}/api-docs/json` or `{baseUrl}/api-docs/yaml`.
- **In repo:** `apis/storage_service/swagger/openapi-config.js`; Swagger plugins are registered in `registerPlugins()` in `index.js`.

## HTTP endpoints

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/health` | Health |
| `POST` | `/storage/upload` | Multipart upload; `partition_key`, `folder_path`, `uploaded_by` (or header `x-user-id`) |
| `GET` | `/storage/list` | Query: `partition_key` (required), `folder_path`, `page`, `limit` |
| `GET` | `/storage/files/:fileId` | Metadata |
| `DELETE` | `/storage/files/:fileId` | Query `hard_delete=true` for permanent delete |
| `DELETE` | `/storage/delete` | JSON: `file_id` or `file_ids`, optional `hard_delete` |
| `GET` | `/storage/stats` | Optional `partition_key`; returns aggregation array |
| `POST` | `/storage/search` | JSON body merged into metadata query |
| `GET` | `/files/*` | Static file download (path mirrors stored layout) |

## Source files

`apis/storage_service/routes/storage-routes.js`, `controllers/storage-controller.js`.

## See also

- [Architecture — Storage Service](../architecture-storage-service.md)
