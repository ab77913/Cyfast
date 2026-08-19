# User Management API — architecture

**Path:** `apis/user_management/`  
**Runtime:** Node.js, **Fastify** (v5)  
**Role:** Authentication and directory: **JWT** access and refresh tokens, users, roles, permissions, organizations; optional file upload routes for user-related assets.

## Stack

- **HTTP:** Fastify with `@fastify/cors` (open origin in current config) and a custom JSON parser enforcing `config.max_post_size_bytes`.
- **Optional plugins:** `@fastify/multipart` (registered where file upload is needed — see `middlewares/file-upload.js`).
- **Data:** **Sequelize** on **MySQL** by default (`DATABASE_TYPE_PRIMARY`); **MSSQL** models also exist under `database/mssql/` for deployments that use SQL Server.
- **Secondary / search:** Optional second database type via env (same pattern as other services); Elasticsearch client is a declared dependency when enabled.

## Route registration (`index.js`)

| Prefix | Module |
|--------|--------|
| `/` | `routes/main-routes` |
| `/auth` | `routes/auth-routes` |
| `/users` | `routes/user-routes` |
| `/roles` | `routes/role-routes` |
| `/permissions` | `routes/permission-routes` |

## Security model

- **Secrets:** `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` from environment (defaults exist in `config.js` — production must override).
- **Middleware:** `middlewares/auth.js` validates JWTs for protected routes; controllers enforce permission checks where applicable.
- **Passwords:** `bcryptjs` for hashing (see user controller flow).

## Data model (MySQL)

Models under `database/mysql/models/` include **Organization**, **User**, **Role**, **Permission**, and join tables (**UserRole**, **RolePermission**) initialized in `init-models.js` and loaded from `database/mysql/models/index.js`.

## Configuration

- **`configs/app.json`:** Per-environment `port`, `host`, `protocol` → builds `config.url`.
- **`configs/database.json`:** Credentials and pool options for Sequelize.
- **`configs/messaging.json`:** Present for parity with other services; messaging may be unused in the minimal Fastify bootstrap (no listeners in `index.js`).

## Operational notes

- Listens on **`0.0.0.0`** for container-friendly binding.
- Package name in `package.json` is **user-management** (version 3.x); aligns with UI `cyuserAxios` base URL.
