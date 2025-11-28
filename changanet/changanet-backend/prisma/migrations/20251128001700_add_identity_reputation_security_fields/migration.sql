-- Add new fields to identity_verification table
ALTER TABLE "identity_verification" ADD COLUMN "selfie_url" TEXT;
ALTER TABLE "identity_verification" ADD COLUMN "biometric_data" TEXT;
ALTER TABLE "identity_verification" ADD COLUMN "biometric_verified" BOOLEAN DEFAULT false;
ALTER TABLE "identity_verification" ADD COLUMN "verification_score" REAL;

-- Add new fields to professional_reputation table
ALTER TABLE "professional_reputation" ADD COLUMN "reputation_previous" REAL;
ALTER TABLE "professional_reputation" ADD COLUMN "score_locked" BOOLEAN DEFAULT false;
ALTER TABLE "professional_reputation" ADD COLUMN "last_calculation" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add new fields to refresh_tokens table
ALTER TABLE "refresh_tokens" ADD COLUMN "device_id" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "ip_address" INET;
ALTER TABLE "refresh_tokens" ADD COLUMN "user_agent" TEXT;

-- Create indexes for new fields
CREATE INDEX "identity_verification_biometric_verified_idx" ON "identity_verification"("biometric_verified");
CREATE INDEX "professional_reputation_score_locked_idx" ON "professional_reputation"("score_locked");
CREATE INDEX "refresh_tokens_device_id_idx" ON "refresh_tokens"("device_id");