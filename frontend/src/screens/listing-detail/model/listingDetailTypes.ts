export interface BookingDraft {
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  name?: string;
  phone?: string;
  message?: string;
  submitAfterAuth?: boolean;
}
