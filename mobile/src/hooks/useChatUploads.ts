import React from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { presignUpload, type AttachmentInput } from '@/lib/api/chat';
import { uploadToS3 } from '@/lib/api/media';
import { ApiError } from '@/lib/api/client';
import { appAlert as Alert } from '@/components/AppAlert';

/** Лимит размера одного файла. Совпадает с maxAttachmentBytes на бэкенде. */
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

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
	const uploadFile = React.useCallback(async (file: PickedFile): Promise<AttachmentInput> => {
		if (file.size > MAX_ATTACHMENT_BYTES) {
			throw new Error('Размер файла превышает лимит 15 МБ.');
		}

		const target = await presignUpload(file.fileName, file.size, file.mimeType);
		await uploadToS3(file.uri, target, file.fileName, file.mimeType);

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
	}, []);

	/**
	 * Загружает один файл с показом индикатора и человекочитаемой ошибкой.
	 * Возвращает null, если загрузка не удалась.
	 */
	const uploadSingle = React.useCallback(
		async (file: PickedFile): Promise<AttachmentInput | null> => {
			setUploading(true);
			try {
				return await uploadFile(file);
			} catch (err) {
				console.error('[Chat] Failed uploading file:', err);
				Alert.alert(
					'Ошибка загрузки',
					err instanceof ApiError || err instanceof Error
						? err.message
						: 'Не удалось загрузить файл. Попробуйте ещё раз.',
				);
				return null;
			} finally {
				setUploading(false);
			}
		},
		[uploadFile],
	);

	return {
		uploading,
		setUploading,
		pickImages,
		takePhoto,
		pickDocument,
		uploadFile,
		uploadSingle,
	};
}
