# Storage Service — architecture

**Path:** `apis/storage_service/`  
**Runtime:** Node.js, **Fastify**  
**Role:** File upload and retrieval API with **local disk** blobs and **MongoDB** metadata (partition keys, folder paths, soft/hard delete). Serves stored bytes under **`/files/*`** as static content.

General Management **project document ingestion** uploads here via `storage-client.js` (`partition_key` = project id, folder per `doc_type`). Ingestion status and chunks live in GM MySQL/MongoDB — see [AI-assisted generation](architecture-ai-generation.md).

## Stack

- **HTTP:** Fastify with `@fastify/cors`, `@fastify/multipart`, `@fastify/static`.
- **Persistence:** **MongoDB** (Mongoose) for `file_metadata` documents; binary files live under `config.storage_path` (see `configs/app.json` per `NODE_ENV`).
- **Logging:** Pino (level from `LOG_LEVEL` or default `info`), plus `helpers/logger.js` for request-scoped logs.

## Startup sequence (`index.js`)

1. Load `config.js` (dotenv, `NODE_ENV`, merge `configs/app.json` and `configs/database.json` for MongoDB).
2. Require `./database/mongodb/models` — connects Mongoose using `mongo_url` built from database config (process exits on connection failure).
3. Ensure `storage_path` directory exists (`fs.mkdir` recursive).
4. Register plugins: CORS (`origin: "*"` in code), multipart (max **10** files per request, `fileSize` from `max_file_size`), static files at **`/files/`** rooted at `storage_path`.
5. Register routes from `routes/storage-routes.js` at the app root (no global prefix).
6. Listen on `config.port`, host `0.0.0.0`.

## HTTP route map

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness: `{ success, message, timestamp }`. |
| `POST` | `/storage/upload` | Multipart upload (one or many file parts). |
| `GET` | `/storage/list` | Paginated listing by `partition_key` (required), optional `folder_path`. |
| `GET` | `/storage/files/:fileId` | Metadata for a single file (`is_deleted: false` only). |
| `DELETE` | `/storage/files/:fileId` | Soft or hard delete; query `hard_delete=true` for permanent removal. |
| `DELETE` | `/storage/delete` | JSON body: `file_id` **or** `file_ids[]`, optional `hard_delete`. |
| `GET` | `/storage/stats` | Aggregated file counts and total size; optional `partition_key` query. |
| `POST` | `/storage/search` | JSON body merged into a MongoDB query (always includes `is_deleted: false`). |
| `GET` | `/files/...` | Direct download via static plugin: URL path mirrors `{partition_key}/{folder_path?}/{stored_filename}`. |

## Request and response notes

- **Upload (`POST /storage/upload`):** Uses multipart. `partition_key`, `folder_path`, and `uploaded_by` are read from **`request.body`** or query (`partition_key` / `folder_path`); `uploaded_by` falls back to header **`x-user-id`** or `"system"`. Stored file name is `{uuid}{originalExtension}`; public URL is `{config.url}/files/{partition_key}/{folder_path?}/{stored_filename}`.
- **List:** Query `page` and `limit` (defaults **1** and **50**). Response spreads `{ data, pagination }` from the factory under `success: true`.
- **Delete by path:** `hard_delete` is compared to the string **`"true"`** in query (see `storage-controller.js`).
- **Bulk delete:** Service returns per-id results in **`success`** (array of outcomes) and **`failed`** (array of `{ fileId, error }`). The handler spreads that object into the reply (field name **`success`** overlaps the top-level boolean in the handler for the multi-id path — clients should treat the bulk response as `{ success: <array>, failed: <array> }` after spread).
- **Search:** Body fields are passed to `FileMetadata.find({ is_deleted: false, ...searchCriteria })`; supports any Mongoose-compatible filter (for example `mime_type`, `partition_key`, nested operators).
- **Stats:** Returns `data` as an **aggregation array**: one object per `partition_key` with `_id`, `total_files`, `total_size` (bytes). With no `partition_key` filter, multiple groups may be returned.

## Data model (`database/mongodb/models/fileMetadata.js`)

Key fields: `file_id` (UUID string, unique), `partition_key`, `folder_path`, `original_filename`, `stored_filename`, `file_path` (absolute path on disk), `file_url`, `mime_type`, `file_size`, `encoding`, `metadata` (Mixed), `is_deleted`, `deleted_at`, `uploaded_by`, `created_at` / `updated_at`. Indexes include `(partition_key, folder_path)`, `is_deleted`, `created_at`.

## Configuration

| Source | Use |
|--------|-----|
| `NODE_ENV` | Selects block in `configs/app.json` and `configs/database.json` (`local` default). |
| `PORT`, `HOST` | Override `app.json` port/host; `config.url` is used when building `file_url`. |
| `configs/app.json` | `protocol`, `host`, `port`, `storage_path`, `max_file_size` (bytes, also Fastify `bodyLimit`), `allowed_mime_types` (present in config; **not enforced** in upload code today). |
| `configs/database.json` | MongoDB credentials and database name per environment. |
| `LOG_LEVEL` | Pino log level. |

## Integrations

- **Other CyFast2 services:** Not wired in the architecture overview diagram yet; treat as an optional microservice for artifacts or shared files. Consumers need this service’s base URL and MongoDB instance.
- **Docker:** `apis/storage_service/Dockerfile` exists for container deployment.

## Related assets

- **Operator / API examples:** `apis/storage_service/README.md` (endpoint-oriented; align with this doc if examples diverge from code).
