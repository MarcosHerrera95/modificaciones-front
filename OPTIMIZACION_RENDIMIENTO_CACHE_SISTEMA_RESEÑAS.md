# Optimización de Rendimiento y Caché - Sistema de Reseñas

## Fecha de Análisis
25 de Noviembre, 2025

## Resumen Ejecutivo

Este documento detalla las estrategias de optimización de rendimiento y caché para el Sistema de Reseñas y Valoraciones de Changánet, con el objetivo de mejorar la eficiencia, escalabilidad y tiempo de respuesta del sistema.

## Análisis de Rendimiento Actual

### Problemas Identificados

1. **Consultas N+1**:
   - Al obtener reseñas de un profesional, se hacen consultas separadas para obtener información del cliente y servicio
   - **Impacto**: Alto, especialmente con muchas reseñas

2. **Cálculo de Promedio**:
   - El promedio se calcula obteniendo todas las reseñas y procesándolas en memoria
   - **Impacto**: Alto, especialmente con muchas reseñas

3. **Consultas No Optimizadas**:
   - Algunas consultas podrían beneficiarse de índices adicionales
   - **Impacto**: Medio, especialmente en tablas grandes

4. **Falta de Caché**:
   - No se implementa caché para consultas frecuentes
   - **Impacto**: Alto, especialmente con muchas solicitudes

5. **Falta de Paginación**:
   - Algunas consultas devuelven todos los resultados sin paginación
   - **Impacto**: Alto, especialmente con muchas reseñas

## Estrategias de Optimización

### 1. Implementación de Caché

#### Caché de Estadísticas de Reseñas

```javascript
// src/services/cacheService.js
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutos

// Clave para el caché de estadísticas de reseñas
const getReviewStatsCacheKey = (professionalId) => `review_stats_${professionalId}`;

// Obtener estadísticas de reseñas desde caché
const getCachedReviewStats = async (professionalId) => {
  const cacheKey = getReviewStatsCacheKey(professionalId);
  return cache.get(cacheKey);
};

// Almacenar estadísticas de reseñas en caché
const cacheReviewStats = (professionalId, stats) => {
  const cacheKey = getReviewStatsCacheKey(professionalId);
  cache.set(cacheKey, stats, 600); // 10 minutos
};

// Invalidar caché de estadísticas de reseñas
const invalidateReviewStatsCache = (professionalId) => {
  const cacheKey = getReviewStatsCacheKey(professionalId);
  cache.del(cacheKey);
};

module.exports = {
  getCachedReviewStats,
  cacheReviewStats,
  invalidateReviewStatsCache
};
```

#### Uso del Caché en el Controlador

```javascript
// src/controllers/reviewController.js
const { getCachedReviewStats, cacheReviewStats, invalidateReviewStatsCache } = require('../services/cacheService');

// Función para obtener estadísticas de reseñas con caché
exports.getReviewStats = async (req, res) => {
  const { professionalId } = req.params;
  
  try {
    // Intentar obtener desde caché primero
    let stats = await getCachedReviewStats(professionalId);
    
    // Si no está en caché, calcular y almacenar
    if (!stats) {
      const reviews = await prisma.resenas.findMany({
        where: {
          servicio: {
            profesional_id: professionalId
          }
        },
        select: {
          calificacion: true,
          creado_en: true
        }
      });

      const totalReviews = reviews.length;
      const averageRating = totalReviews > 0
        ? reviews.reduce((sum, review) => sum + review.calificacion, 0) / totalReviews
        : 0;

      const ratingDistribution = {
        1: reviews.filter(r => r.calificacion === 1).length,
        2: reviews.filter(r => r.calificacion === 2).length,
        3: reviews.filter(r => r.calificacion === 3).length,
        4: reviews.filter(r => r.calificacion === 4).length,
        5: reviews.filter(r => r.calificacion === 5).length
      };

      const positiveReviews = reviews.filter(r => r.calificacion >= 4).length;
      const positivePercentage = totalReviews > 0 ? (positiveReviews / totalReviews) * 100 : 0;

      stats = {
        professionalId,
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution,
        positivePercentage: Math.round(positivePercentage),
        lastReviewDate: reviews.length > 0 ? reviews[0].creado_en : null
      };
      
      // Almacenar en caché
      cacheReviewStats(professionalId, stats);
    }

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas de reseñas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de reseñas.' });
  }
};
```

### 2. Optimización de Consultas

#### Uso de Agregación de Base de Datos

```javascript
// Función para calcular estadísticas con agregación SQL
exports.getReviewStats = async (req, res) => {
  const { professionalId } = req.params;

  try {
    // Usar agregación SQL para calcular estadísticas
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_reviews,
        AVG(calificacion) as average_rating,
        SUM(CASE WHEN calificacion = 1 THEN 1 ELSE 0 END) as star_1,
        SUM(CASE WHEN calificacion = 2 THEN 1 ELSE 0 END) as star_2,
        SUM(CASE WHEN calificacion = 3 THEN 1 ELSE 0 END) as star_3,
        SUM(CASE WHEN calificacion = 4 THEN 1 ELSE 0 END) as star_4,
        SUM(CASE WHEN calificacion = 5 THEN 1 ELSE 0 END) as star_5,
        SUM(CASE WHEN calificacion >= 4 THEN 1 ELSE 0 END) as positive_reviews,
        MAX(creado_en) as last_review_date
      FROM resenas 
      WHERE servicio_id IN (
        SELECT id FROM servicios WHERE profesional_id = ${professionalId}
      )
    `;

    const statsData = stats[0];
    const averageRating = statsData.average_rating || 0;
    const ratingDistribution = {
      1: parseInt(statsData.star_1) || 0,
      2: parseInt(statsData.star_2) || 0,
      3: parseInt(statsData.star_3) || 0,
      4: parseInt(statsData.star_4) || 0,
      5: parseInt(statsData.star_5) || 0
    };
    
    const positivePercentage = statsData.total_reviews > 0 
      ? (statsData.positive_reviews / statsData.total_reviews) * 100 
      : 0;

    res.status(200).json({
      professionalId,
      totalReviews: parseInt(statsData.total_reviews) || 0,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution,
      positivePercentage: Math.round(positivePercentage),
      lastReviewDate: statsData.last_review_date
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de reseñas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de reseñas.' });
  }
};
```

#### Optimización de Consulta de Reseñas

```javascript
// Función para obtener reseñas de un profesional con optimización
exports.getReviewsByProfessional = async (req, res) => {
  const { professionalId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const offset = (page - 1) * limit;
    
    // Usar include optimizado para evitar N+1
    const reviews = await prisma.resenas.findMany({
      where: {
        servicio: {
          profesional_id: professionalId
        }
      },
      include: {
        servicio: {
          select: {
            id: true,
            descripcion: true,
            completado_en: true
          }
        },
        cliente: {
          select: {
            nombre: true,
            email: true,
            url_foto_perfil: true
          }
        }
      },
      orderBy: {
        creado_en: 'desc'
      },
      skip: offset,
      take: parseInt(limit)
    });
    
    // Obtener el total para la paginación
    const totalReviews = await prisma.resenas.count({
      where: {
        servicio: {
          profesional_id: professionalId
        }
      }
    });
    
    const totalPages = Math.ceil(totalReviews / limit);

    res.status(200).json({
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalReviews,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las reseñas.' });
  }
};
```

### 3. Implementación de Paginación

#### Paginación en el Backend

```javascript
// src/controllers/reviewController.js
// Función para obtener reseñas con paginación
exports.getReviewsByProfessional = async (req, res) => {
  const { professionalId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const offset = (page - 1) * limit;
    
    // Obtener reseñas con paginación
    const reviews = await prisma.resenas.findMany({
      where: {
        servicio: {
          profesional_id: professionalId
        }
      },
      include: {
        servicio: true,
        cliente: {
          select: {
            nombre: true,
            email: true
          }
        }
      },
      orderBy: {
        creado_en: 'desc'
      },
      skip: offset,
      take: parseInt(limit)
    });
    
    // Obtener el total para la paginación
    const totalReviews = await prisma.resenas.count({
      where: {
        servicio: {
          profesional_id: professionalId
        }
      }
    });
    
    const totalPages = Math.ceil(totalReviews / limit);

    res.status(200).json({
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalReviews,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las reseñas.' });
  }
};
```

#### Paginación en el Frontend

```jsx
// src/components/ReviewsList.jsx
import { useState, useEffect } from 'react';

const ReviewsList = ({ professionalId }) => {
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalReviews: 0,
    hasNextPage: false,
    hasPreviousPage: false
  });
  const [loading, setLoading] = useState(true);

  const fetchReviews = async (page = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reviews/professional/${professionalId}?page=${page}&limit=10`);
      
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews);
        setPagination(data.pagination);
      } else {
        console.error('Error al cargar reseñas');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(1);
  }, [professionalId]);

  const handlePageChange = (newPage) => {
    fetchReviews(newPage);
  };

  return (
    <div>
      {loading ? (
        <div>Cargando reseñas...</div>
      ) : (
        <div>
          <div className="mb-4">
            <p>Total de reseñas: {pagination.totalReviews}</p>
          </div>
          
          {reviews.map(review => (
            <div key={review.id} className="border-b border-gray-200 py-4">
              {/* Contenido de la reseña */}
            </div>
          ))}
          
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={!pagination.hasPreviousPage}
            >
              Anterior
            </button>
            
            <span>
              Página {pagination.currentPage} de {pagination.totalPages}
            </span>
            
            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={!pagination.hasNextPage}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsList;
```

### 4. Optimización de Base de Datos

#### Índices Adicionales

```sql
-- Añadir índices para mejorar el rendimiento de consultas

-- Índice para buscar reseñas por profesional
CREATE INDEX idx_resenas_profesional_id ON resenas (servicio_id) 
WHERE servicio_id IN (SELECT id FROM servicios WHERE profesional_id = $1);

-- Índice para paginación en reseñas
CREATE INDEX idx_resenas_creado_en_desc ON resenas (creado_en DESC);

-- Índice para búsqueda de reseñas por calificación
CREATE INDEX idx_resenas_calificacion ON resenas (calificacion);

-- Índice para estadísticas de reseñas
CREATE INDEX idx_resenas_stats ON resenas (servicio_id, calificacion);
```

#### Vista Materializada para Estadísticas

```sql
-- Crear una vista materializada para estadísticas de reseñas
CREATE MATERIALIZED VIEW profesional_review_stats AS
SELECT 
  s.profesional_id,
  COUNT(r.id) as total_reviews,
  AVG(r.calificacion) as average_rating,
  SUM(CASE WHEN r.calificacion = 1 THEN 1 ELSE 0 END) as star_1,
  SUM(CASE WHEN r.calificacion = 2 THEN 1 ELSE 0 END) as star_2,
  SUM(CASE WHEN r.calificacion = 3 THEN 1 ELSE 0 END) as star_3,
  SUM(CASE WHEN r.calificacion = 4 THEN 1 ELSE 0 END) as star_4,
  SUM(CASE WHEN r.calificacion = 5 THEN 1 ELSE 0 END) as star_5,
  SUM(CASE WHEN r.calificacion >= 4 THEN 1 ELSE 0 END) as positive_reviews,
  MAX(r.creado_en) as last_review_date
FROM servicios s
JOIN resenas r ON s.id = r.servicio_id
GROUP BY s.profesional_id;

-- Crear un índice para la vista materializada
CREATE INDEX idx_profesional_review_stats_profesional_id ON profesional_review_stats (profesional_id);

-- Función para actualizar la vista materializada
CREATE OR REPLACE FUNCTION refresh_profesional_review_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW profesional_review_stats;
END;
$$ LANGUAGE plpgsql;
```

#### Uso de la Vista Materializada en el Backend

```javascript
// src/controllers/reviewController.js
// Función para obtener estadísticas usando la vista materializada
exports.getReviewStats = async (req, res) => {
  const { professionalId } = req.params;

  try {
    // Usar la vista materializada para obtener estadísticas
    const stats = await prisma.$queryRaw`
      SELECT * FROM profesional_review_stats WHERE profesional_id = ${professionalId}
    `;

    if (stats.length === 0) {
      return res.status(200).json({
        professionalId,
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0
        },
        positivePercentage: 0,
        lastReviewDate: null
      });
    }

    const statsData = stats[0];
    const ratingDistribution = {
      1: parseInt(statsData.star_1) || 0,
      2: parseInt(statsData.star_2) || 0,
      3: parseInt(statsData.star_3) || 0,
      4: parseInt(statsData.star_4) || 0,
      5: parseInt(statsData.star_5) || 0
    };
    
    const positivePercentage = statsData.total_reviews > 0 
      ? (statsData.positive_reviews / statsData.total_reviews) * 100 
      : 0;

    res.status(200).json({
      professionalId,
      totalReviews: parseInt(statsData.total_reviews) || 0,
      averageRating: Math.round((statsData.average_rating || 0) * 10) / 10,
      ratingDistribution,
      positivePercentage: Math.round(positivePercentage),
      lastReviewDate: statsData.last_review_date
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de reseñas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de reseñas.' });
  }
};
```

### 5. Compresión de Imágenes

#### Servicio de Compresión de Imágenes

```javascript
// src/services/imageCompressionService.js
const sharp = require('sharp');

/**
 * Comprime una imagen antes de subirla a Cloudinary
 * @param {Buffer} imageBuffer - Buffer de la imagen
 * @param {Object} options - Opciones de compresión
 * @returns {Promise<Buffer>} - Buffer de la imagen comprimida
 */
const compressImage = async (imageBuffer, options = {}) => {
  const {
    quality = 80,
    width = 800,
    height = 800,
    format = 'jpeg'
  } = options;

  try {
    // Redimensionar y comprimir la imagen
    const compressedBuffer = await sharp(imageBuffer)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toBuffer();

    return compressedBuffer;
  } catch (error) {
    console.error('Error comprimiendo imagen:', error);
    throw new Error('Error al comprimir la imagen');
  }
};

module.exports = {
  compressImage
};
```

#### Uso del Servicio de Compresión en el Controlador

```javascript
// src/controllers/reviewController.js
const { compressImage } = require('../services/imageCompressionService');

// Función para crear una reseña con compresión de imagen
exports.createReview = async (req, res) => {
  const { id: userId } = req.user;
  const { servicio_id, calificacion, comentario } = req.body;

  // Validar calificación
  const rating = parseInt(calificacion);
  if (isNaN(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'La calificación debe ser un número entre 1 y 5.' });
  }

  try {
    const service = await prisma.servicios.findUnique({
      where: { id: servicio_id },
      include: { cliente: true, profesional: true }
    });

    if (!service || service.estado !== 'completado' || service.cliente_id !== userId) {
      return res.status(403).json({ error: 'No puedes dejar una reseña para este servicio.' });
    }

    // Verificar si ya existe una reseña
    const existingReview = await prisma.resenas.findUnique({
      where: { servicio_id: servicio_id }
    });
    if (existingReview) {
      return res.status(400).json({ error: 'Ya se ha dejado una reseña para este servicio.' });
    }

    let url_foto = null;

    // Manejar subida de imagen si hay archivo
    if (req.file) {
      try {
        // Validar tamaño del archivo
        if (req.file.size > 5 * 1024 * 1024) {
          return res.status(400).json({ error: 'La imagen no puede superar los 5MB.' });
        }

        // Comprimir imagen antes de subirla
        const compressedBuffer = await compressImage(req.file.buffer, {
          quality: 80,
          width: 800,
          height: 800,
          format: 'jpeg'
        });

        // Subir imagen comprimida a Cloudinary
        const result = await uploadImage(compressedBuffer, { folder: 'changanet/reviews' });
        url_foto = result.secure_url;
        console.log('Imagen subida exitosamente:', url_foto);
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        return res.status(500).json({ error: 'Error al subir la imagen. Inténtalo de nuevo.' });
      }
    }

    // Crear la reseña
    const review = await prisma.resenas.create({
      data: {
        servicio_id,
        cliente_id: userId,
        calificacion: parseInt(calificacion),
        comentario,
        url_foto
      }
    });

    // Actualizar calificación promedio del profesional
    const reviews = await prisma.resenas.findMany({
      where: { servicio: { profesional_id: service.profesional_id } }
    });
    const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.calificacion, 0) / reviews.length : 0;

    await prisma.perfiles_profesionales.update({
      where: { usuario_id: service.profesional_id },
      data: { calificacion_promedio: avgRating }
    });

    // Enviar notificaciones
    try {
      await sendPushNotification(
        service.profesional_id,
        'Nueva reseña recibida',
        `Has recibido una nueva reseña de ${service.cliente.nombre} (${calificacion}⭐)`,
        {
          type: 'resena_recibida',
          servicio_id: servicio_id,
          calificacion: calificacion,
          cliente_id: userId
        }
      );
    } catch (pushError) {
      console.warn('Error enviando push notification de reseña:', pushError.message);
    }

    await createNotification(
      service.profesional_id,
      NOTIFICATION_TYPES.RESENA_RECIBIDA,
      `Has recibido una nueva reseña de ${service.cliente.nombre} (${calificacion}⭐)`,
      {
        servicio_id: servicio_id,
        calificacion: calificacion,
        cliente_id: userId
      }
    );

    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Error al crear la reseña.' });
  }
};
```

## Optimización del Frontend

### 1. Carga Diferida de Imágenes

```jsx
// src/components/LazyImage.jsx
import { useState, useRef, useEffect } from 'react';

const LazyImage = ({ src, alt, className, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, []);

  return (
    <div ref={imgRef} className={className}>
      {isInView && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          {...props}
        />
      )}
    </div>
  );
};

export default LazyImage;
```

### 2. Virtualización de Listas

```jsx
// src/components/VirtualizedReviewList.jsx
import { FixedSizeList as List } from 'react-window';
import { useMemo } from 'react';

const VirtualizedReviewList = ({ reviews, renderReview }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      {renderReview(reviews[index], index)}
    </div>
  );

  const itemCount = reviews.length;
  const itemSize = 120; // Altura de cada elemento

  const memoizedRow = useMemo(() => Row, [reviews]);

  return (
    <List
      height={600} // Altura del contenedor
      itemCount={itemCount}
      itemSize={itemSize}
      width="100%"
    >
      {memoizedRow}
    </List>
  );
};

export default VirtualizedReviewList;
```

## Monitoreo de Rendimiento

### 1. Métricas a Monitorear

- **Tiempo de respuesta de APIs**: Tiempo promedio de respuesta para cada endpoint
- **Consultas a la base de datos**: Número y tiempo de ejecución de consultas
- **Uso de caché**: Tasa de aciertos de caché
- **Rendimiento de la interfaz**: Tiempo de renderizado y carga de componentes

### 2. Herramientas de Monitoreo

- **Backend**: Express monitoring (如 New Relic), logging detallado
- **Base de datos**: Monitoreo de rendimiento de consultas
- **Frontend**: Lighthouse, Web Vitals

### 3. Implementación de Logging

```javascript
// src/middleware/performanceLogger.js
const winston = require('winston');

// Configurar el logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Middleware para medir el tiempo de respuesta
const performanceLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Performance', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  });
  
  next();
};

module.exports = { performanceLogger, logger };
```

```javascript
// src/controllers/reviewController.js
const { logger } = require('../middleware/performanceLogger');

// Función para obtener reseñas con logging
exports.getReviewsByProfessional = async (req, res) => {
  const startTime = Date.now();
  const { professionalId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const offset = (page - 1) * limit;
    
    logger.info('Fetching reviews', {
      professionalId,
      page,
      limit
    });
    
    const reviews = await prisma.resenas.findMany({
      where: {
        servicio: {
          profesional_id: professionalId
        }
      },
      include: {
        servicio: true,
        cliente: {
          select: {
            nombre: true,
            email: true
          }
        }
      },
      orderBy: {
        creado_en: 'desc'
      },
      skip: offset,
      take: parseInt(limit)
    });
    
    const totalReviews = await prisma.resenas.count({
      where: {
        servicio: {
          profesional_id: professionalId
        }
      }
    });
    
    const totalPages = Math.ceil(totalReviews / limit);

    const duration = Date.now() - startTime;
    logger.info('Reviews fetched successfully', {
      professionalId,
      reviewCount: reviews.length,
      duration: `${duration}ms`
    });

    res.status(200).json({
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalReviews,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error fetching reviews', {
      professionalId,
      error: error.message,
      duration: `${duration}ms`
    });
    
    res.status(500).json({ error: 'Error al obtener las reseñas.' });
  }
};
```

## Conclusión

La optimización de rendimiento y la implementación de caché son esenciales para garantizar que el Sistema de Reseñas y Valoraciones pueda manejar un gran volumen de usuarios y datos de manera eficiente. Las estrategias propuestas tienen como objetivo mejorar significativamente el rendimiento del sistema, especialmente en escenarios con muchas reseñas.

Es importante implementar estas optimizaciones de manera gradual y medir su impacto antes de desplegarlas en producción. El monitoreo continuo del rendimiento ayudará a identificar otros cuellos de botella que puedan surgir a medida que el sistema crezca.