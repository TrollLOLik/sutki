-- Migration to add birthday column to the user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS birthday date DEFAULT NULL;
