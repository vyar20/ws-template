# PLANNING — Slack Bulk Message App

Aplikasi untuk mengirim pesan Slack ke **banyak tujuan sekaligus (bulk)**, baik **langsung** maupun **terjadwal**, dengan Slack Bot Token yang disimpan **terenkripsi** di database.

> Dokumen ini adalah sumber kebenaran untuk urutan pengerjaan. Cek dan update file ini sebelum menambah implementasi baru.

---

## 1. Keputusan Final (hasil klarifikasi)

| Topik                 | Keputusan                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Mekanisme Slack       | **Bot Token (Slack Web API)** — user simpan `xoxb-...` terenkripsi, kirim via `chat.postMessage`  |
| Penjadwalan           | **Masuk scope** — ada job runner worker di dalam proses backend                                   |
| Penerima (recipients) | **Pilih dari Slack API** — backend proxy `conversations.list` / `users.list`, user centang tujuan |
| Role                  | **Admin + User** — admin kelola semua user & lihat semua; user kelola miliknya sendiri            |
| Router frontend       | **react-router** dengan konvensi file-based di `src/app/`                                         |

---

## 2. Prinsip & Konvensi (wajib)

- **Runtime**: Bun. **Bun-first** — pakai API Bun (`Bun.serve`, `Bun.password`, `Bun.env`, Web Crypto) sebelum menambah library.
- **Bahasa**: TypeScript di semua package.
- **Variable**: `camelCase`. **Nama file**: `kebab-case`. **Function**: arrow function bila memungkinkan.
- **Struktur package**: `root/src/files`, kecuali `pkg/config` (config di root).
- **Install library**: di package masing-masing; di root **hanya** jika dipakai lintas package.
- **Package manager**: selalu `pmg bun <args>`, tidak pernah `bun <args>` langsung.
- **Port**: backend & frontend jalan di **satu port (3000)** — Hono server utama, Vite sebagai middleware (dev) / static (prod).
- **Routes API**: backend hanya `/api/*`; sisanya diserahkan ke frontend (SPA).
- **Routing frontend**: file-based di `src/app/` — struktur folder mirror path URL (lihat §8.1).
- **Validasi**: semua schema Zod di `pkg/validations` supaya bisa di-share ke backend & frontend.
- **Base config wajib**: setiap package/app **selalu** mengintegrasikan config dari `pkg/config` (`@repo/config`) — tidak boleh menulis config sendiri dari nol. Lihat §2.1.
- **Cek skills dulu**: sebelum mulai mengerjakan task, **selalu periksa skills yang tersedia** dan gunakan bila relevan alih-alih menulis manual. Khusus UI frontend, **wajib pakai skill `shadcn`** saat membuat/menambah komponen. Lihat §2.2.
- **Keamanan** (mengikuti standar global): input dianggap hostile → validasi di server, token tidak pernah di-log, enkripsi at-rest, authorization dicek per-request (ownership), rate limit di endpoint sensitif & operasi mahal (bulk send).

### 2.1 Integrasi Base Config (`@repo/config`)

`pkg/config` mengekspor tiga base config yang **wajib** dipakai ulang oleh semua package & app:

| Export                  | File konsumen di package                                      | Isi                                                        |
| ----------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| `@repo/config/tsconfig` | `tsconfig.json` → `"extends": "@repo/config/tsconfig"`        | strict, esnext, moduleResolution bundler, types bun        |
| `@repo/config/eslint`   | `eslint.config.ts` → `import base from '@repo/config/eslint'` | js+ts recommended, consistent-type-imports, no-unused-vars |
| `@repo/config/prettier` | `.prettierrc.ts` → `import base from '@repo/config/prettier'` | singleQuote, no semi, tailwind plugin                      |

**Checklist setiap package/app baru** (semua package existing sudah mematuhi ini):

1. `package.json` → tambah `"@repo/config": "workspace:*"` di `devDependencies`.
2. `tsconfig.json` → `extends` `@repo/config/tsconfig` (boleh override `paths`/`include` saja).
3. `eslint.config.ts` → re-export `base` (boleh tambah rule spesifik, mis. react hooks di frontend).
4. `.prettierrc.ts` → re-export `base`.
5. Jangan menyalin isi config; hanya extend/override seperlunya.

> Frontend adalah pengecualian tsconfig (pakai project references untuk lingkungan browser + `vite/client`), **tetapi eslint & prettier tetap extend base**.

### 2.2 Cek & Pakai Skills

Sebelum mengeksekusi milestone apa pun, **cek skills yang tersedia** (baik skill harness maupun project-local di `.agents/skills/`) lalu manfaatkan yang relevan:

1. Lihat daftar skill yang tersedia dulu; jangan menulis manual sesuatu yang sudah dicover skill.
2. **UI frontend → wajib skill `shadcn`** untuk menambah/membuat komponen (jangan salin manual dari web).
3. Jika ada skill lain yang cocok dengan task (mis. review, verify), gunakan sesuai konteks.

> **Catatan:** folder `.agents/skills/` (berisi skill `shadcn` & `migrate-radix-to-base`) dan `skills-lock.json` terhapus saat working tree ter-reset. **Perlu di-install ulang** sebelum mulai pengerjaan frontend agar skill `shadcn` tersedia lagi.

---

## 3. Status Saat Ini

**Sudah ada:**

- Workspace Bun (`apps/*`, `pkg/*`) + `pkg/config` (eslint, prettier, tsconfig).
- `pkg/env` — validasi env via zod (`PORT`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ENCRYPTION_KEY`).
- `pkg/utils` — `fetcher`, `p` (tuple error), `ErrorHandler`, `HTTPCode`, `HTTPText`.
- `pkg/validations` — baru `sign-in-validation.ts`.
- Backend Hono port 3000 (`app.ts`, `app-dev.ts` Vite middleware, `app-prod.ts` static), route `/api`.
- Frontend Vite + React 19 + Tailwind v4 + shadcn/ui (style `base-mira`, base-ui, react-compiler). Entry `src/app/main.tsx`.
- Prisma v7 terpasang, `prisma7.config.ts` siap. `.env` sudah berisi semua secret.

**Belum ada:**

- Model Prisma (schema masih kosong) & koneksi DB.
- Better Auth (server + client) + role admin/user.
- Modul token Slack (CRUD + encrypt/decrypt) & `slack-client`.
- Modul message + target + bulk send service.
- Job runner (scheduler).
- Integrasi frontend: react-query, react-table, react-hook-form + zodResolver, react-router, halaman.

---

## 4. Arsitektur

### 4.1 Alur utama

```
Login (Better Auth email+password)
  → User simpan Slack Bot Token (divalidasi via auth.test, disimpan terenkripsi)
  → User compose message → pilih penerima (fetch dari Slack API) → set kirim sekarang / jadwal
  → Simpan Message + banyak MessageTarget (status pending)
  → Kirim sekarang: langsung diproses  |  Terjadwal: job runner ambil saat jatuh tempo
  → Per target: chat.postMessage (channel) / conversations.open + chat.postMessage (DM)
  → Update status per target (sent / failed + error), lalu status Message
```

### 4.2 Enkripsi token

- Algoritma: **AES-256-GCM** via Web Crypto (`crypto.subtle`), key dari `ENCRYPTION_KEY` (base64, 32 byte).
- Simpan format `iv:ciphertext:tag` (base64) — IV random per token.
- Token **hanya** didekripsi di memori saat mengirim. Tidak pernah dikirim ke frontend, tidak pernah di-log.

### 4.3 Slack Web API yang dipakai

| Kebutuhan        | Endpoint                                  | Scope bot                      |
| ---------------- | ----------------------------------------- | ------------------------------ |
| Validasi token   | `auth.test`                               | —                              |
| List channel     | `conversations.list`                      | `channels:read`, `groups:read` |
| List user        | `users.list`                              | `users:read`                   |
| Kirim ke channel | `chat.postMessage`                        | `chat:write`                   |
| Kirim DM         | `conversations.open` → `chat.postMessage` | `im:write`, `chat:write`       |

`slack-client` (di `pkg/utils`) membungkus pemanggilan ini + handle rate limit (429 `Retry-After`) & error Slack (`ok:false`).

---

## 5. Skema Database (Prisma)

Schema dipecah **per model** memakai fitur multi-file schema Prisma v7. `prisma/schema.prisma` hanya berisi `generator` + `datasource`; setiap model (beserta enum terkaitnya) ditaruh di file sendiri dalam `prisma/models/`. Prisma me-load semua `.prisma` di folder secara rekursif.

```
apps/backend/prisma/
├─ schema.prisma            # generator + datasource saja
└─ models/
   ├─ auth.prisma           # User, Session, Account, Verification, enum Role (Better Auth)
   ├─ slack-token.prisma    # SlackToken
   └─ message.prisma        # Message, MessageTarget + enum MessageStatus/TargetType/TargetStatus
```

`prisma7.config.ts` diarahkan ke folder (bukan file tunggal):

```ts
export default defineConfig({
  schema: 'prisma', // folder → load schema.prisma + models/*.prisma
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] }
})
```

### `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

### `prisma/models/auth.prisma`

```prisma
// Better Auth core (User, Session, Account, Verification) — disesuaikan Better Auth

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  emailVerified Boolean  @default(false)
  role          Role     @default(USER)   // admin plugin Better Auth
  banned        Boolean  @default(false)
  image         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  slackTokens        SlackToken[] @relation("UserSlackTokens")    // token PERSONAL milik user
  createdSlackTokens SlackToken[] @relation("CreatedSlackTokens")  // token yang dibuat (mis. SHARED oleh admin)
  messages           Message[]
  sessions           Session[]
  accounts           Account[]
}

enum Role {
  ADMIN
  USER
}
```

### `prisma/models/slack-token.prisma`

Token punya **dua tipe** (enum `SlackTokenType`):

- **`SHARED`** — dibuat admin, `userId` **null**, bisa dipakai **semua user** saat compose.
- **`PERSONAL`** — dibuat user, `userId` = pemilik, **hanya** bisa dipakai pemilik itu.

`createdById` menyimpan siapa yang membuat token (admin untuk SHARED, user untuk PERSONAL) untuk audit.

```prisma
model SlackToken {
  id             String         @id @default(cuid())
  type           SlackTokenType @default(PERSONAL)   // SHARED (admin) | PERSONAL (user)
  userId         String?                              // pemilik utk PERSONAL; null utk SHARED
  createdById    String                               // pembuat (admin utk SHARED)
  label          String                               // nama alias token
  encryptedToken String                               // AES-GCM: iv:ciphertext:tag
  teamId         String?
  teamName       String?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  user           User?     @relation("UserSlackTokens", fields: [userId], references: [id], onDelete: Cascade)
  createdBy      User      @relation("CreatedSlackTokens", fields: [createdById], references: [id])
  messages       Message[]

  @@index([userId])
  @@index([type])
}

enum SlackTokenType {
  SHARED
  PERSONAL
}
```

### `prisma/models/message.prisma`

```prisma
model Message {
  id           String        @id @default(cuid())
  userId       String
  slackTokenId String?                    // null bila token dihapus → message di-CANCELLED agar bisa diedit user
  content      String                    // isi pesan (mendukung format Slack mrkdwn)
  status       MessageStatus @default(DRAFT)
  scheduledAt  DateTime?                 // null = kirim langsung
  sentAt       DateTime?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  user         User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  slackToken   SlackToken?     @relation(fields: [slackTokenId], references: [id], onDelete: SetNull)
  targets      MessageTarget[]

  @@index([userId])
  @@index([status, scheduledAt])         // dipakai job runner
}

enum MessageStatus {
  DRAFT
  SCHEDULED
  SENDING
  SENT
  PARTIALLY_FAILED
  FAILED
  CANCELLED                              // token yang dipakai dihapus → user perlu edit ulang
}

model MessageTarget {
  id        String       @id @default(cuid())
  messageId String
  type      TargetType                    // CHANNEL | USER
  slackId   String                        // channel id / user id
  name      String                        // cache nama untuk tampilan
  status    TargetStatus @default(PENDING)
  error     String?
  sentAt    DateTime?

  message   Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([messageId])
}

enum TargetType { CHANNEL USER }
enum TargetStatus { PENDING SENT FAILED }
```

---

## 6. Struktur Folder Target

```
root/
├─ package.json
├─ PLANNING.md
├─ pkg/
│  ├─ config/                  # eslint, prettier, tsconfig (done)
│  ├─ env/                     # validasi env (done)
│  ├─ utils/
│  │  └─ src/
│  │     ├─ utils.ts           # fetcher, p, ErrorHandler, HTTP* (done)
│  │     ├─ crypto.ts          # encrypt/decrypt AES-GCM (Web Crypto)
│  │     └─ slack-client.ts    # wrapper Slack Web API
│  └─ validations/
│     └─ src/
│        ├─ sign-in-validation.ts     # (done)
│        ├─ sign-up-validation.ts
│        ├─ slack-token-validation.ts
│        └─ message-validation.ts
└─ apps/
   ├─ backend/
   │  ├─ prisma/
   │  │  ├─ schema.prisma       # generator + datasource
   │  │  └─ models/             # 1 file per model (auth, slack-token, message)
   │  └─ src/
   │     ├─ app.ts / app-dev.ts / app-prod.ts   # (done)
   │     ├─ lib/
   │     │  ├─ prisma.ts        # Prisma client singleton
   │     │  └─ auth.ts          # Better Auth instance + admin plugin
   │     ├─ middlewares/
   │     │  ├─ require-auth.ts   # cek session
   │     │  └─ require-admin.ts  # cek role ADMIN
   │     ├─ modules/
   │     │  ├─ token/            # route + service CRUD token
   │     │  ├─ message/          # route + service message + bulk send
   │     │  ├─ slack/            # route proxy list channel/user
   │     │  └─ admin/            # route kelola user
   │     └─ jobs/
   │        └─ scheduler.ts      # setInterval worker kirim terjadwal
   └─ frontend/
      └─ src/
         ├─ app/                 # file-based routing (mirror URL) — lihat §8.1
         │  ├─ main.tsx          # entry, render <RouterProvider>
         │  ├─ router.tsx        # definisi route → page.tsx / layout.tsx
         │  ├─ layout.tsx        # guard require-auth (area app)
         │  ├─ auth/
         │  │  └─ sign-in/page.tsx
         │  ├─ user/
         │  │  ├─ layout.tsx           # guard require-auth (area user)
         │  │  ├─ dashboard/page.tsx   # summary message user login
         │  │  ├─ slack-token/page.tsx # kelola token PERSONAL milik user
         │  │  └─ message/page.tsx     # compose message
         │  └─ admin/
         │     ├─ layout.tsx           # guard require-admin
         │     ├─ dashboard/page.tsx   # summary message seluruh user
         │     ├─ users/page.tsx       # manage users
         │     └─ slack-token/page.tsx # manage slack token
         ├─ lib/                  # api client (fetcher), query-client, auth-client
         ├─ components/ui/        # shadcn/ui
         └─ features/             # form, table, hooks per fitur (auth, tokens, messages, admin)
```

---

## 7. Kontrak API (`/api/*`)

API dikelompokkan mengikuti route frontend: **`/api/auth`**, **`/api/admin/*`** (role admin), dan **`/api/users/*`** (user login). Tiap grup punya beberapa sub-endpoint konkret di bawahnya.

### 7.1 Auth

| Method | Path          | Auth | Deskripsi                                     |
| ------ | ------------- | ---- | --------------------------------------------- |
| `*`    | `/api/auth/*` | —    | Better Auth handler (sign-in/out, session)    |
| GET    | `/api/me`     | user | Profil + role user aktif                      |

### 7.2 User (`/api/users/*`) — melayani `/user/*`

| Method | Path                                 | Auth         | Deskripsi                                           |
| ------ | ------------------------------------ | ------------ | -------------------------------------------------- |
| GET    | `/api/users/dashboard`               | user         | Summary user login (total pesan, pending, terkirim) |
| GET    | `/api/users/message`                 | user         | List message milik user + status                    |
| POST   | `/api/users/message`                 | user         | Buat message (kirim langsung / jadwal) + targets    |
| GET    | `/api/users/message/:id`             | user (owner) | Detail message + status per target                  |
| DELETE | `/api/users/message/:id`             | user (owner) | Batalkan/hapus message (jika belum terkirim)        |
| GET    | `/api/users/slack-token`             | user         | List token yang bisa dipakai user: PERSONAL miliknya + semua SHARED |
| POST   | `/api/users/slack-token`             | user         | Tambah token PERSONAL (validasi `auth.test`, encrypt) |
| PATCH  | `/api/users/slack-token/:id`         | user (owner) | Update label token PERSONAL miliknya                 |
| DELETE | `/api/users/slack-token/:id`         | user (owner) | Hapus token PERSONAL miliknya                        |
| GET    | `/api/users/slack/:tokenId/channels` | user         | Proxy `conversations.list` (untuk pilih penerima)   |
| GET    | `/api/users/slack/:tokenId/users`    | user         | Proxy `users.list` (untuk pilih penerima)           |

> `GET /api/users/slack-token` mengembalikan token PERSONAL milik user **dan** token SHARED (read-only). Mutasi (`POST`/`PATCH`/`DELETE`) di grup user **hanya** untuk token PERSONAL miliknya; token SHARED dikelola admin (§7.3). Endpoint `slack/*` proxy dipakai compose untuk memilih penerima — `:tokenId` harus lolos cek akses (PERSONAL milik user atau SHARED).

### 7.3 Admin (`/api/admin/*`) — melayani `/admin/*`

| Method | Path                          | Auth  | Deskripsi                                               |
| ------ | ----------------------------- | ----- | ------------------------------------------------------- |
| GET    | `/api/admin/dashboard`        | admin | Summary seluruh user (total pesan, pending, per status) |
| GET    | `/api/admin/users`            | admin | List semua user                                         |
| PATCH  | `/api/admin/users/:id`        | admin | Ubah role / ban user                                    |
| GET    | `/api/admin/slack-token`      | admin | List semua token SHARED (tanpa nilai token)             |
| POST   | `/api/admin/slack-token`      | admin | Tambah token SHARED (validasi `auth.test`, encrypt)     |
| PATCH  | `/api/admin/slack-token/:id`  | admin | Update label token SHARED                               |
| DELETE | `/api/admin/slack-token/:id`  | admin | Hapus token SHARED                                       |

> Semua body divalidasi dengan schema dari `pkg/validations`. Ownership/role dicek server-side (cegah IDOR). Endpoint bulk send (`POST /api/users/message`) & auth diberi rate limit.

### 7.4 Perilaku saat token dihapus

Menghapus token (PERSONAL via §7.2 atau SHARED via §7.3) **tidak** menghapus message terkait. Dalam satu transaksi dengan delete token, service:

1. Set semua message ber-status `SCHEDULED` (atau `DRAFT`) yang memakai token itu → `CANCELLED`.
2. `slackTokenId` di-set `null` otomatis (relasi `onDelete: SetNull` di §5).

Hasilnya message terjadwal tercabut dari job runner dan bisa **diedit ulang user** (pilih token baru + reschedule). Message yang sudah `SENT`/`PARTIALLY_FAILED`/`FAILED` tidak diubah (riwayat tetap; `slackTokenId` jadi null saja).

---

## 8. Frontend

- **Data fetching**: `@tanstack/react-query` (query client + provider di `app/`).
- **Tabel**: `@tanstack/react-table` untuk list message, token, user (admin).
- **Form**: `react-hook-form` + `@hookform/resolvers` (`zodResolver`) memakai schema dari `pkg/validations`.
- **Auth client**: `better-auth/react` (`authClient`) untuk session & sign-in/up/out.
- **UI**: shadcn/ui (selalu gunakan skill `shadcn` saat membuat komponen).
- **Routing**: `react-router` (SPA, data router) dengan **konvensi file-based di `src/app/`**.

### 8.1 Konvensi Routing (file-based di `src/app/`)

Struktur folder **mirror** dengan path URL. Setiap segmen route = satu folder di bawah `src/app/`, dan komponen halaman ada di `page.tsx` di folder tersebut.

| Route                | File                                 |
| -------------------- | ------------------------------------ |
| `/auth/sign-in`      | `src/app/auth/sign-in/page.tsx`      |
| `/admin/dashboard`   | `src/app/admin/dashboard/page.tsx`   |
| `/admin/slack-token` | `src/app/admin/slack-token/page.tsx` |
| `/user/message`      | `src/app/user/message/page.tsx`      |

Aturan:

- **`page.tsx`** → komponen UI untuk route itu (wajib).
- **`layout.tsx`** (opsional) → layout bersama untuk semua child route di segmen itu (mis. `src/app/admin/layout.tsx` untuk guard admin + sidebar).
- **`main.tsx`** → entry, render `<RouterProvider>`.
- **`router.tsx`** → rakit definisi route react-router yang menunjuk ke tiap `page.tsx` / `layout.tsx`. Route didaftarkan di sini agar tetap eksplisit — folder hanya menentukan lokasi file.
- Nama file & folder tetap **kebab-case**.
- Logika/komponen non-halaman (form, table, hooks) tetap di `src/features/*`, bukan di `src/app/`.

### 8.2 Daftar Halaman

| Route                | File                                 | Akses  | Deskripsi                                                                                       |
| -------------------- | ------------------------------------ | ------ | ----------------------------------------------------------------------------------------------- |
| `/auth/sign-in`      | `src/app/auth/sign-in/page.tsx`      | publik | Form email + password (react-hook-form + zodResolver)                                           |
| `/user/dashboard`    | `src/app/user/dashboard/page.tsx`    | user   | Summary message user login (total pesan, pending, terkirim)                                      |
| `/user/slack-token`  | `src/app/user/slack-token/page.tsx`  | user   | Kelola token PERSONAL (tambah/hapus, uji koneksi via `auth.test`)                               |
| `/user/message`      | `src/app/user/message/page.tsx`      | user   | Compose: pilih token (PERSONAL/SHARED) → pilih channel/user (fetch Slack) → tulis pesan → kirim / jadwal |
| `/admin/dashboard`   | `src/app/admin/dashboard/page.tsx`   | admin  | Summary message seluruh user (total pesan, pending, per status)                                 |
| `/admin/users`       | `src/app/admin/users/page.tsx`       | admin  | Kelola user & role                                                                              |
| `/admin/slack-token` | `src/app/admin/slack-token/page.tsx` | admin  | Kelola Slack token (tambah/hapus, uji koneksi via `auth.test`)                                  |

Guard akses via `layout.tsx` per segmen: `src/app/user/layout.tsx` (require auth untuk area user), `src/app/admin/layout.tsx` (require role admin).

---

## 9. Milestones (urutan pengerjaan)

> Legend: `[x]` selesai · `[~]` sebagian · `[ ]` belum

1. `[x]` Setup workspace — root `package.json`, `pkg/config`
2. `[x]` `pkg/env` — validasi env zod
3. `[~]` `pkg/utils` — `fetcher`/`p`/`ErrorHandler`/`HTTP*` (done); **tambah** `crypto.ts` (AES-GCM) & `slack-client.ts`
4. `[~]` Backend dasar — Hono + serve frontend (done); **tambah** `lib/prisma.ts`
5. `[ ]` **Fix** `pkg/validations/package.json` name → `@repo/validations`; tambah `sign-up`, `slack-token`, `message` validation
6. `[ ]` Prisma — set `schema: 'prisma'` (folder) di `prisma7.config.ts`, tulis model per file di `prisma/models/` (§5), `db:push`, generate client
7. `[ ]` Auth — Better Auth (`lib/auth.ts`) + admin plugin + mount `/api/auth/*`; middleware `require-auth` & `require-admin`
8. `[ ]` Modul token — CRUD + encrypt/decrypt + validasi `auth.test`
9. `[ ]` Modul slack — proxy list channel & user
10. `[ ]` Modul message — buat message + targets, list, detail
11. `[ ]` Slack send service — kirim per target (channel & DM), update status
12. `[ ]` Job runner — `jobs/scheduler.ts` polling message `SCHEDULED` jatuh tempo (setInterval ~30s), diaktifkan di `app-dev`/`app-prod`
13. `[ ]` Frontend fondasi — **pastikan skill `shadcn` tersedia (install ulang jika perlu)**, install react-query/react-table/react-hook-form/resolvers/react-router, `app/router.tsx` + providers, `auth-client`, `api client`
14. `[ ]` Frontend auth — halaman `/auth/sign-in` & `/auth/sign-up`
15. `[ ]` Frontend tokens — halaman `/tokens`
16. `[ ]` Frontend messages — `/messages` (react-table) + `/messages/new` (pilih penerima dari Slack) + status
17. `[ ]` Frontend admin — `/admin/dashboard` & `/admin/users`
18. `[ ]` Integrasi & test — end-to-end (kirim langsung & terjadwal), test validasi/authorization/enkripsi

---

## 10. Environment Variables

Sudah ada di `apps/backend/.env` & divalidasi `pkg/env`:

| Var                  | Fungsi                                                  |
| -------------------- | ------------------------------------------------------- |
| `PORT`               | Port server (3000)                                      |
| `DATABASE_URL`       | PostgreSQL                                              |
| `BETTER_AUTH_SECRET` | Secret Better Auth (≥32)                                |
| `BETTER_AUTH_URL`    | Base URL app                                            |
| `ENCRYPTION_KEY`     | Key AES-GCM 32 byte (base64) untuk enkripsi token Slack |

> `.env` berisi secret nyata — sudah di-`.gitignore`. **Jangan** commit.

---

## 11. Catatan Keamanan (ringkas)

- Token Slack: enkripsi AES-GCM at-rest, dekripsi hanya saat kirim, tidak pernah dikembalikan ke client / masuk log.
- Semua endpoint sensitif: cek session + ownership (cegah IDOR); endpoint admin cek role.
- Validasi semua input dengan Zod (`pkg/validations`) — allowlist, batas panjang pesan & jumlah target.
- Rate limit: endpoint auth & bulk send.
- Cookie session: `Secure`, `HttpOnly`, `SameSite` (default aman Better Auth).
- Package install selalu lewat `pmg bun` (proxy supply-chain).

---

## 12. Open Items (finalisasi saat eksekusi)

- Batas maksimum target per bulk message & strategi retry saat sebagian gagal.
- Apakah perlu preview render Slack `mrkdwn` di compose (nice-to-have).
- ~~**Kepemilikan Slack token**~~ **(final)**: token punya 2 tipe — `SHARED` (dibuat admin, `userId` null, dipakai semua user) & `PERSONAL` (dibuat user, `userId` = pemilik, hanya untuk dia). Lihat model §5 (`SlackTokenType`), API user §7.2 (CRUD PERSONAL + list gabungan) & admin §7.3 (CRUD SHARED). Saat compose, cek akses `:tokenId` = PERSONAL milik user **atau** SHARED.
- ~~**Token dihapus saat ada message terjadwal**~~ **(final)**: message terjadwal di-`CANCELLED` (bukan diblok/dihapus) agar user bisa edit ulang. Lihat §5 (`MessageStatus.CANCELLED`, `slackTokenId` nullable + `onDelete: SetNull`) & §7.4.
- **Naming singular vs plural**: frontend memakai `/user/*` (singular), backend `/api/users/*` (plural) — sesuai permintaan. Pertahankan konsisten atau samakan salah satu.
- **Sign-up**: route `/auth/sign-up` dihapus dari daftar halaman. Perlu dipastikan apakah registrasi user dilakukan hanya oleh admin (via `/admin/users`) atau ada jalur self sign-up.
