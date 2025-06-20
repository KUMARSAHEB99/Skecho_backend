import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import admin from '../config/firebase-admin.js';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Create or update user after Firebase authentication
router.post('/create-user', async (req, res) => {
  try {
    const { authorization } = req.headers;
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authorization.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: {
        firebaseUid: decodedToken.uid,
      },
    });

    if (!user) {
      // Create new user if doesn't exist
      user = await prisma.user.create({
        data: {
          firebaseUid: decodedToken.uid,
          email: decodedToken.email || '',
          name: decodedToken.name || '',
          profileCompleted: false,
        },
      });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete user profile
router.post('/complete-profile', authenticateUser, async (req, res) => {
  try {
    const { phoneNumber, address } = req.body;

    if (!phoneNumber || !address) {
      return res.status(400).json({ error: 'Phone number and address are required' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: {
        firebaseUid: req.user.uid
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create delivery address
    const deliveryAddress = await prisma.address.create({
      data: {
        userId: user.id,
        type: 'DELIVERY',
        pincode: address.pincode,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        country: address.country
      }
    });

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        phone: phoneNumber,
        phoneVerified: true,
        profileCompleted: true
      },
      include: {
        addresses: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error completing user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 