/**
 * User mirrors the backend userDTO (snake_case is kept on purpose so the wire
 * format maps 1:1 without a transform layer). See
 * backend/internal/delivery/http/auth_handler.go (toUserDTO).
 */
export interface User {
  id: number;
  email: string;
  name: string;
  surname?: string;
  patronymic?: string;
  phone: string;
  city: string;
  avatar_url: string;
  is_verified: boolean;
  birthday?: string;
  listings_count?: number;
  rating?: number;
  phone_normalized?: string;
  phone_verified_at?: string;
  vk_id?: string;
}
