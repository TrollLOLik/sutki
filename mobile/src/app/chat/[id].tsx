import React, { useState, useEffect, useRef } from 'react';
import {
	View,
	Text,
	FlatList,
	TextInput,
	TouchableOpacity,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	Keyboard,
	LayoutAnimation,
	UIManager,
	Linking,
	StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File } from 'expo-file-system';
import { useQueryClient, InfiniteData } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ImageViewerModal } from '@/components/ui/ImageViewerModal';
import { appAlert as Alert } from '@/components/AppAlert';

import { useSessionStore } from '@/store/session';
import { useChatStore, ChatMessage } from '@/store/chatStore';
import {
	chatKeys,
	useMessages,
	useSendMessage,
	useReadMessages,
	presignUpload,
	useConversations,
	useConversationPresence,
	publishTyping,
} from '@/lib/api/chat';
import { uploadToS3 } from '@/lib/api/media';
import { useListing } from '@/lib/api/listings';
import { useConfirmBooking, useRejectBooking } from '@/lib/api/bookings';
import { useMyReviewEligibility } from '@/lib/api/reviews';
import { api, ApiError } from '@/lib/api/client';
import { useAppTheme } from '@/theme/useAppTheme';
import { NavigationBackButton } from '@/components/NavigationBackButton';
import { formatRooms } from '@/lib/format';
import { Button, BottomSheet, IconButton, MaterialSurface } from '@/components/ui';
import { BookingStatusCard } from '@/components/chat/BookingStatusCard';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

/** Canned owner replies shown as chips above the input. Client-only. */
const QUICK_REPLIES = [
	'Здравствуйте! Даты свободны',
	'Уточните, пожалуйста, даты заезда и выезда',
	'Заселение после 14:00, выезд до 12:00',
	'Напишу вам чуть позже',
];

const EMOJI_OPTIONS = ['😀', '😊', '🙂', '😍', '😂', '👍', '🙏', '👌', '🔥', '❤️', '🎉', '🏠', '📍', '✅', '🙌', '☀️'];
type ChatAttachment = NonNullable<ChatMessage['attachments']>[number];

function formatLastSeen(lastSeenAt?: string) {
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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ChatDialogScreen() {
	const { palette, isDark } = useAppTheme();
	const chatColors = React.useMemo(
		() => ({
			background: isDark ? '#0D0F12' : '#F4F5F7',
			chrome: isDark ? 'rgba(20, 22, 27, 0.97)' : 'rgba(255, 255, 255, 0.97)',
			panel: isDark ? '#181A1F' : '#FFFFFF',
			panelRaised: isDark ? '#202329' : '#F0F1F3',
			incoming: isDark ? '#1B1E23' : '#FFFFFF',
			border: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(18,24,32,0.09)',
			softBorder: isDark ? 'rgba(255,255,255,0.055)' : 'rgba(18,24,32,0.06)',
		}),
		[isDark],
	);
	const router = useRouter();
	const params = useLocalSearchParams<{ id: string; title?: string; otherUserId?: string; houseId?: string }>();
	const convID = parseInt(params.id ?? '0', 10);

	const insets = useSafeAreaInsets();
	const queryClient = useQueryClient();

	const sessionUser = useSessionStore((state) => state.user);
	const centrifuge = useChatStore((state) => state.centrifuge);
	const socketStatus = useChatStore((state) => state.status);
	const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);

	const [inputText, setInputText] = useState('');
	const [uploading, setUploading] = useState(false);
	const [downloadingAttachmentID, setDownloadingAttachmentID] = useState<number | null>(null);
	const [isOtherTyping, setIsOtherTyping] = useState(false);
	const [isAttachMenuVisible, setIsAttachMenuVisible] = useState(false);
	const [isEmojiPickerVisible, setIsEmojiPickerVisible] = useState(false);
	// Contextual anti-scam notice: shown in fresh dialogs (few user messages),
	// dismissible for the rest of the session. Not a chat message — it never
	// pollutes history or unread counters.
	const [safetyNoticeDismissed, setSafetyNoticeDismissed] = useState(false);

	const {
		data,
		isLoading,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		refetch,
	} = useMessages(convID);
	const { data: presence, refetch: refetchPresence } = useConversationPresence(convID);

	// Load listing context if available
	const { data: conversations } = useConversations();
	const activeConv = conversations?.find((c) => c.conversation_id === convID);
	const houseID = activeConv?.house_id || (params.houseId ? parseInt(params.houseId, 10) : undefined);
	const { data: listing } = useListing(houseID);

	const { mutateAsync: performSendMessage } = useSendMessage(convID);
	const { mutate: performReadMessages } = useReadMessages(convID);

	const messages = data?.pages.flat().filter(Boolean) ?? [];

	// Booking card actions (owner shortcuts to the same confirm/reject
	// endpoints as the requests screen).
	const isListingOwner = !!listing && !!sessionUser && listing.owner_id === sessionUser.id;
	const reviewEligibility = useMyReviewEligibility(!!sessionUser && !isListingOwner);
	const eligibilityByRequest = new Map((reviewEligibility.data?.items ?? []).map((entry) => [entry.request_id, entry]));
	const confirmBookingMutation = useConfirmBooking();
	const rejectBookingMutation = useRejectBooking();
	const [actioningRequestId, setActioningRequestId] = useState<number | null>(null);

	// A `new` card keeps its buttons only while no later card exists for the
	// same request (confirmed/rejected/cancelled cards arrive via socket and
	// supersede it). messages[0] is the newest (inverted list).
	const latestCardEventByRequest = React.useMemo(() => {
		const map = new Map<number, string>();
		for (const m of messages) {
			const rid = m.payload?.request_id;
			if (m.kind === 'booking_status' && rid && !map.has(rid)) {
				map.set(rid, m.payload!.event);
			}
		}
		return map;
	}, [messages]);

	const handleConfirmBooking = (requestID: number) => {
		Alert.alert('Подтвердить бронирование?', 'Гость получит уведомление и точный адрес.', [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Подтвердить',
				onPress: () => {
					setActioningRequestId(requestID);
					confirmBookingMutation.mutate(requestID, {
						onError: () => Alert.alert('Ошибка', 'Не удалось подтвердить заявку. Попробуйте еще раз.'),
						onSettled: () => setActioningRequestId(null),
					});
				},
			},
		]);
	};

	const handleRejectBooking = (requestID: number) => {
		Alert.alert('Отклонить заявку?', 'Гость получит уведомление об отказе.', [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Отклонить',
				style: 'destructive',
				onPress: () => {
					setActioningRequestId(requestID);
					rejectBookingMutation.mutate(
						{ id: requestID },
						{
							onError: () => Alert.alert('Ошибка', 'Не удалось отклонить заявку. Попробуйте еще раз.'),
							onSettled: () => setActioningRequestId(null),
						},
					);
				},
			},
		]);
	};

	const [galleryVisible, setGalleryVisible] = useState(false);
	const [selectedImageIndex, setSelectedImageIndex] = useState(0);

	const chatImages = React.useMemo(() => {
		const list: string[] = [];
		for (let i = messages.length - 1; i >= 0; i--) {
			messages[i].attachments?.forEach((att) => {
				if (att.mime_type.startsWith('image/')) {
					list.push(att.url);
				}
			});
		}
		return list;
	}, [messages]);

	const ownTypingActiveRef = useRef(false);
	const ownTypingLastSentAtRef = useRef(0);
	const ownTypingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const otherTypingExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const emitTyping = React.useCallback((active: boolean) => {
		if (!convID || ownTypingActiveRef.current === active) return;
		ownTypingActiveRef.current = active;
		ownTypingLastSentAtRef.current = active ? Date.now() : 0;
		publishTyping(convID, active).catch(() => {
			// Typing is best-effort and must never interfere with composing or
			// sending the actual message.
		});
	}, [convID]);

	const stopOwnTyping = React.useCallback(() => {
		if (ownTypingStopTimerRef.current) {
			clearTimeout(ownTypingStopTimerRef.current);
			ownTypingStopTimerRef.current = null;
		}
		emitTyping(false);
	}, [emitTyping]);

	const handleInputChange = React.useCallback((value: string) => {
		setInputText(value);
		const hasText = value.trim().length > 0;
		if (!hasText) {
			stopOwnTyping();
			return;
		}

		const now = Date.now();
		if (!ownTypingActiveRef.current || now - ownTypingLastSentAtRef.current >= 2_000) {
			// Refresh the remote expiry while a long message is being typed.
			ownTypingActiveRef.current = false;
			emitTyping(true);
		}
		if (ownTypingStopTimerRef.current) clearTimeout(ownTypingStopTimerRef.current);
		ownTypingStopTimerRef.current = setTimeout(stopOwnTyping, 1_800);
	}, [emitTyping, stopOwnTyping]);

	// Mark active conversation on mount/unmount
	useEffect(() => {
		setActiveConversationId(convID);
		return () => {
			setActiveConversationId(null);
			stopOwnTyping();
			if (otherTypingExpiryRef.current) clearTimeout(otherTypingExpiryRef.current);
		};
	}, [convID, setActiveConversationId, stopOwnTyping]);

	useEffect(() => {
		if (socketStatus === 'connected') {
			refetchPresence();
		}
	}, [socketStatus, refetchPresence]);

	// Smooth transition for keyboard layout shifts
	useEffect(() => {
		const showSub = Keyboard.addListener(
			Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
			() => {
				LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
			}
		);
		const hideSub = Keyboard.addListener(
			Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
			() => {
				LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
			}
		);

		return () => {
			showSub.remove();
			hideSub.remove();
		};
	}, []);

	// Track last read message to prevent infinite read loops
	const lastReadIdRef = useRef<number | null>(null);

	// Read receipt triggers
	useEffect(() => {
		if (messages.length > 0) {
			const latestMsg = messages[0];
			if (
				latestMsg.sender_id !== sessionUser?.id &&
				!latestMsg.pending &&
				latestMsg.id !== lastReadIdRef.current
			) {
				lastReadIdRef.current = latestMsg.id;
				performReadMessages(latestMsg.id);
			}
		}
	}, [messages, sessionUser?.id]);

	// Real-time subscription to private channel
	useEffect(() => {
		if (!centrifuge || socketStatus !== 'connected' || !convID) return;

		const channel = `chat:conv_${convID}`;
		console.log('[Chat] Connecting subscription to:', channel);

		// Clean up any existing subscription first to prevent duplicates/errors
		const existingSub = centrifuge.getSubscription(channel);
		if (existingSub) {
			console.log('[Chat] Found existing subscription in registry, removing it first:', channel);
			existingSub.unsubscribe();
			centrifuge.removeSubscription(existingSub);
		}

		const sub = centrifuge.newSubscription(channel, {
			getToken: async () => {
				const res = await api.post<{ subscription_token: string }>('/api/v1/chat/subscription-token', {
					conversation_id: convID,
				});
				return res.subscription_token;
			},
		});

		sub.on('publication', (ctx) => {
			const payload = ctx.data as {
				type: string;
				message?: ChatMessage;
				user_id?: number;
				message_id?: number;
				active?: boolean;
			};
			console.log('[Chat] Event on channel:', channel, payload);

			if (payload.type === 'typing.changed' && payload.user_id !== sessionUser?.id) {
				if (otherTypingExpiryRef.current) clearTimeout(otherTypingExpiryRef.current);
				setIsOtherTyping(payload.active === true);
				if (payload.active) {
					// A missed "stopped" packet must not leave the indicator
					// hanging forever.
					otherTypingExpiryRef.current = setTimeout(() => {
						setIsOtherTyping(false);
					}, 4_000);
				}
				return;
			}

			if (payload.type === 'message.new' && payload.message) {
				const newMsg = payload.message;
				if (newMsg.sender_id !== sessionUser?.id) {
					if (otherTypingExpiryRef.current) clearTimeout(otherTypingExpiryRef.current);
					setIsOtherTyping(false);
				}

				// Append new message to TanStack query cache
				queryClient.setQueryData<InfiniteData<ChatMessage[]>>(chatKeys.messages(convID), (old) => {
					if (!old) return old;

					// 1. Avoid duplicates if the message is already in cache
					if (old.pages.flat().some((m) => m.id === newMsg.id)) {
						return old;
					}

					// 2. If it's our own message, try to find and replace the optimistic pending message
					if (newMsg.sender_id === sessionUser?.id) {
						let replaced = false;
						const newPages = old.pages.map((page) => {
							return page.map((m) => {
								if (m.pending && !replaced) {
									replaced = true;
									return newMsg;
								}
								return m;
							});
						});
						if (replaced) {
							return { ...old, pages: newPages };
						}
					}

					// 3. Otherwise, append it to the top of the first page
					const newPages = [...old.pages];
					newPages[0] = [newMsg, ...newPages[0]];
					return {
						...old,
						pages: newPages,
					};
				});

				// Auto-read incoming message
				if (newMsg.sender_id !== sessionUser?.id) {
					performReadMessages(newMsg.id);
				}
			}
		});

		sub.on('subscribed', () => {
			console.log('[Chat] Successfully subscribed to:', channel);
			refetch();
		});

		sub.subscribe();

		return () => {
			console.log('[Chat] Unsubscribing from:', channel);
			if (otherTypingExpiryRef.current) clearTimeout(otherTypingExpiryRef.current);
			setIsOtherTyping(false);
			sub.unsubscribe();
			centrifuge.removeSubscription(sub);
		};
	}, [centrifuge, socketStatus, convID]);

	const handleSend = async () => {
		const text = inputText.trim();
		if (!text) return;

		stopOwnTyping();
		setInputText('');

		// Create optimistic message
		const tempId = -Date.now();
		const optimisticMsg: ChatMessage = {
			id: tempId,
			conversation_id: convID,
			sender_id: sessionUser?.id ?? 0,
			body: text,
			created_at: new Date().toISOString(),
			pending: true,
		};

		// Push optimistic message to cache
		queryClient.setQueryData<InfiniteData<ChatMessage[]>>(chatKeys.messages(convID), (old) => {
			if (!old) return old;
			const newPages = [...old.pages];
			newPages[0] = [optimisticMsg, ...newPages[0]];
			return { ...old, pages: newPages };
		});

		try {
			const saved = await performSendMessage({ body: text });

			// Replace optimistic message in cache with real database response
			queryClient.setQueryData<InfiniteData<ChatMessage[]>>(chatKeys.messages(convID), (old) => {
				if (!old) return old;
				return {
					...old,
					pages: old.pages.map((page) =>
						page.map((m) => (m.id === tempId ? saved : m)),
					),
				};
			});
		} catch (err) {
			console.error('[Chat] Failed to send message:', err);
			// Mark optimistic message as failed
			queryClient.setQueryData<InfiniteData<ChatMessage[]>>(chatKeys.messages(convID), (old) => {
				if (!old) return old;
				return {
					...old,
					pages: old.pages.map((page) =>
						page.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)),
					),
				};
			});
		}
	};

	const handlePickMedia = () => {
		setIsAttachMenuVisible(true);
	};

	const pickImage = async () => {
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!permission.granted) {
			Alert.alert('Доступ запрещен', 'Для выбора фото разрешите доступ к галерее в настройках.');
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: 'images',
			quality: 0.8,
			allowsMultipleSelection: false,
		});

		if (result.canceled || !result.assets?.[0]) return;
		const asset = result.assets[0];

		await uploadAndSendFile(
			asset.uri,
			asset.fileName || `photo_${Date.now()}.jpg`,
			asset.mimeType || 'image/jpeg',
			asset.fileSize || 0,
			asset.width,
			asset.height
		);
	};

	const takePhoto = async () => {
		const permission = await ImagePicker.requestCameraPermissionsAsync();
		if (!permission.granted) {
			Alert.alert('Доступ запрещен', 'Для создания фото разрешите доступ к камере в настройках.');
			return;
		}

		const result = await ImagePicker.launchCameraAsync({
			mediaTypes: 'images',
			quality: 0.8,
		});

		if (result.canceled || !result.assets?.[0]) return;
		const asset = result.assets[0];

		await uploadAndSendFile(
			asset.uri,
			asset.fileName || `photo_${Date.now()}.jpg`,
			asset.mimeType || 'image/jpeg',
			asset.fileSize || 0,
			asset.width,
			asset.height
		);
	};

	const pickDocument = async () => {
		const result = await DocumentPicker.getDocumentAsync({
			type: [
				'application/pdf',
				'text/plain',
				'application/msword',
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'application/vnd.ms-excel',
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			],
			copyToCacheDirectory: true,
		});

		if (result.canceled || !result.assets?.[0]) return;
		const asset = result.assets[0];

		await uploadAndSendFile(
			asset.uri,
			asset.name,
			asset.mimeType || 'application/octet-stream',
			asset.size || 0
		);
	};

	const uploadAndSendFile = async (
		uri: string,
		fileName: string,
		mimeType: string,
		size: number,
		width?: number,
		height?: number
	) => {
		if (size > 15 * 1024 * 1024) {
			Alert.alert('Ошибка', 'Размер файла превышает лимит 15 МБ.');
			return;
		}

		setUploading(true);
		try {
			// 1. Get presigned POST upload parameters from Go API
			const target = await presignUpload(fileName, size, mimeType);

			// 2. Upload file directly to S3 / MinIO via presigned POST.
			// The POST policy enforces the size limit on the storage side.
			await uploadToS3(uri, target, fileName, mimeType);

			// 3. Send message with the attachment metadata referencing S3 key
			await performSendMessage({
				attachments: [
					{
						url: target.key, // Backend will check existence on S3 via StatObject
						file_name: fileName,
						mime_type: mimeType,
						size_bytes: size,
						width,
						height,
					},
				],
			});
		} catch (err) {
			console.error('[Chat] Failed uploading file:', err);
			Alert.alert(
				'Ошибка загрузки',
				err instanceof ApiError
					? err.message
					: 'Не удалось загрузить и отправить файл. Попробуйте ещё раз.',
			);
		} finally {
			setUploading(false);
		}
	};

	const downloadAttachment = async (attachment: ChatAttachment) => {
		if (downloadingAttachmentID != null) return;
		setDownloadingAttachmentID(attachment.id);
		try {
			const directory = await Directory.pickDirectoryAsync();
			const safeName =
				attachment.file_name
					.trim()
					.replace(/[\\/:*?"<>|]/g, '_')
					.replace(/^\.+/, '') || `document_${attachment.id}`;
			const destination = new File(directory, safeName);
			await File.downloadFileAsync(attachment.url, destination, { idempotent: true });
			Alert.alert('Файл сохранён', `${safeName} сохранён в выбранную папку.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!/cancel/i.test(message)) {
				console.error('[Chat] Failed downloading attachment:', error);
				Alert.alert('Ошибка загрузки', 'Не удалось сохранить документ. Попробуйте ещё раз.');
			}
		} finally {
			setDownloadingAttachmentID(null);
		}
	};

	const formatMessageTime = (timeStr: string) => {
		try {
			return format(new Date(timeStr), 'HH:mm');
		} catch {
			return '';
		}
	};

	const renderMessage = ({ item }: { item: ChatMessage }) => {
		// System booking card: centered, no bubble, optional owner actions.
		if (item.kind === 'booking_status' && item.payload) {
			const rid = item.payload.request_id;
			return (
				<BookingStatusCard
					payload={item.payload}
					createdAt={item.created_at}
					isOwner={isListingOwner}
					isActionable={latestCardEventByRequest.get(rid) === 'new'}
					confirming={actioningRequestId === rid && confirmBookingMutation.isPending}
					rejecting={actioningRequestId === rid && rejectBookingMutation.isPending}
					onConfirm={handleConfirmBooking}
					onReject={handleRejectBooking}
					reviewAvailable={eligibilityByRequest.get(rid)?.can_review === true}
					reviewLabel={
						eligibilityByRequest.get(rid)?.review_status === 'rejected' ||
						eligibilityByRequest.get(rid)?.review_status === 'moderation_review'
							? 'Изменить отзыв'
							: 'Оставить отзыв'
					}
					reviewStatus={eligibilityByRequest.get(rid)?.review_status}
					onReview={(requestID) => router.push({ pathname: '/review/[id]', params: { id: String(requestID) } })}
				/>
			);
		}

		const isMe = item.sender_id != null && item.sender_id === sessionUser?.id;
		const isPending = item.pending;
		const isFailed = item.failed;
		const hasAttachments = !!item.attachments?.length;
		const isImageOnly =
			hasAttachments &&
			!item.body &&
			item.attachments!.every((attachment) => attachment.mime_type.startsWith('image/'));

		return (
			<View className={`flex-row my-1.5 px-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
				<View
					style={[
						styles.messageBubble,
						{
							backgroundColor: isImageOnly
								? 'transparent'
								: isMe
									? palette.primary
									: chatColors.incoming,
							borderColor: isImageOnly || isMe ? 'transparent' : chatColors.softBorder,
							paddingHorizontal: isImageOnly ? 0 : 15,
							paddingVertical: isImageOnly ? 0 : 11,
						},
					]}
				>
					{/* Render attachments */}
					{item.attachments && item.attachments.map((att) => {
						const isImg = att.mime_type.startsWith('image/');
						if (isImg) {
							return (
								<TouchableOpacity
									key={att.id}
									activeOpacity={0.9}
									onPress={() => {
										const index = chatImages.indexOf(att.url);
										if (index >= 0) {
											setSelectedImageIndex(index);
											setGalleryVisible(true);
										}
									}}
									style={styles.imageAttachment}
								>
									<Image
										source={{ uri: att.url }}
										style={{
											width: 210,
											height: att.height && att.width ? (att.height / att.width) * 210 : 150,
										}}
										contentFit="cover"
									/>
								</TouchableOpacity>
							);
						}
						return (
							<Pressable
								key={att.id}
								disabled={downloadingAttachmentID != null}
								onPress={() => downloadAttachment(att)}
								accessibilityRole="button"
								accessibilityLabel={`Скачать документ ${att.file_name}`}
								className={`flex-row items-center p-2.5 rounded-xl mb-1.5 w-[238px] ${isMe ? 'bg-white/10' : 'bg-background/40'} active:opacity-75`}
							>
								<View className={`h-9 w-9 rounded-full items-center justify-center ${isMe ? 'bg-white/10' : 'bg-primary/10'}`}>
									<Ionicons name="document-text" size={20} color={isMe ? '#fff' : palette.primary} />
								</View>
								<View className="ml-2.5 flex-1">
									<Text numberOfLines={1} className={`text-xs ${isMe ? 'text-white' : 'text-ink'} font-semibold`}>
										{att.file_name}
									</Text>
									<Text className={`text-[10px] ${isMe ? 'text-white/70' : 'text-ink-muted'} mt-0.5`}>
										{(att.size_bytes / 1024).toFixed(1)} КБ
									</Text>
								</View>
								{downloadingAttachmentID === att.id ? (
									<ActivityIndicator size="small" color={isMe ? '#fff' : palette.primary} />
								) : (
									<Ionicons name="download-outline" size={20} color={isMe ? '#fff' : palette.primary} />
								)}
							</Pressable>
						);
					})}

					{/* Render text body */}
					{item.body ? (
						<Text className={`text-[15px] leading-[20px] ${isMe ? 'text-white' : 'text-ink'}`}>
							{item.body}
						</Text>
					) : null}

					{/* Time & Sent Status Info */}
					<View
						className="flex-row justify-end items-center mt-1 self-end"
						style={isImageOnly ? styles.imageTimestamp : undefined}
					>
						<Text
							className={`text-[10px] ${isMe || isImageOnly ? 'text-white/80' : 'text-ink-muted'} mr-1`}
						>
							{formatMessageTime(item.created_at)}
						</Text>
						{isMe && (
							<>
								{isPending && (
									<Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.6)" />
								)}
								{isFailed && (
									<Ionicons name="alert-circle-outline" size={11} color="#EF4444" />
								)}
								{!isPending && !isFailed && (
									activeConv?.other_last_read_message_id && item.id <= activeConv.other_last_read_message_id ? (
										<Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.9)" />
									) : (
										<Ionicons name="checkmark" size={12} color="rgba(255,255,255,0.6)" />
									)
								)}
							</>
						)}
					</View>
				</View>
			</View>
		);
	};

	const isInputEmpty = !inputText.trim();
	const isDeletedUser = !!activeConv?.other_user_deleted;
	const conversationTitle = activeConv
		? [activeConv.other_user_name, activeConv.other_user_surname]
			.map((part) => part?.trim())
			.filter(Boolean)
			.join(' ') || 'Собеседник'
		: params.title?.trim() || 'Собеседник';
	const callPhone = activeConv?.other_user_phone?.trim() || '';
	const normalizedCallPhone = callPhone.replace(/[^\d+]/g, '');
	const canCall = !!activeConv && !isDeletedUser && normalizedCallPhone.length > 0;
	const canOpenProfile = !!activeConv?.other_user_id && !isDeletedUser;
	const presenceLabel = isOtherTyping
		? 'печатает…'
		: presence
			? presence.online
				? 'В сети'
				: formatLastSeen(presence.last_seen_at)
			: '';

	const handleProfilePress = () => {
		if (!activeConv || !canOpenProfile) return;
		router.push({
			pathname: '/profile/[id]',
			params: {
				id: String(activeConv.other_user_id),
				name: activeConv.other_user_name || undefined,
				surname: activeConv.other_user_surname || undefined,
				phone: activeConv.other_user_phone || undefined,
				avatarUrl: activeConv.other_user_avatar_url || undefined,
			},
		} as any);
	};

	const handleCallPress = () => {
		if (!canCall) return;
		Linking.openURL(`tel:${normalizedCallPhone}`).catch(() => {
			Alert.alert('Ошибка', 'Не удалось открыть телефон.');
		});
	};

	const handleEmojiPress = (emoji: string) => {
		handleInputChange(`${inputText}${emoji}`);
		setIsEmojiPickerVisible(false);
	};

	// Fresh dialog = fewer than 3 human messages so far. Once the parties are
	// clearly talking, the safety notice retires on its own.
	const userMessageCount = messages.filter((m) => !m.kind || m.kind === 'user').length;
	const showSafetyNotice = !isLoading && !safetyNoticeDismissed && !isDeletedUser && userMessageCount < 3;

	// Quick replies: shown to the listing owner in a fresh dialog while the
	// input is empty — one tap prefills a typical answer.
	const showQuickReplies = isListingOwner && !isDeletedUser && isInputEmpty && userMessageCount < 3;

	return (
		<View style={{ flex: 1, backgroundColor: chatColors.background }}>
			<Stack.Screen options={{ headerShown: false }} />

			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				style={{ flex: 1 }}
				keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
			>

			{/* Floating conversation chrome */}
			<Animated.View
				entering={FadeIn.duration(220)}
				style={[
					styles.header,
					{
						paddingTop: insets.top + 8,
						backgroundColor: 'transparent',
						borderBottomColor: chatColors.softBorder,
					},
				]}
			>
				<BlurView
					intensity={88}
					tint={isDark ? 'dark' : 'light'}
					style={StyleSheet.absoluteFill}
				/>
				<View
					pointerEvents="none"
					style={[
						StyleSheet.absoluteFill,
						{ backgroundColor: isDark ? 'rgba(20,22,27,0.72)' : 'rgba(255,255,255,0.72)' },
					]}
				/>
				<View className="flex-row items-center flex-1">
					<NavigationBackButton
						fallback="/(tabs)/messages"
						size={48}
						variant="material"
						className="mr-3.5"
					/>

					<TouchableOpacity
						activeOpacity={0.7}
						disabled={!canOpenProfile}
						onPress={handleProfilePress}
						className="flex-1 flex-row items-center"
						accessibilityRole={canOpenProfile ? 'button' : undefined}
						accessibilityLabel={canOpenProfile ? `Открыть профиль: ${conversationTitle}` : undefined}
					>
						{activeConv?.other_user_avatar_url && !isDeletedUser ? (
							<Image
								source={{ uri: activeConv.other_user_avatar_url }}
								style={styles.headerAvatar}
								contentFit="cover"
							/>
						) : (
							<View style={[styles.headerAvatar, { backgroundColor: chatColors.panelRaised }]} className="items-center justify-center">
								<Ionicons name="person-outline" size={20} color={palette.inkMuted} />
							</View>
						)}

						<View className="ml-3.5 flex-1">
							<Text numberOfLines={1} className="font-extrabold text-[19px] leading-6 text-ink">
								{isDeletedUser ? 'Удаленный профиль' : conversationTitle}
							</Text>
							{isDeletedUser ? (
								<Text className="mt-1 text-[12px] font-medium text-ink-muted">
									Профиль удален
								</Text>
							) : presenceLabel ? (
								<View className="mt-1 flex-row items-center">
									{presence?.online && !isOtherTyping ? (
										<View className="mr-1.5 h-2 w-2 rounded-full bg-success" />
									) : null}
									<Text
										numberOfLines={1}
										className={`text-[12px] font-semibold ${isOtherTyping ? 'text-primary' : presence?.online ? 'text-success' : 'text-ink-muted'}`}
									>
										{presenceLabel}
									</Text>
								</View>
							) : null}
						</View>
					</TouchableOpacity>
				</View>

				{canCall ? (
					<IconButton
						icon="call-outline"
						iconSize={23}
						size={48}
						tone="primary"
						onPress={handleCallPress}
						accessibilityLabel="Позвонить"
					/>
				) : null}
			</Animated.View>

			{/* Sticky Listing Context Header */}
			{listing && (
				<Animated.View
					entering={FadeInDown.duration(260)}
				>
					<MaterialSurface level="floating" radius={18} style={styles.listingPanel}>
					<View className="flex-row items-center flex-1 mr-3">
						{listing.cover_url ? (
							<Image
								source={{ uri: listing.cover_url }}
								style={styles.listingImage}
								contentFit="cover"
							/>
						) : (
							<View style={[styles.listingImage, { backgroundColor: chatColors.panelRaised }]} className="items-center justify-center">
								<Ionicons name="image-outline" size={25} color={palette.inkMuted} />
							</View>
						)}
						<View className="ml-3 flex-1 justify-center">
							<Text numberOfLines={2} className="text-[15px] leading-5 font-extrabold text-ink">
								{`${formatRooms(listing.rooms)}, ${listing.address}`}
							</Text>
							<Text className="text-[14px] text-primary font-bold mt-1">
								{listing.price.toLocaleString('ru-RU')} ₽ / сутки
							</Text>
						</View>
					</View>
					<TouchableOpacity
						onPress={() => router.push(`/listing/${listing.id}` as any)}
						activeOpacity={0.7}
						className="flex-row items-center py-2 pl-2"
					>
						<Text className="text-primary font-bold text-[13px]">Подробнее</Text>
						<Ionicons name="chevron-forward" size={16} color={palette.primary} style={{ marginLeft: 3 }} />
					</TouchableOpacity>
					</MaterialSurface>
				</Animated.View>
			)}

			{/* Contextual anti-scam notice for fresh dialogs, dismissible */}
			{showSafetyNotice && (
				<View
					style={{ backgroundColor: chatColors.panel, borderColor: chatColors.softBorder }}
					className="flex-row items-start mx-4 mb-2 px-3.5 py-2.5 rounded-2xl border"
				>
					<Ionicons name="shield-checkmark-outline" size={18} color={palette.primary} style={{ marginTop: 1 }} />
					<Text className="flex-1 text-[12px] text-ink-secondary leading-4 ml-2.5 mr-2">
						Не переводите предоплату вне приложения и не переходите по внешним ссылкам на оплату.
					</Text>
					<TouchableOpacity
						onPress={() => setSafetyNoticeDismissed(true)}
						hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
						accessibilityLabel="Скрыть предупреждение"
					>
						<Ionicons name="close" size={16} color={palette.inkMuted} />
					</TouchableOpacity>
				</View>
			)}

			{isLoading ? (
				<View style={{ backgroundColor: chatColors.background }} className="flex-1 justify-center items-center">
					<ActivityIndicator size="large" color={palette.primary} />
				</View>
			) : messages.length === 0 ? (
				/* Perfectly Centered Welcome Empty State */
				<View style={{ backgroundColor: chatColors.background }} className="flex-1 justify-center items-center px-8">
					<View className="w-22 h-22 rounded-full bg-primary/10 items-center justify-center mb-6">
						<Ionicons name="chatbubbles" size={44} color={palette.primary} />
					</View>
					<Text className="text-xl font-bold text-ink text-center mb-2">
						Начните общение с владельцем
					</Text>
					<Text className="text-sm text-ink-secondary text-center leading-6 max-w-[300px]">
						Уточните время прибытия, правила проживания или обсудите индивидуальные условия заселения.
					</Text>
				</View>
			) : (
				<FlatList
					data={messages}
					keyExtractor={(item) => String(item.id)}
					renderItem={renderMessage}
					inverted
					onEndReached={() => {
						if (hasNextPage && !isFetchingNextPage) {
							fetchNextPage();
						}
					}}
					onEndReachedThreshold={0.3}
					contentContainerStyle={{ paddingVertical: 18 }}
					style={{ backgroundColor: chatColors.background }}
					ListFooterComponent={
						isFetchingNextPage ? (
							<ActivityIndicator size="small" color={palette.primary} className="my-2" />
						) : null
					}
				/>
			)}


				{isDeletedUser ? (
					<View style={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 16 }} className="px-4 py-4 border-t border-line/30 bg-surface items-center justify-center">
						<View className="rounded-card border p-4 w-full" style={{ borderRadius: 16, backgroundColor: palette.dangerLight, borderColor: 'rgba(229, 72, 77, 0.2)' }}>
							<View className="flex-row items-start gap-3">
								<View className="h-11 w-11 items-center justify-center rounded-full bg-surface">
									<Ionicons name="trash-outline" size={20} color={palette.danger} />
								</View>
								<View className="flex-1">
									<Text className="text-base font-extrabold text-ink">Профиль удален</Text>
									<Text className="mt-1 text-sm leading-5 text-ink-secondary">
										Вы не можете писать этому пользователю, так как его профиль удален.
									</Text>
								</View>
							</View>
						</View>
					</View>
				) : (
					<Animated.View
						entering={FadeInDown.duration(240)}
						style={{ backgroundColor: chatColors.chrome, borderTopColor: chatColors.softBorder }}
						className="border-t"
					>
					{/* Quick replies for the owner in fresh dialogs */}
					{showQuickReplies && (
						<FlatList
							horizontal
							data={QUICK_REPLIES}
							keyExtractor={(text) => text}
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, gap: 8 }}
							renderItem={({ item: reply }) => (
								<TouchableOpacity
									onPress={() => handleInputChange(reply)}
									activeOpacity={0.7}
									style={{ backgroundColor: chatColors.panelRaised, borderColor: chatColors.border }}
									className="px-3.5 py-2 rounded-full border"
								>
									<Text className="text-[12px] text-ink-secondary font-medium">{reply}</Text>
								</TouchableOpacity>
							)}
						/>
					)}
					<View style={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 12 }} className="px-3 py-2.5">
						<MaterialSurface level="base" radius={29} style={styles.composer}>
						{/* Add Attachment Button */}
						<TouchableOpacity
							onPress={handlePickMedia}
							disabled={uploading}
							style={{ backgroundColor: chatColors.panelRaised }}
							className="w-11 h-11 rounded-full items-center justify-center mr-2"
							activeOpacity={0.7}
						>
							{uploading ? (
								<ActivityIndicator size="small" color={palette.primary} />
							) : (
								<Ionicons name="attach-outline" size={22} color={palette.inkSecondary} />
							)}
						</TouchableOpacity>

						{/* Input and emoji share one continuous material. */}
						<View style={{ backgroundColor: chatColors.panelRaised }} className="flex-1 flex-row items-center rounded-[22px] min-h-11">
							<TextInput
								placeholder="Сообщение..."
								placeholderTextColor={palette.inkMuted}
								value={inputText}
								onChangeText={handleInputChange}
								onBlur={stopOwnTyping}
								className="flex-1 pl-4 pr-1 py-2.5 text-ink max-h-24 text-[15px]"
								multiline
							/>
							<IconButton
								icon="happy-outline"
								iconSize={21}
								size={40}
								onPress={() => setIsEmojiPickerVisible(true)}
								accessibilityLabel="Выбрать смайлик"
								style={{ marginRight: 2, borderWidth: 0, backgroundColor: 'transparent' }}
							/>
						</View>

						{/* Send Button */}
						<IconButton
							icon="arrow-up"
							iconSize={20}
							size={44}
							tone={isInputEmpty ? 'neutral' : 'primary'}
							filled={!isInputEmpty}
							onPress={handleSend}
							disabled={isInputEmpty}
							style={{ marginLeft: 8 }}
						/>
						</MaterialSurface>
					</View>
					</Animated.View>
				)}
			</KeyboardAvoidingView>

			<BottomSheet visible={isEmojiPickerVisible} onClose={() => setIsEmojiPickerVisible(false)}>
				<View className="py-2">
					<Text className="text-lg font-bold text-ink text-center mb-5">
						Смайлик
					</Text>
					<View className="flex-row flex-wrap justify-center gap-3 px-2 pb-2">
						{EMOJI_OPTIONS.map((emoji) => (
							<TouchableOpacity
								key={emoji}
								onPress={() => handleEmojiPress(emoji)}
								activeOpacity={0.75}
								className="w-12 h-12 rounded-2xl bg-surfaceMuted items-center justify-center active:bg-line/40"
								accessibilityRole="button"
								accessibilityLabel={`Добавить ${emoji}`}
							>
								<Text className="text-2xl">{emoji}</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>
			</BottomSheet>

			{/* Premium Bottom Sheet for Attachments */}
			<BottomSheet visible={isAttachMenuVisible} onClose={() => setIsAttachMenuVisible(false)}>
				<View className="py-2">
					<Text className="text-lg font-bold text-ink text-center mb-6">
						Отправить вложение
					</Text>

					<TouchableOpacity
						onPress={() => {
							setIsAttachMenuVisible(false);
							setTimeout(takePhoto, 300);
						}}
						activeOpacity={0.7}
						className="flex-row items-center py-4 px-3 bg-surfaceMuted rounded-2xl mb-3 active:bg-line/40"
					>
						<View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-4">
							<Ionicons name="camera-outline" size={20} color={palette.primary} />
						</View>
						<View className="flex-1">
							<Text className="text-[15px] font-bold text-ink">Камера</Text>
							<Text className="text-xs text-ink-secondary mt-0.5">Сделать снимок сейчас</Text>
						</View>
						<Ionicons name="chevron-forward" size={16} color={palette.inkMuted} />
					</TouchableOpacity>

					<TouchableOpacity
						onPress={() => {
							setIsAttachMenuVisible(false);
							setTimeout(pickImage, 300);
						}}
						activeOpacity={0.7}
						className="flex-row items-center py-4 px-3 bg-surfaceMuted rounded-2xl mb-3 active:bg-line/40"
					>
						<View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-4">
							<Ionicons name="image-outline" size={20} color={palette.primary} />
						</View>
						<View className="flex-1">
							<Text className="text-[15px] font-bold text-ink">Галерея</Text>
							<Text className="text-xs text-ink-secondary mt-0.5">Выбрать из галереи устройства</Text>
						</View>
						<Ionicons name="chevron-forward" size={16} color={palette.inkMuted} />
					</TouchableOpacity>

					<TouchableOpacity
						onPress={() => {
							setIsAttachMenuVisible(false);
							setTimeout(pickDocument, 300);
						}}
						activeOpacity={0.7}
						className="flex-row items-center py-4 px-3 bg-surfaceMuted rounded-2xl mb-6 active:bg-line/40"
					>
						<View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-4">
							<Ionicons name="document-text-outline" size={20} color={palette.primary} />
						</View>
						<View className="flex-1">
							<Text className="text-[15px] font-bold text-ink">Документ</Text>
							<Text className="text-xs text-ink-secondary mt-0.5">PDF, TXT, DOC, DOCX, XLS или XLSX</Text>
						</View>
						<Ionicons name="chevron-forward" size={16} color={palette.inkMuted} />
					</TouchableOpacity>

					<Button
						label="Отмена"
						variant="secondary"
						onPress={() => setIsAttachMenuVisible(false)}
						className="w-full"
					/>
				</View>
			</BottomSheet>

			<ImageViewerModal
				visible={galleryVisible}
				images={chatImages}
				initialIndex={selectedImageIndex}
				onClose={() => setGalleryVisible(false)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	header: {
		minHeight: 82,
		paddingHorizontal: 16,
		paddingBottom: 12,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	headerAvatar: {
		width: 48,
		height: 48,
		borderRadius: 24,
	},
	listingPanel: {
		marginHorizontal: 14,
		marginTop: 10,
		marginBottom: 8,
		minHeight: 84,
		padding: 10,
		borderRadius: 18,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		shadowOpacity: 0.08,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 8 },
		elevation: 2,
	},
	listingImage: {
		width: 64,
		height: 64,
		borderRadius: 13,
	},
	messageBubble: {
		maxWidth: '82%',
		borderRadius: 21,
		borderWidth: StyleSheet.hairlineWidth,
	},
	imageAttachment: {
		marginBottom: 2,
		borderRadius: 18,
		overflow: 'hidden',
	},
	imageTimestamp: {
		position: 'absolute',
		right: 8,
		bottom: 7,
		backgroundColor: 'rgba(0,0,0,0.52)',
		borderRadius: 10,
		paddingHorizontal: 6,
		paddingVertical: 3,
	},
	composer: {
		minHeight: 58,
		borderRadius: 29,
		borderWidth: StyleSheet.hairlineWidth,
		padding: 6,
		flexDirection: 'row',
		alignItems: 'flex-end',
	},
});
