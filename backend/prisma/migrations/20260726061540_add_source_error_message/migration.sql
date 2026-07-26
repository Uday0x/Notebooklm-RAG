-- DropIndex
DROP INDEX "Source_notebookId_idx";

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "errorMessage" TEXT;
