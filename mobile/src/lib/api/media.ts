import { api } from '@/lib/api/client';

export interface UploadTarget {
	url: string;
	key: string;
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

export function uploadToS3(
	uri: string,
	presignUrl: string,
	contentType: string,
	onProgress?: (progress: number) => void,
): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', presignUrl);
		xhr.setRequestHeader('Content-Type', contentType);

		if (onProgress && xhr.upload) {
			xhr.upload.onprogress = (event) => {
				if (event.lengthComputable) {
					const progress = event.loaded / event.total;
					onProgress(progress);
				}
			};
		}

		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve();
			} else {
				reject(new Error(`S3 upload failed: status ${xhr.status}`));
			}
		};

		xhr.onerror = () => {
			reject(new Error('S3 upload failed: network error'));
		};

		xhr.send({ uri } as any);
	});
}
