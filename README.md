# Inventra ERP starter

A responsive inventory-management starter based on `UI.jpeg`, built with React, JavaScript, Vite, a TypeScript Node.js REST API, Prisma, and SQLite.

The Dashboard provides a live overview of stock levels and value, low-stock alerts, sales for the last 14 days, orders awaiting fulfillment, planned production, and active support tickets. It also shows recent orders and support requests, with links into each module.

The Production module creates work orders for finished products with order-specific bills of materials. Completing a planned order atomically consumes the required raw-material stock and adds the finished quantity to inventory. Planned orders can be cancelled without changing inventory.

The Orders module creates customer sales orders with item and price snapshots, email/notes, and open, processing, fulfilled, and cancelled states. Fulfilling an order atomically deducts its item quantities from finished-goods stock. Orders do not reserve stock before fulfillment, so stock is revalidated at fulfillment.

The Reports module summarizes fulfilled sales for a selected date range, including revenue, order count, units sold, average order value, daily revenue, and top-selling products. It can export fulfilled order lines as CSV.

Authentication uses email/password accounts, salted PBKDF2 password hashes, and seven-day server-side sessions. Session tokens are stored hashed in the database and sent only in HttpOnly, SameSite=Strict cookies. Protected API routes require an active session and enforce the user's module permissions.

On first run, set `AUTH_SETUP_SECRET` in `.env` to a unique random value of at least 32 characters (for example, generate one with `openssl rand -hex 32`), restart the API, and use the setup screen to create the first administrator. Setup can only be completed once. The administrator can create team accounts and set an initial password in User Access. Existing profile records have no password until an administrator sets one. There is no email invitation, password reset, or self-service password-change flow yet; use another administrator account to reset a team member's password, and keep a separate recovery plan for the first administrator.

The User Access module manages team profile records, Admin/Manager/Staff roles, active/invited/disabled status, passwords, and per-module access settings. Only active administrator accounts can manage team access; non-admin accounts cannot grant themselves administrator or User Access privileges. Disabling or changing a user's password revokes their existing sessions.

The Support module tracks customer help requests with category, priority, status, and a reply history. Tickets are created in the open state and can be moved between open, in progress, and resolved.

The Settings module saves the workspace business name and contact details, along with the default low-stock threshold for products created in the future. Changing that default does not modify existing product thresholds.

The Settings module saves the workspace business name and contact details, along with the default low-stock threshold for products created in the future. Changing that default does not modify existing product thresholds.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

Open the Vite URL printed in the terminal (defaults to port 5178). Vite proxies `/api` requests to the Node API configured by `API_PORT`. The sample products are added only when the database is empty. Change `VITE_PORT` or `API_PORT` in `.env` if either port is already in use.

## Inventory API

The REST API is implemented in `server/src/index.ts`:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API health check |
| `GET` | `/api/auth/status` | Check whether first-admin setup is required |
| `POST` | `/api/auth/setup` | Create the first administrator using `AUTH_SETUP_SECRET` |
| `POST` | `/api/auth/login` | Sign in with email and password |
| `GET` | `/api/auth/me` | Get the current signed-in user |
| `POST` | `/api/auth/logout` | Revoke the current session |
| `GET` | `/api/products` | List inventory |
| `POST` | `/api/products` | Create a product |
| `PATCH` | `/api/products/:id` | Update a product |
| `POST` | `/api/products/:id/sales` | Record a sale and decrement stock |
| `DELETE` | `/api/products/:id` | Delete a product |
| `GET` | `/api/users` | List user profiles and module access settings |
| `POST` | `/api/users` | Create a user profile |
| `PATCH` | `/api/users/:id` | Update a user's role, status, or permissions |
| `DELETE` | `/api/users/:id` | Remove a user profile |
| `GET` | `/api/support/tickets` | List support tickets and replies |
| `POST` | `/api/support/tickets` | Create a support ticket |
| `PATCH` | `/api/support/tickets/:id` | Update a ticket status |
| `POST` | `/api/support/tickets/:id/replies` | Add a Support team reply |
| `GET` | `/api/settings` | Get workspace settings |
| `PATCH` | `/api/settings` | Update workspace settings |
| `GET` | `/api/settings` | Get workspace settings |
| `PATCH` | `/api/settings` | Update workspace settings |
| `GET` | `/api/orders` | List customer sales orders and their line items |
| `POST` | `/api/orders` | Create a sales order |
| `POST` | `/api/orders/:id/process` | Move an open order to processing |
| `POST` | `/api/orders/:id/fulfill` | Deduct inventory and fulfill an order |
| `POST` | `/api/orders/:id/cancel` | Cancel an open or processing order |
| `GET` | `/api/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD` | Sales summary and fulfilled order lines for an inclusive date range (maximum 366 days) |
| `GET` | `/api/production/orders` | List production orders and their material lists |
| `POST` | `/api/production/orders` | Create a planned production order |
| `POST` | `/api/production/orders/:id/complete` | Consume materials and receive finished goods |
| `POST` | `/api/production/orders/:id/cancel` | Cancel a planned order without stock movement |

All `/api/users` routes require an authenticated administrator with User Access permission. Other module routes require an active signed-in user with the corresponding module permission.

Products have a unique SKU. Inventory quantities are non-negative whole numbers. Requests with duplicate SKUs, invalid fields, or sales exceeding available stock return explicit `4xx` errors.

Production orders require a Finished Good output and at least one Raw Material input. The order stores each raw material's quantity per output unit. Completion runs in a database transaction; if any material is unavailable, no stock is changed and the order remains planned.

Sales orders can only contain Finished Good products and quantities available when the order is placed. Product names, SKUs, and unit prices are snapshotted on each line. Fulfillment rechecks stock and deducts all items in one database transaction; if any item is short, the order stays open/processing and no inventory is changed. Fulfilled orders cannot be cancelled or fulfilled a second time.

## Database

Prisma uses a local SQLite database at `prisma/dev.db` by default. Set a SQLite `DATABASE_URL` in `.env`, then apply the schema with `npm run db:push`. Use `npm run db:studio` to inspect the database.

The local SQLite file is intended for development and is not suitable for serverless or multi-instance deployments. Production uses the PostgreSQL schema in `prisma/schema.postgresql.prisma`; keep it in sync with `prisma/schema.prisma` when changing data models.

## Deploy to Vercel

This project is configured to deploy its React frontend and Express REST API together as a Vercel Function, using Neon PostgreSQL for persistent data.

1. Push this project to a GitHub repository and import it into Vercel. Keep the Vercel project root set to the repository root. The build command and output directory are configured in `vercel.json`.
2. Create a Neon PostgreSQL project. Connect your Neon account to Vercel with the Neon integration and grant access only to this project. Set `AUTH_SETUP_SECRET` to a unique random value of at least 32 characters (for example, generate one privately with `openssl rand -hex 32`); do not commit or share it. The Neon integration supplies `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).
3. Initialize the empty Neon database from your computer. Set `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in your local shell to the Neon connection strings, then run `npm run db:push:postgres`. Do not use the local SQLite URL for this command. The same schema is also generated as part of Vercel's `vercel-build`.
4. Deploy or redeploy from Vercel. Open the deployed URL and use the one-time setup screen and `AUTH_SETUP_SECRET` to create a new production administrator and password. The local test account and SQLite data are not copied to Neon.

The API and UI share the deployed origin, so no separate API URL or CORS configuration is required. Keep the Neon pooled URL in `DATABASE_URL` for runtime requests and the unpooled URL in `DATABASE_URL_UNPOOLED` for Prisma schema changes. Never put database URLs or the setup secret in frontend (`VITE_...`) variables or source control.

## Available commands

- `npm run dev` — start the Vite frontend and Node API
- `npm run build` — type-check the API and build the frontend
- `npm run start:api` — start the compiled Node API after building
- `npm run check` — type-check the TypeScript API
- `npm run db:push` — synchronize the Prisma schema with the database
- `npm run db:seed` — add starter inventory to an empty database
- `npm run db:studio` — open Prisma Studio
