# Data Logging and Inspection

This document describes the logging system for inspecting incoming data from Redmine.

## 📋 Overview

The system uses **Winston** to log all incoming data from Redmine API and sync operations. This allows you to inspect individual records as they come into the system.

## 📁 Log Files

All logs are stored in the `backend/logs/` directory:

- **`data-inspection.log`** - Detailed logs of all incoming data (users, projects, issues, time entries)
- **`combined.log`** - All application logs
- **`error.log`** - Error logs only

## 🔍 What Gets Logged

### 1. **Users**
- Each user fetched from Redmine API
- User data before and during sync
- Includes: id, name, email, created_on, updated_on

### 2. **Projects**
- Each project fetched from Redmine API
- Project data during sync
- Includes: id, name, status, created_on, updated_on

### 3. **Issues**
- Each issue fetched from Redmine API (sampled every 10th page to avoid log spam)
- Issue data during sync
- Includes: id, subject, project, status, estimated_hours, created_on, updated_on

### 4. **Time Entries**
- Time entries fetched from Redmine API (sampled every 20th page to avoid log spam)
- Individual entries during sync (sampled every 10th entry)
- Includes: id, user, project, issue, hours, spent_on, created_on, updated_on

## 📊 Log Format

Logs are written in JSON format for easy parsing:

```json
{
  "timestamp": "2024-01-15 10:30:45",
  "level": "info",
  "message": "[redmine-api] user",
  "id": 123,
  "login": "john.doe",
  "firstname": "John",
  "lastname": "Doe",
  "mail": "john.doe@example.com",
  "created_on": "2023-01-15T10:30:00Z",
  "_source": "redmine-api",
  "_dataType": "user",
  "_timestamp": "2024-01-15T10:30:45.123Z"
}
```

## 🔧 Usage

### View Logs

```bash
# View data inspection logs
tail -f backend/logs/data-inspection.log

# View all logs
tail -f backend/logs/combined.log

# View errors only
tail -f backend/logs/error.log
```

### Search Logs

```bash
# Find all user data
grep -i "user" backend/logs/data-inspection.log

# Find specific user by ID
grep '"id": 123' backend/logs/data-inspection.log

# Find all issues
grep '"issue"' backend/logs/data-inspection.log
```

### Parse Logs with jq (if installed)

```bash
# Extract all user emails
cat backend/logs/data-inspection.log | jq -r 'select(._dataType == "user") | .mail'

# Count issues by project
cat backend/logs/data-inspection.log | jq -r 'select(._dataType == "issue") | .project.name' | sort | uniq -c
```

## ⚙️ Configuration

### Log Level

Set the log level via environment variable:

```env
LOG_LEVEL=debug  # debug, info, warn, error
```

### Log File Size

Log files automatically rotate when they reach:
- **data-inspection.log**: 50MB (keeps 20 files)
- **combined.log**: 10MB (keeps 5 files)
- **error.log**: 10MB (keeps 5 files)

## 📝 Log Sources

- **`redmine-api`** - Data directly from Redmine API responses
- **`sync-service`** - Data during sync processing

## 🎯 Example: Inspecting a Specific Record

1. **Find a user record:**
   ```bash
   grep '"id": 123' backend/logs/data-inspection.log | jq
   ```

2. **Find all time entries for a user:**
   ```bash
   grep '"user".*"id": 123' backend/logs/data-inspection.log | jq
   ```

3. **Find issues for a project:**
   ```bash
   grep '"project".*"id": 45' backend/logs/data-inspection.log | jq
   ```

## 🔒 Security Note

- Logs may contain sensitive data (emails, names, etc.)
- Ensure `logs/` directory is in `.gitignore` (already configured)
- Rotate logs regularly in production
- Consider encrypting logs if they contain sensitive information

## 📈 Performance

- Logging is asynchronous and won't block sync operations
- Large batches are sampled to avoid log file bloat
- Time entries: Every 20th page logged
- Issues: Every 10th page logged
- Individual entries: Every 10th entry logged

