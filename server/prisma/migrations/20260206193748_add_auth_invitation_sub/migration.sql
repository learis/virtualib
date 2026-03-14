/*
  Warnings:

  - You are about to drop the column `library_id` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,library_id]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `categories` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'PLUS', 'PREMIUM', 'UNLIMITED');

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_library_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_library_id_fkey";

-- AlterTable
ALTER TABLE "book_loans" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "libraries" ADD COLUMN     "owner_id" TEXT;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "email_provider" TEXT NOT NULL DEFAULT 'smtp',
ADD COLUMN     "gmail_client_id" TEXT,
ADD COLUMN     "gmail_client_secret" TEXT,
ADD COLUMN     "gmail_refresh_token" TEXT,
ADD COLUMN     "gmail_user" TEXT,
ADD COLUMN     "overdue_days" INTEGER NOT NULL DEFAULT 14;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "library_id",
ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plan" "PlanType" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "plan_end_date" TIMESTAMP(3),
ADD COLUMN     "registration_method" TEXT NOT NULL DEFAULT 'EMAIL',
ADD COLUMN     "subscription_id" TEXT;

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "library_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sender_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LibraryUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_LibraryUsers_AB_unique" ON "_LibraryUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_LibraryUsers_B_index" ON "_LibraryUsers"("B");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_library_id_key" ON "categories"("name", "library_id");

-- AddForeignKey
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LibraryUsers" ADD CONSTRAINT "_LibraryUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LibraryUsers" ADD CONSTRAINT "_LibraryUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
