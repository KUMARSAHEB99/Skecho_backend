import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// List all products with optional filters
router.get('/', async (req, res) => {
  try {
    const {
      category,
      sellerId,
      minPrice,
      maxPrice,
      isAvailable,
      page = 1,
      limit = 10
    } = req.query;

    const where = {};
    
    if (category) {
      where.categories = {
        some: { name: category }
      };
    }
    
    if (sellerId) {
      where.sellerId = sellerId;
    }
    
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    
    if (isAvailable !== undefined) {
      where.isAvailable = isAvailable === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          categories: true,
          seller: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                  email: true
                }
              }
            }
          }
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      products,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get a single product
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        categories: true,
        seller: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create a new product
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { name, description, price, categoryIds, isAvailable } = req.body;

    // Verify seller status
    const seller = await prisma.sellerProfile.findFirst({
      where: { userId: req.user.id }
    });

    if (!seller) {
      return res.status(403).json({ error: 'Only sellers can create products' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        isAvailable: isAvailable ?? true,
        sellerId: seller.id,
        categories: {
          connect: categoryIds.map(id => ({ id }))
        }
      },
      include: {
        categories: true
      }
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update a product
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const { name, description, price, categoryIds, isAvailable } = req.body;

    // Verify product ownership
    const existingProduct = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { seller: true }
    });

    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (existingProduct.seller.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this product' });
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        price: price ? parseFloat(price) : undefined,
        isAvailable,
        categories: categoryIds ? {
          set: [],
          connect: categoryIds.map(id => ({ id }))
        } : undefined
      },
      include: {
        categories: true
      }
    });

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete a product
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    // Verify product ownership
    const existingProduct = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { seller: true }
    });

    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (existingProduct.seller.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this product' });
    }

    await prisma.product.delete({
      where: { id: req.params.id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router; 