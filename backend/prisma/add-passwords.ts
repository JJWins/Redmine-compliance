import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function addPasswords() {
  console.log('Generating password hashes and updating users...');

  // Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);

  console.log('\nPassword hashes generated:');
  console.log('Admin hash:', adminPassword);
  console.log('Manager hash:', managerPassword);
  console.log('\n');

  try {
    // Use upsert to create or update admin user
    const admin = await prisma.user.upsert({
      where: { email: 'admin@polussolutions.com' },
      update: {
        password: adminPassword,
        role: 'admin',
        status: 1, // Active status
        name: 'Admin User'
      },
      create: {
        email: 'admin@polussolutions.com',
        name: 'Admin User',
        password: adminPassword,
        role: 'admin',
        redmineUserId: 999999, // Use a high number to avoid conflicts
        status: 1 // Active status
      }
    });

    console.log(`✅ Admin user: ${admin.email}`);

    // Use upsert to create or update manager user
    const manager = await prisma.user.upsert({
      where: { email: 'manager@polussolutions.com' },
      update: {
        password: managerPassword,
        role: 'manager',
        status: 1, // Active status
        name: 'Manager User'
      },
      create: {
        email: 'manager@polussolutions.com',
        name: 'Manager User',
        password: managerPassword,
        role: 'manager',
        redmineUserId: 999998, // Use a high number to avoid conflicts
        status: 1 // Active status
      }
    });

    console.log(`✅ Manager user: ${manager.email}`);

    console.log('\n✅ Password update complete!');
    console.log('\n📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 ADMIN USER:');
    console.log('   Email: admin@polussolutions.com');
    console.log('   Password: admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 MANAGER USER:');
    console.log('   Email: manager@polussolutions.com');
    console.log('   Password: manager123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('❌ Error updating passwords:', error);
    throw error;
  }
}

addPasswords()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

