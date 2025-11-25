-- ==================================================
-- MIGRACIÓN: Sistema de Solicitud de Presupuestos CHANGANET
-- Archivo: 001_create_budget_system.sql
-- Fecha: 25 de Noviembre de 2025
-- Descripción: Creación de tablas para el módulo de solicitud de presupuestos
-- ==================================================

BEGIN;

-- Crear tabla principal: budget_requests
CREATE TABLE IF NOT EXISTS budget_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    photos JSONB DEFAULT '[]',
    category VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'distributed', 'responding', 'closed', 'expired')),
    budget_range_min DECIMAL(10,2),
    budget_range_max DECIMAL(10,2),
    preferred_date TIMESTAMP,
    location JSONB,
    requirements JSONB DEFAULT '{}',
    total_offers INTEGER DEFAULT 0,
    selected_offer_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de distribución: budget_request_professionals
CREATE TABLE IF NOT EXISTS budget_request_professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES budget_requests(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded BOOLEAN DEFAULT FALSE,
    responded_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'viewed', 'responded', 'expired', 'declined')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(request_id, professional_id)
);

-- Crear tabla de ofertas: budget_offers
CREATE TABLE IF NOT EXISTS budget_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES budget_requests(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL CHECK (price > 0),
    estimated_days INTEGER CHECK (estimated_days > 0 AND estimated_days <= 365),
    comments TEXT,
    photos JSONB DEFAULT '[]',
    availability_details TEXT,
    offer_status VARCHAR(20) DEFAULT 'pending' CHECK (offer_status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    is_selected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(request_id, professional_id)
);

-- Crear índices principales
CREATE INDEX IF NOT EXISTS idx_budget_requests_client_id ON budget_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_budget_requests_status ON budget_requests(status);
CREATE INDEX IF NOT EXISTS idx_budget_requests_category ON budget_requests(category);
CREATE INDEX IF NOT EXISTS idx_budget_requests_created_at ON budget_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_budget_requests_location ON budget_requests USING GIN(location);

CREATE INDEX IF NOT EXISTS idx_budget_request_professionals_request_id ON budget_request_professionals(request_id);
CREATE INDEX IF NOT EXISTS idx_budget_request_professionals_professional_id ON budget_request_professionals(professional_id);
CREATE INDEX IF NOT EXISTS idx_budget_request_professionals_status ON budget_request_professionals(status);
CREATE INDEX IF NOT EXISTS idx_budget_request_professionals_expires_at ON budget_request_professionals(expires_at);
CREATE INDEX IF NOT EXISTS idx_budget_request_professionals_responded ON budget_request_professionals(responded);

CREATE INDEX IF NOT EXISTS idx_budget_offers_request_id ON budget_offers(request_id);
CREATE INDEX IF NOT EXISTS idx_budget_offers_professional_id ON budget_offers(professional_id);
CREATE INDEX IF NOT EXISTS idx_budget_offers_price ON budget_offers(price);
CREATE INDEX IF NOT EXISTS idx_budget_offers_created_at ON budget_offers(created_at);
CREATE INDEX IF NOT EXISTS idx_budget_offers_status ON budget_offers(offer_status);
CREATE INDEX IF NOT EXISTS idx_budget_offers_selected ON budget_offers(is_selected);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_budget_requests_updated_at ON budget_requests;
CREATE TRIGGER update_budget_requests_updated_at 
    BEFORE UPDATE ON budget_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_budget_offers_updated_at ON budget_offers;
CREATE TRIGGER update_budget_offers_updated_at 
    BEFORE UPDATE ON budget_offers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;