# Virtualib Project Documentation

**Last Updated:** January 2026
**Purpose:** Handover document for future development cycles. This file contains the architecture, database schema, and key business logic details.

## System Architecture

The project follows a Microservices Architecture, containerized via Docker (Podman) and orchestrated with podman-compose.

### 1. Service Map

**Service: Web**
- Container Name: openlib-web
- Ports: Host 8080 -> Container 80
- Stack: React, Vite, Nginx
- Responsibility: Serves the Single Page Application (SPA). Proxies API calls in dev.

**Service: API**
- Container Name: openlib-api
- Ports: Host 3000 -> Container 3000
- Stack: Node.js, Express, Prisma
- Responsibility: REST API, Business logic, Auth, Cron jobs.

**Service: DB**
- Container Name: openlib-db
- Ports: Host 5432 -> Container 5432
- Stack: PostgreSQL 15
- Responsibility: Persistent relational data storage.

### 2. Connectivity & Networking
- Internal Network: openlib-net (Bridge network)
- Service Discovery: Services resolve by container name (e.g., API -> 'db')
- External Access:
  - Frontend: http://localhost:8080
  - API: http://localhost:3000

### 3. Data Persistence
- Volume: postgres_data
- Mount Path: /var/lib/postgresql/data
- Purpose: Database persistence across container restarts.

### 4. Environment Management
- Configuration: Single .env file at root.
- Injection: podman-compose injects variables at runtime.

---

## Tech Stack & Key Libraries

### Frontend (/client)
- Framework: React 18 (TypeScript) via Vite
- UI: TailwindCSS, Lucide Icons
- State Management: Zustand (authStore.ts)
- HTTP Client: Axios (Interceptors for JWT handling)
- Routing: React Router DOM (v6)

### Backend (/server)
- Runtime: Node.js (TypeScript)
- Framework: Express.js
- ORM: Prisma (PostgreSQL)
- Validation: Zod schemas
- Scheduling: node-cron (Daily reminders)
- Email: Nodemailer + Google APIs (OAuth2)
- AI: OpenAI API (GPT-3.5-turbo for summaries)

### User-Facing Dependencies (client/package.json)
- react: ^18.3.1
- vite: ^5.4.11
- typescript: ~5.3.3
- tailwindcss: ^3.4.17
- react-router-dom: ^6.28.0
- zustand: ^4.5.5
- axios: ^1.7.9
- lucide-react: ^0.469.0
- recharts: ^2.15.0
- date-fns: ^4.1.0
- clsx: ^2.1.1

### Server-Side Dependencies (server/package.json)
- express: ^5.2.1
- prisma: ^5.22.0
- pg: ^8.16.3
- zod: ^4.3.5
- openai: ^6.16.0
- node-cron: ^4.2.1
- nodemailer: ^7.0.12
- googleapis: ^170.1.0
- jsonwebtoken: ^9.0.3
- bcryptjs: ^3.0.3
- multer: ^2.0.2
- helmet: ^8.1.0
- cors: ^2.8.5
- dotenv: ^17.2.3

---

## Database Schema (Complete Reference)

Location: server/prisma/schema.prisma

```prisma
model Library {
  id          String   @id @default(uuid())
  name        String
  description String?
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  users           User[]
  books           Book[]
  categories      Category[]
  book_loans      BookLoan[]
  borrow_requests BorrowRequest[]
  settings        Settings[]

  @@map("libraries")
}

model Role {
  id        String @id @default(uuid())
  role_name String @unique
  users     User[]

  @@map("user_roles")
}

model User {
  id            String    @id @default(uuid())
  library_id    String
  library       Library   @relation(fields: [library_id], references: [id], onDelete: Cascade)
  name          String
  surname       String
  email         String    @unique
  phone         String?
  role_id       String
  role          Role      @relation(fields: [role_id], references: [id])
  password_hash String
  is_active     Boolean   @default(true)
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt
  deleted_at    DateTime?

  book_loans      BookLoan[]
  borrow_requests BorrowRequest[]

  @@map("users")
}

model Category {
  id         String   @id @default(uuid())
  library_id String
  library    Library  @relation(fields: [library_id], references: [id], onDelete: Cascade)
  name       String
  created_at DateTime @default(now())

  books      BookCategory[]

  @@map("categories")
}

model Book {
  id               String   @id @default(uuid())
  library_id       String
  library          Library  @relation(fields: [library_id], references: [id], onDelete: Cascade)
  name             String
  original_name    String?
  author           String
  publish_year     Int
  isbn             String
  publisher        String
  cover_image_path String?
  summary_tr       String?
  summary_en       String?
  deleted_at       DateTime?
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  categories      BookCategory[]
  loans           BookLoan[]
  borrow_requests BorrowRequest[]

  @@map("books")
}

model BookCategory {
  book_id     String
  book        Book     @relation(fields: [book_id], references: [id], onDelete: Cascade)
  category_id String
  category    Category @relation(fields: [category_id], references: [id], onDelete: Cascade)

  @@id([book_id, category_id])
  @@map("book_categories")
}

model BookLoan {
  id                    String    @id @default(uuid())
  library_id            String
  library               Library   @relation(fields: [library_id], references: [id], onDelete: Cascade)
  book_id               String
  book                  Book      @relation(fields: [book_id], references: [id], onDelete: Cascade)
  user_id               String
  user                  User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
  borrowed_at           DateTime  @default(now())
  due_at                DateTime
  returned_at           DateTime?
  status                String    @default("active") // active, return_requested, returned
  reminder_stage        Int       @default(0)
  last_reminder_sent_at DateTime?
  created_at            DateTime  @default(now())

  @@map("book_loans")
}

model BorrowRequest {
  id           String    @id @default(uuid())
  library_id   String
  library      Library   @relation(fields: [library_id], references: [id], onDelete: Cascade)
  book_id      String
  book         Book      @relation(fields: [book_id], references: [id], onDelete: Cascade)
  user_id      String
  user         User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
  status       String // pending, approved, rejected
  requested_at DateTime  @default(now())
  decided_at   DateTime?

  @@map("borrow_requests")
}

model Settings {
  id             String   @id @default(uuid())
  library_id     String
  library        Library  @relation(fields: [library_id], references: [id], onDelete: Cascade)
  smtp_host      String?
  smtp_port      Int?
  email_provider String    @default("smtp") // "smtp" or "gmail"
  
  // Gmail API Credentials
  gmail_user          String?
  gmail_client_id     String?
  gmail_client_secret String?
  gmail_refresh_token String?
  smtp_user      String?
  smtp_password  String?
  smtp_from      String?
  reminder_rules Json?
  email_templates Json?
  overdue_days    Int      @default(14)

  @@map("settings")
}
```

---

## Frontend Structure (client/src)

### Pages
1. Dashboard (/): Overview stats.
2. Books (/books): Grid/List view. Key Logic: AI Summary generation.
3. Categories (/categories): Book category management.
4. Loans (/loans): Active loans tracking. Overdue logic (due_date < now).
5. Requests (/requests): User borrow requests queue.
6. Users (/users): User management.
7. Settings (/settings): Loan rules, Email config, Template editor.
8. Login (/login): JWT Authentication.

---

## Backend Logic & Services (server/src)

### 1. Cron Job (services/cron.service.ts)
- Schedule: Daily at 09:00 UTC (0 9 * * *).
- Task: Checks active loans where due_date <= now.
- Action: Sends overdue reminder via configured email provider.
- Logic: Throttles to 1 email per 24h per loan.

### 2. Email Service (services/email.service.ts)
- Supports: SMTP and Google Gmail API (OAuth2).
- Content: HTML templates from Settings.

### 3. AI Service (services/openai.service.ts)
- Model: gpt-3.5-turbo
- Function: Generates TR/EN summaries in strict JSON.
- Safety: Sanitizes markdown before parsing.

### 4. Authentication (middleware/auth.middleware.ts)
- Method: JWT Bearer Token.
- RBAC: Role validation (admin/user).

### 5. Initial Setup & Seeding (Critical)
- Script: server/src/scripts/seed.ts
- Command: `npm run seed` (inside server container/directory)
- Purpose: Creates the default Library, Admin Role, and Admin User (email: admin@admin.com / pass: admin123).
- Logic: Idempotent (checks if exists before creating).

### 6. API Route Structure (server/src/routes)
- /api/auth -> auth.routes.ts (Login, Refresh)
- /api/books -> book.routes.ts (CRUD, Generate Summary)
- /api/users -> user.routes.ts (CRUD)
- /api/loans -> loan.routes.ts (Borrow/Return)
- /api/requests -> request.routes.ts (Approval Queue)
- /api/settings -> settings.routes.ts (Config)
- /api/dashboard -> dashboard.routes.ts (Stats)

---

## Deployment & Development

### Standard Build & Run
To apply code changes, rebuild containers.

```bash
# Rebuild API
podman-compose build --no-cache api
podman-compose up -d --force-recreate api

# Rebuild Web
podman-compose build --no-cache web
podman-compose up -d --force-recreate web

# Full Restart (Build All)
podman-compose down
podman-compose up -d --build
```

## Troubleshooting

### "Out of Memory" Error During Build
If you see errors like `fatal error: out of memory allocating heap arena map` or random build failures:
Your server might be running out of RAM during the `npm run build` process. To fix this, add Swap space:

```bash
# Check current memory
free -h

# Create a 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make it permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Critical Files
- server/.dockerignore: Excludes local 'dist' and 'node_modules'. Essential for clean builds.
- server/src/index.ts: Entry point. Initializes Cron jobs.
