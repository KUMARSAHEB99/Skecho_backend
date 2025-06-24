import express from 'express';
const router = express.Router();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { body, validationResult } from 'express-validator';
import { createImageUploadMiddleware } from '../middleware/upload.js';
import { uploadImage } from '../utils/cloudinary.js';

// Middleware for single image upload (referenceImage)
const uploadReferenceImage = createImageUploadMiddleware({
  fields: [{ name: 'referenceImage', maxCount: 1 }]
});

// Create a new custom order
router.post('/', uploadReferenceImage,
  body('userId').isString(),
  body('artistId').isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("validation err",errors);
      
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      console.log("body is ----");
      console.log(req.body);
      
      
      // Look up user by id
      const user = await prisma.user.findUnique({
        where: { id: req.body.userId }
      });
      if (!user) {
        console.log("user ni mila");
        
        return res.status(400).json({ error: 'User not found' });
      }
      // Look up artist by id
      const artist = await prisma.user.findUnique({
        where: { id: req.body.artistId }
      });
      if (!artist) {
        console.log("artist ni mila");
        
        return res.status(400).json({ error: 'Artist not found' });
      }
      let referenceImageUrl = null;
      if (req.files && req.files.referenceImage && req.files.referenceImage[0]) {
        referenceImageUrl = await uploadImage(req.files.referenceImage[0], { folder: 'skecho/custom-orders' });
      }
      console.log("imageurl",referenceImageUrl);
      
      const order = await prisma.order.create({
        data: {
          type: 'custom',
          userId: user.id,
          artistId: artist.id,
          referenceImage: referenceImageUrl,
          description: req.body.description,
          paperSize: req.body.paperSize,
          paperType: req.body.paperType,
          numPeople: req.body.numPeople ? parseInt(req.body.numPeople) : null,
          basePrice: req.body.basePrice ? parseInt(req.body.basePrice) : null,
          status: 'requested',
        },
      });
      res.status(201).json(order);
    } catch (err) {
      console.log(err);
      
      res.status(500).json({ error: err.message });
    }
  }
);

// Get all custom orders for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.params.userId, type: 'custom' },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all custom orders for an artist
router.get('/artist/:artistId', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { artistId: req.params.artistId, type: 'custom' },
      orderBy: { createdAt: 'desc' },
      include:{
        user: { select: { name: true, email: true, id: true } }, 
      },
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single custom order by id
router.get('/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
    });
    if (!order || order.type !== 'custom') return res.status(404).json({ error: 'Custom order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update custom order status, rejection reason, or deliveryUrl
router.patch('/:id', async (req, res) => {
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;