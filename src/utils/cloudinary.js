import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Converts a file buffer to base64 string with data URI
 * @param {Object} file - Multer file object
 * @returns {string} Base64 data URI
 */
const fileToBase64 = (file) => {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
};

/**
 * Uploads an image to Cloudinary
 * @param {string|Object} input - Base64 image string or Multer file object
 * @param {Object} options - Upload options
 * @param {string} options.folder - Cloudinary folder to store the image in
 * @param {Object} options.transformation - Cloudinary transformation options
 * @returns {Promise<string>} - Cloudinary URL of the uploaded image
 */
export const uploadImage = async (input, options = {}) => {
  try {
    const base64Image = typeof input === 'string' ? input : fileToBase64(input);
    const uploadOptions = {
      folder: options.folder || 'skecho',
      resource_type: 'auto',
      allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
      transformation: options.transformation || [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    };

    const result = await cloudinary.uploader.upload(base64Image, uploadOptions);
    return result.secure_url;
  } catch (error) {
    console.error('Error uploading image to Cloudinary:', error);
    throw new Error('Failed to upload image');
  }
};

/**
 * Processes file uploads from multer middleware
 * @param {Object} files - Files object from multer middleware
 * @param {Object} config - Configuration for processing uploads
 * @param {Object} config.fields - Map of field names to their upload options
 * @returns {Promise<Object>} - Object with upload results for each field
 */
export const processUploads = async (files, config) => {
  const results = {};

  for (const [fieldName, options] of Object.entries(config.fields)) {
    if (files[fieldName]) {
      const fileArray = files[fieldName];
      
      if (Array.isArray(fileArray)) {
        if (fileArray.length === 1) {
          // Single file - return string
          results[fieldName] = await uploadImage(fileArray[0], options);
        } else {
          // Multiple files - return array
          results[fieldName] = await Promise.all(
            fileArray.map(file => uploadImage(file, options))
          );
        }
      } else {
        // Single file object - return string
        results[fieldName] = await uploadImage(fileArray, options);
      }
    }
  }

  return results;
};

// Common upload configurations
export const uploadConfigs = {
  sellerProfile: {
    fields: {
      profileImage: {
        folder: 'skecho/profile-images',
        transformation: [
          { width: 400, height: 400, crop: 'fill' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      },
      portfolioImages: {
        folder: 'skecho/portfolio-images',
        transformation: [
          { width: 1200, height: 800, crop: 'fill' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      }
    }
  },
  product: {
    fields: {
      mainImage: {
        folder: 'skecho/product-images',
        transformation: [
          { width: 800, height: 800, crop: 'fill' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      },
      additionalImages: {
        folder: 'skecho/product-images',
        transformation: [
          { width: 800, height: 800, crop: 'fill' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      }
    }
  }
};

/**
 * Uploads multiple images to Cloudinary
 * @param {string[]} base64Images - Array of base64 encoded image strings
 * @param {string} folder - Cloudinary folder to store the images in
 * @returns {Promise<string[]>} - Array of Cloudinary URLs of the uploaded images
 */
export const uploadMultipleImages = async (base64Images, folder = 'skecho') => {
  try {
    const uploadPromises = base64Images.map(image => uploadImage(image, folder));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading multiple images to Cloudinary:', error);
    throw new Error('Failed to upload one or more images');
  }
};

/**
 * Deletes an image from Cloudinary
 * @param {string} imageUrl - Cloudinary URL of the image to delete
 * @returns {Promise<void>}
 */
export const deleteImage = async (imageUrl) => {
  try {
    // Extract public_id from the URL
    const publicId = imageUrl.split('/').slice(-1)[0].split('.')[0];
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw new Error('Failed to delete image');
  }
}; 