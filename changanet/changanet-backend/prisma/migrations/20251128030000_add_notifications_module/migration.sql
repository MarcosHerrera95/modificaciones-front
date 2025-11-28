-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "channel" TEXT NOT NULL DEFAULT 'inapp',
    "status" TEXT NOT NULL DEFAULT 'unread',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "group_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "analytics_data" JSONB,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_queue" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "retry_attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_analytics" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "in_app" BOOLEAN NOT NULL DEFAULT true,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "sms" BOOLEAN NOT NULL DEFAULT false,
    "frequency" TEXT NOT NULL DEFAULT 'immediate',
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "marketing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "device_settings" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_notif_user" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "idx_notif_status" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "idx_notif_type" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "idx_notif_priority" ON "notifications"("priority");

-- CreateIndex
CREATE INDEX "idx_notif_group" ON "notifications"("group_id");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_idx" ON "notifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "notifications_user_id_type_idx" ON "notifications"("user_id", "type");

-- CreateIndex
CREATE INDEX "notification_queue_notification_id_idx" ON "notification_queue"("notification_id");

-- CreateIndex
CREATE INDEX "notification_queue_scheduled_at_idx" ON "notification_queue"("scheduled_at");

-- CreateIndex
CREATE INDEX "notification_queue_created_at_idx" ON "notification_queue"("created_at");

-- CreateIndex
CREATE INDEX "notification_groups_name_idx" ON "notification_groups"("name");

-- CreateIndex
CREATE INDEX "notification_analytics_notification_id_idx" ON "notification_analytics"("notification_id");

-- CreateIndex
CREATE INDEX "notification_analytics_event_type_idx" ON "notification_analytics"("event_type");

-- CreateIndex
CREATE INDEX "notification_analytics_created_at_idx" ON "notification_analytics"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_notification_type_key" ON "notification_preferences"("user_id", "notification_type");

-- CreateIndex
CREATE INDEX "idx_preference_user" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "notification_preferences_notification_type_idx" ON "notification_preferences"("notification_type");

-- CreateIndex
CREATE INDEX "notification_preferences_marketing_enabled_idx" ON "notification_preferences"("marketing_enabled");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_analytics" ADD CONSTRAINT "notification_analytics_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;