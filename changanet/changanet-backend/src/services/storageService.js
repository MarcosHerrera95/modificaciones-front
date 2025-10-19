// src/services/storageService.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configurar Cloudinary con credenciales reales
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configurar almacenamiento de Cloudinary para Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'changanet', // Carpeta en Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'], // Formatos permitidos
    transformation: [{ width: 800, height: 600, crop: 'limit' }], // Transformación básica
  },
});

// Crear middleware de Multer con almacenamiento en Cloudinary
const upload = multer({ storage: storage });

// Función para subir imagen a Cloudinary
const uploadImage = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'changanet',
        public_id: options.publicId,
        transformation: options.transformation || [{ width: 800, height: 600, crop: 'limit' }],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// Función para eliminar imagen de Cloudinary
const deleteImage = (publicId) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};

// Función para obtener URL optimizada de imagen
const getOptimizedUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    width: options.width || 400,
    height: options.height || 300,
    crop: options.crop || 'fill',
    quality: options.quality || 'auto',
    fetch_format: 'auto',
  });
};

module.exports = {
  cloudinary,
  upload,
  uploadImage,
  deleteImage,
  getOptimizedUrl,
};