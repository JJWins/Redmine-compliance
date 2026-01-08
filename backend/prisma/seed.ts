import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed system configuration
  await prisma.systemConfig.upsert({
    where: { key: 'compliance_rules' },
    update: {},
    create: {
      key: 'compliance_rules',
      value: {
        missingEntryDays: 2,
        bulkLoggingThreshold: 3,
        lateEntryDays: 3,
        staleTaskDays: 14,
        overrunThreshold: 1.5,
      },
      description: 'Compliance detection rules',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'working_days' },
    update: {},
    create: {
      key: 'working_days',
      value: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      },
      description: 'Working days configuration',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'notification_settings' },
    update: {},
    create: {
      key: 'notification_settings',
      value: {
        dailyDigestEnabled: true,
        digestTime: '09:00',
        emailRecipients: [],
      },
      description: 'Notification and email settings',
    },
  });

  console.log('✅ Seed data created successfully');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

