import { CheckCircle2, CircleX, Clock3, RotateCcw, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { RentalRequest } from './types';

export type RequestStatusTone = 'success' | 'danger' | 'neutral' | 'primary';

export interface RequestStatusMeta {
  label: string;
  description: string;
  tone: RequestStatusTone;
  icon: LucideIcon;
}

export interface RequestCapabilities {
  confirm: boolean;
  reject: boolean;
  cancel: boolean;
  repeat: boolean;
  review: boolean;
  chat: boolean;
  contact: boolean;
}

const outgoingCurrentStatuses = new Set<RentalRequest['status']>([
  'pending',
  'in_progress',
  'pending_verification',
  'confirmed',
  'active',
]);

export function isCurrentRequest(request: RentalRequest): boolean {
  if (request.direction === 'incoming') {
    return request.status === 'pending' || request.status === 'in_progress';
  }
  return outgoingCurrentStatuses.has(request.status);
}

export function getRequestCapabilities(request: RentalRequest): RequestCapabilities {
  const incoming = request.direction === 'incoming';
  const awaitingOwnerDecision = incoming && ['pending', 'in_progress'].includes(request.status);
  const historicalOutgoing = !incoming && ['cancelled', 'completed'].includes(request.status);

  return {
    confirm: awaitingOwnerDecision,
    reject: awaitingOwnerDecision,
    cancel: !incoming && ['pending', 'in_progress', 'pending_verification'].includes(request.status),
    repeat: historicalOutgoing,
    review: !incoming && request.status === 'completed' && Boolean(request.reviewAvailable),
    chat: true,
    contact: request.status === 'confirmed' || request.status === 'active',
  };
}

export function isIncomingRequestActionable(request: RentalRequest): boolean {
  const capabilities = getRequestCapabilities(request);
  return capabilities.confirm || capabilities.reject;
}

export function isOutgoingRequestCancellable(request: RentalRequest): boolean {
  return getRequestCapabilities(request).cancel;
}

export function getRequestStatusMeta(request: RentalRequest): RequestStatusMeta {
  const incoming = request.direction === 'incoming';

  if (request.status === 'confirmed') return {
    label: 'Подтверждена',
    description: incoming ? 'Вы подтвердили проживание гостя' : 'Владелец подтвердил бронирование',
    tone: 'success',
    icon: CheckCircle2,
  };
  if (request.status === 'active') return {
    label: 'Проживание',
    description: 'Сейчас идёт период проживания',
    tone: 'success',
    icon: CheckCircle2,
  };
  if (request.status === 'completed') return {
    label: 'Завершена',
    description: 'Период проживания завершён',
    tone: 'success',
    icon: CheckCircle2,
  };
  if (request.status === 'pending_verification') return {
    label: 'Ожидает OTP',
    description: incoming
      ? 'Гость ещё подтверждает заявку'
      : 'Подтвердите заявку кодом из письма',
    tone: 'primary',
    icon: ShieldCheck,
  };
  if (request.status === 'cancelled') {
    const rejected = request.cancelledBy === 'owner';
    return {
      label: rejected ? 'Отклонена' : 'Отменена',
      description: rejected
        ? incoming ? 'Вы отклонили эту заявку' : 'Владелец отклонил эту заявку'
        : incoming ? 'Гость отменил эту заявку' : 'Вы отменили эту заявку',
      tone: rejected ? 'danger' : 'neutral',
      icon: rejected ? CircleX : RotateCcw,
    };
  }
  if (request.status === 'pending') return {
    label: 'На рассмотрении',
    description: incoming ? 'Заявка ожидает вашего решения' : 'Заявка отправлена владельцу',
    tone: 'primary',
    icon: Clock3,
  };
  return {
    label: 'На рассмотрении',
    description: incoming ? 'Заявка ожидает вашего решения' : 'Владелец рассматривает заявку',
    tone: 'primary',
    icon: Clock3,
  };
}
