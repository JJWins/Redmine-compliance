import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.utils';
import prisma from '../config/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Simple password hashing (for demo purposes)
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

const generateToken = (userId: string, email: string, role: string): string => {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400);
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!user) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Check if user is Active (status 1) - status 2 = Registered, 3 = Locked
    if (user.status !== 1) {
      return sendError(res, 'Account is not active', 401);
    }

    // Check password
    if (!user.password) {
      return sendError(res, 'Password not set for this user. Please contact administrator.', 401);
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Generate token
    const token = generateToken(user.id, user.email, user.role);

    // Return user data (excluding password)
    const { password: _, ...userWithoutPassword } = user;

    logger.info('User login successful', { userId: user.id, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword });
    
    return sendSuccess(res, {
      user: userWithoutPassword,
      token,
      mustChangePassword: user.mustChangePassword || false
    });
  } catch (error: any) {
    logger.error('Login error', { error: error.message, stack: error.stack, email: req.body.email });
    return sendError(res, error.message || 'Login failed', 500);
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  const userId = (req as any).userId; // Set by auth middleware
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        teamMembers: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    const { password: _, ...userWithoutPassword } = user;

    logger.info('Get current user', { userId });
    return sendSuccess(res, userWithoutPassword);
  } catch (error: any) {
    logger.error('Get current user error', { error: error.message, stack: error.stack, userId });
    return sendError(res, error.message || 'Failed to get user', 500);
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return sendError(res, 'Email, password, and name are required', 400);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return sendError(res, 'User with this email already exists', 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'user',
        redmineUserId: Math.floor(Math.random() * 1000000), // Temporary, should sync from Redmine
        status: 1 // Default to Active status
      }
    });

    const { password: _, ...userWithoutPassword } = user;

    logger.info('User registered', { userId: user.id, email: user.email, role: user.role });
    return sendSuccess(res, userWithoutPassword, 201);
  } catch (error: any) {
    logger.error('Register error', { error: error.message, stack: error.stack, email: req.body.email });
    return sendError(res, error.message || 'Registration failed', 500);
  }
};

/**
 * Change password endpoint
 * Requires authentication
 * If mustChangePassword is true, allows changing password without current password check
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId; // Set by auth middleware
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return sendError(res, 'New password is required', 400);
    }

    // Validate new password strength (minimum 8 characters)
    if (newPassword.length < 8) {
      return sendError(res, 'New password must be at least 8 characters long', 400);
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // If mustChangePassword is true, skip current password check
    // Otherwise, require current password
    if (!user.mustChangePassword) {
      if (!currentPassword) {
        return sendError(res, 'Current password is required', 400);
      }

      if (!user.password) {
        return sendError(res, 'Password not set for this user', 400);
      }

      const isValidPassword = await comparePassword(currentPassword, user.password);
      if (!isValidPassword) {
        return sendError(res, 'Current password is incorrect', 401);
      }
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear mustChangePassword flag
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mustChangePassword: true
      }
    });

    logger.info('Password changed successfully', { userId: user.id, email: user.email });
    return sendSuccess(res, { message: 'Password changed successfully', user: updatedUser });
  } catch (error: any) {
    logger.error('Change password error', { error: error.message, stack: error.stack, userId: (req as any).userId });
    return sendError(res, error.message || 'Failed to change password', 500);
  }
};

