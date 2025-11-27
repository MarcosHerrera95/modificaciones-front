/**
 * PhotoUploadService
 * Servicio especializado para gestión de subida y procesamiento de fotos
 *
 * Maneja validación, optimización, almacenamiento y eliminación de imágenes
 * para perfiles de usuario y profesionales
 */

const { uploadImage, deleteImage } = require('./storageService');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

class PhotoUploadService {
  constructor() {
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    this.supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  }

  /**
   * Valida un archivo de imagen antes de procesarlo
   */
  validateImageFile(file) {
    if (!file) {
      throw new Error('No se proporcionó archivo');
    }

    if (!file.buffer && !file.path) {
      throw new Error('Archivo inválido: falta buffer o path');
    }

    // Validar tamaño
    const fileSize = file.size || file.buffer?.length || 0;
    if (fileSize > this.maxFileSize) {
      throw new Error(`El archivo es demasiado grande. Máximo ${this.maxFileSize / (1024 * 1024)}MB permitido.`);
    }

    // Validar tipo MIME
    if (!this.allowedTypes.includes(file.mimetype)) {
      throw new Error('Tipo de archivo no válido. Use JPEG, PNG o WebP.');
    }

    // Validar extensión
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!this.supportedExtensions.includes(extension)) {
      throw new Error('Extensión de archivo no válida.');
    }

    return true;
  }

  /**
   * Optimiza una imagen usando Sharp
   */
  async optimizeImage(buffer, options = {}) {
    try {
      const {
        width = 800,
        height = 800,
        quality = 85,
        format = 'webp'
      } = options;

      let sharpInstance = sharp(buffer)
        .resize(width, height, {
          fit: 'cover',
          position: 'center',
          withoutEnlargement: true
        });

      // Aplicar formato y calidad
      if (format === 'webp') {
        sharpInstance = sharpInstance.webp({ quality });
      } else if (format === 'jpeg') {
        sharpInstance = sharpInstance.jpeg({ quality });
      } else if (format === 'png') {
        sharpInstance = sharpInstance.png({ compressionLevel: 6 });
      }

      const optimizedBuffer = await sharpInstance.toBuffer();
      return optimizedBuffer;
    } catch (error) {
      console.error('Error optimizing image:', error);
      throw new Error('Error al optimizar la imagen');
    }
  }

  /**
   * Procesa y sube una foto de perfil
   */
  async processProfilePhoto(file, userId, type = 'profile') {
    try {
      // Validar archivo
      this.validateImageFile(file);

      // Optimizar imagen
      const optimizedBuffer = await this.optimizeImage(file.buffer, {
        width: type === 'banner' ? 1200 : 400,
        height: type === 'banner' ? 400 : 400,
        quality: 85,
        format: 'webp'
      });

      // Crear archivo optimizado para subida
      const optimizedFile = {
        ...file,
        buffer: optimizedBuffer,
        originalname: `${userId}_${type}_${Date.now()}.webp`,
        mimetype: 'image/webp'
      };

      // Determinar carpeta según tipo
      const folder = type === 'banner'
        ? 'changanet/professionals/banners'
        : 'changanet/users/profile-photos';

      // Subir a storage
      const result = await uploadImage(optimizedBuffer, {
        folder,
        public_id: `${userId}_${type}_${Date.now()}`
      });

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      };
    } catch (error) {
      console.error('Error processing profile photo:', error);
      throw error;
    }
  }

  /**
   * Procesa múltiples fotos (para galerías o portfolios)
   */
  async processMultiplePhotos(files, userId, maxPhotos = 10) {
    try {
      if (!Array.isArray(files)) {
        files = [files];
      }

      if (files.length > maxPhotos) {
        throw new Error(`Máximo ${maxPhotos} fotos permitidas`);
      }

      const results = [];

      for (const file of files) {
        try {
          this.validateImageFile(file);

          const optimizedBuffer = await this.optimizeImage(file.buffer, {
            width: 800,
            height: 600,
            quality: 80,
            format: 'webp'
          });

          const result = await uploadImage(optimizedBuffer, {
            folder: `changanet/professionals/galleries/${userId}`,
            public_id: `${userId}_gallery_${Date.now()}_${results.length}`
          });

          results.push({
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            originalName: file.originalname
          });
        } catch (error) {
          console.error(`Error processing photo ${file.originalname}:`, error);
          results.push({
            success: false,
            error: error.message,
            originalName: file.originalname
          });
        }
      }

      return {
        total: files.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      console.error('Error processing multiple photos:', error);
      throw error;
    }
  }

  /**
   * Elimina una foto del storage
   */
  async deletePhoto(publicId) {
    try {
      if (!publicId) {
        return { success: true, message: 'No public ID provided' };
      }

      await deleteImage(publicId);

      return {
        success: true,
        message: 'Foto eliminada exitosamente',
        publicId
      };
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw new Error('Error al eliminar la foto');
    }
  }

  /**
   * Actualiza foto de perfil con eliminación de la anterior
   */
  async updateProfilePhoto(file, userId, currentPublicId = null, type = 'profile') {
    try {
      // Eliminar foto anterior si existe
      if (currentPublicId) {
        try {
          await this.deletePhoto(currentPublicId);
        } catch (error) {
          console.warn('Error deleting previous photo:', error);
          // No fallar si no se puede eliminar la anterior
        }
      }

      // Procesar y subir nueva foto
      const result = await this.processProfilePhoto(file, userId, type);

      return {
        success: true,
        url: result.url,
        publicId: result.publicId,
        previousPublicId: currentPublicId,
        message: 'Foto de perfil actualizada exitosamente'
      };
    } catch (error) {
      console.error('Error updating profile photo:', error);
      throw error;
    }
  }

  /**
   * Valida y optimiza imagen para verificación de identidad
   */
  async processVerificationPhoto(file, userId, side = 'front') {
    try {
      this.validateImageFile(file);

      // Para documentos de identidad, mantener mayor calidad
      const optimizedBuffer = await this.optimizeImage(file.buffer, {
        width: 1000,
        height: 700,
        quality: 95,
        format: 'jpeg' // JPEG para documentos
      });

      const result = await uploadImage(optimizedBuffer, {
        folder: `changanet/verifications/${userId}`,
        public_id: `${userId}_verification_${side}_${Date.now()}`
      });

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        side,
        message: `Foto de ${side === 'front' ? 'frente' : 'reverso'} procesada exitosamente`
      };
    } catch (error) {
      console.error('Error processing verification photo:', error);
      throw error;
    }
  }

  /**
   * Genera thumbnails para preview rápido
   */
  async generateThumbnail(buffer, size = 150) {
    try {
      const thumbnail = await sharp(buffer)
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 70 })
        .toBuffer();

      return thumbnail;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      throw new Error('Error al generar thumbnail');
    }
  }

  /**
   * Obtiene metadatos de una imagen
   */
  async getImageMetadata(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation
      };
    } catch (error) {
      console.error('Error getting image metadata:', error);
      throw new Error('Error al obtener metadatos de la imagen');
    }
  }

  /**
   * Convierte imagen a diferentes formatos
   */
  async convertImage(buffer, targetFormat = 'webp', quality = 85) {
    try {
      let sharpInstance = sharp(buffer);

      switch (targetFormat) {
        case 'webp':
          sharpInstance = sharpInstance.webp({ quality });
          break;
        case 'jpeg':
        case 'jpg':
          sharpInstance = sharpInstance.jpeg({ quality });
          break;
        case 'png':
          sharpInstance = sharpInstance.png({ compressionLevel: 6 });
          break;
        default:
          throw new Error(`Formato no soportado: ${targetFormat}`);
      }

      const convertedBuffer = await sharpInstance.toBuffer();
      return convertedBuffer;
    } catch (error) {
      console.error('Error converting image:', error);
      throw new Error('Error al convertir la imagen');
    }
  }

  /**
   * Valida dimensiones mínimas de imagen
   */
  validateImageDimensions(metadata, minWidth = 200, minHeight = 200) {
    if (metadata.width < minWidth || metadata.height < minHeight) {
      throw new Error(`La imagen debe tener al menos ${minWidth}x${minHeight} píxeles`);
    }
    return true;
  }

  /**
   * Comprime imagen manteniendo calidad aceptable
   */
  async compressImage(buffer, targetSizeKB = 500) {
    try {
      const targetBytes = targetSizeKB * 1024;
      let quality = 90;
      let compressedBuffer = buffer;

      // Intentar compresión progresiva hasta alcanzar el tamaño objetivo
      while (compressedBuffer.length > targetBytes && quality > 10) {
        compressedBuffer = await sharp(buffer)
          .webp({ quality })
          .toBuffer();
        quality -= 10;
      }

      return {
        buffer: compressedBuffer,
        originalSize: buffer.length,
        compressedSize: compressedBuffer.length,
        compressionRatio: ((buffer.length - compressedBuffer.length) / buffer.length * 100).toFixed(1)
      };
    } catch (error) {
      console.error('Error compressing image:', error);
      throw new Error('Error al comprimir la imagen');
    }
  }
}

module.exports = new PhotoUploadService();