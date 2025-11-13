/**
 * Servicio de almacenamiento seguro usando Google Cloud Storage y Cloudinary
 * Gestiona subida y acceso seguro a documentos de verificación e imágenes de perfil
 * REQ-36, REQ-40 - Almacenamiento seguro de documentos sensibles
 * REQ-06 - Gestión de fotos de perfil con Cloudinary
 */

const { Storage } = require('@google-cloud/storage');
const cloudinary = require('cloudinary').v2;
const path = require('path');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configurar Google Cloud Storage
const storage = new Storage({
  keyFilename: path.join(__dirname, '../keys/gcs-key.json'),
  projectId: 'changanet-notifications-477520'
});

const bucketName = 'changanet-docs';
const bucket = storage.bucket(bucketName);

/**
 * Sube documento de verificación a Google Cloud Storage
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} originalName - Nombre original del archivo
 * @param {string} userId - ID del usuario
 * @returns {Promise<string>} Nombre del archivo subido
 */
const uploadVerificationDocument = async (fileBuffer, originalName, userId) => {
  try {
    // Sanitizar nombre de archivo
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const fileName = `${userId}/${timestamp}_${sanitizedName}`;

    const file = bucket.file(fileName);

    // Configurar metadata
    const metadata = {
      metadata: {
        originalName: originalName,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        contentType: getContentType(originalName)
      }
    };

    // Subir archivo
    await file.save(fileBuffer, metadata);

    console.log(`✅ Documento subido a GCS: ${fileName}`);
    return fileName;
  } catch (error) {
    console.error('❌ Error subiendo documento a GCS:', error);
    throw new Error('Error al subir el documento de verificación');
  }
};

/**
 * Genera URL firmada para acceder al documento (válida 15 minutos)
 * @param {string} fileName - Nombre del archivo en GCS
 * @returns {Promise<string>} URL firmada
 */
const getSignedUrl = async (fileName) => {
  try {
    const file = bucket.file(fileName);

    // URL válida por 15 minutos
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutos
    });

    return url;
  } catch (error) {
    console.error('❌ Error generando URL firmada:', error);
    throw new Error('Error al generar URL de acceso al documento');
  }
};

/**
 * Obtiene el tipo de contenido basado en la extensión del archivo
 * @param {string} fileName - Nombre del archivo
 * @returns {string} Tipo MIME
 */
const getContentType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.pdf': 'application/pdf'
  };
  return contentTypes[ext] || 'application/octet-stream';
};

/**
 * Valida archivo antes de subir
 * @param {Buffer} buffer - Buffer del archivo
 * @param {string} mimeType - Tipo MIME
 * @param {string} originalName - Nombre original
 * @returns {boolean} true si es válido
 */
const validateFile = (buffer, mimeType, originalName) => {
  // Tipos permitidos
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (!allowedTypes.includes(mimeType)) {
    throw new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG) y PDF.');
  }

  // Tamaño máximo: 5MB
  const maxSize = 5 * 1024 * 1024;
  if (buffer.length > maxSize) {
    throw new Error('El archivo es demasiado grande. Máximo 5MB permitido.');
  }

  return true;
};

/**
 * Sube documento genérico a Google Cloud Storage
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} fileName - Nombre del archivo
 * @param {string} mimeType - Tipo MIME
 * @param {string} userId - ID del usuario
 * @returns {Promise<string>} Nombre del archivo subido
 */
const uploadDocument = async (fileBuffer, fileName, mimeType, userId) => {
  try {
    // Usar la nueva función específica para verificación
    return await uploadVerificationDocument(fileBuffer, fileName, userId);
  } catch (error) {
    console.error('❌ Error subiendo documento:', error);
    throw error;
  }
};

/**
 * Sube imagen a Cloudinary para perfiles de usuario
 * @param {Buffer} buffer - Buffer de la imagen
 * @param {Object} options - Opciones de subida (folder, etc.)
 * @returns {Promise<Object>} Resultado de Cloudinary
 */
const uploadImage = async (buffer, options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(buffer, {
      folder: options.folder || 'changanet/profiles',
      resource_type: 'image',
      ...options
    });

    console.log('✅ Imagen subida a Cloudinary:', result.secure_url);
    return result;
  } catch (error) {
    console.error('❌ Error subiendo imagen a Cloudinary:', error);
    throw new Error('Error al subir la imagen');
  }
};

/**
 * Elimina imagen de Cloudinary
 * @param {string} publicId - Public ID de la imagen en Cloudinary
 * @returns {Promise<Object>} Resultado de la eliminación
 */
const deleteImage = async (publicId) => {
  try {
    // Extraer el public_id si viene con folder
    const cleanPublicId = publicId.replace('changanet/', '');

    const result = await cloudinary.uploader.destroy(`changanet/${cleanPublicId}`);

    console.log('✅ Imagen eliminada de Cloudinary:', cleanPublicId);
    return result;
  } catch (error) {
    console.error('❌ Error eliminando imagen de Cloudinary:', error);
    throw new Error('Error al eliminar la imagen');
  }
};

module.exports = {
  uploadVerificationDocument,
  getSignedUrl,
  validateFile,
  uploadDocument,
  uploadImage,
  deleteImage
};