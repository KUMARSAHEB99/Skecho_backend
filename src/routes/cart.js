import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Get user's cart with items
router.get('/', authenticateUser, async (req, res) => {
  try {
    // User is already authenticated and loaded
    const user = req.user;

    // Get or create cart
    let cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                seller: {
                  select: {
                    user: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId: user.id
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  seller: {
                    select: {
                      user: {
                        select: {
                          name: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
    }

    res.json(cart);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Add item to cart
router.post('/items', authenticateUser, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const user = req.user;

    // Get or create cart
    let cart = await prisma.cart.findUnique({
      where: { userId: user.id }
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId: user.id
        }
      });
    }

    // Check if product exists and is available
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!product.isAvailable) {
      return res.status(400).json({ error: 'Product is not available' });
    }

    // Check if requested quantity is available
    const existingCartItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId
        }
      }
    });

    const currentQuantity = existingCartItem?.quantity || 0;
    const newTotalQuantity = currentQuantity + quantity;

    if (newTotalQuantity > product.quantity) {
      return res.status(400).json({ 
        error: 'Not enough quantity available',
        availableQuantity: product.quantity,
        requestedQuantity: newTotalQuantity
      });
    }

    // Add or update cart item
    const cartItem = await prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId
        }
      },
      update: {
        quantity: {
          increment: quantity
        }
      },
      create: {
        cartId: cart.id,
        productId,
        quantity
      },
      include: {
        product: {
          include: {
            seller: {
              select: {
                user: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });

    res.json(cartItem);
  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// Update cart item quantity
router.put('/items/:itemId', authenticateUser, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 0) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }

    const user = req.user;

    // Get user's cart
    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: true }
    });

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    // Get cart item and check product quantity
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id
      },
      include: {
        product: true
      }
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    if (quantity > cartItem.product.quantity) {
      return res.status(400).json({ 
        error: 'Not enough quantity available',
        availableQuantity: cartItem.product.quantity,
        requestedQuantity: quantity
      });
    }

    if (quantity === 0) {
      // Remove item if quantity is 0
      await prisma.cartItem.delete({
        where: { id: itemId }
      });
      res.json({ message: 'Item removed from cart' });
    } else {
      // Update quantity
      const updatedItem = await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity },
        include: {
          product: {
            include: {
              seller: {
                select: {
                  user: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      });
      res.json(updatedItem);
    }
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
});

// Remove item from cart
router.delete('/items/:itemId', authenticateUser, async (req, res) => {
  try {
    const { itemId } = req.params;
    const user = req.user;

    // Get user's cart
    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: true }
    });

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    // Check if item exists in user's cart
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id
      }
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    // Delete cart item
    await prisma.cartItem.delete({
      where: { id: itemId }
    });

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error removing item from cart:', error);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});

// Clear cart
router.delete('/', authenticateUser, async (req, res) => {
  try {
    const user = req.user;

    // Get user's cart
    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: true }
    });

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    // Delete all items in cart
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id }
    });

    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

export default router; 