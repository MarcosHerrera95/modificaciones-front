# Implementación de Validaciones Robustas - Sistema de Reseñas

## Fecha de Análisis
25 de Noviembre, 2025

## Resumen Ejecutivo

Este documento detalla la implementación de validaciones robustas para el Sistema de Reseñas y Valoraciones de Changánet, cubriendo tanto las validaciones del frontend como del backend, con el objetivo de asegurar la integridad de los datos, prevenir errores y mejorar la experiencia del usuario.

## Validaciones por Requerimiento

### REQ-21: Calificación con estrellas (1 a 5)

#### Validaciones de Frontend

1. **Validación de rango**:
   - Solo se permiten valores del 1 al 5
   - No se permite enviar el formulario sin seleccionar una calificación
   - **Implementación**: Deshabilitar el botón de envío hasta que se seleccione una calificación

2. **Validación visual**:
   - La selección debe ser visualmente clara
   - Los estados hover y active deben ser diferenciados
   - **Implementación**: Usar estilos CSS para feedback visual

#### Validaciones de Backend

1. **Validación de tipo**:
   - La calificación debe ser un número entero
   - **Implementación**: Usar `parseInt()` y verificar si el resultado es un número

2. **Validación de rango**:
   - La calificación debe estar entre 1 y 5
   - **Implementación**: Verificar que el valor esté en el rango permitido

```javascript
// Validación de calificación en el backend
const calificacion = parseInt(req.body.calificacion);
if (isNaN(calificacion) || calificacion < 1 || calificacion > 5) {
  return res.status(400).json({ error: 'La calificación debe ser un número entre 1 y 5.' });
}
```

### REQ-22: Comentario escrito

#### Validaciones de Frontend

1. **Validación de longitud**:
   - El comentario debe tener un límite de caracteres (ej. 1000 caracteres)
   - **Implementación**: Usar `maxLength` en el textarea y mostrar el contador de caracteres

2. **Validación de contenido**:
   - El comentario no debe contener palabras prohibidas
   - **Implementación**: Filtrado básico de palabras prohibidas

3. **Validación de formato**:
   - El comentario no debe estar vacío si se requiere
   - **Implementación**: Verificar que no sea solo espacios en blanco

#### Validaciones de Backend

1. **Validación de longitud**:
   - El comentario no debe superar el límite de caracteres
   - **Implementación**: Verificar la longitud de la cadena

2. **Sanitización**:
   - Eliminar tags HTML y scripts para prevenir XSS
   - **Implementación**: Usar una librería como DOMPurify

```javascript
// Validación de comentario en el backend
const comentario = req.body.comentario ? req.body.comentario.trim() : '';

// Verificar longitud
if (comentario.length > 1000) {
  return res.status(400).json({ error: 'El comentario no puede tener más de 1000 caracteres.' });
}

// Sanitización para prevenir XSS
const sanitizeHtml = require('sanitize-html');
const comentarioSanitizado = sanitizeHtml(comentario, {
  allowedTags: [],
  allowedAttributes: {}
});

// Verificar que no esté vacío (si es requerido)
if (comentarioSanitizado.trim() === '') {
  return res.status(400).json({ error: 'El comentario no puede estar vacío.' });
}
```

### REQ-23: Adjuntar foto del servicio finalizado

#### Validaciones de Frontend

1. **Validación de tipo de archivo**:
   - Solo se permiten archivos de imagen (JPEG, PNG, GIF)
   - **Implementación**: Filtrar por extensión y tipo MIME

2. **Validación de tamaño**:
   - El archivo no debe superar un límite (ej. 5MB)
   - **Implementación**: Verificar el tamaño del archivo antes de la subida

3. **Validación de dimensiones**:
   - La imagen debe tener dimensiones mínimas
   - **Implementación**: Leer las dimensiones de la imagen y verificarlas

#### Validaciones de Backend

1. **Validación de tipo de archivo**:
   - Solo se permiten archivos de imagen
   - **Implementación**: Verificar el tipo MIME

2. **Validación de tamaño**:
   - El archivo no debe superar un límite
   - **Implementación**: Verificar el tamaño del buffer

3. **Validación de contenido**:
   - La imagen debe ser válida
   - **Implementación**: Intentar leer la imagen y verificar que no esté corrupta

```javascript
// Validación de imagen en el backend
// Validación de tipo MIME
if (!req.file.mimetype.startsWith('image/')) {
  return res.status(400).json({ error: 'Solo se permiten archivos de imagen.' });
}

// Validación de tamaño
if (req.file.size > 5 * 1024 * 1024) { // 5MB
  return res.status(400).json({ error: 'La imagen no puede superar los 5MB.' });
}

// Validación de contenido usando la librería 'image-size'
const sizeOf = require('image-size');
try {
  const dimensions = sizeOf(req.file.buffer);
  // Verificar dimensiones mínimas (ej. 200x200)
  if (dimensions.width < 200 || dimensions.height < 200) {
    return res.status(400).json({ error: 'La imagen debe tener al menos 200x200 píxeles.' });
  }
} catch (err) {
  return res.status(400).json({ error: 'El archivo no es una imagen válida.' });
}
```

### REQ-24: Calcular y mostrar la calificación promedio

#### Validaciones de Frontend

1. **Validación de formato**:
   - El promedio debe mostrarse con una precisión de una decimal
   - **Implementación**: Usar `toFixed(1)` para formatear el número

2. **Validación de rango**:
   - El promedio debe estar entre 0 y 5
   - **Implementación**: Verificar que el valor esté en el rango permitido

#### Validaciones de Backend

1. **Validación de cálculo**:
   - El promedio debe calcularse correctamente
   - **Implementación**: Verificar que la fórmula sea correcta

2. **Validación de almacenamiento**:
   - El promedio debe almacenarse correctamente en la base de datos
   - **Implementación**: Verificar que el campo `calificacion_promedio` se actualice correctamente

```javascript
// Cálculo del promedio en el backend
const { _avg: { calificacion: avgRating } } = await prisma.resenas.aggregate({
  where: { servicio: { profesional_id: service.profesional_id } },
  _avg: { calificacion: true }
});

// Verificar que el promedio esté en el rango correcto
if (avgRating !== null && (avgRating < 0 || avgRating > 5)) {
  return res.status(500).json({ error: 'Error en el cálculo del promedio de calificación.' });
}

// Almacenar el promedio
await prisma.perfiles_profesionales.update({
  where: { usuario_id: service.profesional_id },
  data: { calificacion_promedio: avgRating || 0 }
});
```

### REQ-25: Solo usuarios que completaron un servicio pueden dejar reseña

#### Validaciones de Frontend

1. **Verificación de elegibilidad**:
   - Solo mostrar el formulario si el usuario puede reseñar
   - **Implementación**: Verificar antes de mostrar el formulario

2. **Validación de estado**:
   - El servicio debe estar en estado 'completado'
   - **Implementación**: Verificar el estado del servicio

#### Validaciones de Backend

1. **Verificación de permisos**:
   - Solo el cliente del servicio puede reseñar
   - **Implementación**: Verificar que `cliente_id` coincida con el ID del usuario autenticado

2. **Verificación de estado**:
   - El servicio debe estar en estado 'completado'
   - **Implementación**: Verificar que `estado` sea 'completado'

3. **Verificación de duplicados**:
   - No se puede dejar más de una reseña por servicio
   - **Implementación**: Verificar que no exista una reseña para ese servicio

```javascript
// Verificación de elegibilidad en el backend
const service = await prisma.servicios.findUnique({
  where: { id: servicio_id },
  include: { cliente: true, profesional: true }
});

// Verificar que el servicio existe
if (!service) {
  return res.status(404).json({ error: 'Servicio no encontrado.' });
}

// Verificar que el usuario es el cliente del servicio
if (service.cliente_id !== userId) {
  return res.status(403).json({ error: 'No tienes permiso para reseñar este servicio.' });
}

// Verificar que el servicio está completado
if (service.estado !== 'completado') {
  return res.status(400).json({ error: 'Solo se pueden reseñar servicios completados.' });
}

// Verificar que no existe ya una reseña para este servicio
const existingReview = await prisma.resenas.findUnique({
  where: { servicio_id: servicio_id }
});
if (existingReview) {
  return res.status(400).json({ error: 'Ya se ha dejado una reseña para este servicio.' });
}
```

## Validaciones Adicionales Recomendadas

1. **Validación de contenido ofensivo**:
   - Filtrar palabras ofensivas en comentarios e imágenes
   - **Implementación**: Usar una lista de palabras prohibidas y detección de contenido

2. **Validación de spam**:
   - Prevenir la subida masiva de reseñas
   - **Implementación**: Implementar límites de tasa (rate limiting)

3. **Validación de consistencia**:
   - Verificar que los datos sean consistentes con otras partes del sistema
   - **Implementación**: Validar referencias a otras entidades

4. **Validación de integridad**:
   - Verificar que los datos no se corrompan durante el procesamiento
   - **Implementación**: Usar transacciones de base de datos

## Implementación de Sistema de Validación Robusto

### Frontend

1. **Biblioteca de validación**:
   - Usar una biblioteca como Joi o Yup para validación
   - Implementar esquemas de validación reutilizables

2. **Validación en tiempo real**:
   - Mostrar errores a medida que el usuario填写 el formulario
   - Implementar validación con debouncing para evitar solicitudes excesivas

3. **Feedback visual**:
   - Proporcionar retroalimentación visual clara sobre errores
   - Usar íconos, colores y mensajes para indicar el estado de validación

### Backend

1. **Middleware de validación**:
   - Crear middleware reutilizable para validación de requests
   - Implementar un sistema de validación centralizado

2. **Sanitización de datos**:
   - Sanitizar todos los datos de entrada para prevenir ataques
   - Implementar un sistema de sanitización centralizado

3. **Validación de integridad**:
   - Usar transacciones de base de datos para operaciones complejas
   - Implementar restricciones de integridad a nivel de base de datos

## Conclusión

La implementación de validaciones robustas es esencial para garantizar la integridad de los datos y mejorar la experiencia del usuario. Las validaciones propuestas cubren todos los aspectos necesarios para cumplir con los requerimientos del PRD y proporcionan una capa adicional de seguridad y robustez al sistema.

Las validaciones deben implementarse tanto en el frontend como en el backend, con el backend siendo la fuente de verdad final. Es importante proporcionar retroalimentación clara al usuario cuando occuran errores de validación, para que pueda corregir los problemas fácilmente.