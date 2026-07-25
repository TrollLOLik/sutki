import * as VideoThumbnails from 'expo-video-thumbnails';
import { Video as VideoCompressor } from 'react-native-compressor';
import { File } from 'expo-file-system';

/**
 * Подготовка видео к отправке.
 *
 * Что делается на устройстве и почему именно здесь:
 *
 * - **Сжатие до 720p.** Съёмка с телефона — это легко 100+ МБ на минуту, что не
 *   влезает в лимит и мучительно долго уходит по мобильной сети. Сжатие на
 *   устройстве экономит трафик пользователя и наш канал.
 * - **Обложка.** Нужна для мгновенного превью в композере и в ленте, до того как
 *   сервер сгенерирует свою. Иначе секунды до ответа сервера выглядят как пустое
 *   место в сообщении.
 * - **Длительность.** Проверяется здесь, чтобы сказать «слишком длинное» до
 *   загрузки, а не после. Но это удобство, а не защита: сервер всё равно
 *   перепроверяет через ffprobe, потому что заявленной клиентом длительности
 *   доверять нельзя.
 */

/** Лимит длительности. Должен совпадать с MAX_VIDEO_SECONDS на бэкенде. */
export const MAX_VIDEO_SECONDS = 60;

/** Лимит размера видео. Совпадает с maxVideoBytes на бэкенде. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** Целевая высота после сжатия. */
const TARGET_HEIGHT = 720;

/** Видео, подготовленное к загрузке. */
export interface PreparedVideo {
	uri: string;
	fileName: string;
	mimeType: string;
	size: number;
	durationSeconds: number;
	/** Локальный путь к обложке — показывается до ответа сервера. */
	thumbnailUri?: string;
	width?: number;
	height?: number;
}

export class VideoTooLongError extends Error {
	constructor(public readonly seconds: number) {
		super(`Видео длиннее ${MAX_VIDEO_SECONDS} секунд`);
		this.name = 'VideoTooLongError';
	}
}

export class VideoTooLargeError extends Error {
	constructor() {
		super('Размер видео превышает лимит 50 МБ');
		this.name = 'VideoTooLargeError';
	}
}

/** Размер файла в байтах, или 0 если узнать не удалось. */
async function fileSize(uri: string): Promise<number> {
	try {
		const info = new File(uri);
		return info.size ?? 0;
	} catch {
		return 0;
	}
}

/**
 * Кадр для обложки.
 *
 * Берётся с первой секунды, а не с нулевой: у записи с телефона начальный кадр
 * часто чёрный или смазанный, пока камера настраивает экспозицию. Для клипов
 * короче секунды падаем на нулевую отметку.
 *
 * Ошибка не критична — сервер сгенерирует свою обложку после модерации, так что
 * отсутствие локальной означает лишь заглушку на пару секунд.
 */
async function generateThumbnail(uri: string): Promise<string | undefined> {
	for (const time of [1000, 0]) {
		try {
			const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, { time });
			return thumbUri;
		} catch {
			// пробуем следующую метку
		}
	}
	return undefined;
}

/**
 * Сжимает видео и готовит метаданные для отправки.
 *
 * Сжатие идёт в ручном режиме с фиксированной высотой: авторежим библиотеки
 * подбирает битрейт «как в WhatsApp», но не даёт гарантии по разрешению, а нам
 * важно попасть в 720p — на этом размере сервер режет кадры без лишней работы.
 *
 * onProgress получает значения 0..1 — сжатие минутного клипа занимает секунды, и
 * без индикатора выглядит как зависание.
 */
export async function prepareVideo(
	sourceUri: string,
	fileName: string,
	durationSeconds: number,
	onProgress?: (progress: number) => void,
): Promise<PreparedVideo> {
	// Длительность известна из пикера — отказываем до сжатия, чтобы не тратить
	// секунды процессорного времени на файл, который всё равно не пройдёт.
	if (durationSeconds > MAX_VIDEO_SECONDS) {
		throw new VideoTooLongError(durationSeconds);
	}

	const compressedUri = await VideoCompressor.compress(
		sourceUri,
		{
			compressionMethod: 'manual',
			maxSize: TARGET_HEIGHT,
			// Оставляем звук: в румтуре владелец обычно комментирует, что показывает.
			// Модерация всё равно смотрит только кадры.
			bitrate: 2_000_000,
		},
		(progress) => onProgress?.(progress),
	);

	const size = await fileSize(compressedUri);
	// Даже после сжатия файл может не влезть — например, минута с высокой
	// детализацией. Сообщаем до загрузки, а не после отказа сервера.
	if (size > MAX_VIDEO_BYTES) {
		throw new VideoTooLargeError();
	}

	const thumbnailUri = await generateThumbnail(compressedUri);

	return {
		uri: compressedUri,
		// Расширение приводим к .mp4: компрессор всегда отдаёт MP4, а исходное имя
		// могло быть .mov, и по нему сервер выберет неверный ключ объекта.
		fileName: fileName.replace(/\.[^.]+$/, '') + '.mp4',
		mimeType: 'video/mp4',
		size,
		durationSeconds,
		thumbnailUri,
	};
}

/** Длительность в формате мм:сс для плашки на обложке. */
export function formatDuration(seconds: number): string {
	const total = Math.max(0, Math.round(seconds));
	const mins = Math.floor(total / 60);
	const secs = total % 60;
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}
