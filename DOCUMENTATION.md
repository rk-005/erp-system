# System Design & Technical Documentation
**Project:** Mini ERP + CRM Operations Portal

---

## 1. Executive Summary

This system is a full-stack, role-based ERP (Enterprise Resource Planning) and CRM (Customer Relationship Management) portal designed for wholesale and distribution companies. It enables businesses to manage their customer base, track product inventory, record stock movements, and process sales challans (orders) with strict access controls and atomic data integrity.

---

## 2. System Architecture

The application follows a decoupled client-server model:

- **Frontend (Client):** A Single Page Application (SPA) built with React and TypeScript, running in the user's browser. It is hosted on **Vercel**.
- **Backend (API):** A RESTful API built with Node.js and Express in TypeScript. It handles business logic, security, and data validation. It is hosted on **Render**.
- **Database:** A serverless PostgreSQL relational database hosted on **Neon** (AWS). The backend uses Prisma ORM to safely query and mutate data.

### Request Lifecycle
1. The user interacts with the React frontend (e.g., clicking "Confirm Challan").
2. The frontend makes an HTTP POST request to the backend API (`/api/challans/:id/confirm`) using a JWT token for authorization.
3. The Node.js Express server receives the request.
4. **Middleware** validates the JWT token and checks if the user's Role (e.g., SALES) has permission to hit this endpoint.
5. The **Controller/Service** layer executes the business logic, communicating with the PostgreSQL database via Prisma.
6. The backend responds with JSON (success or error).
7. The frontend updates the UI based on the response.

---

## 3. Core Modules & How They Work

### A. Authentication & Authorization (Role-Based Access Control)
**What it does:** Ensures that only verified users can log in, and restricts what they can see or do based on their job role.
**How it works:**
- The system supports 4 roles: `ADMIN`, `SALES`, `WAREHOUSE`, and `ACCOUNTS`.
- Upon successful login (`POST /auth/login`), the backend generates a **JSON Web Token (JWT)** containing the user's ID and Role, signed with a secret key.
- The frontend stores this token (in localStorage or memory) and attaches it as a `Bearer` token in the `Authorization` header of all subsequent API requests.
- **Backend Protection:** An `authenticate` middleware verifies the token signature. A `requireRole` middleware checks if the token's role is allowed for the specific route (e.g., only `WAREHOUSE` and `ADMIN` can manually adjust stock).
- **Frontend Protection:** The React Router uses a `<ProtectedRoute>` component to hide unauthorized pages from the UI (e.g., hiding the Warehouse tab from Sales users).

### B. Customer CRM Module
**What it does:** Manages customer profiles (retail, wholesale, distributors) and tracks interaction history.
**How it works:**
- The `Customer` table in Postgres stores contact details, GST numbers, and status.
- The `CustomerNote` table is linked via a One-to-Many relationship to track follow-ups and history.
- The frontend uses paginated tables with search and filter capabilities to display this data efficiently without overloading the browser.

### C. Product & Inventory Module
**What it does:** Maintains the master list of products, SKUs, pricing, and current stock levels.
**How it works:**
- The `Product` table tracks `currentStock` and `minStockAlert` levels.
- A specialized endpoint (`GET /products/low-stock`) dynamically filters products where `currentStock <= minStockAlert` to warn warehouse managers of low inventory.

### D. Stock Movements (Audit Trail)
**What it does:** Maintains a strict, immutable ledger of why stock levels changed (IN or OUT).
**How it works:**
- Users cannot edit the `currentStock` of a product directly.
- Instead, stock is changed by creating a `StockMovement` record (e.g., "Manual Adjustment" or "Challan Confirmed").
- The backend wraps the stock adjustment in a **Database Transaction**. It first checks if an `OUT` movement would cause stock to drop below zero. If so, it aborts. Otherwise, it logs the movement and updates the product stock simultaneously.

### E. Sales Challan Module (The Core Business Logic)
**What it does:** Allows sales reps to create draft orders (challans) and confirm them, which permanently deducts stock.
**How it works (The Confirmation Flow):**
When a user clicks "Confirm", a highly critical operation occurs in the `challanService.ts`:
1. **Transaction Start:** Prisma begins an atomic `$transaction`. If anything fails, everything rolls back.
2. **State Check:** It verifies the challan is currently in `DRAFT` status.
3. **Dynamic Stock Check:** It loops through every item on the challan and queries the live `Product` table to see if enough stock exists *right now* (preventing race conditions where two sales reps confirm an order simultaneously).
4. **Validation:** If ANY item lacks stock, the entire transaction is aborted, and a `409 Conflict` error is returned to the frontend detailing exactly which products failed.
5. **Execution:** If stock is sufficient:
   - The product's `currentStock` is decremented.
   - A `StockMovement` (OUT) is logged for the audit trail.
   - A snapshot of the product's current name and price is saved into `ChallanItem.productSnapshot` (so if the product price changes next year, old challans remain accurate).
   - The challan status changes to `CONFIRMED`.

### F. PDF Generation
**What it does:** Exports challans as printable invoices.
**How it works:**
- Uses the `pdfkit` library on the backend.
- The `GET /challans/:id/pdf` endpoint builds a PDF document in memory using the challan data.
- If the challan is `CANCELLED` or `DRAFT`, it stamps a large watermark across the page to prevent fraudulent use.
- The binary PDF stream is piped directly to the HTTP response, allowing the browser to download or preview it instantly.

---

## 4. Technical Quality & DevOps

- **Data Validation:** All API inputs (body, query, params) are rigorously validated using **Zod** schemas before reaching the business logic. Invalid requests are rejected immediately with a `400 Bad Request` and detailed field errors.
- **Error Handling:** A global error handler catches all exceptions, preventing the Node.js server from crashing, and formatting errors into a standardized `{ error: { message, code } }` JSON structure for the frontend.
- **Dockerization:** The entire system can be spun up using Docker Compose, creating isolated containers for the database, backend, and a reverse-proxied Nginx frontend.
- **CI/CD:** GitHub Actions automatically run type-checks and test suites on every push. If tests pass, Webhooks are triggered to deploy the latest code to Vercel and Render automatically.

---

## 5. Summary of Technologies

| Category | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | React + Vite | Fast, component-based UI rendering |
| **Language** | TypeScript | Static typing to catch bugs at compile time |
| **Styling** | Tailwind CSS | Utility-first, responsive CSS |
| **Backend Runtime** | Node.js + Express | Fast, asynchronous event-driven API server |
| **Database** | PostgreSQL (Neon) | Reliable, relational data storage |
| **ORM** | Prisma | Type-safe database interactions and migrations |
| **Deployment** | Vercel & Render | Cloud hosting for Frontend and Backend |
| **CI/CD** | GitHub Actions | Automated testing and deployment pipelines |
