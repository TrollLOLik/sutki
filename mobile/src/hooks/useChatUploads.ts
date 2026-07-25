import React from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { presignUpload, type AttachmentInput } from '@/lib/api/chat';
import { uploadToS3 } from '@/lib/api/media';
import { appAlert as Alert } from '@/components/AppAlert';

/** Лимит размера одного файла. Совпадает с maxAttachmentBytes на бэкенде. */
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/**
 * Сколько файлов помещается в одно сообщение.
 * Должно совпадать с maxAttachmentsPerMessage на бэкенде: если клиент отправит
 * больше, сервер ответит отказом на всю пачку.
 */
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

/**
 * Сколько файлов грузим одновременно.
 *
 * Не все сразу: десять параллельных POST на мобильной сети делят узкий канал,
 * и первое фото доходит не быстрее последнего — прогресс выглядит зависшим.
 * Четыре потока насыщают канал, оставляя загрузкам предсказуемый порядок.
 */
const UPLOAD_CONCURRENCY = 4;

/** Типы документов, которые принимает whitelist бэкенда. */
const DOCUMENT_MIME_TYPES = [
	'application/pdf',
	'text/plain',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/** Файл, выбранный пользователем, до загрузки в хранилище. */
export interface PickedFile {
	uri: string;
	fileName: string;
	mimeType: string;
	size: number;
	width?: number;
	height?: number;
}

/**
 * Файл на стадии подготовки: выбран, показан в композере, но ещё не отправлен.
 *
 * localId нужен, потому что до загрузки у файла нет серверного id, а ключ для
 * списка превью и адрес для удаления нужны сразу. Пути (uri) для этого не
 * годятся: одно и то же фото можно выбрать дважды.
 */
export interface StagedFile extends PickedFile {
	localId: string;
	/** Прогресс загрузки от 0 до 1; заполняется во время отправки. */
	progress?: number;
	/** Загрузка этого файла не удалась. */
	failed?: boolean;
}

let stagedCounter = 0;

function toStagedFile(file: PickedFile): StagedFile {
	stagedCounter += 1;
	return { ...file, localId: `staged_${Date.now()}_${stagedCounter}` };
}

/**
 * Загрузка вложений чата.
 *
 * Загрузка идёт в два шага: бэкенд выдаёт presigned POST на S3/MinIO, файл
 * уходит в хранилище напрямую, и только потом ключ объекта отправляется в
 * сообщение. Сервер проверяет существование объекта и его реальный размер —
 * заявленному размеру от клиента он не доверяет.
 *
 * Хук выбор файлов и загрузку не связывает с отправкой сообщения: он возвращает
 * готовые AttachmentInput, а что с ними делать — решает вызывающий экран. Это
 * нужно для альбомов, где пачка сначала собирается, к ней добавляется подпись,
 * и лишь потом уходит одним сообщением.
 */
export function useChatUploads() {
	const [uploading, setUploading] = React.useState(false);

	/** Выбор фото из галереи. limit > 1 включает мультивыбор. */
	const pickImages = React.useCallback(async (limit = 1): Promise<PickedFile[]> => {
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!permission.granted) {
			Alert.alert('Доступ запрещен', 'Для выбора фото разрешите доступ к галерее в настройках.');
			return [];
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: 'images',
			quality: 0.8,
			allowsMultipleSelection: limit > 1,
			selectionLimit: limit > 1 ? limit : undefined,
		});

		if (result.canceled || !result.assets?.length) return [];

		return result.assets.map((asset, index) => ({
			uri: asset.uri,
			fileName: asset.fileName || `photo_${Date.now()}_${index}.jpg`,
			mimeType: asset.mimeType || 'image/jpeg',
			size: asset.fileSize || 0,
			width: asset.width,
			height: asset.height,
		}));
	}, []);

	/** Съёмка фото камерой. */
	const takePhoto = React.useCallback(async (): Promise<PickedFile[]> => {
		const permission = await ImagePicker.requestCameraPermissionsAsync();
		if (!permission.granted) {
			Alert.alert('Доступ запрещен', 'Для создания фото разрешите доступ к камере в настройках.');
			return [];
		}

		const result = await ImagePicker.launchCameraAsync({
			mediaTypes: 'images',
			quality: 0.8,
		});

		if (result.canceled || !result.assets?.[0]) return [];
		const asset = result.assets[0];

		return [
			{
				uri: asset.uri,
				fileName: asset.fileName || `photo_${Date.now()}.jpg`,
				mimeType: asset.mimeType || 'image/jpeg',
				size: asset.fileSize || 0,
				width: asset.width,
				height: asset.height,
			},
		];
	}, []);

	/** Выбор документа. */
	const pickDocument = React.useCallback(async (): Promise<PickedFile[]> => {
		const result = await DocumentPicker.getDocumentAsync({
			type: DOCUMENT_MIME_TYPES,
			copyToCacheDirectory: true,
		});

		if (result.canceled || !result.assets?.[0]) return [];
		const asset = result.assets[0];

		return [
			{
				uri: asset.uri,
				fileName: asset.name,
				mimeType: asset.mimeType || 'application/octet-stream',
				size: asset.size || 0,
			},
		];
	}, []);

	/**
	 * Загружает один файл в хранилище и возвращает метаданные для сообщения.
	 * Бросает исключение при отказе — вызывающий решает, показывать ли ошибку
	 * по каждому файлу или одну на всю пачку.
	 */
	const uploadFile = React.useCallback(
		async (file: PickedFile, onProgress?: (progress: number) => void): Promise<AttachmentInput> => {
			if (file.size > MAX_ATTACHMENT_BYTES) {
				throw new Error('Размер файла превышает лимит 15 МБ.');
			}

			const target = await presignUpload(file.fileName, file.size, file.mimeType);
			await uploadToS3(file.uri, target, file.fileName, file.mimeType, onProgress);

			return {
				// Бэкенд принимает ключ объекта, а не публичный URL: он проверяет
				// его через StatObject и сам подписывает ссылку для выдачи.
				url: target.key,
				file_name: file.fileName,
				mime_type: file.mimeType,
				size_bytes: file.size,
				width: file.width,
				height: file.height,
			};
		},
		[],
	);

	// --- Стадия подготовки -------------------------------------------------
	// Выбранные файлы живут здесь, пока пользователь набирает подпись. Раньше
	// выбор фото сразу отправлял сообщение, из-за чего ни подписи, ни альбома
	// не могло быть в принципе.

	const [staged, setStaged] = React.useState<StagedFile[]>([]);

	/** Добавляет файлы к выбранным, соблюдая лимит на сообщение. */
	const addStaged = React.useCallback((files: PickedFile[]) => {
		if (!files.length) return;
		setStaged((current) => {
			const room = MAX_ATTACHMENTS_PER_MESSAGE - current.length;
			if (room <= 0) {
				Alert.alert(
					'Достигнут лимит',
					`За раз можно отправить не больше ${MAX_ATTACHMENTS_PER_MESSAGE} файлов.`,
				);
				return current;
			}
			if (files.length > room) {
				Alert.alert(
					'Часть файлов не добавлена',
					`В одно сообщение помещается ${MAX_ATTACHMENTS_PER_MESSAGE} файлов — добавлены первые ${room}.`,
				);
			}
			return [...current, ...files.slice(0, room).map(toStagedFile)];
		});
	}, []);

	const removeStaged = React.useCallback((localId: string) => {
		setStaged((current) => current.filter((f) => f.localId !== localId));
	}, []);

	const clearStaged = React.useCallback(() => setStaged([]), []);

	/**
	 * Загружает подготовленную пачку в хранилище.
	 *
	 * Порядок вложений сохраняется — он определяет раскладку сетки, и менять его
	 * из-за того, что мелкое фото загрузилось первым, нельзя. Отсюда запись
	 * результата по индексу, а не push в порядке завершения.
	 *
	 * Возвращает null, если хотя бы один файл не загрузился: сообщение с частью
	 * альбома молча отправлять нельзя — пользователь выбирал конкретный набор.
	 * Неудавшиеся файлы помечаются, остальные остаются в композере.
	 */
	const uploadStaged = React.useCallback(async (): Promise<AttachmentInput[] | null> => {
		const batch = staged;
		if (!batch.length) return [];

		setUploading(true);
		setStaged((current) => current.map((f) => ({ ...f, progress: 0, failed: false })));

		const results: (AttachmentInput | null)[] = new Array(batch.length).fill(null);
		let cursor = 0;

		const worker = async () => {
			while (cursor < batch.length) {
				const index = cursor;
				cursor += 1;
				const file = batch[index];
				try {
					results[index] = await uploadFile(file, (progress) => {
						setStaged((current) =>
							current.map((f) => (f.localId === file.localId ? { ...f, progress } : f)),
						);
					});
				} catch (err) {
					console.error('[Chat] Failed uploading file:', err);
					results[index] = null;
					setStaged((current) =>
						current.map((f) =>
							f.localId === file.localId ? { ...f, failed: true, progress: undefined } : f,
						),
					);
				}
			}
		};

		try {
			await Promise.all(
				Array.from({ length: Math.min(UPLOAD_CONCURRENCY, batch.length) }, worker),
			);
		} finally {
			setUploading(false);
		}

		const failedCount = results.filter((r) => r === null).length;
		if (failedCount > 0) {
			Alert.alert(
				'Не все файлы загрузились',
				failedCount === batch.length
					? 'Не удалось загрузить файлы. Проверьте соединение и попробуйте ещё раз.'
					: `Не загрузилось файлов: ${failedCount}. Удалите их или попробуйте отправить снова.`,
			);
			return null;
		}

		return results as AttachmentInput[];
	}, [staged, uploadFile]);

	return {
		uploading,
		setUploading,
		staged,
		addStaged,
		removeStaged,
		clearStaged,
		uploadStaged,
		pickImages,
		takePhoto,
		pickDocument,
		uploadFile,
	};
}
