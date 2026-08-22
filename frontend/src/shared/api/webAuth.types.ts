export interface WebAuthUser {
  id: number;
  email: string;
  name: string;
  surname: string;
  patronymic: string;
  phone: string;
  phone_normalized: string;
  phone_verified_at: string | null;
  city: string;
  avatar_url: string;
  is_verified: boolean;
  birthday: string | null;
  created_at: string;
  listings_count: number;
  rating: number;
  reviews_count: number;
}
