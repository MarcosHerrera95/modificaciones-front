/**
 * PhotoUploadService
 * Servicio frontend para subida y gestión de fotos
 *
 * Maneja validación, optimización y subida de imágenes
 * para perfiles de usuario, galerías y documentos de verificación
 */

class PhotoUploadService {
  constructor() {
    this.baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
    this.token = localStorage.getItem('changanet_token');
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    this.allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  }

  /**
   * Configurar headers de autenticación
   */
  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`
      // No setear Content-Type para FormData
    };
  }

  /**
   * Manejo de respuestas de API
   */
  async handleResponse(response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Validar archivo de imagen
   */
  validateImageFile(file, options = {}) {
    const {
      maxSize = this.maxFileSize,
      allowedTypes = this.allowedTypes,
      minWidth = 0,
      minHeight = 0
    } = options;

    if (!file) {
      throw new Error('No se proporcionó archivo');
    }

    // Validar tamaño
    if (file.size > maxSize) {
      throw new Error(`El archivo es demasiado grande. Máximo ${Math.round(maxSize / (1024 * 1024))}MB permitido.`);
    }

    // Validar tipo MIME
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de archivo no válido. Use JPEG, PNG o WebP.');
    }

    // Validar extensión
    const extension = file.name ? file.name.toLowerCase().substring(file.name.lastIndexOf('.')) : '';
    if (!this.allowedExtensions.includes(extension)) {
      throw new Error('Extensión de archivo no válida.');
    }

    // Validar dimensiones mínimas si se especifican
    if (minWidth > 0 || minHeight > 0) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (img.width < minWidth || img.height < minHeight) {
            reject(new Error(`La imagen debe tener al menos ${minWidth}x${minHeight} píxeles`));
          } else {
            resolve(true);
          }
        };
        img.onerror = () => reject(new Error('Error al validar dimensiones de la imagen'));
        img.src = URL.createObjectURL(file);
      });
    }

    return true;
  }

  /**
   * POST /api/upload/image
   * Sube una imagen general a Cloudinary
   */
  async uploadImage(file, options = {}) {
    try {
      await this.validateImageFile(file, options);

      const formData = new FormData();
      formData.append('image', file);

      // Agregar opciones adicionales
      if (options.folder) formData.append('folder', options.folder);
      if (options.public_id) formData.append('public_id', options.public_id);

      const response = await fetch(`${this.baseURL}/api/upload/image`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: formData
      });

      const result = await this.handleResponse(response);
      return result.data;
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      throw error;
    }
  }

  /**
   * POST /api/upload/document
   * Sube un documento a Google Cloud Storage
   */
  async uploadDocument(file, options = {}) {
    try {
      const allowedDocTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      await this.validateImageFile(file, {
        ...options,
        allowedTypes: allowedDocTypes
      });

      const formData = new FormData();
      formData.append('document', file);

      const response = await fetch(`${this.baseURL}/api/upload/document`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: formData
      });

      const result = await this.handleResponse(response);
      return result.data;
    } catch (error) {
      console.error('Error subiendo documento:', error);
      throw error;
    }
  }

  /**
   * Subir foto de perfil de usuario
   */
  async uploadProfilePhoto(file, userId) {
    try {
      await this.validateImageFile(file, { minWidth: 200, minHeight: 200 });

      const result = await this.uploadImage(file, {
        folder: 'changanet/users/profile-photos',
        public_id: `profile_${userId}_${Date.now()}`
      });

      return {
        success: true,
        url: result.url,
        publicId: result.public_id,
        message: 'Foto de perfil subida exitosamente'
      };
    } catch (error) {
      console.error('Error subiendo foto de perfil:', error);
      throw error;
    }
  }

  /**
   * Subir foto de portada/banner
   */
  async uploadBannerPhoto(file, userId) {
    try {
      await this.validateImageFile(file, { minWidth: 800, minHeight: 400 });

      const result = await this.uploadImage(file, {
        folder: 'changanet/professionals/banners',
        public_id: `banner_${userId}_${Date.now()}`
      });

      return {
        success: true,
        url: result.url,
        publicId: result.public_id,
        message: 'Foto de portada subida exitosamente'
      };
    } catch (error) {
      console.error('Error subiendo foto de portada:', error);
      throw error;
    }
  }

  /**
   * Subir múltiples fotos para galería
   */
  async uploadGalleryPhotos(files, userId, maxPhotos = 10) {
    try {
      if (!Array.isArray(files)) {
        files = [files];
      }

      if (files.length > maxPhotos) {
        throw new Error(`Máximo ${maxPhotos} fotos permitidas`);
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          await this.validateImageFile(file, { minWidth: 400, minHeight: 300 });

          const result = await this.uploadImage(file, {
            folder: `changanet/professionals/galleries/${userId}`,
            public_id: `gallery_${userId}_${Date.now()}_${i}`
          });

          results.push({
            success: true,
            url: result.url,
            publicId: result.public_id,
            originalName: file.name,
            index: i
          });
        } catch (error) {
          console.error(`Error subiendo foto ${file.name}:`, error);
          errors.push({
            success: false,
            error: error.message,
            originalName: file.name,
            index: i
          });
        }
      }

      return {
        total: files.length,
        successful: results.length,
        failed: errors.length,
        results: [...results, ...errors],
        message: `Subidas ${results.length} de ${files.length} fotos`
      };
    } catch (error) {
      console.error('Error subiendo fotos de galería:', error);
      throw error;
    }
  }

  /**
   * Subir fotos de verificación de identidad
   */
  async uploadVerificationPhotos(frontPhoto, backPhoto, userId) {
    try {
      const results = [];

      // Validar y subir foto frontal
      if (frontPhoto) {
        await this.validateImageFile(frontPhoto, { minWidth: 600, minHeight: 400 });

        const frontResult = await this.uploadImage(frontPhoto, {
          folder: `changanet/verifications/${userId}`,
          public_id: `verification_${userId}_front_${Date.now()}`
        });

        results.push({
          side: 'front',
          success: true,
          url: frontResult.url,
          publicId: frontResult.public_id
        });
      }

      // Validar y subir foto trasera
      if (backPhoto) {
        await this.validateImageFile(backPhoto, { minWidth: 600, minHeight: 400 });

        const backResult = await this.uploadImage(backPhoto, {
          folder: `changanet/verifications/${userId}`,
          public_id: `verification_${userId}_back_${Date.now()}`
        });

        results.push({
          side: 'back',
          success: true,
          url: backResult.url,
          publicId: backResult.public_id
        });
      }

      return {
        success: true,
        results,
        message: 'Fotos de verificación subidas exitosamente'
      };
    } catch (error) {
      console.error('Error subiendo fotos de verificación:', error);
      throw error;
    }
  }

  /**
   * Comprimir imagen antes de subir (opcional)
   */
  async compressImage(file, quality = 0.8) {
    try {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
          // Calcular nuevas dimensiones manteniendo aspect ratio
          const maxWidth = 1200;
          const maxHeight = 1200;
          let { width, height } = img;

          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          // Dibujar imagen comprimida
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            }));
          }, file.type, quality);
        };

        img.src = URL.createObjectURL(file);
      });
    } catch (error) {
      console.error('Error comprimiendo imagen:', error);
      return file; // Retornar archivo original si falla la compresión
    }
  }

  /**
   * Crear thumbnail de preview
   */
  async createThumbnail(file, size = 150) {
    try {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
          canvas.width = size;
          canvas.height = size;

          // Calcular crop para mantener aspect ratio
          const aspectRatio = img.width / img.height;
          let sourceX, sourceY, sourceWidth, sourceHeight;

          if (aspectRatio > 1) {
            // Imagen más ancha
            sourceWidth = img.height;
            sourceHeight = img.height;
            sourceX = (img.width - img.height) / 2;
            sourceY = 0;
          } else {
            // Imagen más alta
            sourceWidth = img.width;
            sourceHeight = img.width;
            sourceX = 0;
            sourceY = (img.height - img.width) / 2;
          }

          ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size, size);

          canvas.toBlob((blob) => {
            resolve(new File([blob], `thumb_${file.name}`, {
              type: file.type,
              lastModified: Date.now()
            }));
          }, file.type, 0.7);
        };

        img.src = URL.createObjectURL(file);
      });
    } catch (error) {
      console.error('Error creando thumbnail:', error);
      throw error;
    }
  }

  /**
   * Obtener metadatos de imagen
   */
  async getImageMetadata(file) {
    try {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            width: img.width,
            height: img.height,
            aspectRatio: img.width / img.height,
            fileSize: file.size,
            type: file.type,
            name: file.name
          });
        };
        img.onerror = () => reject(new Error('Error obteniendo metadatos'));
        img.src = URL.createObjectURL(file);
      });
    } catch (error) {
      console.error('Error obteniendo metadatos de imagen:', error);
      throw error;
    }
  }

  /**
   * Validar lote de archivos antes de subir
   */
  validateFileBatch(files, options = {}) {
    const errors = [];
    const validFiles = [];

    files.forEach((file, index) => {
      try {
        this.validateImageFile(file, options);
        validFiles.push(file);
      } catch (error) {
        errors.push({
          index,
          fileName: file.name,
          error: error.message
        });
      }
    });

    return {
      validFiles,
      errors,
      isValid: errors.length === 0
    };
  }
}

export const photoUploadService = new PhotoUploadService();
export default photoUploadService;