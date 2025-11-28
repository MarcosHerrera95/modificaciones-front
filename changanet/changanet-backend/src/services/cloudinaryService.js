/**
 * Cloudinary Service - Manejo de imágenes para CHANGANET
 * @descripción Servicio para subir, procesar y gestionar imágenes con Cloudinary
 * @versión 1.0.0
 */

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Configuración de storage para multer
 */
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'changanet',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 1200, height: 1200, crop: 'limit' },
      { quality: 'auto' }
    ]
  }
});

/**
 * Middleware de multer configurado
 */
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

/**
 * Subir imagen a Cloudinary
 * @param {Buffer} buffer - Buffer de la imagen
 * @param {Object} options - Opciones de subida
 * @returns {Promise<Object>} Resultado de Cloudinary
 */
const uploadImage = async (buffer, options = {}) => {
  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder || 'changanet/general',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
          transformation: [
            { width: 1200, height: 1200, crop: 'limit' },
            { quality: 'auto' }
          ],
          ...options
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      // Crear stream desde buffer
      const { Readable } = require('stream');
      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });

    return {
      publicId: result.public_id,
      url: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error('Error al subir la imagen');
  }
};

/**
 * Eliminar imagen de Cloudinary
 * @param {string} publicId - ID público de la imagen
 * @returns {Promise<Object>} Resultado de la eliminación
 */
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw new Error('Error al eliminar la imagen');
  }
};

/**
 * Generar URL optimizada
 * @param {string} publicId - ID público de la imagen
 * @param {Object} options - Opciones de transformación
 * @returns {string} URL optimizada
 */
const getOptimizedUrl = (publicId, options = {}) => {
  const { width = 800, height = 600, quality = 'auto' } = options;
  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    quality,
    secure: true
  });
};

/**
 * Middleware para procesar subida de archivos
 */
const uploadToCloudinary = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  // Procesar cada archivo
  const processedFiles = req.files.map(file => ({
    ...file,
    cloudinaryUrl: file.path,
    publicId: file.filename
  }));

  req.files = processedFiles;
  next();
};

module.exports = {
  cloudinary,
  upload,
  uploadImage,
  deleteImage,
  getOptimizedUrl,
  uploadToCloudinary
};