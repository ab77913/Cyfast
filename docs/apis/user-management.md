# User Management API

**Base URL:** configured `config.url` (default local port **8087**).  
**Runtime:** Fastify.

Route modules are registered with prefixes in `apis/user_management/index.js`.

## OpenAPI / Swagger

- **UI:** `{baseUrl}/api-docs` (e.g. `http://localhost:8087/api-docs`).
- **Spec:** `{baseUrl}/api-docs/json` or `{baseUrl}/api-docs/yaml` (provided by `@fastify/swagger-ui`).
- **In repo:** `apis/user_management/swagger/openapi-config.js`; `@fastify/swagger` and `@fastify/swagger-ui` are registered in `index.js` before application routes. The spec documents a `bearerAuth` security scheme for JWT-protected operations.

## Root — prefix `/`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/` | Root / health-style handler |

## Auth — prefix `/auth`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/auth/me` | Current user (expects bearer token per controller) |
| `POST` | `/auth/login` | Body: `username` or `email`, plus `password`; returns `accessToken`, `refreshToken`, `user` |
| `POST` | `/auth/logout` | Uses `Authorization` header |
| `POST` | `/auth/forgot_password` | Forgot password flow |
| `POST` | `/auth/reset_password` | Reset password |

## Users — prefix `/users`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/users` | List users |
| `POST` | `/users` | Create user |
| `GET` | `/users/my-profile` | Authenticated profile |
| `GET` | `/users/roles/simple` | Simple role list (duplicate of roles list; see below) |
| `GET` | `/users/:userId` | Get user (`userId` integer) |
| `POST` | `/users/:userId` | Update user |
| `PUT` | `/users/:userId` | Update user |
| `DELETE` | `/users/:userId` | Delete user |

## Roles — prefix `/roles`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/roles` | List roles |
| `GET` | `/roles/roles/simple` | Simple list (path is as registered: **double** `roles` segment) |
| `GET` | `/roles/:roleId` | Get role |
| `POST` | `/roles` | Create role |
| `POST` | `/roles/:roleId` | Update role |
| `DELETE` | `/roles/:roleId` | Delete role |

## Permissions — prefix `/permissions`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/permissions` | List |
| `GET` | `/permissions/:permissionId` | Get (`permissionId` integer) |
| `POST` | `/permissions` | Create |
| `POST` | `/permissions/:permissionId` | Update |
| `DELETE` | `/permissions/:permissionId` | Delete |

## Source files

`apis/user_management/routes/main-routes.js`, `auth-routes.js`, `user-routes.js`, `role-routes.js`, `permission-routes.js`.
