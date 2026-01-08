#!/usr/bin/env node
// Quick script to check sync status
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStatus() {
  try {
    const [users, projects, issues, timeEntries, latestLog] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.issue.count(),
      prisma.timeEntry.count(),
      prisma.syncLog.findFirst({
        orderBy: { startedAt: 'desc' }
      })
    ]);

    console.log('\n📊 Database Status:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Users:        ${users}`);
    console.log(`  Projects:     ${projects}`);
    console.log(`  Issues:       ${issues}`);
    console.log(`  Time Entries: ${timeEntries}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (latestLog) {
      console.log('📋 Latest Sync:');
      console.log(`  Type:     ${latestLog.syncType}`);
      console.log(`  Entity:   ${latestLog.entityType}`);
      console.log(`  Status:   ${latestLog.status}`);
      console.log(`  Records:  ${latestLog.recordsSynced}`);
      console.log(`  Started:  ${latestLog.startedAt.toLocaleString()}`);
      if (latestLog.completedAt) {
        const duration = Math.round((latestLog.completedAt - latestLog.startedAt) / 1000);
        console.log(`  Completed: ${latestLog.completedAt.toLocaleString()} (${duration}s)`);
      } else {
        console.log(`  Status:   ⏳ Still running...`);
      }
      if (latestLog.errorMessage) {
        console.log(`  Error:    ${latestLog.errorMessage}`);
      }
    }

    console.log('\n');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkStatus();

