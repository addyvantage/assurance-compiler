-- Adds a required column with no default, which cannot succeed while "User" has rows.
ALTER TABLE "User" ADD COLUMN "age" INTEGER NOT NULL;
