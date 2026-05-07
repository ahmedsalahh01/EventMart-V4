# EventMart V4 — Complete Technical Documentation & Project Report

**Project:** EventMart V4  
**Type:** B2B Event Equipment Marketplace  
**Market:** Egypt  
**Date:** May 2026  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Frontend Application](#4-frontend-application)
5. [Admin Panel Application](#5-admin-panel-application)
6. [Backend Server](#6-backend-server)
7. [Database](#7-database)
8. [API Reference](#8-api-reference)
9. [Authentication & Security](#9-authentication--security)
10. [UI/UX Design System](#10-uiux-design-system)
11. [Features & Functionality](#11-features--functionality)
12. [Third-Party Integrations](#12-third-party-integrations)
13. [State Management](#13-state-management)
14. [Routing](#14-routing)
15. [Testing](#15-testing)
16. [Deployment & Infrastructure](#16-deployment--infrastructure)
17. [Development Workflow](#17-development-workflow)
18. [Project Structure](#18-project-structure)
19. [Environment Configuration](#19-environment-configuration)
20. [Methodologies & Patterns](#20-methodologies--patterns)

---

## 1. Project Overview

EventMart is a B2B/B2C event equipment marketplace focused on the Egyptian market. It allows businesses and individuals to browse, buy, or rent event equipment including lighting, audio, rigging, staging, and furniture for various event types.

### Core Value Proposition
- One-stop shop for event equipment in Egypt
- Buy and rent options for products
- AI-assisted event planning
- Pre-built and custom event packages
- Smart product recommendations based on event type and user behavior

### Target Users
- **Customers:** Event organizers, businesses, individuals planning events
- **Admins:** Internal team managing products, orders, and analytics

### Event Types Supported
Party, Birthday, Corporate, Engagement, Wedding, Reception, Rehearsal, Private Event, Conference/Seminar, Exhibition, Training

---

## 2. Architecture Overview

EventMart V4 is a **monorepo** containing three independent applications:

```
EventMart-V4/
├── Frontend/      → Customer-facing storefront (React + Vite)
├── Admin/         → Internal management panel (React + Vite)
└── Server/        → REST API backend (Node.js + Express)
```

### Architectural Pattern
**Three-Tier Architecture:**
- **Presentation Layer:** Frontend (public) + Admin (internal) React SPAs
- **Application Layer:** Express REST API server
- **Data Layer:** PostgreSQL relational database

### Communication
- Frontend ↔ Server: HTTP REST API over JSON
- Admin ↔ Server: HTTP REST API with Bearer token authentication
- Server ↔ Database: Connection pool via `pg` (node-postgres)
- Server ↔ External Services: Cloudinary (images), OpenAI (AI), Resend (email)

### Deployment Topology
| App | Host | URL | Port |
|---|---|---|---|
| Frontend | Vercel | https://event-mart-v4.vercel.app | 443 |
| Admin | Local only | http://localhost:5174 | 5174 |
| Backend | Railway | https://eventmart-v4-production.up.railway.app | 443 |
| Database | Railway | (PostgreSQL managed) | 5432 |

---

## 3. Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI library — component-based rendering |
| Vite | 5.4.10 | Build tool — fast HMR, ES module bundling |
| React Router DOM | 6.28.0 | Client-side routing with nested routes |
| Framer Motion | 12.36.0 | Animations — page transitions, UI motion |
| CSS Custom Properties | Native | Theming, responsive scaling |
| JavaScript (ESM) | ES2022+ | Language (no TypeScript) |

### Admin Panel
| Technology | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI library |
| Vite | 5.4.10 | Build tool |
| React Router DOM | 6.28.0 | Admin routing |
| Vercel Analytics | 2.0.1 | Usage analytics |

### Backend Server
| Technology | Version | Purpose |
|---|---|---|
| Node.js | LTS | JavaScript runtime |
| Express | 4.21.0 | HTTP web framework |
| pg (node-postgres) | 8.12.0 | PostgreSQL client |
| jsonwebtoken | 9.0.2 | JWT auth token generation/validation |
| bcryptjs | 2.4.3 | Password hashing |
| Helmet | 8.1.0 | Security HTTP headers |
| CORS | 2.8.5 | Cross-origin resource sharing |
| Multer | 2.1.1 | Multipart form-data / file uploads |
| express-rate-limit | 8.5.0 | API rate limiting |
| Resend | 6.12.3 | Transactional email delivery |
| XLSX | 0.18.5 | Excel/CSV file parsing for bulk import |
| dotenv | 16.4.5 | Environment variable management |
| nodemon | 3.1.4 | Dev auto-restart |
| concurrently | 8.2.2 | Run multiple processes simultaneously |

### Database
| Technology | Purpose |
|---|---|
| PostgreSQL | Relational database — products, users, orders, packages |

### External APIs & Services
| Service | Purpose |
|---|---|
| OpenAI API (gpt-4o-mini) | AI event planner, product auto-description, recommendation reranking |
| Cloudinary | Image storage, optimization, and CDN delivery |
| Resend | Transactional email (order confirmations, verifications) |
| Google OAuth | Social login (OAuth 2.0) |

---

## 4. Frontend Application

### Overview
The customer-facing storefront. A single-page application (SPA) built with React and served via Vite. Deployed on Vercel.

**Dev Port:** 5173  
**Production URL:** https://event-mart-v4.vercel.app

### Entry Point

**`Frontend/src/main.jsx`** bootstraps the application with a context provider hierarchy:

```
React.StrictMode
  └── BrowserRouter         (React Router)
        └── ThemeProvider   (dark/light mode)
              └── AuthProvider   (user session)
                    └── CartProvider    (shopping cart)
                          └── App     (routes)
```

### File Structure

```
Frontend/
├── public/
├── src/
│   ├── main.jsx              ← App bootstrap
│   ├── App.jsx               ← Route definitions
│   ├── pages/                ← 17 page components
│   ├── components/           ← 12 reusable components
│   ├── contexts/             ← 3 React contexts
│   ├── hooks/                ← 3 custom hooks
│   ├── lib/                  ← 24 utility/service modules
│   └── styles/               ← 12 CSS files
├── vite.config.js
├── .env.local
└── package.json
```

### Pages (17 total)

| Page | Route | Auth Required | Description |
|---|---|---|---|
| HomePage | `/` | No | Landing page with hero and featured products |
| ShopPage | `/shop` | No | Product catalog with filtering and event type selection |
| ProductDetailPage | `/shop/:slug` | No | Single product with variations, pricing, add to cart |
| CartPage | `/cart` | No | Cart items, quantity control, checkout CTA |
| AuthPage | `/auth` | No | Sign in / Register with tabs |
| VerifyEmailPage | `/verify-email` | Yes | Email verification flow |
| AuthCallbackPage | `/auth/callback` | No | OAuth 2.0 callback handler |
| CheckoutPage | `/checkout` | Yes | Address, payment, order summary |
| OrderConfirmationPage | `/orders/:orderId/confirmation` | Yes | Post-purchase success screen |
| ProfilePage | `/profile` | Yes | Account settings, order history |
| AIPlannerPage | `/ai-planner` | Yes | AI chat-based event planning assistant |
| PackagesPage | `/packages` | No | Pre-built event packages listing |
| PackageDetailPage | `/packages/:identifier` | No | Package details with item breakdown |
| PackageBuilderPage | `/package-builder` | No | Custom package configuration tool |
| AboutPage | `/about` | No | Company information |
| ContactPage | `/contact` | No | Contact form |
| NotFoundPage | `*` | No | 404 fallback |

> `/signin` is a legacy redirect to `/auth?tab=signin`

### Components (12 total)

| Component | Purpose |
|---|---|
| `AppShell.jsx` | Master layout — renders Navbar + page content + Footer |
| `AppScaleFrame.jsx` | Applies `--app-scale` CSS variable for responsive scaling |
| `Navbar.jsx` | Top navigation bar with cart badge counter |
| `Footer.jsx` | Site footer with navigation links and info |
| `ProtectedRoute.jsx` | HOC — redirects unauthenticated users to `/auth` |
| `HeroSlideshow.jsx` | Auto-advancing hero image carousel on homepage |
| `FeaturedCarousel.jsx` | Horizontal scrolling featured product carousel |
| `RecommendationsSection.jsx` | Full recommendation block for product detail pages |
| `SmartRecommendationBar.jsx` | Inline slim recommendation bar |
| `EventTypeShopHeading.jsx` | Dynamic heading that adapts to selected event type |
| `shop/ProductCard.jsx` | Product tile in grid view — image, name, price, CTA |
| `shop/ProductModal.jsx` | Quick-view modal for product details without navigation |

### Contexts (3 total)

#### AuthContext (`src/contexts/AuthContext.jsx`)
Manages global authentication state.

**State:**
- `user` — current user object (null if not authenticated)
- `token` — JWT access token
- `loading` — auth initialization state

**Methods:**
- `login(credentials)` — Authenticates via API, stores token
- `register(data)` — Creates account via API
- `logout()` — Clears token and user from state and localStorage
- `refreshUser()` — Re-fetches current user from `/api/me`

**Persistence:** Token stored in `localStorage` under key `eventmart_auth_v1`

#### CartContext (`src/contexts/CartContext.jsx`)
Manages shopping cart state across the session.

**State:**
- `items` — array of normalized cart items
- `itemCount` — total quantity count
- `cartTotal` — computed total price

**Methods:**
- `addItem(product, variation, quantity)` — Adds or increments item
- `removeItem(itemKey)` — Removes item from cart
- `updateQuantity(itemKey, qty)` — Updates item quantity
- `clearCart()` — Empties the cart
- `getItemCount()` — Returns total item count

#### ThemeContext (`src/contexts/ThemeContext.jsx`)
Toggles dark/light interface theme.

**State:** `theme` — `"dark"` | `"light"`  
**Method:** `toggleTheme()` — switches theme and updates `data-interface-theme` on `<html>`  
**Persistence:** Stored in `localStorage`

### Custom Hooks (3 total)

| Hook | Purpose |
|---|---|
| `useRequireAuth` | Redirects to `/auth` if user is not authenticated; used in protected pages |
| `useSmartRecommendations` | Fetches and manages smart product recommendation state |
| `useCartPricingSummary` | Computes subtotal, fees, and totals from cart items |

### Library Modules (`src/lib/`)

#### Core API

**`api.js`** — Central HTTP client  
- `resolveApiBaseUrl()` — reads `VITE_API_URL` from env
- `buildApiUrl(path)` — constructs full URL
- `apiRequest(path, options)` — generic request with error handling, retry, and fallback
- `authRequest(path, token, options)` — attaches `Authorization: Bearer <token>` header
- `sendAIPlannerMessage(data)` — POST to AI planner endpoint
- `requestSmartRecommendationRerank(data)` — POST for AI reranking

**`endpoints.js`** — All API path constants (17 groups, ~40 endpoints)

#### Product & Shop

**`products.js`** — List/fetch products with in-memory caching  
**`productDetail.js`** — Fetch single product by slug  
**`productRuleEngine.js`** — Evaluate product visibility and availability rules  
**`homeHeroShowcaseImages.js`** — Config for hero carousel featured images  
**`eventTypeConfig.js`** — 11 event type definitions with:
  - Shop headings and CTAs
  - Allowed/preferred product categories
  - Venue compatibility
  - Recommended tags

#### Cart & Checkout

**`cart.js`** — Cart item normalization, image merging, upload token handling  
**`checkout.js`** — Order validation, shipping calculation, address validation (Egypt), currency handling (EGP)

#### Packages

**`packages.js`** — Fetch package listings and details  
**`packageMinimums.js`** — Enforce minimum requirements per package type

#### Recommendations

**`recommendationEngine.js`** — Client-side product ranking algorithm  
**`smartRecommendationService.js`** — Calls server AI reranking, manages cache  
**`userBehavior.js`** — Tracks event type selection, cart additions, guest count

### Styles Architecture (`src/styles/`)

EventMart uses **plain CSS with CSS Custom Properties** (no CSS framework).

| File | Scope |
|---|---|
| `theme.css` | Dark/light mode variable definitions |
| `index.css` | Global reset, base variables, `--app-scale` system |
| `home.css` | Homepage hero, featured section |
| `shop.css` | Product grid, filters |
| `cart.css` | Cart layout and item rows |
| `checkout.css` | Multi-step checkout form |
| `profile.css` | Profile tabs, order history |
| `auth.css` | Login/register form |
| `packages.css` | Package cards and detail |
| `ai-planner.css` | Chat interface |
| `contact.css` | Contact form |
| `order-confirmation.css` | Success screen |
| `experience.css` | Shared experience-related styles |

**CSS Variable System:**
```css
--app-scale             /* Responsive scale multiplier */
--app-scale-inverse     /* Inverse for counter-scaling */
--page-hero-bg          /* Hero gradient */
--page-heading-bg       /* Section heading gradient */
--page-accent-*         /* Brand accent colors */

/* Brand Colors */
--brand-deep-1 / -2 / -4
--brand-teal-1 / -2
--brand-mist-1
```

Dark mode via `[data-interface-theme="dark"]` attribute on `<html>`.

---

## 5. Admin Panel Application

### Overview
Internal management panel for the EventMart team. **Not publicly deployed** — runs locally on port 5174 and communicates with the production Railway API.

**Dev Port:** 5174  
**API Target:** https://eventmart-v4-production.up.railway.app

### File Structure

```
Admin/
├── src/
│   ├── App.jsx               ← Routes + auth state
│   ├── pages/                ← 7 admin pages
│   ├── components/           ← 5 admin components
│   ├── lib/
│   │   └── admin.js          ← All API interactions
│   └── styles/
│       └── admin.css         ← Admin styles
├── vite.config.js
├── .env.local
└── package.json
```

### Pages (7 total)

| Page | Route | Description |
|---|---|---|
| LoginPage | `/login` | Admin credential login |
| DashboardPage | `/` | Key metrics overview (orders, revenue, users) |
| ProductsPage | `/products` | Full product CRUD — create, edit, delete, bulk import |
| UsersPage | `/users` | View and manage registered users |
| OrdersPage | `/orders` | Browse and manage customer orders |
| AnalyticsPage | `/analytics` | Sales charts, product performance |
| PackagesPage | `/packages` | Create and manage event packages |

### Components (5 total)

| Component | Purpose |
|---|---|
| `AdminLayout.jsx` | Sidebar navigation + main content area |
| `AppScaleFrame.jsx` | Responsive scale wrapper |
| `ProductList.jsx` | Tabular product display with sort/filter |
| `ProductForm.jsx` | Create/edit product form with image upload |
| `StatList.jsx` | Metric stat cards display |

### Admin Library (`admin.js`)
Central module (~2000 lines) containing all API call functions for:
- Product management (CRUD, import, auto-describe)
- User management
- Package management
- Order retrieval
- Token/user persistence in `localStorage`
- Metrics caching (`METRICS_KEY`)

**Auth Storage Keys:**
- `ADMIN_TOKEN_KEY` — JWT token
- `ADMIN_USER_KEY` — Admin user object

### Admin Authentication Flow
1. Admin submits credentials on `LoginPage`
2. On success, token + user stored in `localStorage`
3. `App.jsx` reads stored token on mount
4. All API calls include `Authorization: Bearer <token>`
5. Protected routes check `isAuthenticated` state

---

## 6. Backend Server

### Overview
Monolithic Node.js/Express REST API. Single entry point at `Server/src/index.js` (~3130 lines). Handles authentication, product catalog, orders, packages, AI features, and admin operations.

**Dev Port:** 4000  
**Production URL:** https://eventmart-v4-production.up.railway.app

### File Structure

```
Server/
├── src/
│   ├── index.js              ← Main server, all inline routes
│   ├── db.js                 ← PostgreSQL connection pool
│   ├── create-admin.js       ← CLI tool to seed admin user
│   ├── routes/
│   │   ├── recommendations.js
│   │   ├── adminProducts.js
│   │   └── packages.js
│   ├── services/
│   │   ├── recommendationEngine.js
│   │   ├── aiRecommendationService.js
│   │   ├── recommendationContextBuilder.js
│   │   ├── productImportService.js
│   │   └── (test files)
│   ├── lib/
│   │   ├── catalog.js
│   │   ├── checkout.js
│   │   ├── packageBuilder.js
│   │   ├── builderConfig.js
│   │   ├── eventTypeConfig.js
│   │   ├── cloudinary.js
│   │   ├── autoDescribe.js
│   │   └── (test files)
│   └── utils/
│       ├── skuGenerator.js
│       ├── productImportParser.js
│       └── productImportValidator.js
├── .env.example
└── package.json
```

### Server Configuration

**Middleware Stack (in order):**
1. `helmet()` — Security headers (XSS, HSTS, CSP, etc.)
2. `cors(corsOptions)` — Origin whitelist validation
3. `express.json()` — JSON body parsing
4. `express.urlencoded()` — Form data parsing
5. `rateLimit()` — Request throttling
6. `express.static('/uploads')` — Serve uploaded files

**CORS Allowed Origins:**
- `http://localhost:5173` (Frontend dev)
- `http://localhost:5174` (Admin dev)
- `https://event-mart-v4.vercel.app` (Production Frontend)
- `https://*.vercel.app` (Vercel preview deployments)

### Routes

Routes are split between inline handlers in `index.js` and mounted route modules:

**Mounted Route Modules:**
```
/api/recommendations     ← recommendations.js
/api/admin/products      ← adminProducts.js (auth-required)
/api                     ← packages.js (packages + builder)
/api/config/builder      ← inline builder config handler
/uploads                 ← static file serving
```

**Inline Routes in `index.js`** cover the remainder of the API surface including auth, users, products, checkout, orders, AI planner, geolocation, and customization uploads.

### Route Modules

#### `routes/recommendations.js`
- `GET /api/recommendations/:productId` — Fetch ranked product recommendations
- `POST /api/recommendations/smart` — AI-powered smart recommendations
- `POST /api/recommendations/track` — Track recommendation click/interaction

#### `routes/adminProducts.js`
All routes require Bearer token admin auth.
- `POST /api/admin/products/import` — Bulk import products from XLSX/CSV file
- `GET /api/admin/products/import-template` — Download blank import template
- `POST /api/admin/products/auto-describe` — Generate AI product description via OpenAI
- Product image upload handled via Multer middleware

#### `routes/packages.js`
- `GET /api/packages` — List all active packages
- `GET /api/packages/:id` — Get single package with items
- `POST /api/packages/preview` — Preview package total and items
- `POST /api/package-builder/preview` — Preview custom package
- `POST /api/package-builder/cart-preview` — Preview package as cart items

### Services

#### `services/recommendationEngine.js`
Core ranking algorithm for product recommendations:
- Scores products by category match, price proximity, rating, stock
- Filters already-carted or currently-viewed items
- Returns ranked list with score metadata

#### `services/aiRecommendationService.js`
- Calls OpenAI API to rerank recommendations
- Accepts product list + user context
- Returns reordered recommendations with reasoning

#### `services/recommendationContextBuilder.js`
- Builds context object from user session data
- Includes event type, cart contents, browsing history, guest count
- Used as input to AI reranking

#### `services/productImportService.js`
- Orchestrates bulk product import pipeline
- Calls parser → validator → database insertion
- Returns per-row success/error results

### Libraries (`lib/`)

#### `lib/catalog.js`
Product catalog management:
- Product normalization (price formatting, slug generation)
- Variation handling (size, color, quantity variants)
- Stock management helpers
- Category and tag normalization

#### `lib/checkout.js`
Checkout business logic:
- Order validation (items exist, quantities available)
- Payment authorization logic
- Shipping fee calculation (Egypt zones)
- Address validation
- Order ID generation

#### `lib/packageBuilder.js`
Custom package creation:
- Applies minimums from `builderConfig.js`
- Calculates package pricing with service fees
- Validates item selections
- Returns final package structure

#### `lib/builderConfig.js`
Configuration constants for the package builder:
- Category minimums per package type
- Service fee percentages
- Item limits
- Price caps

#### `lib/cloudinary.js`
Cloudinary integration wrapper:
- `uploadImage(buffer, folder)` — Upload image buffer
- `deleteImage(publicId)` — Delete image by ID
- Configured via `CLOUDINARY_*` env vars

#### `lib/autoDescribe.js`
AI product description generator:
- Takes product name, category, tags
- Calls OpenAI API with prompt engineering
- Returns marketing-ready product description

### Utilities (`utils/`)

| File | Purpose |
|---|---|
| `skuGenerator.js` | Generate unique SKU codes for products |
| `productImportParser.js` | Parse XLSX/CSV rows into product objects |
| `productImportValidator.js` | Validate parsed product data, return errors per row |

### Database Connection (`db.js`)

Uses `pg.Pool` for connection pooling:
```javascript
new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }  // Railway self-signed cert
})
```

The server calls a schema initialization function on startup to ensure all required tables exist.

---

## 7. Database

### Database System
**PostgreSQL** — relational database. Hosted on Railway in production, local PostgreSQL for development.  
Schema is defined in `Server/schema.sql` and applied automatically on server startup via `ensureSchema()`.

---

### Table: `users`
Stores all registered customer accounts.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | auto | Internal user ID |
| `name` | `TEXT` | NOT NULL | — | Full name |
| `email` | `TEXT` | UNIQUE, NOT NULL | — | Email address |
| `password_hash` | `TEXT` | nullable | — | bcrypt hash (NULL for OAuth-only users) |
| `role` | `TEXT` | NOT NULL | `'customer'` | `'customer'` or `'admin'` |
| `email_verified` | `BOOLEAN` | NOT NULL | `false` | Whether email has been verified |
| `google_id` | `TEXT` | UNIQUE (partial, where not null) | NULL | Google OAuth subject ID |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Account creation timestamp |
| `last_login_at` | `TIMESTAMPTZ` | nullable | NULL | Last successful login |

**Indexes:**
- `users_google_id_unique` — unique partial index on `google_id WHERE google_id IS NOT NULL`

---

### Table: `products`
Core product catalog.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | auto | Internal product ID |
| `product_id` | `TEXT` | UNIQUE, NOT NULL | — | Zero-padded public ID (e.g. `00042`) |
| `sku` | `TEXT` | UNIQUE (partial, where not null) | NULL | Stock keeping unit |
| `name` | `TEXT` | NOT NULL | — | Display name |
| `slug` | `TEXT` | UNIQUE | NULL | URL-friendly identifier |
| `category` | `TEXT` | NOT NULL | — | Top-level category |
| `subcategory` | `TEXT` | NOT NULL | — | Sub-category |
| `description` | `TEXT` | NOT NULL | `''` | Marketing description |
| `quality` | `TEXT` | NOT NULL | `''` | Quality tier label |
| `quality_points` | `JSONB` | NOT NULL | `[]` | Array of quality bullet points |
| `colors` | `JSONB` | NOT NULL | `[]` | Available colors array |
| `size_mode` | `TEXT` | NOT NULL, CHECK | `'one-size'` | `'one-size'` or `'varied'` |
| `sizes` | `JSONB` | NOT NULL | `[]` | Available sizes array |
| `customizable` | `BOOLEAN` | NOT NULL | `false` | Whether customization is offered |
| `buy_enabled` | `BOOLEAN` | NOT NULL | `true` | Whether product can be purchased |
| `rent_enabled` | `BOOLEAN` | NOT NULL | `false` | Whether product can be rented |
| `buy_price` | `NUMERIC(12,2)` | nullable | NULL | Purchase price |
| `rent_price_per_day` | `NUMERIC(12,2)` | nullable | NULL | Daily rental price |
| `base_price` | `NUMERIC(12,2)` | nullable | NULL | Base reference price |
| `currency` | `TEXT` | NOT NULL | `'USD'` | Price currency code |
| `event_type` | `TEXT` | NOT NULL | `''` | Target event type |
| `tags` | `JSONB` | NOT NULL | `[]` | Searchable tags array |
| `customization_fee` | `NUMERIC(12,2)` | NOT NULL | `0` | Additional fee for customization |
| `venue_type` | `TEXT` | NOT NULL | `''` | `'indoor'`, `'outdoor'`, or `'hybrid'` |
| `delivery_class` | `TEXT` | NOT NULL | `''` | Delivery tier classification |
| `availability_note` | `TEXT` | NOT NULL | `''` | Freetext availability notice |
| `featured` | `BOOLEAN` | NOT NULL | `false` | Show on homepage featured section |
| `active` | `BOOLEAN` | NOT NULL | `true` | Whether product is publicly visible |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Last update timestamp |

**Constraints:**
- `products_product_id_key` — UNIQUE on `product_id`
- `products_slug_key` — UNIQUE on `slug`
- `products_sku_unique` — unique partial index on `sku WHERE sku IS NOT NULL`
- `products_size_mode_check` — CHECK `size_mode IN ('one-size', 'varied')`

**Indexes:**
- `products_active_idx` on `(active)`
- `products_category_idx` on `(category)`
- `products_subcategory_idx` on `(subcategory)`
- `products_active_featured_idx` on `(active, featured)`

---

### Table: `product_inventory`
Stock levels for each product (1:1 with products).

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `product_id` | `BIGINT` | PRIMARY KEY, FK → `products(id)` ON DELETE CASCADE | — | References products |
| `quantity_available` | `INT` | NOT NULL, CHECK ≥ 0 | `0` | Current available stock |
| `reorder_level` | `INT` | NOT NULL, CHECK ≥ 0 | `0` | Stock level that triggers reorder |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Last stock update |

---

### Table: `product_costs`
Cost data for each product (1:1 with products, used for margin analytics).

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `product_id` | `BIGINT` | PRIMARY KEY, FK → `products(id)` ON DELETE CASCADE | — | References products |
| `unit_cost` | `NUMERIC(12,2)` | NOT NULL | `0` | Per-unit procurement cost |
| `overhead_cost` | `NUMERIC(12,2)` | NOT NULL | `0` | Allocated overhead cost |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Last update |

---

### Table: `product_variations`
Per-product stock at the color+size variation level.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | auto | Internal variation ID |
| `product_id` | `BIGINT` | NOT NULL, FK → `products(id)` ON DELETE CASCADE | — | Parent product |
| `color` | `TEXT` | NOT NULL | — | Color label |
| `size` | `TEXT` | NOT NULL | — | Size label |
| `quantity` | `INT` | NOT NULL | `0` | Stock count for this variation |
| `sku` | `TEXT` | nullable | NULL | Variation-level SKU |
| `availability_status` | `TEXT` | NOT NULL, CHECK | `'in_stock'` | `'in_stock'`, `'out_of_stock'`, or `'unavailable'` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | — |

**Constraints:**
- UNIQUE `(product_id, color, size)`
- `product_variations_availability_status_check` — CHECK on `availability_status`

---

### Table: `product_images`
Images associated with a product, ordered and theme-aware.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | auto | — |
| `product_id` | `BIGINT` | NOT NULL, FK → `products(id)` ON DELETE CASCADE | — | Parent product |
| `url` | `TEXT` | NOT NULL | — | Cloudinary or local image URL |
| `sort_order` | `INT` | NOT NULL | `0` | Display order (ascending) |
| `theme_mode` | `TEXT` | NOT NULL, CHECK | `'light'` | `'light'` or `'dark'` |

**Constraints:**
- `product_images_theme_mode_check` — CHECK `theme_mode IN ('light', 'dark')`

**Indexes:**
- `product_images_product_sort_idx` on `(product_id, sort_order, id)`
- `product_images_product_theme_sort_idx` on `(product_id, theme_mode, sort_order, id)`

---

### Table: `packages`
Pre-built or admin-curated event packages.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | auto | Internal package ID |
| `name` | `TEXT` | NOT NULL | — | Display name |
| `slug` | `TEXT` | UNIQUE, NOT NULL | — | URL-friendly identifier |
| `description` | `TEXT` | NOT NULL | `''` | Package description |
| `customization_type` | `TEXT` | NOT NULL, CHECK | `'not customizable'` | `'customizable'`, `'not customizable'`, or `'hybrid'` |
| `venue_type` | `TEXT` | NOT NULL, CHECK | `'hybrid'` | `'indoor'`, `'outdoor'`, or `'hybrid'` |
| `recommended_for` | `JSONB` | NOT NULL | `[]` | Array of recommended event type strings |
| `fits_for_people` | `INT` | NOT NULL, CHECK > 0 | `1` | Capacity / guest count |
| `price` | `NUMERIC(12,2)` | NOT NULL, CHECK ≥ 0 | `0` | Total package price |
| `event_type` | `TEXT` | NOT NULL | `''` | Primary event type |
| `visibility` | `TEXT` | NOT NULL, CHECK | `'public'` | `'public'`, `'private'`, or `'hidden'` |
| `status` | `TEXT` | NOT NULL, CHECK | `'draft'` | `'draft'`, `'active'`, or `'inactive'` |
| `active` | `BOOLEAN` | NOT NULL | `true` | Whether package is live |
| `context_defaults` | `JSONB` | NOT NULL | `{}` | Builder context defaults (guest count, pricing, etc.) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | — |

**Constraints:**
- `packages_slug_key` — UNIQUE on `slug`
- `packages_customization_type_check`, `packages_venue_type_check`, `packages_visibility_check`, `packages_status_check`, `packages_fits_for_people_check`, `packages_price_check`

**Indexes:**
- `packages_updated_at_idx` on `(updated_at DESC, id DESC)`

---

### Table: `package_items`
Products included in a package with quantity and customization rules.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | auto | — |
| `package_id` | `BIGINT` | NOT NULL, FK → `packages(id)` ON DELETE CASCADE | — | Parent package |
| `product_id` | `BIGINT` | NOT NULL, FK → `products(id)` ON DELETE CASCADE | — | Included product |
| `minimum_quantity` | `INT` | NOT NULL | `1` | Minimum selectable quantity |
| `default_quantity` | `INT` | NOT NULL | `1` | Pre-selected quantity |
| `customizable` | `BOOLEAN` | NOT NULL | `false` | Whether this item is customizable |
| `is_required` | `BOOLEAN` | NOT NULL | `false` | Whether this item is mandatory |
| `preferred_mode` | `TEXT` | NOT NULL, CHECK | `''` | `''`, `'buy'`, or `'rent'` |
| `applies_to_event_types` | `JSONB` | NOT NULL | `[]` | Event types this item applies to |
| `applies_to_venue_types` | `JSONB` | NOT NULL | `[]` | Venue types this item applies to |
| `discount_tiers` | `JSONB` | NOT NULL | `[]` | Quantity-based discount tiers |
| `notes` | `TEXT` | NOT NULL | `''` | Internal notes |
| `sort_order` | `INT` | NOT NULL | `0` | Display order |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | — |

**Constraints:**
- UNIQUE `(package_id, product_id)`
- `package_items_preferred_mode_check` — CHECK `preferred_mode IN ('', 'buy', 'rent')`

**Indexes:**
- `package_items_package_sort_idx` on `(package_id, sort_order, id)`

---

### Table: `orders`
Customer orders.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | auto | Internal order ID |
| `user_id` | `BIGINT` | FK → `users(id)` ON DELETE SET NULL | NULL | Placing user |
| `status` | `TEXT` | NOT NULL | `'pending'` | Order status |
| `public_order_id` | `TEXT` | UNIQUE | NULL | Human-readable ID (e.g. `EM-20240101-000042`) |
| `subtotal` | `NUMERIC(12,2)` | NOT NULL | `0` | Items subtotal before fees |
| `tax` | `NUMERIC(12,2)` | NOT NULL | `0` | Tax amount |
| `discount` | `NUMERIC(12,2)` | NOT NULL | `0` | Discount amount |
| `shipping` | `NUMERIC(12,2)` | NOT NULL | `0` | Shipping fee |
| `total` | `NUMERIC(12,2)` | NOT NULL | `0` | Grand total |
| `currency` | `TEXT` | NOT NULL | `'USD'` | Currency code |
| `shipping_details` | `JSONB` | NOT NULL | `{}` | Delivery address and method |
| `billing_details` | `JSONB` | NOT NULL | `{}` | Billing address |
| `delivery_estimate` | `TEXT` | nullable | NULL | Human-readable delivery window |
| `deposit_required` | `NUMERIC(12,2)` | NOT NULL | `0` | Advance deposit amount |
| `deposit_paid` | `NUMERIC(12,2)` | NOT NULL | `0` | Amount of deposit already paid |
| `deposit_status` | `TEXT` | NOT NULL, CHECK | `'unpaid'` | `'unpaid'`, `'paid'`, or `'failed'` |
| `deposit_paid_at` | `TIMESTAMPTZ` | nullable | NULL | When deposit was paid |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Order placement time |
| `paid_at` | `TIMESTAMPTZ` | nullable | NULL | Full payment timestamp |

**Constraints:**
- `orders_public_order_id_key` — UNIQUE on `public_order_id`
- `orders_deposit_status_check` — CHECK on `deposit_status`

**Indexes:**
- `orders_user_created_idx` on `(user_id, created_at DESC)`

---

### Table: `order_items`
Individual line items within an order.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | auto | — |
| `order_id` | `BIGINT` | NOT NULL, FK → `orders(id)` ON DELETE CASCADE | — | Parent order |
| `product_id` | `BIGINT` | NOT NULL, FK → `products(id)` | — | Ordered product |
| `variation_id` | `BIGINT` | FK → `product_variations(id)` ON DELETE SET NULL | NULL | Selected variation |
| `quantity` | `INT` | NOT NULL | — | Quantity ordered |
| `type` | `TEXT` | NOT NULL | `'buy'` | `'buy'` or `'rent'` |
| `selected_color` | `TEXT` | nullable | NULL | Color chosen at order time |
| `selected_size` | `TEXT` | nullable | NULL | Size chosen at order time |
| `customization_requested` | `BOOLEAN` | NOT NULL | `false` | Whether customization was requested |
| `rent_days` | `INT` | nullable | NULL | Number of rental days (if type = rent) |
| `unit_price` | `NUMERIC(12,2)` | NOT NULL | — | Price per unit at time of order |
| `unit_cost_snapshot` | `NUMERIC(12,2)` | NOT NULL | `0` | Cost snapshot for margin tracking |
| `line_total` | `NUMERIC(12,2)` | NOT NULL | — | `unit_price × quantity` |

---

### Table: `customization_uploads`
Files uploaded by customers for product customization (mockups, designs).

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | auto | — |
| `upload_token` | `TEXT` | UNIQUE, NOT NULL | — | Token linking upload to cart item |
| `product_id` | `BIGINT` | NOT NULL, FK → `products(id)` ON DELETE CASCADE | — | Target product |
| `variation_id` | `BIGINT` | FK → `product_variations(id)` ON DELETE SET NULL | NULL | Target variation |
| `package_id` | `BIGINT` | FK → `packages(id)` ON DELETE SET NULL | NULL | Package context (if applicable) |
| `package_item_id` | `BIGINT` | FK → `package_items(id)` ON DELETE SET NULL | NULL | Package item context |
| `user_id` | `BIGINT` | FK → `users(id)` ON DELETE SET NULL | NULL | Uploading user |
| `order_item_id` | `BIGINT` | FK → `order_items(id)` ON DELETE SET NULL | NULL | Linked order item (after checkout) |
| `upload_kind` | `TEXT` | NOT NULL, CHECK | — | `'mockup'` or `'design'` |
| `original_file_name` | `TEXT` | NOT NULL | — | Original filename |
| `stored_path` | `TEXT` | NOT NULL | — | Server filesystem path |
| `mime_type` | `TEXT` | NOT NULL | — | MIME type (pdf, jpg, png, webp) |
| `size_bytes` | `INT` | NOT NULL | — | File size in bytes |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Upload timestamp |

**Constraints:**
- `customization_uploads_upload_kind_check` — CHECK `upload_kind IN ('mockup', 'design')`

**Indexes:**
- `customization_uploads_user_idx` on `(user_id)`

---

### Table: `expenses`
Internal expense tracking for admin analytics.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | auto | — |
| `category` | `TEXT` | NOT NULL | — | Expense category |
| `amount` | `NUMERIC(12,2)` | NOT NULL | — | Amount |
| `note` | `TEXT` | nullable | NULL | Optional note |
| `occurred_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | When expense occurred |

---

### Table: `events`
Analytics event log — tracks user interactions (product views, orders, etc.).

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | auto | — |
| `user_id` | `BIGINT` | FK → `users(id)` ON DELETE SET NULL | NULL | Acting user (NULL for guests) |
| `session_id` | `TEXT` | NOT NULL | — | Client session identifier |
| `event_type` | `TEXT` | NOT NULL | — | Event type string (e.g. `product_view`) |
| `product_id` | `BIGINT` | FK → `products(id)` ON DELETE SET NULL | NULL | Related product (if any) |
| `order_id` | `BIGINT` | FK → `orders(id)` ON DELETE SET NULL | NULL | Related order (if any) |
| `metadata` | `JSONB` | NOT NULL | `{}` | Arbitrary event payload |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Event timestamp |

---

### Table: `contact_messages`
Messages submitted through the Contact page.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | auto | — |
| `full_name` | `TEXT` | NOT NULL | — | Sender's name |
| `email` | `TEXT` | NOT NULL | — | Sender's email |
| `subject` | `TEXT` | NOT NULL | — | Message subject |
| `message` | `TEXT` | NOT NULL | — | Message body |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Submission timestamp |

---

### Table: `password_reset_tokens`
One-time tokens for password reset flow.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | auto | — |
| `user_id` | `BIGINT` | NOT NULL, FK → `users(id)` ON DELETE CASCADE | — | Token owner |
| `token` | `TEXT` | UNIQUE, NOT NULL | — | Secure random token |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | — | Expiry timestamp |
| `used_at` | `TIMESTAMPTZ` | nullable | NULL | When token was consumed |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Creation timestamp |

---

### Table: `email_verification_codes`
Short-lived codes for email address verification.

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY | auto | — |
| `user_id` | `BIGINT` | NOT NULL, FK → `users(id)` ON DELETE CASCADE | — | User being verified |
| `code` | `TEXT` | NOT NULL | — | Verification code |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | — | Expiry timestamp |
| `used_at` | `TIMESTAMPTZ` | nullable | NULL | When code was consumed |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Creation timestamp |

**Indexes:**
- `email_verification_codes_user_idx` on `(user_id, created_at DESC)`

---

### Entity Relationship Summary

```
users ──────────────────────────── orders (user_id → users.id)
                                      └── order_items (order_id → orders.id)
                                              ├── products (product_id → products.id)
                                              └── product_variations (variation_id → product_variations.id)

products ───────────────────────── product_inventory (product_id → products.id)
         ───────────────────────── product_costs     (product_id → products.id)
         ───────────────────────── product_variations(product_id → products.id)
         ───────────────────────── product_images    (product_id → products.id)

packages ───────────────────────── package_items (package_id → packages.id)
                                      └── products (product_id → products.id)

users ──────────────────────────── password_reset_tokens  (user_id → users.id)
      ──────────────────────────── email_verification_codes(user_id → users.id)

customization_uploads ─────────── products, product_variations, packages,
                                   package_items, users, order_items

events ─────────────────────────── users, products, orders
```

### Schema Initialization
On server startup, `ensureSchema()` reads `Server/schema.sql` and executes it against the database. All statements use `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`, making the migration safe to re-run on every deploy.

---

## 8. API Reference

### Base URL
- Development: `http://localhost:4000`
- Production: `https://eventmart-v4-production.up.railway.app`

### Authentication
Protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

### Endpoint Groups

#### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | No | Login with email + password |
| POST | `/api/auth/register` | No | Create new account |
| GET | `/api/auth/google` | No | Google OAuth initiate |
| GET | `/api/auth/callback` | No | Google OAuth callback |

#### Current User
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/me` | Yes | Get authenticated user profile |
| GET | `/api/me/orders` | Yes | Get user's order history |

#### Products
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/products` | No | List products (supports filters) |
| GET | `/api/products/slug/:slug` | No | Get product by slug |

#### Cart & Checkout
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/checkout/orders` | Yes | Place new order |
| GET | `/api/orders/:publicOrderId/confirmation` | Yes | Get order confirmation |

#### Packages
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/packages` | No | List packages |
| GET | `/api/packages/:id` | No | Get package by ID |
| POST | `/api/packages/preview` | No | Preview package totals |

#### Package Builder
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/config/builder` | No | Get builder configuration |
| POST | `/api/package-builder/preview` | No | Preview custom package |
| POST | `/api/package-builder/cart-preview` | No | Get package as cart items |

#### Recommendations
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/recommendations/:productId` | No | Get recommendations for product |
| POST | `/api/recommendations/smart` | No | Smart AI recommendations |
| POST | `/api/recommendations/track` | No | Track recommendation interaction |

#### AI Features
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/ai-planner` | Yes | Send message to AI planner |

#### Customization
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/customization-uploads` | Yes | Upload custom product file |

#### Geolocation
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/geolocation/reverse-egypt` | No | Reverse geocode in Egypt |

#### Admin (all require admin Bearer token)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/users` | Admin | List all users |
| GET | `/api/admin/orders` | Admin | List all orders |
| POST | `/api/admin/products/import` | Admin | Bulk import products |
| GET | `/api/admin/products/import-template` | Admin | Download import template |
| POST | `/api/admin/products/auto-describe` | Admin | Generate AI description |

---

## 9. Authentication & Security

### User Authentication Flow

1. **Registration:** User submits email + password → server hashes password with bcrypt (10 rounds) → stores in `users` table → returns JWT
2. **Login:** User submits credentials → server compares bcrypt hash → on match, signs JWT with `JWT_SECRET` → returns token
3. **Session:** Token stored in Frontend `localStorage` under `eventmart_auth_v1`
4. **API Calls:** Token attached as `Authorization: Bearer <token>` on protected requests
5. **Token Validation:** Server middleware verifies JWT signature and expiry on each protected route
6. **Logout:** Token cleared from localStorage, React state reset

### Google OAuth Flow
1. User clicks "Sign in with Google"
2. Frontend redirects to `/api/auth/google`
3. Server redirects to Google OAuth consent screen
4. Google redirects back to `/api/auth/callback`
5. Server exchanges code for user info
6. Server creates/finds user, issues JWT
7. Frontend callback page stores token and redirects

### Admin Authentication
- Separate login endpoint with admin role check
- Token stored in `localStorage` under `ADMIN_TOKEN_KEY`
- All admin API routes verify Bearer token AND admin role

### Security Measures

| Measure | Implementation |
|---|---|
| Password hashing | bcryptjs with configurable salt rounds (default 10) |
| JWT tokens | HS256 signed with `JWT_SECRET` env var |
| Security headers | Helmet middleware (XSS, HSTS, CSP, no-sniff) |
| Rate limiting | express-rate-limit on API routes |
| CORS | Strict origin whitelist — only known domains allowed |
| SQL injection | Parameterized queries via `pg` |
| File upload | Multer with type/size restrictions |
| HTTPS | Enforced at Vercel (frontend) and Railway (backend) |
| SSL | PostgreSQL SSL with Railway self-signed cert support |

---

## 10. UI/UX Design System

### Design Philosophy
- **Dark-first design** with light mode support
- **Consistent scaling** via CSS `--app-scale` variable (no media query breakpoints — uses transform-based scaling)
- **Subtle motion** — Framer Motion for page transitions, no gratuitous animation
- **Brand identity** — Deep navy + teal palette, professional event aesthetic

### Color Palette

| Token | Role |
|---|---|
| `--brand-deep-1` | Primary dark background |
| `--brand-deep-2` | Secondary surface |
| `--brand-deep-4` | Elevated card surface |
| `--brand-teal-1` | Primary action / CTA |
| `--brand-teal-2` | Hover / active teal |
| `--brand-mist-1` | Soft neutral / dividers |

### Typography
- System font stack (no custom fonts)
- Size scale managed via `--app-scale` multiplier

### Responsive Design
Uses a CSS custom property `--app-scale` applied via `AppScaleFrame` component. Rather than breakpoint-based layouts, the entire UI scales proportionally — suitable for desktop-first event marketplace.

### Animations (Framer Motion)
- **Page transitions:** `AnimatePresence` wrapping `<Routes>` — slide/fade between pages
- **Hero slideshow:** Auto-advancing carousel with crossfade
- **Featured carousel:** Horizontal scroll with drag support
- **Micro-interactions:** Button hover states, modal entry

### Theme Switching
`ThemeContext` applies `data-interface-theme="dark"` | `"light"` to `<html>` element. All CSS variables are redefined under each selector, enabling instant theme swap without page reload.

### Key UX Patterns

| Pattern | Implementation |
|---|---|
| Protected Routes | `ProtectedRoute` HOC redirects to `/auth` with return URL |
| Loading States | Per-component loading spinners / skeleton states |
| Error States | Inline error messages with retry CTAs |
| Empty States | Illustrated empty cart/no results messages |
| Toast/Feedback | Inline feedback on form actions |
| Optimistic UI | Cart updates reflected immediately, synced with server |
| Lazy Loading | Products fetched on scroll/filter change |
| Event Type Personalization | Shop heading, filters, and recommendations adapt to selected event type |

---

## 11. Features & Functionality

### 1. Product Catalog
- Browse all products with category and event type filters
- Search by name/tag
- Product cards with image, name, price, availability
- Product detail page with:
  - Multiple images
  - Product variations (size, color, etc.)
  - Buy / Rent selection
  - Add to cart
  - Smart recommendations section

### 2. Shopping Cart
- Persistent cart (survives page refresh via state normalization)
- Add/remove/update quantities
- Support for product variations
- Custom file upload tokens per item
- Running total with fee breakdown
- Checkout CTA with item count badge in Navbar

### 3. Checkout
- Delivery address form with Egypt address validation
- Governorate/city selection
- Order summary with line items
- Total calculation including delivery fee
- Order placement → confirmation page with order ID

### 4. User Accounts
- Register / Login / Google OAuth
- Email verification flow
- Profile page:
  - Edit personal info
  - View order history
  - Order status tracking

### 5. Event Packages
- Pre-built packages for common event types
- Package detail with full item list and pricing
- Add full package to cart
- Custom Package Builder:
  - Select event type
  - Configure item categories
  - Apply minimums automatically
  - Get instant price preview

### 6. AI Event Planner
- Chat-based interface powered by OpenAI
- User describes event requirements in natural language
- AI responds with equipment recommendations
- Context-aware — remembers conversation history per session
- Accessible to authenticated users only

### 7. Smart Recommendations
**Client-side:** Rule-based scoring by category match, price range, popularity  
**Server-side AI:** OpenAI reranks recommendations based on user context (event type, cart contents, behavior history)  
**Tracking:** Recommendation impressions and clicks logged for analytics

### 8. Admin Panel
- **Dashboard:** Total orders, revenue, user count, product count
- **Products:** Full CRUD, bulk CSV/XLSX import, AI auto-description generation, image upload to Cloudinary
- **Users:** List users, view details
- **Orders:** View and manage all orders
- **Analytics:** Sales trends, product performance
- **Packages:** Create and manage event packages

### 9. Image Management
- Product images uploaded to **Cloudinary**
- Automatic optimization and CDN delivery
- Separate upload flow for product customization files
- Upload folder organized under `eventmart/products`

### 10. Email Notifications
- Transactional emails via **Resend**
- Order confirmation emails
- Email verification for new accounts

### 11. Bulk Product Import
- Admin uploads XLSX or CSV file
- Server parses with `productImportParser`
- Validates each row with `productImportValidator`
- Inserts valid rows, returns per-row error report
- Downloadable blank template for proper formatting

### 12. AI Auto-Description
- Admin provides product name, category, tags
- Server calls OpenAI to generate marketing description
- Returned description pre-fills the product form

### 13. Geolocation
- Reverse geocoding endpoint scoped to Egypt
- Used in checkout for address autocomplete/validation

### 14. User Behavior Tracking
- Selected event type stored per session
- Cart additions tracked for recommendation context
- Guest count estimated from behavior signals
- Used to personalize recommendations without requiring login

---

## 12. Third-Party Integrations

### OpenAI API
- **Model:** `gpt-4o-mini` (configurable via `OPENAI_MODEL` env var)
- **Base URL:** `https://api.openai.com/v1` (configurable for custom proxy)
- **Use cases:**
  1. AI Event Planner chat
  2. Product description auto-generation
  3. Smart recommendation reranking

### Cloudinary
- **Purpose:** Product image hosting and CDN
- **Integration:** Direct upload from server via `cloudinary.js` wrapper
- **Config:** `CLOUDINARY_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- **Folder:** `eventmart/products`

### Resend
- **Purpose:** Transactional email delivery
- **Use cases:** Order confirmations, email verification
- **Config:** `RESEND_API_KEY` env var

### Google OAuth 2.0
- **Purpose:** Social login for customers
- **Config:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Callback:** `/api/auth/callback`

### Vercel
- **Purpose:** Frontend deployment and hosting
- **Features used:** Automatic deploys from git, edge CDN
- **Analytics:** `@vercel/analytics` in Admin panel

### Railway
- **Purpose:** Backend server + PostgreSQL hosting
- **Auto-deploy:** Configured from git repository
- **Database:** Managed PostgreSQL instance with SSL

---

## 13. State Management

EventMart uses **React Context API** (not Redux/Zustand) for global state. This is appropriate for the application's scale.

### State Architecture

```
ThemeContext       → interface theme (dark/light)
AuthContext        → user session, token, auth actions
CartContext        → cart items, totals, cart actions
```

### Local State
Individual pages and components manage their own local state via `useState` and `useEffect` for:
- Loading states
- Form inputs
- Modal open/close
- Pagination / filter selections

### Server State
No dedicated server-state library (no React Query/SWR). API calls are made directly from components and hooks using the `api.js` module. Results are stored in local `useState`.

### Persistence
| Data | Storage | Key |
|---|---|---|
| Auth token | localStorage | `eventmart_auth_v1` |
| Theme | localStorage | (ThemeContext key) |
| Admin token | localStorage | `ADMIN_TOKEN_KEY` |
| Admin user | localStorage | `ADMIN_USER_KEY` |
| Admin metrics | localStorage | `METRICS_KEY` |

---

## 14. Routing

### Frontend Routing (React Router v6)

Uses `<BrowserRouter>` with `<Routes>` / `<Route>` pattern. `AnimatePresence` from Framer Motion wraps `<Routes>` for animated page transitions.

**Route Guard:** `ProtectedRoute` component checks `AuthContext` — if not authenticated, redirects to `/auth?redirect=<current_path>` so user is returned after login.

### Admin Routing (React Router v6)

Admin uses simple `<Routes>` without animation. All routes except `/login` check `isAuthenticated` state in `App.jsx`. Unauthenticated access redirects to `/login`.

### Server Routing (Express)

Express Router pattern. Route modules mounted with `app.use()`:

```javascript
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/admin/products', adminProductsRouter);
app.use('/api', packagesRouter);
```

Remaining routes are defined inline in `index.js`.

---

## 15. Testing

EventMart has a custom lightweight test runner (no Jest/Vitest).

### Test Runner
Both Frontend and Server have `src/lib/run-tests.js` — a custom Node.js test runner that imports test files and reports pass/fail.

**Run tests:**
```bash
npm run test   # in Frontend/ or Server/
```

### Frontend Tests
| File | Tests |
|---|---|
| `lib/api.test.js` | API request function, URL building |
| `lib/products.test.js` | Product fetch and normalization |
| `lib/checkout.test.js` | Checkout validation logic |
| `lib/packages.test.js` | Package fetching |
| `lib/packageMinimums.test.js` | Package minimum rules |
| `lib/recommendationEngine.test.js` | Recommendation scoring |
| `lib/authNavigation.test.js` | Auth redirect logic |

### Server Tests
| File | Tests |
|---|---|
| `lib/catalog.test.js` | Product catalog normalization |
| `lib/checkout.test.js` | Server-side checkout logic |
| `lib/packageBuilder.test.js` | Package builder pricing |
| `services/productImportService.test.js` | Import pipeline |
| `services/recommendationContextBuilder.test.js` | Context builder |

### Test Coverage Areas
- Business logic (pricing, validation, normalization)
- API utility functions
- Recommendation engine scoring
- Package minimums enforcement
- Import parsing and validation

---

## 16. Deployment & Infrastructure

### Production Architecture

```
User Browser
    │
    ▼
Vercel (Frontend CDN)
event-mart-v4.vercel.app
    │ HTTPS API calls
    ▼
Railway (Backend)
eventmart-v4-production.up.railway.app:443
    │
    ▼
Railway PostgreSQL
    │
    ├── Cloudinary (images)
    ├── OpenAI API (AI features)
    ├── Resend (emails)
    └── Google OAuth (auth)
```

### Frontend (Vercel)
- **Deploy:** Push to main branch triggers auto-deploy
- **Build command:** `vite build`
- **Output dir:** `dist/`
- **Environment:** `VITE_API_URL=https://eventmart-v4-production.up.railway.app`

### Backend (Railway)
- **Deploy:** Push to main triggers auto-deploy
- **Start command:** `node src/index.js`
- **Environment:** All `PGHOST/PORT/DB/USER/PASS`, `JWT_SECRET`, `OPENAI_API_KEY`, `CLOUDINARY_*`, `RESEND_API_KEY`, `GOOGLE_*` vars set in Railway dashboard
- **Database:** Railway-managed PostgreSQL with SSL (rejectUnauthorized: false for Railway self-signed cert)

### Admin Panel
- **Not deployed publicly** — runs locally on developer machines
- Points to production Railway API for managing production data
- Admin `.env.local`: `VITE_API_URL=https://eventmart-v4-production.up.railway.app`

---

## 17. Development Workflow

### Prerequisites
- Node.js LTS
- npm
- PostgreSQL (local dev)
- Environment variables configured

### Setup
```bash
# 1. Clone repository
git clone <repo>
cd EventMart-V4

# 2. Install all dependencies
npm run install:all

# 3. Configure environment
cp Server/.env.example Server/.env
# Edit Server/.env with your local DB credentials, API keys

# 4. Start all three apps
npm run dev
```

### Individual Start Commands
```bash
npm run dev:server      # Backend only (port 4000)
npm run dev:frontend    # Frontend only (port 5173)
npm run dev:admin       # Admin only (port 5174)
```

### Create First Admin User
```bash
cd Server
npm run create-admin
# Follow CLI prompts to set email and password
```

### Git Workflow
- **Branch:** `main` is the primary branch
- **Remote:** GitHub repository
- **Deploy:** Auto-deploy on push to `main` (Vercel + Railway)

---

## 18. Project Structure

### Full Directory Tree (source files only)

```
EventMart-V4/
├── package.json                    ← Root monorepo config
│
├── Frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── ShopPage.jsx
│   │   │   ├── ProductDetailPage.jsx
│   │   │   ├── CartPage.jsx
│   │   │   ├── AuthPage.jsx
│   │   │   ├── CheckoutPage.jsx
│   │   │   ├── OrderConfirmationPage.jsx
│   │   │   ├── ProfilePage.jsx
│   │   │   ├── AIPlannerPage.jsx
│   │   │   ├── PackagesPage.jsx
│   │   │   ├── PackageDetailPage.jsx
│   │   │   ├── PackageBuilderPage.jsx
│   │   │   ├── AboutPage.jsx
│   │   │   ├── ContactPage.jsx
│   │   │   ├── AuthCallbackPage.jsx
│   │   │   ├── VerifyEmailPage.jsx
│   │   │   └── NotFoundPage.jsx
│   │   ├── components/
│   │   │   ├── AppShell.jsx
│   │   │   ├── AppScaleFrame.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── HeroSlideshow.jsx
│   │   │   ├── FeaturedCarousel.jsx
│   │   │   ├── RecommendationsSection.jsx
│   │   │   ├── SmartRecommendationBar.jsx
│   │   │   ├── EventTypeShopHeading.jsx
│   │   │   └── shop/
│   │   │       ├── ProductCard.jsx
│   │   │       └── ProductModal.jsx
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx
│   │   │   ├── CartContext.jsx
│   │   │   └── ThemeContext.jsx
│   │   ├── hooks/
│   │   │   ├── useRequireAuth.js
│   │   │   ├── useSmartRecommendations.js
│   │   │   └── useCartPricingSummary.js
│   │   ├── lib/
│   │   │   ├── api.js
│   │   │   ├── api.test.js
│   │   │   ├── endpoints.js
│   │   │   ├── products.js
│   │   │   ├── products.test.js
│   │   │   ├── productDetail.js
│   │   │   ├── productRuleEngine.js
│   │   │   ├── homeHeroShowcaseImages.js
│   │   │   ├── cart.js
│   │   │   ├── checkout.js
│   │   │   ├── checkout.test.js
│   │   │   ├── packages.js
│   │   │   ├── packages.test.js
│   │   │   ├── packageMinimums.js
│   │   │   ├── packageMinimums.test.js
│   │   │   ├── recommendationEngine.js
│   │   │   ├── recommendationEngine.test.js
│   │   │   ├── smartRecommendationService.js
│   │   │   ├── userBehavior.js
│   │   │   ├── eventTypeConfig.js
│   │   │   ├── authNavigation.js
│   │   │   ├── authNavigation.test.js
│   │   │   └── run-tests.js
│   │   └── styles/
│   │       ├── index.css
│   │       ├── theme.css
│   │       ├── home.css
│   │       ├── shop.css
│   │       ├── cart.css
│   │       ├── checkout.css
│   │       ├── profile.css
│   │       ├── auth.css
│   │       ├── packages.css
│   │       ├── ai-planner.css
│   │       ├── contact.css
│   │       ├── experience.css
│   │       └── order-confirmation.css
│   ├── vite.config.js
│   ├── .env.local
│   └── package.json
│
├── Admin/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── ProductsPage.jsx
│   │   │   ├── UsersPage.jsx
│   │   │   ├── OrdersPage.jsx
│   │   │   ├── AnalyticsPage.jsx
│   │   │   └── PackagesPage.jsx
│   │   ├── components/
│   │   │   ├── AdminLayout.jsx
│   │   │   ├── AppScaleFrame.jsx
│   │   │   ├── ProductList.jsx
│   │   │   ├── ProductForm.jsx
│   │   │   └── StatList.jsx
│   │   ├── lib/
│   │   │   └── admin.js
│   │   └── styles/
│   │       └── admin.css
│   ├── vite.config.js
│   ├── .env.local
│   └── package.json
│
└── Server/
    ├── src/
    │   ├── index.js                ← Main server (~3130 lines)
    │   ├── db.js
    │   ├── create-admin.js
    │   ├── routes/
    │   │   ├── recommendations.js
    │   │   ├── adminProducts.js
    │   │   └── packages.js
    │   ├── services/
    │   │   ├── recommendationEngine.js
    │   │   ├── aiRecommendationService.js
    │   │   ├── recommendationContextBuilder.js
    │   │   ├── recommendationContextBuilder.test.js
    │   │   ├── productImportService.js
    │   │   └── productImportService.test.js
    │   ├── lib/
    │   │   ├── catalog.js
    │   │   ├── catalog.test.js
    │   │   ├── checkout.js
    │   │   ├── checkout.test.js
    │   │   ├── packageBuilder.js
    │   │   ├── packageBuilder.test.js
    │   │   ├── builderConfig.js
    │   │   ├── eventTypeConfig.js
    │   │   ├── cloudinary.js
    │   │   ├── autoDescribe.js
    │   │   └── run-tests.js
    │   └── utils/
    │       ├── skuGenerator.js
    │       ├── productImportParser.js
    │       └── productImportValidator.js
    ├── .env.example
    └── package.json
```

---

## 19. Environment Configuration

### Frontend (`Frontend/.env.local`)
```env
VITE_API_URL=http://localhost:4000
```

### Admin (`Admin/.env.local`)
```env
VITE_API_URL=https://eventmart-v4-production.up.railway.app
```

### Server (`Server/.env` — not in git)
```env
# App
PORT=4000
JWT_SECRET=replace_with_a_long_random_secret
BCRYPT_SALT_ROUNDS=10
FRONTEND_URL=http://localhost:5173

# Database
PGHOST=your_db_host
PGPORT=5432
PGDATABASE=your_db_name
PGUSER=your_db_user
PGPASSWORD=your_db_password

# OpenAI
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1

# Cloudinary
CLOUDINARY_URL=cloudinary://key:secret@cloud
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_PRODUCT_IMAGE_FOLDER=eventmart/products

# Email (Resend)
RESEND_API_KEY=your_resend_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

> `Server/.env` is gitignored. Production vars are set in Railway dashboard.

---

## 20. Methodologies & Patterns

### Software Architecture

| Pattern | Usage |
|---|---|
| **Monorepo** | Three apps in one repository with shared scripts |
| **SPA (Single Page Application)** | Frontend and Admin both React SPAs |
| **REST API** | All client-server communication via HTTP/JSON |
| **Three-Tier Architecture** | Presentation / Application / Data layers |
| **Monolithic Backend** | Single Express server handling all routes |

### React Patterns

| Pattern | Usage |
|---|---|
| **Context API** | Global state — auth, cart, theme |
| **Custom Hooks** | Reusable logic — `useRequireAuth`, `useSmartRecommendations`, `useCartPricingSummary` |
| **HOC (Higher-Order Component)** | `ProtectedRoute` wraps page components |
| **Composition** | `AppShell` composes Navbar + content + Footer |
| **Controlled Components** | All forms use React-controlled inputs |
| **Code Splitting** | Vite handles per-route chunk splitting |

### Backend Patterns

| Pattern | Usage |
|---|---|
| **Middleware Pipeline** | Helmet → CORS → parsing → rate limit → routes |
| **Route Modules** | Separate files for recommendations, admin, packages |
| **Service Layer** | `services/` separates business logic from routes |
| **Repository Pattern (light)** | `lib/catalog.js`, `lib/checkout.js` encapsulate DB + logic |
| **Connection Pooling** | `pg.Pool` for efficient DB connections |
| **Parameterized Queries** | All SQL uses `$1, $2` parameters (SQL injection prevention) |

### CSS / Styling

| Pattern | Usage |
|---|---|
| **CSS Custom Properties** | All colors, spacing, scaling via `var(--*)` |
| **BEM-like naming** | Consistent class naming conventions |
| **CSS-only dark mode** | `[data-interface-theme]` attribute switch — no JS class toggling |
| **Scale-based responsive** | `--app-scale` multiplier instead of breakpoints |
| **File-per-page** | Each page has its own CSS file |

### Development Methodology

| Practice | Implementation |
|---|---|
| **Environment separation** | `.env.local` (dev) vs Railway dashboard (prod) |
| **Gitignored secrets** | `Server/.env` never tracked |
| **Schema auto-init** | Tables created on server startup if missing |
| **Concurrent dev** | `concurrently` runs all three apps from root |
| **Custom test runner** | Lightweight `run-tests.js` — no external test framework overhead |
| **AI-assisted development** | OpenAI used within the product for auto-descriptions and planning |

### Security Practices

| Practice | Implementation |
|---|---|
| **Defense in depth** | Helmet + CORS + rate limiting + JWT + bcrypt all layered |
| **Least privilege** | Admin routes separately guarded with role check |
| **Env var secrets** | No credentials in source code |
| **SSL in production** | Railway + Vercel enforce HTTPS |
| **Input validation** | Import parser validates every row before DB insert |

---

## Summary Statistics

| Metric | Value |
|---|---|
| Total applications | 3 (Frontend, Admin, Server) |
| Frontend pages | 17 |
| Frontend components | 12 |
| Frontend contexts | 3 |
| Frontend custom hooks | 3 |
| Frontend lib modules | 24 (incl. tests) |
| Frontend CSS files | 13 |
| Admin pages | 7 |
| Admin components | 5 |
| Server route modules | 3 |
| Server service modules | 5 (incl. tests) |
| Server lib modules | 11 (incl. tests) |
| Server utility modules | 3 |
| API endpoint groups | 12 |
| Total API endpoints | ~40 |
| External integrations | 4 (OpenAI, Cloudinary, Resend, Google OAuth) |
| Deployment platforms | 2 (Vercel, Railway) |
| Test files | 12 |
| npm packages (total) | ~25 production deps |

---

*Documentation generated May 2026 — EventMart V4*
