/**
 * Script to set default password for users when their role is changed to manager or admin
 * 
 * Usage:
 *   tsx prisma/set-default-password.ts <user-email>
 * 
 * This script will:
 * 1. Set the password to the default password "Polus@123" (hashed)
 * 2. Set mustChangePassword flag to true
 * 3. Update the user's role if needed
 * 
 * Default password hash: $2b$10$L3ohkWK7ZAl6jsDwUMEUPOpREdbp17/rjLh9XkoURR1jgXvFQjBo2
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default password hash for "Polus@123"
const DEFAULT_PASSWORD_HASH = '$2b$10$L3ohkWK7ZAl6jsDwUMEUPOpREdbp17/rjLh9XkoURR1jgXvFQjBo2';

async function setDefaultPassword(email: string, role?: 'manager' | 'admin') {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }

    // Prepare update data
    const updateData: any = {
      password: DEFAULT_PASSWORD_HASH,
      mustChangePassword: true
    };

    // Update role if provided
    if (role && (role === 'manager' || role === 'admin')) {
      updateData.role = role;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { email },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mustChangePassword: true
      }
    });

    console.log('User updated successfully:');
    console.log(JSON.stringify(updatedUser, null, 2));
    console.log('\nDefault password set: Polus@123');
    console.log('User will be required to change password on next login.');
  } catch (error: any) {
    console.error('Error updating user:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: tsx prisma/set-default-password.ts <user-email> [role]');
  console.error('Example: tsx prisma/set-default-password.ts user@example.com manager');
  process.exit(1);
}

const email = args[0];
const role = args[1] as 'manager' | 'admin' | undefined;

setDefaultPassword(email, role);

