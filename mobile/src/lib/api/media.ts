import { api } from '@/lib/api/client';

export interface UploadTarget {
	url: string;
	form_data: Record<string, string>;
	key: string;
}

export interface ListingImageModerationItem {
	key: string;
	decision: 'approve' | 'reject' | 'review';
	category?: string;
	reason?: string;
	confidence: number;
}

export function moderateListingImages(keys: string[]): Promise<{ items: ListingImageModerationItem[] }> {
	return api.post<{ items: ListingImageModerationItem[] }>('/api/v1/media/listings/moderate', { keys });
}

export function presignMediaUpload(
	fileName: string,
	size: number,
	contentType: string,
	type: 'avatar' | 'listing' | 'chat',
): Promise<UploadTarget> {
	return api.post<UploadTarget>('/api/v1/media/presign', {
		file_name: fileName,
		size: size,
		content_type: contentType,
		type: type,
	});
}

/**
 * Uploads a file directly to S3 using a presigned POST policy.
 *
 * The backend issues a POST policy (not a PUT URL) because content-length-range
 * is the only S3 mechanism that enforces a size cap on the storage side —
 * oversized uploads are rejected by S3 itself with EntityTooLarge.
 *
 * Notes:
 * - All signed policy fields must be appended BEFORE the file field;
 *   S3 ignores any form fields that come after "file".
 * - Do not set the Content-Type header manually: React Native's XHR sets
 *   multipart/form-data with the correct boundary automatically.
 */
export function uploadToS3(
	uri: string,
	target: UploadTarget,
	fileName: string,
	contentType: string,
	onProgress?: (progress: number) => void,
): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const form = new FormData();
		for (const [field, value] of Object.entries(target.form_data ?? {})) {
			form.append(field, value);
		}
		// React Native FormData accepts { uri, name, type } for file parts.
		form.append('file', {
			uri,
			name: fileName,
			type: contentType,
		} as any);

		const xhr = new XMLHttpRequest();
		xhr.open('POST', target.url);

		if (onProgress && xhr.upload) {
			xhr.upload.onprogress = (event) => {
				if (event.lengthComputable) {
					const progress = event.loaded / event.total;
					onProgress(progress);
				}
			};
		}

		xhr.onload = () => {
			// S3 returns 204 No Content for successful POST policy uploads
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve();
			} else if (xhr.status === 400 && xhr.responseText.includes('EntityTooLarge')) {
				reject(new Error('S3 upload failed: file exceeds the size limit'));
			} else {
				reject(new Error(`S3 upload failed: status ${xhr.status}`));
			}
		};

		xhr.onerror = () => {
			reject(new Error('S3 upload failed: network error'));
		};

		xhr.send(form);
	});
}
