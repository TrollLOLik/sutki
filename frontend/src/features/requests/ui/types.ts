import type { RentalRequest } from '../model/types';

export type RequestTab = 'current' | 'history';

export type RequestDialogState =
  | { type: 'confirm'; request: RentalRequest }
  | { type: 'reject'; request: RentalRequest }
  | { type: 'cancel'; request: RentalRequest }
  | null;
