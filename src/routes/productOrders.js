import express from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
const router = express.Router();
const prisma = new PrismaClient();

// Create a new product order
router.post('/',
  body('userId').isString(),
  body('productId').isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      // Get the product to find the seller's user ID
      const product = await prisma.product.findUnique({
        where: { id: req.body.productId },
        include: {
          seller: {
            include: {
              user: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      });

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (!product.isAvailable) {
        return res.status(400).json({ error: 'Product is not available' });
      }

      const order = await prisma.order.create({
        data: {
          type: 'product',
          userId: req.body.userId,
          artistId: product.seller.user.id, // Use the seller's user ID
          productId: req.body.productId,
          status: 'requested',
        },
      });
      res.status(201).json(order);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Get all product orders for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.params.userId, type: 'product' },
      orderBy: { createdAt: 'desc' },
      include: {
        artist: { select: { name: true, email: true, id: true } },
        product: { select: { name: true, description: true, price: true, images: true } },
      },
    });
    console.log('Product orders for user:', orders);
    res.json(orders);
  } catch (err) {
    console.error('Error fetching product orders:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all product orders for an artist
router.get('/artist/:artistId', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { artistId: req.params.artistId, type: 'product' },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single product order by id
router.get('/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
    });
    if (!order || order.type !== 'product') return res.status(404).json({ error: 'Product order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product order status, rejection reason, or deliveryUrl
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