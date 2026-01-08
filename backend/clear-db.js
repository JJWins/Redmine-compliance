#!/usr/bin/env node
// Script to clear all synced data and reset sync state
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearDatabase() {
  try {
    console.log('🗑️  Clearing database...');
    
    // Clear in order (respecting foreign keys)
    console.log('  Clearing time entries...');
    await prisma.timeEntry.deleteMany({});
    
    console.log('  Clearing issues...');
    await prisma.issue.deleteMany({});
    
    console.log('  Clearing compliance violations...');
    await prisma.complianceViolation.deleteMany({});
    
    console.log('  Clearing manager scorecards...');
    await prisma.managerScorecard.deleteMany({});
    
    console.log('  Clearing projects...');
    await prisma.project.deleteMany({});
    
    console.log('  Clearing users...');
    await prisma.user.deleteMany({});
    
    console.log('  Clearing sync logs...');
    await prisma.syncLog.deleteMany({});
    
    console.log('  Clearing sync state...');
    await prisma.systemConfig.deleteMany({
      where: { key: 'sync_state' }
    });
    
    console.log('✅ Database cleared successfully!');
    
    // Show counts
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.issue.count(),
      prisma.timeEntry.count(),
    ]);
    
    console.log('\n📊 Current counts:');
    console.log(`  Users: ${counts[0]}`);
    console.log(`  Projects: ${counts[1]}`);
    console.log(`  Issues: ${counts[2]}`);
    console.log(`  Time Entries: ${counts[3]}`);
    
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();

