import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import admin from '../config/firebase-admin.js';

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

export default router; 