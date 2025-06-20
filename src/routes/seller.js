import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser } from '../middleware/auth.js';
import { createImageUploadMiddleware, uploadConfigs as multerConfigs, handleMulterError } from '../middleware/upload.js';
import { processUploads, uploadConfigs as cloudinaryConfigs } from '../utils/cloudinary.js';

const router = Router();
const prisma = new PrismaClient();

// Complete seller profile
router.post(
  '/complete-profile',
  authenticateUser,
  (req, res, next) => {
    console.log('Before Multer:', { body: req.body });
    next();
  },
  createImageUploadMiddleware(multerConfigs.sellerProfile),
  async (req, res) => {
    try {
      console.log('After Multer:', {
        body: req.body,
        files: req.files,
      });

      const { bio, categoryIds, pickupAddress, doesCustomArt, customArtPricing, materialOptions } = req.body;

      if (!bio || !pickupAddress) {
        return res.status(400).json({ error: 'Bio and pickup address are required' });
      }

      // Parse categoryIds, pickupAddress, customArtPricing, and materialOptions if they're strings
      let parsedCategoryIds;
      let parsedPickupAddress;
      let parsedCustomArtPricing;
      let parsedMaterialOptions;
      try {
        parsedCategoryIds = typeof categoryIds === 'string' 
          ? JSON.parse(categoryIds) 
          : categoryIds;

        parsedPickupAddress = typeof pickupAddress === 'string'
          ? JSON.parse(pickupAddress)
          : pickupAddress;

        parsedCustomArtPricing = typeof customArtPricing === 'string'
          ? JSON.parse(customArtPricing)
          : customArtPricing;

        parsedMaterialOptions = typeof materialOptions === 'string'
          ? JSON.parse(materialOptions)
          : materialOptions;

        if (!Array.isArray(parsedCategoryIds)) {
          return res.status(400).json({ error: 'Invalid category IDs format' });
        }
      } catch (error) {
        console.error('Error parsing request data:', error);
        return res.status(400).json({ error: 'Invalid request data format' });
      }

      // Verify categories exist
      const categories = await prisma.category.findMany({
        where: {
          id: {
            in: parsedCategoryIds
          }
        }
      });

      if (categories.length !== parsedCategoryIds.length) {
        return res.status(400).json({ error: 'One or more categories not found' });
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

      // Process image uploads
      let uploadResults = {};
      if (req.files) {
        try {
          uploadResults = await processUploads(req.files, cloudinaryConfigs.sellerProfile);
          console.log('Images uploaded:', uploadResults);
        } catch (error) {
          console.error('Error uploading images:', error);
          return res.status(400).json({ error: 'Failed to upload images' });
        }
      }

      // Ensure profileImage is a single string, not an array
      const profileImage = uploadResults.profileImage ? 
        (Array.isArray(uploadResults.profileImage) ? uploadResults.profileImage[0] : uploadResults.profileImage) 
        : null;

      // Create pickup address
      const address = await prisma.address.create({
        data: {
          userId: user.id,
          type: 'PICKUP',
          pincode: parsedPickupAddress.pincode,
          addressLine1: parsedPickupAddress.addressLine1,
          addressLine2: parsedPickupAddress.addressLine2,
          city: parsedPickupAddress.city,
          state: parsedPickupAddress.state,
          country: parsedPickupAddress.country
        }
      });

      console.log('Creating seller profile with data:', {
        bio,
        profileImage: profileImage,
        portfolioImages: uploadResults.portfolioImages || [],
        pickupAddressId: address.id,
        categoryIds: parsedCategoryIds,
        doesCustomArt,
        customArtPricing: parsedCustomArtPricing,
        materialOptions: parsedMaterialOptions
      });

      // Create or update seller profile
      const sellerProfile = await prisma.sellerProfile.upsert({
        where: {
          userId: user.id
        },
        update: {
          bio,
          profileImage: profileImage,
          portfolioImages: uploadResults.portfolioImages || [],
          pickupAddressId: address.id,
          doesCustomArt: doesCustomArt === 'true',
          customArtPricing: parsedCustomArtPricing,
          materialOptions: parsedMaterialOptions,
          categories: {
            set: parsedCategoryIds.map(id => ({ id }))
          }
        },
        create: {
          userId: user.id,
          bio,
          profileImage: profileImage,
          portfolioImages: uploadResults.portfolioImages || [],
          pickupAddressId: address.id,
          doesCustomArt: doesCustomArt === 'true',
          customArtPricing: parsedCustomArtPricing,
          materialOptions: parsedMaterialOptions,
          categories: {
            connect: parsedCategoryIds.map(id => ({ id }))
          }
        },
        include: {
          categories: true,
          pickupAddress: true
        }
      });

      console.log('Seller profile created:', sellerProfile);

      // Update user's seller status
      await prisma.user.update({
        where: {
          id: user.id
        },
        data: {
          isSeller: true
        }
      });

      res.json(sellerProfile);
    } catch (error) {
      console.error('Error in complete-profile route:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get seller profile
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        firebaseUid: req.user.firebaseUid
      },
      include: {
        sellerProfile: {
          include: {
            categories: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.sellerProfile) {
      return res.status(404).json({ error: 'Seller profile not found' });
    }

    res.json(user.sellerProfile);
  } catch (error) {
    console.error('Error fetching seller profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if seller profile is complete
router.get('/profile-complete', authenticateUser, async (req, res) => {
  if (!req.user || !req.user.firebaseUid) {
    return res.status(401).json({ error: 'Unauthorized: No user found' });
  }
  try {
    console.log("inside api");
    const user = await prisma.user.findUnique({
      where: {
        firebaseUid: req.user.firebaseUid
      },
      include: {
        sellerProfile: {
          include: {
            categories: true,
            pickupAddress: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    console.log("user ye rha ----->", user);
    // Check if user is a seller and has a complete profile
    const isComplete = user.isSeller && 
                      user.sellerProfile && 
                      user.sellerProfile.bio && 
                      user.sellerProfile.pickupAddressId &&
                      user.sellerProfile.categories.length > 0;
    console.log("isComplete ye rha ----->", isComplete);
    res.json({ 
      isComplete,
      isSeller: user.isSeller,
      hasProfile: !!user.sellerProfile,
      hasBio: !!user.sellerProfile?.bio,
      hasAddress: !!user.sellerProfile?.pickupAddressId,
      hasCategories: user.sellerProfile?.categories.length > 0
    });
  } catch (error) {
    console.error('Error checking seller profile completion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    console.log('Fetching seller with ID:', req.params.id);
    console.log('Database connection status:', prisma ? 'Connected' : 'Not connected');
    
    const seller = await prisma.sellerProfile.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            createdAt: true
          }
        },
        products: {
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            categories: true
          }
        }
      }
    });
    
    console.log('Query result:', seller);
    
    if (!seller) {
      console.log('No seller found with ID:', req.params.id);
      return res.status(404).json({ error: 'Seller not found' });
    }

    console.log('Sending seller data');
    res.json(seller);
  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    res.status(500).json({ error: 'Failed to fetch seller details' });
  }
});

router.get('/', async (req, res) => {
  console.log("agya andar");
  try {
    
    const sellers = await prisma.sellerProfile.findMany({
      take: 6,
      include: {
        user: {
          select: {
            name: true,
            createdAt: true
          }
        },
        products: {
          include: {
            categories: true
          }
        },
        _count: {
          select: {
            products: true
          }
        }
      },
      orderBy: {
        products: {
          _count: 'desc'
        }
      }
    });

    res.json(sellers);
  } catch (error) {
    console.error('Error fetching featured sellers:', error);
    res.status(500).json({ error: 'Failed to fetch featured sellers' });
  }
});

// Get all sellers (for debugging)
router.get('/debug/all', async (req, res) => {
  try {
    console.log('Fetching all sellers');
    const sellers = await prisma.sellerProfile.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            createdAt: true
          }
        },
        products: {
          include: {
            categories: true
          }
        }
      }
    });
    
    console.log(`Found ${sellers.length} sellers`);
    res.json(sellers);
  } catch (error) {
    console.error('Error fetching all sellers:', error);
    res.status(500).json({ error: 'Failed to fetch sellers' });
  }
});

export default router;