# Stockroom

A customer is on the phone asking for two mugs and a notebook. You need to know what’s in stock, what the order costs, and what reference to give them. Stockroom is the browser console where you take that order and where the next person finds it when it’s time to pack.

## Setup and run

Use Docker with the Compose plugin, Node.js 24 or newer, and npm. Docker starts PostgreSQL 16 on localhost port 5432 and creates `stockroom` and `stockroom_test` on first initialization of the named volume.

```bash
docker compose up -d
cp .env.example .env
npm ci
set -a
. ./.env
set +a
docker compose ps           # Wait for postgres to show (healthy) before seeding.
npm run seed
npm run dev
```

The app and seed read `DATABASE_URL` from the environment. In each new shell, load `.env` as shown above or export the values from `.env.example` before running `npm run seed` and `npm run dev`. A hosted PostgreSQL URL also works. `DATABASE_URL_UNPOOLED` is only needed when `DATABASE_URL` connects through a transaction-mode pooler. Set it to a direct connection string for startup migrations.

Open [the console](http://localhost:5173). Vite forwards API requests to NestJS with Fastify on port 3001. Startup and seeding apply the committed migrations automatically. The seed inserts missing catalogue products by SKU, so running it again preserves existing stock and orders.

To run the production build locally:

```bash
npm run build
npm start
```

Open [the built console](http://127.0.0.1:3001). NestJS with Fastify serves both the frontend and API. Set `PORT` to change the API port.

## Work an order

### While the customer is on the phone

Open **Products** and add two **Studio Mug** units and one **Field Notebook**. On a fresh catalogue, the mug’s details show **5 left** and **2 in draft**. The two in your draft still count toward the five on the shelf. Stockroom deducts them when the order goes through.

Check the **₹48.50** total with the caller. On a small screen, **Jump to cart** takes you straight to the order summary. Select **Place order**, then copy the reference from the confirmation. Give the caller that reference so anyone at the desk can find the order if they ring back.

If you’re already on **Dashboard**, you can add products from the recommendations. Stockroom ranks those by units ordered, excluding cancelled orders. Before the first order, the panel shows the products with the most stock. Hover over or focus **Cart** in the top bar to preview the draft and open the order summary.

### When checkout gets interrupted

**Someone bought the last unit while you were on the phone.** Stockroom keeps your draft and refreshes the catalogue. If some units are still available, use the **Reduce to** button to bring that line down to the available quantity. If the item has sold out, remove it and agree on the revised order with the caller before placing it again. The other lines in a failed checkout keep their stock.

**You clicked Place order and lost the connection.** Use **Retry checkout** in the same tab. Stockroom pauses cart edits and reuses the original checkout key. If the order already went through, the retry brings back the same reference without deducting stock again.

### When the order is ready to leave

On **Dashboard**, select **To pack** to see the oldest orders first, or search by reference. Open the order to check the items and quantities. Select **Pack** once the parcel is packed. It moves to **Ready to ship**, where you can mark it shipped after handoff.

If the customer calls to cancel before shipping, find the reference and confirm **Cancel order**. Stockroom puts the units back into available stock. The order stays searchable, and its details show the fulfilment times Stockroom recorded.

## Architecture

- `frontend/src/orders/` contains the dashboard, cart, fulfilment views, and Zustand draft store. `frontend/src/inventory/` contains the catalogue, product details, and recommendations. The draft lives in browser session storage. TanStack Query refreshes affected views after writes.
- `backend/app.ts` configures NestJS with Fastify. The controllers validate requests with Zod, the exception filter maps errors to HTTP responses, and the order service owns pricing, fulfilment rules, and transaction boundaries.
- `backend/db/` contains the Drizzle schema, PostgreSQL migrations, connection setup, and seed data. Stock checks and deductions commit with the order and its line items. Cancellation changes status and restores stock in the same transaction. Prices and totals use integer paise internally and display in Indian rupees. Order lines retain the name and price at placement.
- `shared/orders.ts` defines the data shapes used by both apps.

| Method | Endpoint                            | Purpose                                                       |
| ------ | ----------------------------------- | ------------------------------------------------------------- |
| GET    | `/api/products`                     | Catalogue with current stock                                  |
| GET    | `/api/products/recommended`         | Products ranked by units from non-cancelled orders            |
| GET    | `/api/orders?search=&status=&sort=` | Up to 100 orders with optional reference, status, and sorting |
| GET    | `/api/orders/counts`                | Total order count for each status                             |
| POST   | `/api/orders`                       | Place an order from product IDs and quantities                |
| GET    | `/api/orders/:reference`            | Order details                                                 |
| PATCH  | `/api/orders/:reference/status`     | Pack, ship, or cancel through a valid transition              |

The API returns HTTP 409 for insufficient stock and invalid transitions, including repeat cancellation.

## Inventory consistency

Picture two people selling the last Studio Mug at once. Whoever places the first order gets the mug. The other person keeps their draft and can tell the caller what’s still available.

The order service uses a PostgreSQL transaction for each placement or status change. Placement locks the requested product rows in product ID order. Status changes lock the order row before reading its current state.

- **Placement.** Duplicate product lines are combined. The transaction checks stock while holding the product locks. A short item aborts placement before any stock changes. Stock, the order header, and its lines commit together. The database also checks for nonnegative stock, valid statuses, and valid foreign keys.
- **Fulfilment and cancellation.** The service reads the current status inside the write transaction and validates the requested transition. Cancellation records the terminal status and restores the order's original quantities in the same transaction. A competing cancellation or shipment then sees the committed status and is rejected.
- **Checkout retries.** A placement can include an `Idempotency-Key` UUID. A transaction-level advisory lock serializes requests with the same key. The server stores it in the same transaction as the order and stock deduction. An equivalent retry returns HTTP 200 and the existing order, while reusing the key for different quantities returns HTTP 409. For API compatibility, unkeyed requests are treated as new placements. The browser persists the pending key in the tab’s session storage and pauses draft edits until the result is known.

### Pitch demo

Set `TEST_DATABASE_URL` to a direct connection to a PostgreSQL test database, then run `npm run test:consistency`. The CLI seeds a fresh schema, starts two NestJS processes targeting that schema, and cleans up afterward. It reports HTTP success rates, status counts, requests per second, and p50/p95 time to response headers for each burst.

| Scenario                                  | Expected outcome                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 120 concurrent checkout attempts          | 12 orders consume exactly 24 notebook units. The other 108 requests receive HTTP 409. A second product keeps all 5 units when a cart contains an unavailable item. |
| 60 concurrent cancellation attempts       | 12 succeed and 48 receive HTTP 409. Stock returns to its original count.                                                                                           |
| 32 submissions with the same checkout key | One HTTP 201 and 31 HTTP 200 replays return the same order. Stock is deducted once.                                                                                |
| Concurrent ship and cancel                | One transition succeeds. The other receives HTTP 409. Restarting the service preserves all 13 orders, their timestamps, and the final inventory.                   |

Expected HTTP 409 responses count as correct outcomes in the demo. Direct SQL probes bypass the API and show PostgreSQL rejecting negative stock, an invalid status value, a duplicate checkout key, an orphaned line item, and zero quantity. A failed transaction also rolls back a valid stock deduction issued earlier in that transaction.

Database constraints protect individual values and relationships. The order service still owns cross-table rules such as matching totals to line items and restoring stock on cancellation. The timing figures describe this burst on the demo machine. Production capacity needs a sustained workload on the deployment environment.

## Checks

Set `TEST_DATABASE_URL` to a direct PostgreSQL connection for the test database. The local `stockroom` role owns `stockroom_test` and can create schemas there. Running `npm run test:e2e` requires installing Chromium with `npx playwright install chromium` first.

```bash
export TEST_DATABASE_URL='postgresql://stockroom:stockroom@localhost:5432/stockroom_test'
npm run check
npm test
npm run test:consistency
npm run build
npx playwright install chromium
npm run test:e2e
```

The API suite runs migrations against temporary PostgreSQL schemas. It covers placement, rollback on insufficient stock, skipped and invalid transitions, cancellation from either eligible status, competing requests, recommendation ranking, input validation, and persistence after reopening. Playwright runs against the local production build with its own temporary PostgreSQL schema and verifies the staff workflow and a stock conflict during placement.
