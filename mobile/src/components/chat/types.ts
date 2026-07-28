import { format } from 'date-fns';

import type { ChatMessage } from '@/store/chatStore';

/** Одно вложение сообщения — распакованный элемент ChatMessage['attachments']. */
export type ChatAttachment = NonNullable<ChatMessage['attachments']>[number];

/** Вложение — изображение (для сетки альбома и просмотрщика). */
export function isImageAttachment(att: ChatAttachment): boolean {
	return att.mime_type.startsWith('image/');
}

/** Вложение — видео: рендерится обложкой с Play, а не инлайн-плеером. */
export function isVideoAttachment(att: ChatAttachment): boolean {
	return att.mime_type.startsWith('video/');
}

/**
 * Вложение ещё проверяется. Чужие pending-вложения сервер не отдаёт вовсе, так
 * что этот флаг встречается только на своих сообщениях.
 */
export function isPendingAttachment(att: ChatAttachment): boolean {
	return att.moderation_status === 'pending';
}

export function isRejectedAttachment(att: ChatAttachment): boolean {
	return att.moderation_status === 'rejected';
}

/**
 * Сообщение состоит только из изображений, без текста.
 * Такие рендерятся без пузыря — картинка сама себе фон, а время накладывается
 * поверх неё полупрозрачной плашкой.
 */
export function isImageOnlyMessage(message: ChatMessage): boolean {
	const attachments = message.attachments;
	if (!attachments?.length) return false;
	if (message.body) return false;
	// Видео сюда не попадает: у него своя рамка с обложкой, и прозрачный пузырь с
	// наложенным временем ей не подходит.
	return attachments.every(
		(att) => att.moderation_status !== 'rejected' && isImageAttachment(att),
	);
}

/** Время сообщения в ленте: только часы и минуты. */
export function formatMessageTime(timeStr: string): string {
	try {
		return format(new Date(timeStr), 'HH:mm');
	} catch {
		return '';
	}
}

/**
 * Человекочитаемое «был(а) в сети».
 * Сегодня и вчера — словами, дальше — датой.
 */
export function formatLastSeen(lastSeenAt?: string): string {
	if (!lastSeenAt) return 'Не в сети';
	const lastSeen = new Date(lastSeenAt);
	if (Number.isNaN(lastSeen.getTime())) return 'Не в сети';

	const now = new Date();
	const sameDay =
		now.getFullYear() === lastSeen.getFullYear() &&
		now.getMonth() === lastSeen.getMonth() &&
		now.getDate() === lastSeen.getDate();
	if (sameDay) return `Сегодня в ${format(lastSeen, 'HH:mm')}`;

	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	const wasYesterday =
		yesterday.getFullYear() === lastSeen.getFullYear() &&
		yesterday.getMonth() === lastSeen.getMonth() &&
		yesterday.getDate() === lastSeen.getDate();
	if (wasYesterday) return `Вчера в ${format(lastSeen, 'HH:mm')}`;

	return `${format(lastSeen, 'dd.MM.yyyy')} в ${format(lastSeen, 'HH:mm')}`;
}

/** Размер файла для подписи под документом. */
export function formatFileSize(sizeBytes: number): string {
	if (sizeBytes >= 1024 * 1024) {
		return `${(sizeBytes / (1024 * 1024)).toFixed(1)} МБ`;
	}
	return `${(sizeBytes / 1024).toFixed(1)} КБ`;
}
