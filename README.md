# EventMart V4

B2B event equipment marketplace for Egypt — buy and rent lighting, audio, rigging, and furniture for events.

## Project Structure

```
EventMart-V4/
├── Frontend/     React + Vite storefront (customer-facing)
├── Admin/        React + Vite admin panel
└── Server/       Node.js + Express API + PostgreSQL
```

## Running Locally

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or a Railway/Neon hosted instance)

### 1. Backend

```bash
cd Server
cp .env.example .env        # fill in your values (see below)
npm install
node src/index.js
```

The API starts on `http://localhost:4000`.

**First-time DB setup:**
```bash
psql $DATABASE_URL -f schema.sql   # create all tables
psql $DATABASE_URL -f seed.sql     # load demo products & packages
```

**Create an admin user:**
```bash
npm run create-admin "Your Name" your@email.com YourPassword123
```

### 2. Frontend (storefront)

```bash
cd Frontend
cp .env.local.example .env.local   # set VITE_API_URL
npm install
npm run dev                        # http://localhost:5173
```

### 3. Admin Panel

```bash
cd Admin
cp .env.local.example .env.local   # set VITE_API_URL
npm install
npm run dev                        # http://localhost:5174
```

Sign in at `/` with the admin credentials you created above.

---

## Environment Variables

### `Server/.env`

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | HTTP port (default: 4000) |
| `JWT_SECRET` | **yes** | Long random string used to sign tokens |
| `BCRYPT_SALT_ROUNDS` | no | bcrypt rounds (default: 10) |
| `FRONTEND_URL` | no | Storefront origin for CORS |
| `PGHOST` | **yes** | PostgreSQL host |
| `PGPORT` | no | PostgreSQL port (default: 5432) |
| `PGDATABASE` | **yes** | Database name |
| `PGUSER` | **yes** | Database user |
| `PGPASSWORD` | **yes** | Database password |
| `OPENAI_API_KEY` | no | Powers the AI event planner (`/api/ai-planner`) |
| `OPENAI_MODEL` | no | Model ID (default: `gpt-4o-mini`) |
| `CLOUDINARY_CLOUD_NAME` | no | Cloudinary cloud for product images |
| `CLOUDINARY_API_KEY` | no | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | no | Cloudinary API secret |
| `CLOUDINARY_PRODUCT_IMAGE_FOLDER` | no | Upload folder path |

### `Frontend/.env.local` / `Admin/.env.local`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | **yes** | Full URL of the backend, e.g. `http://localhost:4000` |

---

## Demo Credentials (after running seed.sql)

| Role | Email | Password |
|---|---|---|
| Admin | admin@eventmart.com | Admin123! |
| Customer | customer@eventmart.com | Customer123! |

---

## API Overview

### Products
| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/products` | public |
| `GET` | `/api/products?page=1&limit=20` | public |
| `GET` | `/api/products/slug/:slug` | public |
| `POST` | `/api/products` | admin |
| `PUT` | `/api/products/:id` | admin |
| `DELETE` | `/api/products/:id` | admin |

### Packages
| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/packages` | public |
| `GET` | `/api/packages/:identifier` | public |
| `POST` | `/api/packages` | admin |
| `PUT` | `/api/packages/:identifier` | admin |
| `DELETE` | `/api/packages/:identifier` | admin |

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Sign in, returns JWT |
| `GET` | `/api/me` | Get current user |
| `PUT` | `/api/me` | Update profile / password |
| `POST` | `/api/auth/forgot-password` | Request reset token |
| `POST` | `/api/auth/reset-password` | Apply new password |

### Other
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Uptime check |
| `POST` | `/api/checkout/orders` | Place an order |
| `GET` | `/api/me/orders` | Order history |
| `POST` | `/api/contact` | Submit contact form |
| `POST` | `/api/ai-planner` | AI event planner |
| `GET` | `/api/users` | List all users (admin) |

---

## Deployment

- **Backend:** Railway (auto-deploys from `main`)
- **Frontend / Admin:** Vercel (set `VITE_API_URL` in Vercel env vars)
- **Database:** Railway PostgreSQL

After any schema change run `schema.sql` again — all statements are idempotent.
