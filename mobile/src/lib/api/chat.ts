import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { activityKeys } from '@/lib/api/activity';
import type { ChatMessage } from '@/store/chatStore';

export interface ConversationSummary {
	conversation_id: number;
	house_id?: number;
	last_activity: string;
	unread_count: number;
	last_message_id?: number;
	last_message_body: string;
	last_message_sender_id?: number;
	last_message_created_at?: string;
	other_last_read_message_id?: number;
	other_user_id: number;
	other_user_name: string;
	other_user_surname: string;
	other_user_avatar_url: string;
	other_user_phone?: string;
	other_user_deleted?: boolean;
	house_street?: string;
	house_number?: string;
	house_count_room?: string;
	house_price?: number;
	house_cover_path?: string;
}

export interface AttachmentInput {
	url: string;
	file_name: string;
	mime_type: string;
	size_bytes: number;
	width?: number;
	height?: number;
}

export interface SendMessageBody {
	body?: string;
	attachments?: AttachmentInput[];
}

export interface UploadTarget {
	url: string;
	form_data: Record<string, string>;
	key: string;
}

export const chatKeys = {
	all: ['chat'] as const,
	conversations: () => [...chatKeys.all, 'conversations'] as const,
	messages: (convID: number) => [...chatKeys.all, 'messages', convID] as const,
};

// 1. Fetch conversation list
export function fetchConversations(): Promise<ConversationSummary[]> {
	return api.get<ConversationSummary[]>('/api/v1/chat/conversations');
}

export function useConversations() {
	return useQuery({
		queryKey: chatKeys.conversations(),
		queryFn: fetchConversations,
		staleTime: 1000 * 15, // Fresh for 15 seconds
	});
}

// 2. Fetch messages in a conversation
export function fetchMessages(
	convID: number,
	cursor: number = 0,
	limit: number = 20,
): Promise<ChatMessage[]> {
	return api.get<ChatMessage[]>(
		`/api/v1/chat/conversations/${convID}/messages?cursor=${cursor}&limit=${limit}`,
	);
}

export function useMessages(convID: number | undefined) {
	return useInfiniteQuery({
		queryKey: chatKeys.messages(convID ?? 0),
		queryFn: ({ pageParam = 0 }) => fetchMessages(convID as number, pageParam, 20),
		initialPageParam: 0,
		getNextPageParam: (lastPage) => {
			if (!lastPage || lastPage.length < 20) {
				return undefined;
			}
			// Cursor is the ID of the last (oldest) message on the page
			return lastPage[lastPage.length - 1].id;
		},
		enabled: convID != null && convID > 0,
	});
}

// 3. Create or find conversation
export function findOrCreateConversation(
	houseID: number | null,
	userID: number,
): Promise<{ conversation_id: number }> {
	return api.post<{ conversation_id: number }>('/api/v1/chat/conversations', {
		house_id: houseID,
		user_id: userID,
	});
}

export function useFindOrCreateConversation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (params: { houseID: number | null; userID: number }) =>
			findOrCreateConversation(params.houseID, params.userID),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
		},
	});
}

// 4. Send message mutation
export function sendMessage(convID: number, body: SendMessageBody): Promise<ChatMessage> {
	return api.post<ChatMessage>(`/api/v1/chat/conversations/${convID}/messages`, body);
}

export function useSendMessage(convID: number) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: SendMessageBody) => sendMessage(convID, body),
		onSuccess: (newMsg) => {
			// Invalidate conversation list
			queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
		},
	});
}

// 5. Read messages mutation
export function readMessages(convID: number, messageID: number): Promise<void> {
	return api.post<void>(`/api/v1/chat/conversations/${convID}/read`, {
		message_id: messageID,
	});
}

export function useReadMessages(convID: number) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (messageID: number) => readMessages(convID, messageID),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
			queryClient.invalidateQueries({ queryKey: activityKeys.counters() });
		},
	});
}

// 6. Presign S3/MinIO upload
export function presignUpload(
	fileName: string,
	size: number,
	contentType: string,
): Promise<UploadTarget> {
	return api.post<UploadTarget>('/api/v1/chat/attachments/presign', {
		file_name: fileName,
		size: size,
		content_type: contentType,
	});
}
