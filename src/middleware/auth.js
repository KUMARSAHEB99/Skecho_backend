import admin from '../config/firebase-admin.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authenticateUser = async (req, res, next) => {
  try {
    const { authorization } = req.headers;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authorization.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Add the decoded token to the request object
    const user = await prisma.user.findUnique({ where: { firebaseUid: decodedToken.uid } });
    if (!user) return res.status(401).json({ error: "User not found" });
    req.user = user;
    
    next();
  } catch (error) {
    console.error('Error authenticating user:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
}; 