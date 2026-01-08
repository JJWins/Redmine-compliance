# Backend Setup Guide

## 🔧 Environment Configuration

Create a `.env` file in the `backend` directory with the following content:

```env
# Database Connection
DATABASE_URL=mysql://redmine_user:YourStrongPassword123!@localhost:3306/redmine_dashboard

# Individual Environment Variables (alternative format)
DB_HOST=localhost
DB_PORT=3306
DB_USER=redmine_user
DB_PASSWORD=YourStrongPassword123!
DB_NAME=redmine_dashboard

# Redmine API
REDMINE_URL=https://redmine.polussolutions.com
REDMINE_API_KEY=dummy1234dert45667

# Server
PORT=3000
NODE_ENV=development

# Job Scheduler
SYNC_INTERVAL_HOURS=1
DAILY_DIGEST_TIME=09:00

# CORS
FRONTEND_URL=http://localhost:4200
```

**Important:** Update the actual values (especially `DB_PASSWORD` and `REDMINE_API_KEY`) with your real credentials.

---

## 📦 Installation Steps

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Create MySQL Database

Make sure MySQL is running and create the database:

```sql
CREATE DATABASE redmine_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Or using MySQL command line:
```bash
mysql -u root -p -e "CREATE DATABASE redmine_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3. Create Database User (Optional but Recommended)

```sql
CREATE USER 'redmine_user'@'localhost' IDENTIFIED BY 'YourStrongPassword123!';
GRANT ALL PRIVILEGES ON redmine_dashboard.* TO 'redmine_user'@'localhost';
FLUSH PRIVILEGES;
```

### 4. Generate Prisma Client

```bash
npm run prisma:generate
```

### 5. Run Database Migrations

This will create all the tables in your database:

```bash
npm run prisma:migrate
```

When prompted, name your migration: `init`

### 6. Seed Initial Data (Optional)

This will populate system configuration:

```bash
npm run prisma:seed
```

### 7. Start the Server

```bash
npm run dev
```

The server should start on `http://localhost:3000`

---

## ✅ Verify Setup

### Test Database Connection

```bash
npm run prisma:studio
```

This opens Prisma Studio where you can view and edit your database.

### Test API

```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status":"ok","timestamp":"2024-01-20T10:30:00.000Z"}
```

### Test Redmine Connection

```bash
curl http://localhost:3000/api/redmine/status
```

---

## 🔍 Troubleshooting

### Database Connection Issues

- Verify MySQL is running: `mysql -u root -p`
- Check database exists: `SHOW DATABASES;`
- Verify user has permissions: `SHOW GRANTS FOR 'redmine_user'@'localhost';`
- Check connection string format in `.env`

### Prisma Issues

- Make sure `DATABASE_URL` in `.env` is correct
- Run `npm run prisma:generate` after schema changes
- Check Prisma logs for specific errors

### Port Already in Use

If port 3000 is already in use, change `PORT` in `.env` file.

---

## 📝 Next Steps

Once setup is complete:

1. ✅ Database tables created
2. ✅ Server running on port 3000
3. ✅ API endpoints accessible
4. 🔄 Ready for Phase 2: Redmine Integration

---

**Note:** Remember to update the actual password and API key values in `.env` before going to production!

