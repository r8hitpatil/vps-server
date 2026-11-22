# 🏨 NestJS Booking Server (Redis + DB without Docker)

A lightweight, production-ready **NestJS Booking Server** built with **Redis** and an embedded **SQL Database (SQLite via TypeORM)**, designed to run **completely without Docker**.

---

## 📑 Table of Contents
- [Architecture & Design](#-architecture--design)
- [Prerequisites](#-prerequisites)
- [Installation Guide](#-installation-guide)
- [Starting the Application](#-starting-the-application)
- [Testing the API](#-testing-the-api)
- [API Reference & Examples](#-api-reference--examples)
- [How Redis Distributed Locks Work](#-how-redis-distributed-locks-work)
- [Stopping the Server](#-stopping-the-server)
- [Environment Configuration](#-environment-configuration)

---

## 🏛️ Architecture & Design

This project achieves full database persistence and high-concurrency Redis caching/locking without relying on Docker or heavy background system services:

```
                     HTTP Clients / Web Apps / Mobile
                                    │
                                    ▼
                      ┌───────────────────────────┐
                      │       NestJS Server       │  (Port 3000)
                      │  Controllers & Services   │
                      └─────────────┬─────────────┘
                                    │
                 ┌──────────────────┴──────────────────┐
                 ▼                                     ▼
      ┌─────────────────────┐               ┌─────────────────────┐
      │ Redis Server Daemon │               │   SQLite Database   │
      │   (Port 6379)       │               │ (data/booking.db)   │
      ├─────────────────────┤               ├─────────────────────┤
      │ • Distributed Lock  │               │ • Resources Table   │
      │ • Catalog Caching   │               │ • Bookings Table    │
      │ • Booking Counters  │               │ • Foreign Keys      │
      └─────────────────────┘               └─────────────────────┘
```

- **Database**: SQLite stored in `./data/booking.sqlite` via TypeORM. Zero configuration, self-contained, and persists all data to disk.
- **In-Memory Cache & Mutex**: Standalone native Redis server binary vendored in `./bin/redis-server`. Runs as a lightweight local daemon without root permissions or containerization.

---

## ⚙️ Prerequisites

- **Node.js**: `v18.x`, `v20.x`, `v22.x`, or `v26.x`
- **npm**: `v9.x` or higher
- **curl** & **jq** (optional, for running API tests)

---

## 📥 Installation Guide

### Step 1: Clone / Navigate to the Project
```bash
cd /home/flux/bookings
```

### Step 2: Install Node.js Dependencies
```bash
npm install
```

### Step 3: Verify or Build Project
```bash
npm run build
```

---

## 🚀 Starting the Application

You can start the entire stack (Redis + NestJS) with a single command or run each service individually.

### Option A: 1-Click Startup Script (Recommended)

Run the included startup script:
```bash
chmod +x ./start.sh ./stop.sh ./test-api.sh
./start.sh
```
This script automatically:
1. Creates required data directories (`./data` and `./redis-data`).
2. Checks if Redis is running; starts the local Redis daemon on port `6379` if it is not.
3. Builds the NestJS application (if not already built).
4. Seeds initial sample bookable rooms (on first run).
5. Boots the NestJS server at `http://localhost:3000`.

---

### Option B: Step-by-Step Manual Startup

If you prefer running services in separate terminal tabs:

#### 1. Start Redis
```bash
npm run redis:start
```
To verify Redis is responding:
```bash
npm run redis:status
# Expected output: PONG
```

#### 2. Start NestJS Server

**Development Mode (Hot Reload):**
```bash
npm run start:dev
```

**Production Mode:**
```bash
npm run build
npm run start:prod
```

Once started, you will see:
```log
=======================================================
🚀 NestJS Booking Server running at http://localhost:3000
📦 Database: SQLite (local disk, no Docker needed)
⚡ Redis: Native Redis Server (port 6379, no Docker needed)
=======================================================
```

---

## 🧪 Testing the API

An automated end-to-end integration test script is included:

```bash
./test-api.sh
```

This script exercises:
- Fetching available rooms from cache.
- Creating a booking (10:00 - 12:00).
- **Double booking prevention** (attempting 11:00 - 13:00 returns `409 Conflict`).
- Adjacent non-overlapping booking (12:00 - 14:00 returns `201 Created`).
- Availability checking for the date.
- Booking cancellation and immediate slot availability update.
- Redis metrics increment verification.

---

## 📡 API Reference & Examples

Base URL: `http://localhost:3000`

### 1. Resources (Rooms / Desks / Facilities)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/resources` | List all resources (cached in Redis) |
| `POST` | `/resources` | Create a new bookable resource |
| `GET` | `/resources/:id` | Get single resource by UUID |
| `PATCH` | `/resources/:id` | Update resource information |
| `DELETE` | `/resources/:id` | Delete resource |

#### List Resources:
```bash
curl -s http://localhost:3000/resources | jq .
```

#### Create Resource:
```bash
curl -X POST http://localhost:3000/resources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Executive Boardroom",
    "description": "16-seat conference room with 4K display and polycom phone",
    "capacity": 16,
    "pricePerHour": 75.0,
    "isActive": true
  }'
```

---

### 2. Bookings

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/bookings` | Create a booking (**Distributed Redis Lock**) |
| `GET` | `/bookings` | List bookings (filters: `resourceId`, `status`, `date`) |
| `GET` | `/bookings/:id` | Get booking details |
| `GET` | `/bookings/availability/:resourceId?date=YYYY-MM-DD` | Get booked slots on a specific date |
| `PATCH` | `/bookings/:id/cancel` | Cancel booking & release slot |

#### Create a Booking:
```bash
curl -X POST http://localhost:3000/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "resourceId": "<RESOURCE_UUID>",
    "customerName": "Jane Doe",
    "customerEmail": "jane@example.com",
    "startTime": "2026-11-25T14:00:00.000Z",
    "endTime": "2026-11-25T16:00:00.000Z"
  }'
```

#### Check Resource Availability:
```bash
curl "http://localhost:3000/bookings/availability/<RESOURCE_UUID>?date=2026-11-25" | jq .
```

#### Cancel Booking:
```bash
curl -X PATCH "http://localhost:3000/bookings/<BOOKING_UUID>/cancel" | jq .
```

---

## 🔒 How Redis Distributed Locks Work

In booking systems, race conditions happen when two concurrent requests try to book the exact same slot at the exact millisecond.

To solve this without heavy database-level table locks:
1. **Acquire Mutex Lock**: When `POST /bookings` is called, Redis executes:
   ```
   SET lock:resource:<id> <unique-token> PX 6000 NX
   ```
   If another request holds the lock, the second request fails with `409 Conflict`.
2. **Conflict Verification**: The service queries SQLite to ensure no overlapping confirmed bookings exist:
   ```sql
   WHERE resourceId = :id 
     AND status = 'CONFIRMED'
     AND startTime < :newEndTime 
     AND endTime > :newStartTime
   ```
3. **Commit & Cache Invalidation**: The booking is inserted into SQLite and the Redis cache (`cache:bookings:*`) is invalidated.
4. **Atomic Lock Release**: The lock is safely released via a Lua script only if the token matches.

---

## 🛑 Stopping the Server

To stop both NestJS and the background Redis daemon:
```bash
./stop.sh
```

Or manually:
```bash
npm run redis:stop
```

---

## ⚙️ Environment Configuration

Configuration is managed in [.env](file:///home/flux/bookings/.env):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port for the NestJS server |
| `REDIS_HOST` | `127.0.0.1` | Local Redis host |
| `REDIS_PORT` | `6379` | Local Redis port |
| `DATABASE_PATH` | `./data/booking.sqlite` | SQLite database file location |
