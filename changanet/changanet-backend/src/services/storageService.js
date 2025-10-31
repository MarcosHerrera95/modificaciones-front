// src/services/storageService.js
// Servicio de almacenamiento usando Firebase Storage
// Proporciona funciones para subir, descargar y gestionar archivos con credenciales reales de Firebase

const { storage } = require('../config/firebaseAdmin');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Configurar Multer para memoria (necesario para Firebase Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB límite
  },
  fileFilter: (req, file, cb) => {
    // Verificar tipos de archivo permitidos
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo imágenes JPG, PNG, GIF.'), false);
    }
  }
});

// Función para subir archivo a Firebase Storage
const uploadFile = async (fileBuffer, fileName, folder = 'changanet', metadata = {}) => {
  try {
    if (!storage) {
      throw new Error('Firebase Storage no está disponible');
    }

    const bucket = storage.bucket();
    const fileNameWithUUID = `${uuidv4()}_${fileName}`;
    const filePath = folder ? `${folder}/${fileNameWithUUID}` : fileNameWithUUID;

    const file = bucket.file(filePath);

    // Configurar metadata
    const fileMetadata = {
      metadata: {
        contentType: metadata.contentType || 'image/jpeg',
        metadata: {
          originalName: metadata.originalName || fileName,
          uploadedAt: new Date().toISOString(),
          ...metadata
        }
      }
    };

    // Subir archivo
    await file.save(fileBuffer, fileMetadata);

    // Hacer el archivo público
    await file.makePublic();

    // Obtener URL pública
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    console.log('✅ Archivo subido exitosamente a Firebase Storage:', publicUrl);

    return {
      url: publicUrl,
      fileName: fileNameWithUUID,
      path: filePath,
      bucket: bucket.name,
      size: fileBuffer.length
    };
  } catch (error) {
    console.error('❌ Error al subir archivo a Firebase Storage:', error);
    throw error;
  }
};

// Función para eliminar archivo de Firebase Storage
const deleteFile = async (filePath) => {
  try {
    if (!storage) {
      throw new Error('Firebase Storage no está disponible');
    }

    const bucket = storage.bucket();
    const file = bucket.file(filePath);

    await file.delete();
    console.log('✅ Archivo eliminado exitosamente:', filePath);
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar archivo:', error);
    throw error;
  }
};

// Función para obtener URL firmada (temporal) para archivos privados
const getSignedUrl = async (filePath, expiresIn = 3600) => { // 1 hora por defecto
  try {
    if (!storage) {
      throw new Error('Firebase Storage no está disponible');
    }

    const bucket = storage.bucket();
    const file = bucket.file(filePath);

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });

    return url;
  } catch (error) {
    console.error('❌ Error al obtener URL firmada:', error);
    throw error;
  }
};

// Función para obtener metadata de archivo
const getFileMetadata = async (filePath) => {
  try {
    if (!storage) {
      throw new Error('Firebase Storage no está disponible');
    }

    const bucket = storage.bucket();
    const file = bucket.file(filePath);

    const [metadata] = await file.getMetadata();
    return metadata;
  } catch (error) {
    console.error('❌ Error al obtener metadata del archivo:', error);
    throw error;
  }
};

// Función para listar archivos en una carpeta
const listFiles = async (folder = 'changanet', maxResults = 100) => {
  try {
    if (!storage) {
      throw new Error('Firebase Storage no está disponible');
    }

    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({
      prefix: folder,
      maxResults
    });

    return files.map(file => ({
      name: file.name,
      size: file.metadata.size,
      created: file.metadata.timeCreated,
      updated: file.metadata.updated,
      contentType: file.metadata.contentType
    }));
  } catch (error) {
    console.error('❌ Error al listar archivos:', error);
    throw error;
  }
};

// Función para subir imagen con optimización
const uploadImage = async (fileBuffer, fileName, options = {}) => {
  const folder = options.folder || 'changanet/images';
  const metadata = {
    contentType: options.contentType || 'image/jpeg',
    originalName: fileName,
    ...options.metadata
  };

  return await uploadFile(fileBuffer, fileName, folder, metadata);
};

// Función para subir archivo de reseña (con foto adjunta)
const uploadReviewFile = async (fileBuffer, fileName, reviewId) => {
  const folder = `changanet/reviews/${reviewId}`;
  const metadata = {
    contentType: 'image/jpeg',
    originalName: fileName,
    reviewId
  };

  return await uploadFile(fileBuffer, fileName, folder, metadata);
};

module.exports = {
  upload,
  uploadFile,
  deleteFile,
  getSignedUrl,
  getFileMetadata,
  listFiles,
  uploadImage,
  uploadReviewFile
};