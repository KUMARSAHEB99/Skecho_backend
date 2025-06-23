import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Complete user profile (phone number and delivery address)
router.post('/complete-profile', authenticateUser, async (req, res) => {
  try {
    const { phoneNumber, address } = req.body;
    if (!phoneNumber || !address) {
      return res.status(400).json({ error: 'Phone number and address are required' });
    }

    // Update user's phone number
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { phone: phoneNumber },
    });
    
    // Find existing delivery address for this user
    let deliveryAddress = await prisma.address.findUnique({
      where: {
        userId_type: {
          userId: req.user.id,
          type: 'DELIVERY',
        },
      },
    });

    if (deliveryAddress) {
      // Update existing address
      deliveryAddress = await prisma.address.update({
        where: { id: deliveryAddress.id },
        data: {
          pincode: address.pincode,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          city: address.city,
          state: address.state,
          country: address.country,
        },
      });
    } else {
      // Create new address
      deliveryAddress = await prisma.address.create({
        data: {
          userId: req.user.id,
          type: 'DELIVERY',
          pincode: address.pincode,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          city: address.city,
          state: address.state,
          country: address.country,
        },
      });
    }

    res.json({ user, deliveryAddress });
  } catch (error) {
    console.error('Error completing user profile:', error);
    res.status(500).json({ error: 'Failed to complete profile' });
  }
});

// Check if user profile is complete
router.get('/profile-complete', authenticateUser, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        addresses: {
          where: { type: 'DELIVERY' },
        },
      },
    });
    if (!user) return res.status(404).json({ isComplete: false });
    const hasPhone = !!user.phone;
    const hasDeliveryAddress = user.addresses.length > 0;
    res.json({ isComplete: hasPhone && hasDeliveryAddress });
  } catch (error) {
    console.error('Error checking profile completion:', error);
    res.status(500).json({ isComplete: false });
  }
});

// Fetch current user's profile
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        addresses: true,
        sellerProfile: true, // include seller profile if exists
      },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

export default router; 