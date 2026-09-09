# Team Management API

A REST API for managing teams, projects, weekly reports, review workflows, and manager dashboards. It is built with Node.js, Express 5, and MySQL.

## Features

- JWT access-token authentication with rotating refresh-token cookies
- Role-based access for team members, managers, and administrators
- Team membership and project assignment management
- Weekly reporting periods and versioned reports
- Report submission, approval, and correction workflows
- Manager dashboards for submission status, workload, time, and activity
- Audit logging and a transactional outbox worker
- Request validation, rate limiting, CORS, security headers, and structured logging
- OpenAPI 3.1 API contract

## Requirements

- Node.js 20 or later
- npm
- MySQL 8 or later (`SKIP LOCKED` is used by the outbox worker)

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example configuration to the development profile:

   ```powershell
   Copy-Item .env.example .env.development
   ```

   On macOS or Linux:

   ```bash
   cp .env.example .env.development
   ```

3. Update `.env.development` with your database credentials and replace the example secrets. `JWT_ACCESS_SECRET` must contain at least 32 characters, and `TOKEN_ENCRYPTION_KEY` must contain exactly 64 hexadecimal characters.

4. Create the configured database:

   ```sql
   CREATE DATABASE team_management_development
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;
   ```

5. Create the schema and seed its lookup values:

   ```bash
   npm run db:migrate
   ```

6. Optionally add demonstration data:

   ```bash
   npm run seed:demo
   ```

7. Start the API:

   ```bash
   npm run dev
   ```

The API is available by default at `http://localhost:4000/api`. Use `npm run dev:watch` to restart it automatically when source files change.

## Demo accounts

Running `npm run seed:demo` creates the following users. All three use the password `ChangeMe123!`.

| Role | Email |
| --- | --- |
| Administrator | `admin@example.com` |
| Manager | `manager@example.com` |
| Team member | `member@example.com` |

The seed is safe to run more than once and also creates an Engineering team, sample projects, and reporting periods.

## Authentication

Log in with `POST /api/auth/login`. The response contains a short-lived access token; send it with protected requests:

```http
Authorization: Bearer <access-token>
```

The refresh token is stored in an HTTP-only cookie. Browser requests to login, refresh, and logout must include credentials, for example `credentials: "include"` with `fetch` or `withCredentials: true` with Axios.

Public authentication routes cover registration, login, token refresh, logout, password reset, and invitation acceptance. `GET /api/auth/me` and password changes require an access token.

## Roles and report workflow

| Role | Main permissions |
| --- | --- |
| `TEAM_MEMBER` | View accessible teams and projects; create, edit, submit, and view own reports |
| `MANAGER` | Team-member permissions plus project and reporting-period management, report review, and dashboards |
| `ADMIN` | System-wide user, role, team, invitation, project, report-review, and dashboard administration |

Reports move through the following states:

```text
DRAFT -> SUBMITTED -> APPROVED
                    -> NEEDS_CORRECTION -> SUBMITTED
```

A report is editable while it is in `DRAFT` or `NEEDS_CORRECTION`. Saved versions preserve its history.

## API overview

All routes are prefixed with `/api`.

| Area | Routes | Purpose |
| --- | --- | --- |
| Health | `GET /health` | Check database availability |
| Authentication | `/auth/*` | Register, log in, refresh, log out, manage passwords, accept invitations |
| Lookups | `GET /lookups` | Retrieve report task types, priorities, and status values |
| Teams | `/teams/*` | List teams and manage membership |
| Projects | `/projects/*` | Manage projects and project assignments |
| Reporting periods | `/reporting-periods/*` | List, create, and close reporting periods |
| Users | `/users/*` | Manage users, roles, statuses, profiles, and invitations |
| Reports | `/reports/*` | Create, edit, submit, review, filter, and inspect report versions |
| Dashboard | `/dashboard/*` | Retrieve manager summaries, trends, workload, activity, and time data |

The complete request and route contract is in [`docs/openapi.yaml`](docs/openapi.yaml). Most domain resources expose UUID `publicId` values; lookup and reporting-period IDs are numeric. Project lists and most team-scoped queries require `teamPublicId`.

## Response format

Successful requests return camelCase data in a consistent envelope:

```json
{
  "success": true,
  "data": {}
}
```

Errors use the following shape:

```json
{
  "success": false,
  "error": {
    "message": "The request could not be completed",
    "details": [],
    "requestId": "request-id"
  }
}
```

`details` is included only when useful. Unexpected errors return the generic message `Internal server error`; use `requestId` to find the corresponding structured server log.

## Environment variables

| Variable | Default/example | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runtime profile: development, test, staging, or production |
| `PORT` | `4000` | HTTP server port |
| `DB_HOST`, `DB_PORT` | `127.0.0.1`, `3306` | MySQL server connection |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | — | MySQL credentials and database |
| `DB_CONNECTION_LIMIT` | `10` | Connection-pool limit |
| `JWT_ACCESS_SECRET` | — | Access-token signing secret (minimum 32 characters) |
| `TOKEN_ENCRYPTION_KEY` | — | 64-character hexadecimal token encryption key |
| `ACCESS_TOKEN_TTL` | `15m` | Access-token lifetime |
| `REFRESH_TOKEN_DAYS` | `7` | Refresh-token lifetime in days |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | One allowed origin or a comma-separated allowlist |
| `COOKIE_NAME` | `team_refresh` | Refresh-cookie name |
| `COOKIE_SECURE` | `false` | Restrict the cookie to HTTPS |
| `COOKIE_SAME_SITE` | `lax` | Cookie SameSite mode: `lax`, `strict`, or `none` |
| `COOKIE_DOMAIN` | empty | Optional refresh-cookie domain |
| `LOG_LEVEL` | `info` | Pino logging level |
| `OUTBOX_BATCH_SIZE` | `25` | Events claimed during one worker cycle |
| `OUTBOX_INTERVAL_MS` | `5000` | Delay between worker cycles in milliseconds |

Configuration is loaded from `.env.<NODE_ENV>` and then `.env`. Existing process variables take precedence. Staging and production reject placeholder secrets and require `COOKIE_SECURE=true`. For a cross-site frontend, use HTTPS together with `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=none`.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with `.env.development` |
| `npm run dev:watch` | Start the development API with Nodemon |
| `npm start` | Start using externally supplied `NODE_ENV` and configuration |
| `npm run start:development` | Start with the development profile |
| `npm run start:staging` | Start with the staging profile |
| `npm run start:production` | Start with the production profile |
| `npm run worker` | Start the outbox worker using the current environment |
| `npm run worker:development` | Start the development outbox worker |
| `npm run worker:staging` | Start the staging outbox worker |
| `npm run worker:production` | Start the production outbox worker |
| `npm run db:migrate` | Apply the idempotent schema and lookup seed migration |
| `npm run seed:demo` | Create demonstration users and team data |
| `npm test` | Run the Node.js test suite |

## Outbox worker

Run the worker as a separate process when invitation, password-reset, and other outbox events need to be handled:

```bash
npm run worker:development
```

The current publisher writes events to the application log. Replace `publish` in `src/workers/outbox.worker.js` with the intended email or message-broker integration before relying on event delivery in production.

## Project structure

```text
docs/                 OpenAPI contract
migrations/           MySQL schema and lookup seeds
scripts/              Environment runner, migration, and demo seed scripts
src/
  config/             Environment, database, and logging configuration
  constants/          Shared roles and status codes
  middleware/         Authentication, authorization, validation, and errors
  modules/            Feature routes, controllers, services, and repositories
  repositories/       Shared audit and outbox persistence
  services/           Shared access-control and audit services
  workers/            Transactional outbox processor
test/                  Unit and API-contract tests
```

## Testing

```bash
npm test
```

The current suite verifies shared status-code definitions and checks that the implemented routes remain aligned with the OpenAPI contract.
