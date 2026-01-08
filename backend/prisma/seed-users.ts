import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedUsers() {
  console.log('Seeding users...');

  // Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);

  // Create Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@polussolutions.com' },
    update: {
      password: adminPassword,
      role: 'admin',
      status: 1 // Active status
    },
    create: {
      email: 'admin@polussolutions.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'admin',
      redmineUserId: 1,
      status: 1 // Active status
    }
  });

  console.log('Created admin user:', admin.email);

  // Create Manager User
  const manager = await prisma.user.upsert({
    where: { email: 'manager@polussolutions.com' },
    update: {
      password: managerPassword,
      role: 'manager',
      status: 1 // Active status
    },
    create: {
      email: 'manager@polussolutions.com',
      name: 'Manager User',
      password: managerPassword,
      role: 'manager',
      redmineUserId: 2,
      status: 1 // Active status
    }
  });

  console.log('Created manager user:', manager.email);

  console.log('\n✅ User credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👤 ADMIN USER:');
  console.log('   Email: admin@polussolutions.com');
  console.log('   Password: admin123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👤 MANAGER USER:');
  console.log('   Email: manager@polussolutions.com');
  console.log('   Password: manager123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

seedUsers()
  .catch((e) => {
    console.error('Error seeding users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

