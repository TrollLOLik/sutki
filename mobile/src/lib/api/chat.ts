import {
	useQuery,
	useMutation,
	useQueryClient,
	useInfiniteQuery,
	type InfiniteData,
} from '@tanstack/react-query';
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
	/** id процитированного сообщения. Должно быть из той же беседы. */
	reply_to_message_id?: number;
}

export interface UploadTarget {
	url: string;
	form_data: Record<string, string>;
	key: string;
}

export interface ConversationPresence {
	online: boolean;
	last_seen_at?: string;
}

export interface ChatSuggestions {
	suggestions: string[];
	/** true — подсказки сгенерированы моделью, false — статичный набор. */
	generated: boolean;
}

export const chatKeys = {
	all: ['chat'] as const,
	conversations: () => [...chatKeys.all, 'conversations'] as const,
	messages: (convID: number) => [...chatKeys.all, 'messages', convID] as const,
	images: (convID: number) => [...chatKeys.all, 'images', convID] as const,
	presence: (convID: number) => [...chatKeys.all, 'presence', convID] as const,
	/**
	 * Ключ включает id последнего сообщения: подсказки относятся к конкретному
	 * состоянию беседы, и с приходом нового сообщения запрос должен уйти заново.
	 * Ровно та же логика инвалидации, что в серверном кэше.
	 */
	suggestions: (convID: number, lastMessageID: number) =>
		[...chatKeys.all, 'suggestions', convID, lastMessageID] as const,
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

export function fetchConversationImages(
	convID: number,
): Promise<NonNullable<ChatMessage['attachments']>> {
	return api.get<NonNullable<ChatMessage['attachments']>>(
		`/api/v1/chat/conversations/${convID}/images`,
	);
}

export function useConversationImages(convID: number | undefined) {
	return useQuery({
		queryKey: chatKeys.images(convID ?? 0),
		queryFn: () => fetchConversationImages(convID as number),
		enabled: convID != null && convID > 0,
		staleTime: 30_000,
	});
}

export function fetchConversationPresence(convID: number): Promise<ConversationPresence> {
	return api.get<ConversationPresence>(`/api/v1/chat/conversations/${convID}/presence`);
}

export function useConversationPresence(convID: number | undefined) {
	return useQuery({
		queryKey: chatKeys.presence(convID ?? 0),
		queryFn: () => fetchConversationPresence(convID as number),
		enabled: convID != null && convID > 0,
		refetchInterval: 30_000,
		staleTime: 10_000,
	});
}

export function publishTyping(convID: number, active: boolean): Promise<void> {
	return api.post<void>(`/api/v1/chat/conversations/${convID}/typing`, { active });
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

/**
 * Merge a server message into a locally richer copy.
 *
 * A reply is hydrated on the server, but the HTTP/realtime payload can arrive
 * without the nested quote while the message is being finalized. Do not let
 * that partial payload erase the quote already rendered optimistically.
 */
export function mergeChatMessage(previous: ChatMessage, updated: ChatMessage): ChatMessage {
	const merged = { ...previous, ...updated };
	const hasReplyID = merged.reply_to_message_id != null;

	if (hasReplyID && updated.reply_to == null && previous.reply_to) {
		merged.reply_to = previous.reply_to;
	}
	if (previous.reply_to_message_id != null && updated.reply_to_message_id === undefined) {
		merged.reply_to_message_id = previous.reply_to_message_id;
	}
	if (updated.reply_to_message_id === null) {
		merged.reply_to = null;
	}

	// The shared conversation channel carries only recipient-safe attachments.
	// Preserve retryable failed media until the authoritative history refetch
	// arrives. Policy rejections are modal-only and must disappear from the chat.
	const senderOnly = previous.attachments?.filter(
		(att) => att.moderation_status === 'failed',
	);
	if (senderOnly?.length && updated.attachments) {
		const updatedIDs = new Set(updated.attachments.map((att) => att.id));
		merged.attachments = [
			...updated.attachments,
			...senderOnly.filter((att) => !updatedIDs.has(att.id)),
		];
	}

	return merged;
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

export function retryAttachment(attachmentID: number): Promise<void> {
	return api.post<void>(`/api/v1/chat/attachments/${attachmentID}/retry`);
}

export function useRetryAttachment(convID: number) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: retryAttachment,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: chatKeys.messages(convID) });
			queryClient.invalidateQueries({ queryKey: chatKeys.images(convID) });
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

/**
 * ИИ-подсказки ответа для беседы.
 *
 * Сервер всегда отвечает 200: при недоступной модели он отдаёт статичный набор,
 * поэтому у клиента нет ветки «подсказок нет». Запрос идёт только когда экран
 * реально их показывает — включённый флаг enabled экономит и вызовы модели, и
 * лимит запросов пользователя.
 */
export function fetchSuggestions(convID: number): Promise<ChatSuggestions> {
	return api.get<ChatSuggestions>(`/api/v1/chat/conversations/${convID}/suggestions`);
}

export function useChatSuggestions(
	convID: number | undefined,
	lastMessageID: number,
	enabled: boolean,
) {
	return useQuery({
		queryKey: chatKeys.suggestions(convID ?? 0, lastMessageID),
		queryFn: () => fetchSuggestions(convID as number),
		enabled: enabled && convID != null && convID > 0,
		// Пока беседа не изменилась, ключ тот же — данные считаем свежими и не
		// перезапрашиваем при возврате на экран.
		staleTime: 30 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
		refetchOnMount: false,
		refetchOnReconnect: false,
		// Подсказки — необязательное улучшение: ошибка модели не должна влиять на чат.
		retry: false,
	});
}

// 7. Правка и удаление сообщения.
//
// Адресуются по id сообщения без беседы: id глобально уникален, а права
// проверяются по авторству. Сервер возвращает обновлённое сообщение целиком —
// клиент подменяет им запись в кэше.
//
// Окна: правка 15 минут и только пока получатель не прочитал, удаление 60 минут.
// Отказы приходят как 4xx с готовым текстом в поле message, поэтому экран может
// показать ошибку сервера напрямую, не дублируя правила на клиенте.

export function editMessage(messageID: number, body: string): Promise<ChatMessage> {
	return api.patch<ChatMessage>(`/api/v1/chat/messages/${messageID}`, { body });
}

export function deleteMessage(messageID: number): Promise<ChatMessage> {
	return api.delete<ChatMessage>(`/api/v1/chat/messages/${messageID}`);
}

/**
 * Заменяет сообщение в постраничном кэше беседы.
 *
 * Используется и правкой с удалением, и обработчиками realtime-событий, чтобы
 * оба пути обновляли кэш одинаково.
 */
export function replaceMessageInCache(
	queryClient: ReturnType<typeof useQueryClient>,
	convID: number,
	updated: ChatMessage,
) {
	queryClient.setQueryData<InfiniteData<ChatMessage[]>>(chatKeys.messages(convID), (old) => {
		if (!old) return old;
		return {
			...old,
			pages: old.pages.map((page) =>
				page.map((m) => {
					if (m.id !== updated.id) return m;
					const merged = mergeChatMessage(m, updated);
					// Сервер опускает пустые поля (omitempty), поэтому у удалённого
					// сообщения ключей body и attachments в JSON просто нет — при
					// поверхностном слиянии они бы уцелели от старой версии. Тогда
					// галерея продолжала бы держать ссылки на уже удалённые из
					// хранилища файлы. Чистим явно.
					if (updated.deleted_at) {
						merged.body = undefined;
						merged.attachments = undefined;
					}
					return merged;
				}),
			),
		};
	});
}

export function useEditMessage(convID: number) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (params: { messageID: number; body: string }) =>
			editMessage(params.messageID, params.body),
		onSuccess: (updated) => {
			replaceMessageInCache(queryClient, convID, updated);
			// Превью в списке диалогов показывает последнее сообщение, поэтому
			// правка последнего сообщения делает список устаревшим.
			queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
		},
	});
}

export function useDeleteMessage(convID: number) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (messageID: number) => deleteMessage(messageID),
		onSuccess: (updated) => {
			replaceMessageInCache(queryClient, convID, updated);
			queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
		},
	});
}
