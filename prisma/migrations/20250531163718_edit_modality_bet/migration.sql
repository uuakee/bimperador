/*
  Warnings:

  - The values [EXACT_SCORE,TOTAL_GOALS,BOTH_SCORE] on the enum `BetChoiceType` will be removed. If these variants are still used in the database, this will fail.
  - The values [TOTAL_GOALS,BOTH_SCORE,CUSTOM] on the enum `BolaoModality` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BetChoiceType_new" AS ENUM ('WINNER', 'HOME_SCORE', 'AWAY_SCORE');
ALTER TABLE "bet_choices" ALTER COLUMN "type" TYPE "BetChoiceType_new" USING ("type"::text::"BetChoiceType_new");
ALTER TYPE "BetChoiceType" RENAME TO "BetChoiceType_old";
ALTER TYPE "BetChoiceType_new" RENAME TO "BetChoiceType";
DROP TYPE "BetChoiceType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "BolaoModality_new" AS ENUM ('WINNER', 'EXACT_SCORE');
ALTER TABLE "bolaos" ALTER COLUMN "modality" TYPE "BolaoModality_new" USING ("modality"::text::"BolaoModality_new");
ALTER TYPE "BolaoModality" RENAME TO "BolaoModality_old";
ALTER TYPE "BolaoModality_new" RENAME TO "BolaoModality";
DROP TYPE "BolaoModality_old";
COMMIT;
