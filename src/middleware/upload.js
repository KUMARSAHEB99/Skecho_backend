import multer from 'multer';

// Configure multer to use memory storage
const storage = multer.memoryStorage();

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

// Configure multer with memory storage
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
}).fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'additionalImages', maxCount: 4 }
]);

/**
 * Creates a multer middleware for handling image uploads
 * @param {Object} config - Configuration object for the upload
 * @param {Object[]} config.fields - Array of field configurations
 * @param {string} config.fields[].name - Name of the field
 * @param {number} config.fields[].maxCount - Maximum number of files for this field
 * @returns {Function} Multer middleware configured for the specified fields
 */
export const createImageUploadMiddleware = (config) => {
  if (!config || !config.fields || !Array.isArray(config.fields)) {
    throw new Error('Invalid configuration: fields array is required');
  }

  const middleware = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    }
  }).fields(config.fields);

  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  };
};

// Predefined middleware configurations for common use cases
export const uploadConfigs = {
  sellerProfile: {
    fields: [
      { name: 'profileImage', maxCount: 1 },
      { name: 'portfolioImages', maxCount: 5 }
    ]
  },
  product: {
    fields: [
      { name: 'mainImage', maxCount: 1 },
      { name: 'additionalImages', maxCount: 4 }
    ]
  },
  single: (fieldName) => ({
    fields: [{ name: fieldName, maxCount: 1 }]
  }),
  multiple: (fieldName, maxCount = 5) => ({
    fields: [{ name: fieldName, maxCount }]
  })
};

// Error handler middleware for multer errors
export const handleMulterError = (err, req, res, next) => {
  console.error('Multer error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large! Maximum size is 5MB.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files! Maximum is 5 files.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected field name for file upload.'
      });
    }
    return res.status(400).json({
      error: err.message
    });
  }
  
  if (err.message === 'Not an image! Please upload only images.') {
    return res.status(400).json({
      error: err.message
    });
  }
  
  next(err);
}; 