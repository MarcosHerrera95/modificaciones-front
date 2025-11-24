-- Migration: Professional Profile Enhancements
-- Implements complete REQ-06 to REQ-10 functionality
-- Date: 2025-11-24

-- 1. Create specialties catalog table
CREATE TABLE IF NOT EXISTS specialties (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create coverage zones table for geographic areas
CREATE TABLE IF NOT EXISTS coverage_zones (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    city TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    radius_km REAL DEFAULT 5.0,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create junction table for professional specialties (many-to-many)
CREATE TABLE IF NOT EXISTS professional_specialties (
    professional_id TEXT NOT NULL,
    specialty_id TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (professional_id, specialty_id),
    FOREIGN KEY (professional_id) REFERENCES perfiles_profesionales(usuario_id) ON DELETE CASCADE,
    FOREIGN KEY (specialty_id) REFERENCES specialties(id) ON DELETE CASCADE
);

-- 4. Add coverage zone reference to professional profiles
ALTER TABLE perfiles_profesionales 
ADD COLUMN coverage_zone_id TEXT REFERENCES coverage_zones(id);

-- 5. Add enhanced profile fields for better functionality
ALTER TABLE perfiles_profesionales 
ADD COLUMN profile_completion_score INTEGER DEFAULT 0;

ALTER TABLE perfiles_profesionales 
ADD COLUMN profile_views_count INTEGER DEFAULT 0;

ALTER TABLE perfiles_profesionales 
ADD COLUMN last_profile_update DATETIME DEFAULT CURRENT_TIMESTAMP;

-- 6. Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_specialties_category ON specialties(category);
CREATE INDEX IF NOT EXISTS idx_specialties_active ON specialties(is_active);
CREATE INDEX IF NOT EXISTS idx_coverage_zones_city ON coverage_zones(city, state);
CREATE INDEX IF NOT EXISTS idx_coverage_zones_active ON coverage_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_professional_specialties_professional ON professional_specialties(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_specialties_specialty ON professional_specialties(specialty_id);
CREATE INDEX IF NOT EXISTS idx_professionals_completion_score ON perfiles_profesionales(profile_completion_score);
CREATE INDEX IF NOT EXISTS idx_professionals_last_update ON perfiles_profesionales(last_profile_update);

-- 7. Insert default specialties catalog
INSERT OR IGNORE INTO specialties (name, category, description) VALUES
-- Construction & Building
('Plomero', 'Construcción', 'Instalación y reparación de sistemas de plomería'),
('Electricista', 'Construcción', 'Instalación y mantenimiento de sistemas eléctricos'),
('Albañil', 'Construcción', 'Trabajos de mampostería y construcción'),
('Pintor', 'Construcción', 'Pintura residencial y comercial'),
('Gasista', 'Construcción', 'Instalación y reparación de sistemas de gas'),
('Herrero', 'Construcción', 'Trabajos en metal y herrería'),
('Carpintero', 'Construcción', 'Trabajos en madera y carpintería'),
(' techero', 'Construcción', 'Construcción y reparación de techos'),

-- Automotive
('Mecánico', 'Automotriz', 'Reparación y mantenimiento de vehículos'),
('Electricista Automotriz', 'Automotriz', 'Sistemas eléctricos de vehículos'),
('Chapista', 'Automotriz', 'Reparación de carrocerías'),
('Pintor Automotriz', 'Automotriz', 'Pintura de vehículos'),

-- Home Services
('Jardinero', 'Jardinería', 'Mantenimiento de jardines y espacios verdes'),
('Poda de Árboles', 'Jardinería', 'Poda y cuidado de árboles'),
('Limpieza', 'Limpieza', 'Servicios de limpieza residencial y comercial'),
('Mudanzas', 'Transporte', 'Servicios de mudanzas y transporte'),

-- HVAC
('Aire Acondicionado', 'Climatización', 'Instalación y mantenimiento de aire acondicionado'),
('Calefacción', 'Climatización', 'Instalación y mantenimiento de calefacción'),

-- Technology
('Técnico en Informática', 'Tecnología', 'Reparación y mantenimiento de equipos informáticos'),
('Instalador de Antenas', 'Tecnología', 'Instalación de sistemas de televisión y comunicaciones'),

-- Security
('Cerrajero', 'Seguridad', 'Apertura y reparación de cerraduras'),
('Instalador de Seguridad', 'Seguridad', 'Sistemas de alarmas y seguridad');

-- 8. Insert default coverage zones (major Argentine cities)
INSERT OR IGNORE INTO coverage_zones (name, state, city, latitude, longitude, radius_km) VALUES
('Ciudad Autónoma de Buenos Aires', 'Buenos Aires', 'Buenos Aires', -34.6118, -58.3960, 15.0),
('Palermo', 'Buenos Aires', 'Buenos Aires', -34.5881, -58.4165, 5.0),
('Recoleta', 'Buenos Aires', 'Buenos Aires', -34.5881, -58.3935, 3.0),
('Belgrano', 'Buenos Aires', 'Buenos Aires', -34.5622, -58.4572, 4.0),
('Puerto Madero', 'Buenos Aires', 'Buenos Aires', -34.6108, -58.3631, 2.0),
('San Telmo', 'Buenos Aires', 'Buenos Aires', -34.6214, -58.3730, 2.0),
('La Boca', 'Buenos Aires', 'Buenos Aires', -34.6345, -58.3638, 2.0),
('Avellaneda', 'Buenos Aires', 'Avellaneda', -34.6608, -58.3826, 8.0),
('Lanus', 'Buenos Aires', 'Lanus', -34.7175, -58.3993, 10.0),
('Quilmes', 'Buenos Aires', 'Quilmes', -34.7243, -58.2548, 12.0),
('Morón', 'Buenos Aires', 'Morón', -34.6435, -58.6212, 8.0),
('Tigre', 'Buenos Aires', 'Tigre', -34.4240, -58.5797, 15.0),
('San Isidro', 'Buenos Aires', 'San Isidro', -34.4708, -58.5364, 10.0),
('Vicente López', 'Buenos Aires', 'Vicente López', -34.5078, -58.4639, 6.0),
('San Fernando', 'Buenos Aires', 'San Fernando', -34.4420, -58.5584, 8.0),
('Ezeiza', 'Buenos Aires', 'Ezeiza', -34.8531, -58.5206, 10.0),
('Córdoba', 'Córdoba', 'Córdoba', -31.4201, -64.1888, 20.0),
('Rosario', 'Santa Fe', 'Rosario', -32.9442, -60.6505, 18.0),
('Mendoza', 'Mendoza', 'Mendoza', -32.8908, -68.8272, 15.0),
('Tucumán', 'Tucumán', 'San Miguel de Tucumán', -26.8083, -65.2176, 12.0),
('La Plata', 'Buenos Aires', 'La Plata', -34.9215, -57.9545, 12.0),
('Mar del Plata', 'Buenos Aires', 'Mar del Plata', -38.0055, -57.6256, 20.0),
('Bahía Blanca', 'Buenos Aires', 'Bahía Blanca', -38.7167, -62.2833, 15.0),
('Santa Fe', 'Santa Fe', 'Santa Fe', -31.6486, -60.7087, 10.0),
('Resistencia', 'Chaco', 'Resistencia', -27.4511, -58.9865, 12.0),
('Posadas', 'Misiones', 'Posadas', -27.3676, -55.8961, 10.0),
('Corrientes', 'Corrientes', 'Corrientes', -27.4806, -58.8344, 10.0),
('Formosa', 'Formosa', 'Formosa', -26.1894, -58.1731, 8.0),
('San Salvador de Jujuy', 'Jujuy', 'San Salvador de Jujuy', -24.1858, -65.2975, 8.0),
('Salta', 'Salta', 'Salta', -24.7859, -65.4117, 12.0),
('San Juan', 'San Juan', 'San Juan', -31.5375, -68.5360, 10.0),
('San Luis', 'San Luis', 'San Luis', -33.2953, -66.3356, 8.0),
('Villa Carlos Paz', 'Córdoba', 'Villa Carlos Paz', -31.4135, -64.4948, 8.0),
('Bariloche', 'Río Negro', 'San Carlos de Bariloche', -41.1335, -71.3103, 10.0),
('Neuquén', 'Neuquén', 'Neuquén', -38.9260, -68.0633, 10.0),
('Comodoro Rivadavia', 'Chubut', 'Comodoro Rivadavia', -45.8643, -67.4806, 12.0),
('Rio Gallegos', 'Santa Cruz', 'Rio Gallegos', -51.6236, -69.2181, 8.0),
('Ushuaia', 'Tierra del Fuego', 'Ushuaia', -54.8019, -68.3030, 6.0);

-- 9. Update existing professional profiles with completion scores
UPDATE perfiles_profesionales 
SET profile_completion_score = (
    CASE 
        WHEN especialidad IS NOT NULL AND especialidad != '' THEN 20 ELSE 0 END +
    CASE 
        WHEN anos_experiencia IS NOT NULL AND anos_experiencia >= 0 THEN 15 ELSE 0 END +
    CASE 
        WHEN zona_cobertura IS NOT NULL AND zona_cobertura != '' THEN 15 ELSE 0 END +
    CASE 
        WHEN tipo_tarifa IS NOT NULL AND tipo_tarifa IN ('hora', 'servicio', 'convenio') THEN 15 ELSE 0 END +
    CASE 
        WHEN tarifa_hora IS NOT NULL AND tarifa_hora > 0 THEN 10 ELSE 0 END +
    CASE 
        WHEN tarifa_servicio IS NOT NULL AND tarifa_servicio > 0 THEN 5 ELSE 0 END +
    CASE 
        WHEN tarifa_convenio IS NOT NULL AND tarifa_convenio != '' THEN 5 ELSE 0 END +
    CASE 
        WHEN descripcion IS NOT NULL AND length(descripcion) >= 50 THEN 15 ELSE 0 END
),
last_profile_update = CURRENT_TIMESTAMP
WHERE profile_completion_score = 0;

-- 10. Create views for easier queries
CREATE VIEW IF NOT EXISTS professional_profile_summary AS
SELECT 
    p.usuario_id,
    u.nombre,
    u.email,
    u.url_foto_perfil,
    p.especialidad,
    p.especialidades,
    p.anos_experiencia,
    p.zona_cobertura,
    p.latitud,
    p.longitud,
    p.tipo_tarifa,
    p.tarifa_hora,
    p.tarifa_servicio,
    p.tarifa_convenio,
    p.descripcion,
    p.url_foto_perfil,
    p.url_foto_portada,
    p.esta_disponible,
    p.calificacion_promedio,
    p.estado_verificacion,
    p.profile_completion_score,
    p.profile_views_count,
    p.last_profile_update,
    cz.name as coverage_zone_name,
    cz.city as coverage_city,
    cz.state as coverage_state,
    COUNT(ps.specialty_id) as specialties_count,
    GROUP_CONCAT(s.name, ', ') as specialty_names
FROM perfiles_profesionales p
JOIN usuarios u ON p.usuario_id = u.id
LEFT JOIN coverage_zones cz ON p.coverage_zone_id = cz.id
LEFT JOIN professional_specialties ps ON p.usuario_id = ps.professional_id
LEFT JOIN specialties s ON ps.specialty_id = s.id
GROUP BY p.usuario_id;

-- 11. Create trigger to update completion score automatically
CREATE TRIGGER IF NOT EXISTS update_profile_completion_score
AFTER UPDATE OF especialidad, anos_experiencia, zona_cobertura, tipo_tarifa, 
       tarifa_hora, tarifa_servicio, tarifa_convenio, descripcion 
ON perfiles_profesionales
BEGIN
    UPDATE perfiles_profesionales 
    SET profile_completion_score = (
        CASE 
            WHEN NEW.especialidad IS NOT NULL AND NEW.especialidad != '' THEN 20 ELSE 0 END +
        CASE 
            WHEN NEW.anos_experiencia IS NOT NULL AND NEW.anos_experiencia >= 0 THEN 15 ELSE 0 END +
        CASE 
            WHEN NEW.zona_cobertura IS NOT NULL AND NEW.zona_cobertura != '' THEN 15 ELSE 0 END +
        CASE 
            WHEN NEW.tipo_tarifa IS NOT NULL AND NEW.tipo_tarifa IN ('hora', 'servicio', 'convenio') THEN 15 ELSE 0 END +
        CASE 
            WHEN NEW.tarifa_hora IS NOT NULL AND NEW.tarifa_hora > 0 THEN 10 ELSE 0 END +
        CASE 
            WHEN NEW.tarifa_servicio IS NOT NULL AND NEW.tarifa_servicio > 0 THEN 5 ELSE 0 END +
        CASE 
            WHEN NEW.tarifa_convenio IS NOT NULL AND NEW.tarifa_convenio != '' THEN 5 ELSE 0 END +
        CASE 
            WHEN NEW.descripcion IS NOT NULL AND length(NEW.descripcion) >= 50 THEN 15 ELSE 0 END
    ),
    last_profile_update = CURRENT_TIMESTAMP
    WHERE usuario_id = NEW.usuario_id;
END;

-- 12. Create function to calculate distance between two points
CREATE TRIGGER IF NOT EXISTS update_profile_completion_score_insert
AFTER INSERT ON perfiles_profesionales
BEGIN
    UPDATE perfiles_profesionales 
    SET profile_completion_score = (
        CASE 
            WHEN NEW.especialidad IS NOT NULL AND NEW.especialidad != '' THEN 20 ELSE 0 END +
        CASE 
            WHEN NEW.anos_experiencia IS NOT NULL AND NEW.anos_experiencia >= 0 THEN 15 ELSE 0 END +
        CASE 
            WHEN NEW.zona_cobertura IS NOT NULL AND NEW.zona_cobertura != '' THEN 15 ELSE 0 END +
        CASE 
            WHEN NEW.tipo_tarifa IS NOT NULL AND NEW.tipo_tarifa IN ('hora', 'servicio', 'convenio') THEN 15 ELSE 0 END +
        CASE 
            WHEN NEW.tarifa_hora IS NOT NULL AND NEW.tarifa_hora > 0 THEN 10 ELSE 0 END +
        CASE 
            WHEN NEW.tarifa_servicio IS NOT NULL AND NEW.tarifa_servicio > 0 THEN 5 ELSE 0 END +
        CASE 
            WHEN NEW.tarifa_convenio IS NOT NULL AND NEW.tarifa_convenio != '' THEN 5 ELSE 0 END +
        CASE 
            WHEN NEW.descripcion IS NOT NULL AND length(NEW.descripcion) >= 50 THEN 15 ELSE 0 END
    ),
    last_profile_update = CURRENT_TIMESTAMP
    WHERE usuario_id = NEW.usuario_id;
END;