/**
 * Multer Configuration
 * Configuración centralizada de multer para subida de archivos
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configuración de almacenamiento en memoria para procesamiento
const memoryStorage = multer.memoryStorage();

// Configuración de almacenamiento en disco (fallback)
const diskStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const basename = path.basename(file.originalname, extension);
    cb(null, `${basename}-${uniqueSuffix}${extension}`);
  }
});

// Filtro de archivos
const fileFilter = (req, file, cb) => {
  // Tipos MIME permitidos
  const allowedMimes = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    video: ['video/mp4', 'video/avi', 'video/mov']
  };

  // Verificar tipo de archivo según campo
  const fieldName = file.fieldname;
  let allowedTypes = [];

  if (fieldName.includes('photo') || fieldName.includes('foto') || fieldName.includes('image')) {
    allowedTypes = allowedMimes.image;
  } else if (fieldName.includes('document') || fieldName.includes('doc')) {
    allowedTypes = allowedMimes.document;
  } else if (fieldName.includes('video')) {
    allowedTypes = allowedMimes.video;
  } else {
    // Por defecto permitir imágenes
    allowedTypes = allowedMimes.image;
  }

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido. Tipos permitidos: ${allowedTypes.join(', ')}`), false);
  }
};

// Configuración base
const baseConfig = {
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10 // máximo 10 archivos
  }
};

// Configuración para fotos de perfil
const profilePhotoConfig = {
  storage: memoryStorage,
  ...baseConfig,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 2 // foto de perfil + portada
  }
};

// Configuración para documentos de verificación
const verificationDocumentConfig = {
  storage: memoryStorage,
  ...baseConfig,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 2 // frente y reverso
  }
};

// Configuración para fotos de galería
const galleryPhotoConfig = {
  storage: memoryStorage,
  ...baseConfig,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB por foto
    files: 20 // máximo 20 fotos en galería
  }
};

// Configuración para fotos de cotizaciones
const quotePhotoConfig = {
  storage: memoryStorage,
  ...baseConfig,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10 // máximo 10 fotos por cotización
  }
};

// Exportar middlewares configurados
module.exports = {
  profilePhotoUpload: multer(profilePhotoConfig),
  verificationDocumentUpload: multer(verificationDocumentConfig),
  galleryPhotoUpload: multer(galleryPhotoConfig),
  quotePhotoUpload: multer(quotePhotoConfig),

  // Configuraciones individuales para uso directo
  memoryStorage,
  diskStorage,
  fileFilter
};