const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { body, validationResult } = require('express-validator');

// Create a new product order
router.post('/',
  body('userId').isString(),
  body('artistId').isString(),
  body('productId').isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const order = await prisma.order.create({
        data: {
          type: 'product',
          userId: req.body.userId,
          artistId: req.body.artistId,
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
    });
    res.json(orders);
  } catch (err) {
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

module.exports = router; 