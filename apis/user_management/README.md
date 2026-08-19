# User Management Service

REST API for managing users, roles, and permissions. Built with **Fastify** and **Sequelize**, supporting both MySQL and MSSQL databases.

## Tech Stack

- **Runtime:** Node.js 20
- **Framework:** Fastify 5
- **ORM:** Sequelize 6
- **Databases:** MySQL (mysql2) / MSSQL (tedious)
- **Auth:** JWT (jsonwebtoken) + bcryptjs

## Project Structure

```
UserManagement/
├── index.js                  # Fastify server entry point
├── config.js                 # Environment and app configuration
├── configs/
│   ├── app.json              # Host, port, protocol per environment
│   ├── database.json         # DB connection settings per environment
│   └── messaging.json        # Message queue settings per environment
├── routes/
│   ├── main-routes.js        # GET /
│   ├── auth-routes.js        # /auth
│   ├── user-routes.js        # /users
│   ├── role-routes.js        # /roles
│   └── permission-routes.js  # /permissions
├── controllers/
│   ├── auth-controller.js
│   ├── user-controller.js
│   ├── role-controller.js
│   └── permission-controller.js
├── services/
│   ├── auth-service.js       # JWT token generation and verification
│   └── user-service.js       # Password change logic
├── middlewares/
│   ├── auth.js               # JWT authenticate / authorize / isAdmin hooks
│   └── file-upload.js        # File upload via @fastify/multipart
├── helpers/
│   └── index.js              # Pagination, case conversion, size utilities
├── database/
│   ├── mysql/
│   │   ├── models/           # Sequelize models (User, Role, Permission, etc.)
│   │   └── factories/        # Data access layer
│   └── mssql/
│       ├── models/
│       └── factories/
├── Dockerfile
└── package.json
```

## Prerequisites

- Node.js >= 20
- MySQL or MSSQL database instance
- (Optional) Docker & Docker Compose

## Getting Started

### Local Development

1. **Install dependencies:**

   ```bash
   cd UserManagement
   npm install
   ```

2. **Configure environment:**

   Create a `.env` file in the `UserManagement/` directory:

   ```env
   NODE_ENV=local
   DATABASE_TYPE_PRIMARY=mysql
   ACCESS_TOKEN_SECRET=<your-secret>
   REFRESH_TOKEN_SECRET=<your-secret>
   ```

   Database credentials are in `configs/database.json` — update the `local` block to match your DB instance.

3. **Start the server:**

   ```bash
   npm start
   ```

   The service starts on **http://localhost:8087** by default.

### Docker

From the `NodeServices/` root:

```bash
docker compose up user-mgmt
```

This builds the image using `UserManagement/Dockerfile` and exposes port **8087**.

## API Endpoints

### Root

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/`  | Service health / banner |

### Auth (`/auth`)

| Method | Path               | Description                |
|--------|--------------------|----------------------------|
| GET    | `/auth/me`         | Get current user by token  |
| POST   | `/auth/login`      | Login with username/email + password |
| POST   | `/auth/logout`     | Logout (invalidate tokens) |
| POST   | `/auth/forgot_password` | Request password reset token |
| POST   | `/auth/reset_password`  | Reset password with token  |

### Users (`/users`)

| Method | Path                 | Description              |
|--------|----------------------|--------------------------|
| GET    | `/users`             | List users (paginated, filterable) |
| POST   | `/users`             | Create a new user        |
| GET    | `/users/my-profile`  | Get profile by access token |
| GET    | `/users/roles/simple`| List roles (id + name only) |
| GET    | `/users/:userId`     | Get user by ID           |
| POST   | `/users/:userId`     | Update user by ID        |
| PUT    | `/users/:userId`     | Update user by ID        |
| DELETE | `/users/:userId`     | Delete user by ID        |

### Roles (`/roles`)

| Method | Path                 | Description         |
|--------|----------------------|---------------------|
| GET    | `/roles`             | List roles (paginated, filterable) |
| GET    | `/roles/roles/simple`| List roles (id + name only) |
| GET    | `/roles/:roleId`     | Get role by ID      |
| POST   | `/roles`             | Create a new role   |
| POST   | `/roles/:roleId`     | Update role by ID   |
| DELETE | `/roles/:roleId`     | Delete role by ID   |

### Permissions (`/permissions`)

| Method | Path                         | Description             |
|--------|------------------------------|-------------------------|
| GET    | `/permissions`               | List permissions        |
| GET    | `/permissions/:permissionId` | Get permission by ID    |
| POST   | `/permissions`               | Create a new permission |
| POST   | `/permissions/:permissionId` | Update permission by ID |
| DELETE | `/permissions/:permissionId` | Delete permission by ID |

## Environment Variables

| Variable                 | Default   | Description                        |
|--------------------------|-----------|------------------------------------|
| `NODE_ENV`               | `local`   | Environment: `local`, `staging`, `production` |
| `DATABASE_TYPE_PRIMARY`  | `mysql`   | Primary DB: `mysql` or `mssql`     |
| `DATABASE_TYPE_SECONDARY`| —         | Optional secondary DB type         |
| `MESSAGING_TYPE`         | `rabbitmq`| Message queue type                 |
| `ACCESS_TOKEN_SECRET`    | (built-in)| JWT access token signing secret    |
| `REFRESH_TOKEN_SECRET`   | (built-in)| JWT refresh token signing secret   |
| `MAX_GET_SIZE`           | `2MB`     | Max request query/URL size         |
| `MAX_POST_SIZE`          | `8MB`     | Max request body size              |

## Database

The service dynamically loads models and factories based on `DATABASE_TYPE_PRIMARY`:

- **MySQL** — uses `mysql2` driver with Sequelize
- **MSSQL** — uses `tedious` driver with Sequelize

Models: `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `Organization`

Connection settings live in `configs/database.json`, keyed by database type and environment.

## Authentication

- **Login** returns a JWT `accessToken` (15 min expiry) and a `refreshToken`.
- Tokens are signed with `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET`.
- The `middlewares/auth.js` module provides Fastify hooks:
  - `authenticate` — verifies the Bearer token and attaches `request.user`
  - `authorize(permissions)` — checks user permissions
  - `isAdmin()` — checks for admin role
