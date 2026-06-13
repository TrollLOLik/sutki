/**
 * Minimal user shape for Phase 0. This will be reconciled with the real
 * PostgreSQL schema / backend DTOs once the DB is wired up.
 */
export type UserRole = 'guest' | 'host';

export interface User {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  city?: string;
  birthDate?: string;
  role?: UserRole;
}
