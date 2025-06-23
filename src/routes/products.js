import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser } from "../middleware/auth.js"
import { createImageUploadMiddleware, uploadConfigs as multerConfigs } from '../middleware/upload.js';
import { processUploads, uploadConfigs as cloudinaryConfigs } from '../utils/cloudinary.js';

const router = express.Router();
const prisma = new PrismaClient();

// List all products with optional filters
router.get('/', async (req, res) => {
  try {
    console.log('Fetching all products...');
    const {
      category,
      minPrice,
      maxPrice,
      isAvailable,
      orderBy = 'createdAt',
      order = 'desc',
      medium,
      page = 1,
      limit = 12
    } = req.query;

    const where = {};
    
    // Category and medium filters
    const categoryFilters = [];
    if (category) {
      categoryFilters.push({ name: { equals: category, mode: 'insensitive' } });
    }
    if (medium) {
      categoryFilters.push({ name: { equals: medium, mode: 'insensitive' } });
    }

    if (categoryFilters.length > 0) {
      where.categories = {
        some: {
          OR: categoryFilters
        }
      };
    }
    
    // Price range filter
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    
    // Availability filter
    if (isAvailable !== undefined) {
      where.isAvailable = isAvailable === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Validate orderBy field
    const allowedOrderByFields = ['createdAt', 'price'];
    const validOrderBy = allowedOrderByFields.includes(orderBy) ? orderBy : 'createdAt';
    const validOrder = order === 'asc' ? 'asc' : 'desc';

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
        orderBy: {
          [validOrderBy]: validOrder
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.product.count({ where })
    ]);

    console.log(`Found ${products.length} products`);
    console.log(products);
    
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
    // console.log("product iss------------------");
    // console.log(product);
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create a new product
router.post('/',
  authenticateUser,
  (req, res, next) => {
    console.log('Before Multer:', { body: req.body });
    next();
  },
  createImageUploadMiddleware(multerConfigs.product),
  (req, res, next) => {
    console.log('After Multer:', { body: req.body, files: req.files });
    if (!req.body) {
      return res.status(400).json({ error: 'No form data received' });
    }
    next();
  },
  async (req, res) => {
    try {
      const { name, description, price, categoryIds } = req.body;

      // Validate required fields
      if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
      }

      // Verify seller status
      const seller = await prisma.sellerProfile.findFirst({
        where: { userId: req.user.id }
      });

      if (!seller) {
        return res.status(403).json({ error: 'Only sellers can create products' });
      }

      // Parse categoryIds if it's a string
      let parsedCategoryIds;
      try {
        parsedCategoryIds = typeof categoryIds === 'string' 
          ? JSON.parse(categoryIds) 
          : categoryIds;

        if (!Array.isArray(parsedCategoryIds)) {
          return res.status(400).json({ error: 'Invalid category IDs format' });
        }
      } catch (error) {
        console.error('Error parsing categoryIds:', error);
        return res.status(400).json({ error: 'Invalid category IDs format' });
      }

      // Process image uploads
      let uploadResults = {};
      if (req.files) {
        try {
          uploadResults = await processUploads(req.files, cloudinaryConfigs.product);
          console.log('Images uploaded:', uploadResults);
        } catch (error) {
          console.error('Error uploading images:', error);
          return res.status(400).json({ error: 'Failed to upload images' });
        }
      }

      // Prepare image URLs array
      // const imageUrls = [
      //   // Get the first URL from mainImage array if it exists
      //   ...(uploadResults.mainImage || []),
      //   // Get the URLs from additionalImages array if they exist
      //   ...(uploadResults.additionalImages || [])
      // ].filter(url => typeof url === 'string');
        if(!uploadResults.mainImage){
          console.error('couldnt get main image');
          return res.status(400).json({ error: 'Failed to upload images' });
        }
        let imageUrls=[];
        imageUrls.push(uploadResults.mainImage);
        if(uploadResults.additionalImages){
          uploadResults.additionalImages.forEach(img => {
            imageUrls.push(img)
          });
        }
        
      // Create product with uploaded image URLs
      const product = await prisma.product.create({
        data: {
          name,
          description,
          price: Number(price),
          isAvailable: true,
          sellerId: seller.id,
          images: imageUrls,
          categories: {
            connect: parsedCategoryIds.map(id => ({ id }))
          }
        },
        include: {
          categories: true,
          seller: {
            include: {
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

      res.status(201).json(product);
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
);

// Update a product
router.put('/:id',
  authenticateUser,
  createImageUploadMiddleware(multerConfigs.product),
  (req, res, next) => {
    if (!req.body) {
      return res.status(400).json({ error: 'No form data received' });
    }
    next();
  },
  async (req, res) => {
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

      // Process image uploads if any
      let uploadResults = {};
      if (req.files && (req.files.mainImage || req.files.additionalImages)) {
        try {
          uploadResults = await processUploads(req.files, cloudinaryConfigs.product);
          console.log('Images uploaded:', uploadResults);
        } catch (error) {
          console.error('Error uploading images:', error);
          return res.status(400).json({ error: 'Failed to upload images' });
        }
      }

      // Parse categoryIds if provided
      let parsedCategoryIds;
      if (categoryIds) {
        try {
          parsedCategoryIds = typeof categoryIds === 'string' 
            ? JSON.parse(categoryIds) 
            : categoryIds;

          if (!Array.isArray(parsedCategoryIds)) {
            return res.status(400).json({ error: 'Invalid category IDs format' });
          }
        } catch (error) {
          console.error('Error parsing categoryIds:', error);
          return res.status(400).json({ error: 'Invalid category IDs format' });
        }
      }

      // Construct the new images array
      let newImages = [...existingProduct.images];

      // If a new main image is uploaded, it replaces the old one
      if (uploadResults.mainImage && uploadResults.mainImage.length > 0) {
        newImages[0] = uploadResults.mainImage[0];
      }

      // If new additional images are uploaded, they are added
      if (uploadResults.additionalImages && uploadResults.additionalImages.length > 0) {
        newImages.push(...uploadResults.additionalImages);
      }
      
      // Update product
      const product = await prisma.product.update({
        where: { id: req.params.id },
        data: {
          name,
          description,
          price: price ? Number(price) : undefined,
          isAvailable,
          ...(uploadResults.mainImage || uploadResults.additionalImages ? {
            images: newImages.filter(Boolean)
          } : {}),
          ...(parsedCategoryIds ? {
            categories: {
              set: parsedCategoryIds.map(id => ({ id }))
            }
          } : {})
        },
        include: {
          categories: true,
          seller: {
            include: {
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

      res.json(product);
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ error: 'Failed to update product' });
    }
  }
);

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

// Get featured products
router.get('/featured', async (req, res) => {
  try {
    const featuredProducts = await prisma.product.findMany({
      take: 6, // Limit to 6 products for the featured section
      where: {
        isAvailable: true,
      },
      orderBy: [
        {
          createdAt: 'desc' // Get the most recent products
        }
      ],
      include: {
        seller: {
          include: {
            user: {
              select: {
                name: true
              }
            }
          }
        },
        categories: true
      }
    });

    res.json(featuredProducts);
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

export default router; 