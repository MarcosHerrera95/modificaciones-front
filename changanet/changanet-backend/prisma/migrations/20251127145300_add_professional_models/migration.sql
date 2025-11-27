-- Add professional profile models: certifications, experiences, portfolio_photos
-- Migration: 20251127145300_add_professional_models

-- CreateTable
CREATE TABLE "certifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professional_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuing_organization" TEXT NOT NULL,
    "issue_date" DATETIME,
    "expiry_date" DATETIME,
    "credential_id" TEXT,
    "credential_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "certifications_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "perfiles_profesionales" ("usuario_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "experiences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professional_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME,
    "description" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "experiences_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "perfiles_profesionales" ("usuario_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "portfolio_photos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professional_id" TEXT NOT NULL,
    "photo_url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "category" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "portfolio_photos_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "perfiles_profesionales" ("usuario_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "certifications_professional_id_idx" ON "certifications"("professional_id");

-- CreateIndex
CREATE INDEX "experiences_professional_id_idx" ON "experiences"("professional_id");

-- CreateIndex
CREATE INDEX "experiences_start_date_idx" ON "experiences"("start_date");

-- CreateIndex
CREATE INDEX "portfolio_photos_professional_id_idx" ON "portfolio_photos"("professional_id");

-- CreateIndex
CREATE INDEX "portfolio_photos_is_featured_idx" ON "portfolio_photos"("is_featured");