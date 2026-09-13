-- Adds the required column with a default, so existing rows receive a value.
ALTER TABLE "User" ADD COLUMN "age" INTEGER NOT NULL DEFAULT 0;
