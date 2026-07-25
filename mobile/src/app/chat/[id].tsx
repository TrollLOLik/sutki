import React, { useState, useEffect, useRef } from 'react';
import {
	View,
	Text,
	FlatList,
	TextInput,
	TouchableOpacity,
	ActivityIndicator,
	Linking,
	StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Directory, File } from 'expo-file-system';
import { useQueryClient, InfiniteData } from '@tanstack/react-query';
import { ImageViewerModal } from '@/components/ui/ImageViewerModal';
import { appAlert as Alert } from '@/components/AppAlert';

import { useSessionStore } from '@/store/session';
import { useChatStore, ChatMessage } from '@/store/chatStore';
import {
	chatKeys,
	useMessages,
	useSendMessage,
	useReadMessages,
	useEditMessage,
	useDeleteMessage,
	useConversations,
	useConversationPresence,
	useChatSuggestions,
	publishTyping,
	replaceMessageInCache,
	type AttachmentInput,
} from '@/lib/api/chat';
import { uploadToS3 } from '@/lib/api/media';
import { useListing } from '@/lib/api/listings';
import { useConfirmBooking, useRejectBooking } from '@/lib/api/bookings';
import { useMyReviewEligibility } from '@/lib/api/reviews';
import { api, ApiError } from '@/lib/api/client';
import { useAppTheme } from '@/theme/useAppTheme';
import { NavigationBackButton } from '@/components/NavigationBackButton';
import { formatRooms } from '@/lib/format';
import { BottomSheet, IconButton, MaterialSurface } from '@/components/ui';
import { BookingStatusCard } from '@/components/chat/BookingStatusCard';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ReplyPreviewBar } from '@/components/chat/ReplyPreviewBar';
import { StagedAttachmentsBar } from '@/components/chat/StagedAttachmentsBar';
import { SuggestionChips } from '@/components/chat/SuggestionChips';
import { VideoPlayerModal } from '@/components/chat/VideoPlayerModal';
import { EditPreviewBar } from '@/components/chat/EditPreviewBar';
import {
	MessageActionsSheet,
	getMessageActions,
} from '@/components/chat/MessageActionsSheet';
import { useChatColors } from '@/components/chat/useChatColors';
import { type ChatAttachment, formatLastSeen } from '@/components/chat/types';
import { useChatUploads, MAX_ATTACHMENTS_PER_MESSAGE } from '@/hooks/useChatUploads';
import { MAX_VIDEO_SECONDS } from '@/lib/video';
import { hapticTapLight, hapticTapMedium, hapticSuccess } from '@/lib/haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, {
	Easing,
	FadeIn,
	FadeInDown,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated';
import { useKeyboardHandler } from 'react-native-keyboard-controller';

export default function ChatDialogScreen() {
	const { palette, isDark } = useAppTheme();
	const chatColors = useChatColors();
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
	const [downloadingAttachmentID, setDownloadingAttachmentID] = useState<number | null>(null);

	// Выбор и загрузка вложений живут в хуке: экрану остаётся только решить,
	// что делать с готовыми метаданными (сейчас — отправить сообщением).
	const {
		uploading,
		staged,
		addStaged,
		removeStaged,
		clearStaged,
		uploadStaged,
		pickImages,
		pickVideo: pickVideoFile,
		takePhoto: takePhotoFromCamera,
		pickDocument: pickDocumentFile,
	} = useChatUploads();
	/**
	 * Локальные обложки видео по id вложения.
	 *
	 * Серверная обложка появляется только после модерации, поэтому первые
	 * несколько секунд показываем снятую на устройстве. Ключ — серверный id
	 * вложения, известный лишь после ответа на отправку.
	 */
	const [localVideoThumbnails, setLocalVideoThumbnails] = useState<Record<number, string>>({});
	const [isOtherTyping, setIsOtherTyping] = useState(false);
	const [isAttachMenuVisible, setIsAttachMenuVisible] = useState(false);
	const keyboardHeight = useSharedValue(0);
	const keyboardIsResizing = useSharedValue(false);

	useKeyboardHandler(
		{
			onStart: (event) => {
				'worklet';

				// Opening and closing stay synchronized with the native IME.
				// Only smooth an in-place height change, such as switching
				// from Gboard's letters to its taller emoji panel.
				keyboardIsResizing.value = keyboardHeight.value > 0 && event.height > 0;
				if (keyboardIsResizing.value) {
					keyboardHeight.value = withTiming(event.height, {
						duration: 120,
						easing: Easing.out(Easing.cubic),
					});
				}
			},
			onMove: (event) => {
				'worklet';

				if (!keyboardIsResizing.value) {
					keyboardHeight.value = event.height;
				}
			},
			onInteractive: (event) => {
				'worklet';

				keyboardIsResizing.value = false;
				keyboardHeight.value = event.height;
			},
			onEnd: (event) => {
				'worklet';

				if (keyboardIsResizing.value) {
					keyboardHeight.value = withTiming(event.height, {
						duration: 80,
						easing: Easing.out(Easing.cubic),
					});
				} else {
					keyboardHeight.value = event.height;
				}
				keyboardIsResizing.value = false;
			},
		},
		[],
	);

	const keyboardStickyStyle = useAnimatedStyle(
		() => ({
			transform: [
				{
					translateY: -Math.max(0, keyboardHeight.value - insets.bottom),
				},
			],
		}),
		[insets.bottom],
	);
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
	const { mutateAsync: performEditMessage, isPending: isSavingEdit } = useEditMessage(convID);
	const { mutate: performDeleteMessage } = useDeleteMessage(convID);

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
	// Плеер открывается только по тапу на обложку: в ленте видео живёт статичной
	// картинкой, иначе несколько декодеров на экране рвут скролл.
	const [playingVideoUri, setPlayingVideoUri] = useState<string | null>(null);

	const chatImages = React.useMemo(() => {
		const list: string[] = [];
		for (let i = messages.length - 1; i >= 0; i--) {
			// Удалённое сообщение пропускаем: его файлы уже убраны из хранилища,
			// и попав в этот список они сдвинули бы индексы просмотрщика.
			if (messages[i].deleted_at) continue;
			messages[i].attachments?.forEach((att) => {
				// Видео сюда не идёт — у него свой плеер. Непроверенное фото тоже:
				// оно ещё может быть отклонено, а его присутствие в списке сдвинуло
				// бы индексы уже одобренных снимков.
				if (att.mime_type.startsWith('image/') && att.moderation_status !== 'pending') {
					list.push(att.url);
				}
			});
		}
		return list;
	}, [messages]);

	// Ответ на сообщение: хранится целиком, а не только id — блок над полем
	// ввода показывает текст и миниатюру, а они уже есть в ленте.
	const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
	// Подсветка после перехода к оригиналу: короткая вспышка, чтобы глаз нашёл
	// сообщение в ленте.
	const [highlightedMessageID, setHighlightedMessageID] = useState<number | null>(null);
	const listRef = useRef<FlatList<ChatMessage>>(null);
	const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	/**
	 * Всегда указывает на актуальный handleSend.
	 *
	 * Отправка по долгому нажатию на подсказку сначала пишет текст в состояние, а
	 * отправляет следующим тиком — к этому моменту handleSend уже пересоздан, и
	 * замыкание на старую версию отправило бы пустое сообщение.
	 */
	const sendRef = useRef<(() => void) | null>(null);

	// Панель действий по долгому нажатию и режим правки.
	const [actionsTarget, setActionsTarget] = useState<ChatMessage | null>(null);
	const [editing, setEditing] = useState<ChatMessage | null>(null);

	const startReply = React.useCallback((message: ChatMessage) => {
		// Ответ и правка — взаимоисключающие состояния композера: в правке поле
		// содержит старый текст, и добавлять к нему цитату бессмысленно.
		setEditing(null);
		setReplyTo(message);
		hapticTapLight();
	}, []);

	const cancelReply = React.useCallback(() => setReplyTo(null), []);

	/**
	 * Имя автора для шапки цитаты.
	 *
	 * В беседе всего два участника, поэтому достаточно различить «я» и
	 * собеседник — отдельный запрос профиля не нужен. sender_id === null бывает
	 * у системных карточек брони.
	 */
	const resolveAuthorName = React.useCallback(
		(senderID?: number | null) => {
			if (senderID == null) return 'Бронирование';
			if (senderID === sessionUser?.id) return 'Вы';
			return activeConv?.other_user_name?.trim() || 'Собеседник';
		},
		[activeConv?.other_user_name, sessionUser?.id],
	);

	/**
	 * Переход к процитированному сообщению.
	 *
	 * Оригинал может лежать за пределами загруженных страниц: история тянется
	 * по 20 сообщений, а цитата ссылается куда угодно. Если сообщения нет в
	 * ленте — подгружаем следующую страницу и говорим об этом, вместо того
	 * чтобы молча ничего не делать.
	 */
	const scrollToMessage = React.useCallback(
		(messageID: number) => {
			const index = messages.findIndex((m) => m.id === messageID);
			if (index < 0) {
				if (hasNextPage && !isFetchingNextPage) {
					fetchNextPage();
					Alert.alert('Загружаем историю', 'Сообщение выше — подгружаем и попробуйте ещё раз.');
				} else {
					Alert.alert('Сообщение недоступно', 'Не удалось найти исходное сообщение в переписке.');
				}
				return;
			}

			listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
			setHighlightedMessageID(messageID);
			if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
			highlightTimerRef.current = setTimeout(() => setHighlightedMessageID(null), 1200);
		},
		[fetchNextPage, hasNextPage, isFetchingNextPage, messages],
	);

	useEffect(
		() => () => {
			if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
		},
		[],
	);

	// --- Действия с сообщением -------------------------------------------

	const openActions = React.useCallback((message: ChatMessage) => {
		setActionsTarget(message);
		hapticTapMedium();
	}, []);

	const closeActions = React.useCallback(() => setActionsTarget(null), []);

	const actionsAvailability = React.useMemo(
		() =>
			actionsTarget
				? getMessageActions(actionsTarget, sessionUser?.id, activeConv?.other_last_read_message_id)
				: { canReply: false, canCopy: false, canEdit: false, canDelete: false },
		[actionsTarget, activeConv?.other_last_read_message_id, sessionUser?.id],
	);

	const handleActionReply = React.useCallback(
		(message: ChatMessage) => {
			closeActions();
			startReply(message);
		},
		[closeActions, startReply],
	);

	const handleActionCopy = React.useCallback(
		async (message: ChatMessage) => {
			closeActions();
			if (!message.body) return;
			await Clipboard.setStringAsync(message.body);
			hapticSuccess();
		},
		[closeActions],
	);

	const startEditing = React.useCallback(
		(message: ChatMessage) => {
			closeActions();
			// Правка и ответ не сочетаются: поле уже занято старым текстом.
			setReplyTo(null);
			setEditing(message);
			setInputText(message.body ?? '');
		},
		[closeActions],
	);

	const cancelEditing = React.useCallback(() => {
		setEditing(null);
		setInputText('');
	}, []);

	const handleActionDelete = React.useCallback(
		(message: ChatMessage) => {
			closeActions();
			Alert.alert('Удалить сообщение?', 'Оно исчезнет и у собеседника.', [
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Удалить',
					style: 'destructive',
					onPress: () => {
						// Если удаляем то, что правим или цитируем, — сбрасываем
						// композер: и то и другое ссылается на исчезающий текст.
						setEditing((current) => (current?.id === message.id ? null : current));
						setReplyTo((current) => (current?.id === message.id ? null : current));
						performDeleteMessage(message.id, {
							onError: (err) => {
								console.error('[Chat] Failed to delete message:', err);
								Alert.alert(
									'Не удалось удалить',
									err instanceof ApiError
										? err.message
										: 'Попробуйте ещё раз.',
								);
							},
						});
					},
				},
			]);
		},
		[closeActions, performDeleteMessage],
	);

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
				/** Причина отказа модерации — показывается отправителю. */
				reason?: string;
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
				return;
			}

			// Правка и удаление приходят одним и тем же способом: сервер
			// присылает сообщение целиком, клиент подменяет запись в кэше. Так
			// удалённое сообщение превращается в плашку, а исправленное меняет
			// текст и получает метку «ред.» — без перезагрузки истории.
			if (
				(payload.type === 'message.edited' || payload.type === 'message.deleted') &&
				payload.message
			) {
				const updated = payload.message;
				replaceMessageInCache(queryClient, convID, updated);

				// Композер не должен ссылаться на исчезнувшее сообщение: цитата
				// становится недействительной, а сохранение правки упрётся в отказ
				// сервера. Панель действий для него тоже закрываем.
				if (payload.type === 'message.deleted') {
					setReplyTo((current) => (current?.id === updated.id ? null : current));
					setEditing((current) => {
						if (current?.id !== updated.id) return current;
						setInputText('');
						return null;
					});
					setActionsTarget((current) => (current?.id === updated.id ? null : current));
				}

				// Сообщение могли изменить с другого устройства, пока оно открыто
				// на правку здесь. Обновляем цель, чтобы полоса показывала актуальный
				// исходный текст.
				if (payload.type === 'message.edited') {
					setEditing((current) => (current?.id === updated.id ? { ...current, ...updated } : current));
				}
				return;
			}

			// Вложение не прошло модерацию. Приходит только отправителю (получатель
			// его и не видел), поэтому здесь достаточно обновить своё сообщение и
			// сказать, почему файл исчез.
			if (payload.type === 'attachment.rejected') {
				if (payload.reason) {
					Alert.alert('Вложение не отправлено', payload.reason);
				}
				// Перезапрашиваем историю: сервер уже удалил вложение, и подменять
				// сообщение вручную здесь пришлось бы дублированием его логики.
				refetch();
				return;
			}

			// Соседнее устройство или получатель: у сообщения убрали вложение.
			// Обновляем ленту, чтобы пузырь не показывал то, чего уже нет.
			if (payload.type === 'message.attachment_rejected') {
				refetch();
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

	/**
	 * Отправка сообщения: текст, альбом вложений или и то и другое.
	 *
	 * Раньше это были два независимых пути — текст уходил отсюда, а файл
	 * отправлялся отдельным сообщением сразу после выбора в галерее. Теперь путь
	 * один, поэтому подпись к фото это просто body того же сообщения: отдельное
	 * поле в схеме не понадобилось.
	 */
	const handleSend = async () => {
		const text = inputText.trim();
		const hasAttachments = staged.length > 0;
		if (!text && !hasAttachments) return;

		stopOwnTyping();

		// В режиме правки та же кнопка сохраняет изменения, а не отправляет новое
		// сообщение. Отдельная кнопка «сохранить» рядом с «отправить» приводила бы
		// к отправке правки новым сообщением по привычке.
		if (editing) {
			const target = editing;
			// Текст не изменился — молча выходим из режима, не тратя запрос.
			if (text === (target.body ?? '').trim()) {
				cancelEditing();
				return;
			}
			try {
				await performEditMessage({ messageID: target.id, body: text });
				cancelEditing();
				hapticSuccess();
			} catch (err) {
				console.error('[Chat] Failed to edit message:', err);
				// Текст остаётся в поле: сервер мог отказать из-за прочтения или
				// истёкшего окна, и терять набранное из-за этого нельзя.
				Alert.alert(
					'Не удалось изменить',
					err instanceof ApiError ? err.message : 'Попробуйте ещё раз.',
				);
			}
			return;
		}

		// Снимки состояния: поля сбрасываются сразу, а отправка асинхронная,
		// поэтому к моменту запроса состояние может уже смениться.
		const replyTarget = replyTo;
		const stagedSnapshot = staged;

		// Вложения сначала загружаем и только потом чистим композер: при сбое
		// пачка должна остаться на месте, чтобы её можно было отправить снова.
		let attachments: AttachmentInput[] = [];
		if (hasAttachments) {
			const uploaded = await uploadStaged();
			if (!uploaded) return; // сообщение об ошибке показал сам хук
			attachments = uploaded;
		}

		setInputText('');
		setReplyTo(null);
		clearStaged();

		// Оптимистичное сообщение: показываем локальные превью до ответа сервера,
		// иначе альбом появлялся бы в ленте только после загрузки всех файлов.
		const tempId = -Date.now();
		const optimisticMsg: ChatMessage = {
			id: tempId,
			conversation_id: convID,
			sender_id: sessionUser?.id ?? 0,
			body: text || undefined,
			created_at: new Date().toISOString(),
			pending: true,
			...(hasAttachments
				? {
						attachments: stagedSnapshot.map((file, index) => ({
							// Отрицательные id не пересекаются с серверными и служат
							// только ключами списка до подмены реальным сообщением.
							id: -(index + 1),
							message_id: tempId,
							url: file.uri,
							file_name: file.fileName,
							mime_type: file.mimeType,
							size_bytes: file.size,
							width: file.width,
							height: file.height,
							duration_seconds: file.durationSeconds,
							// Локальный путь: до ответа сервера это единственная обложка.
							thumbnail_url: file.thumbnailUri,
							// Медиа уходит на асинхронную проверку, поэтому сразу
							// показываем «Проверяется», а не кнопку Play: файл ещё не
							// одобрен, и тап по нему был бы обманом. Документы
							// проверять нечего — они одобрены сразу.
							moderation_status: file.mimeType.startsWith('image/') || file.mimeType.startsWith('video/')
								? ('pending' as const)
								: ('approved' as const),
						})),
					}
				: {}),
			// Цитату собираем локально из уже загруженного сообщения: сервер
			// пришлёт свою версию в ответе, но пузырь должен показать её сразу.
			...(replyTarget
				? {
						reply_to_message_id: replyTarget.id,
						reply_to: {
							id: replyTarget.id,
							sender_id: replyTarget.sender_id,
							kind: replyTarget.kind ?? 'user',
							body_preview: (replyTarget.body ?? '').slice(0, 120),
							attachment_count: replyTarget.attachments?.length ?? 0,
							first_attachment_url: replyTarget.attachments?.find((a) =>
								a.mime_type.startsWith('image/'),
							)?.url,
							deleted: false,
						},
					}
				: {}),
		};

		// Push optimistic message to cache
		queryClient.setQueryData<InfiniteData<ChatMessage[]>>(chatKeys.messages(convID), (old) => {
			if (!old) return old;
			const newPages = [...old.pages];
			newPages[0] = [optimisticMsg, ...newPages[0]];
			return { ...old, pages: newPages };
		});

		try {
			const saved = await performSendMessage({
				body: text || undefined,
				reply_to_message_id: replyTarget?.id,
				attachments: hasAttachments ? attachments : undefined,
			});

			// Перевешиваем локальные обложки видео с временных ключей на серверные
			// id: сервер сгенерирует свою обложку только после модерации, а до тех
			// пор в пузыре надо что-то показывать. Сопоставляем по порядку — он
			// сохранён, потому что загрузка пишет результаты по индексу.
			if (hasAttachments && saved.attachments?.length) {
				const thumbs: Record<number, string> = {};
				saved.attachments.forEach((att, index) => {
					const local = stagedSnapshot[index];
					if (local?.thumbnailUri && att.mime_type.startsWith('video/')) {
						thumbs[att.id] = local.thumbnailUri;
					}
				});
				if (Object.keys(thumbs).length > 0) {
					setLocalVideoThumbnails((current) => ({ ...current, ...thumbs }));
				}
			}

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

			// Модерация могла отклонить всю пачку целиком. Возвращаем файлы в
			// композер, чтобы выбор пользователя не пропал вместе с ошибкой.
			if (hasAttachments) {
				Alert.alert(
					'Сообщение не отправлено',
					err instanceof ApiError
						? err.message
						: 'Не удалось отправить вложения. Попробуйте ещё раз.',
				);
			}
		}
	};

	// Держим ref в синхроне на каждом рендере: отложенная отправка по долгому
	// нажатию на подсказку должна вызвать актуальную версию, а не замыкание.
	sendRef.current = handleSend;

	const handlePickMedia = () => {
		setIsAttachMenuVisible(true);
	};

	// Выбранные файлы попадают в стадию подготовки, а не улетают сразу: только
	// так к ним можно добавить подпись и собрать из них альбом. Отправка — по
	// кнопке в композере, общая с текстом.

	const remainingSlots = MAX_ATTACHMENTS_PER_MESSAGE - staged.length;

	const pickImage = async () => {
		if (remainingSlots <= 0) return;
		addStaged(await pickImages(remainingSlots));
	};

	const pickVideo = async () => {
		if (remainingSlots <= 0) return;
		// Сжатие занимает секунды, поэтому меню закрывается сразу, а прогресс
		// показывается в полосе вложений.
		addStaged(await pickVideoFile());
	};

	const takePhoto = async () => {
		if (remainingSlots <= 0) return;
		addStaged(await takePhotoFromCamera());
	};

	const pickDocument = async () => {
		if (remainingSlots <= 0) return;
		addStaged(await pickDocumentFile());
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

	const openVideoPlayer = React.useCallback((attachment: ChatAttachment) => {
		setPlayingVideoUri(attachment.url);
	}, []);

	const openImageViewer = React.useCallback(
		(attachment: ChatAttachment) => {
			const index = chatImages.indexOf(attachment.url);
			if (index >= 0) {
				setSelectedImageIndex(index);
				setGalleryVisible(true);
			}
		},
		[chatImages],
	);

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

		return (
			<MessageBubble
				message={item}
				isMine={isMe}
				otherLastReadMessageID={activeConv?.other_last_read_message_id}
				downloadingAttachmentID={downloadingAttachmentID}
				onImagePress={openImageViewer}
				onDocumentPress={downloadAttachment}
				onVideoPress={openVideoPlayer}
				localThumbnails={localVideoThumbnails}
				quoteAuthorName={resolveAuthorName}
				onReply={startReply}
				onQuotePress={scrollToMessage}
				onLongPress={openActions}
				highlighted={highlightedMessageID === item.id}
			/>
		);
	};

	const isInputEmpty = !inputText.trim();
	// Отправлять можно и одни вложения без подписи, поэтому кнопка смотрит на
	// оба источника. В режиме правки вложения не при чём — правится только текст,
	// и пустым его оставлять нельзя (сервер вернёт ErrEmptyMessage).
	const canSend = editing
		? !isInputEmpty && !isSavingEdit
		: (!isInputEmpty || staged.length > 0) && !uploading;
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

	// Fresh dialog = fewer than 3 human messages so far. Once the parties are
	// clearly talking, the safety notice retires on its own.
	const userMessageCount = messages.filter((m) => !m.kind || m.kind === 'user').length;
	const showSafetyNotice = !isLoading && !safetyNoticeDismissed && !isDeletedUser && userMessageCount < 3;

	/**
	 * Подсказки ответа.
	 *
	 * Показываем обеим сторонам (раньше — только владельцу) и только в беседе по
	 * объявлению: в общем диалоге нет контекста брони, и советовать там нечего.
	 *
	 * Условия показа держим узкими, потому что каждый запрос может стоить вызова
	 * модели: поле ввода пусто, вложения не выбраны, режим правки не активен,
	 * собеседник существует. Ограничения «первые N сообщений» тут нет — подсказки
	 * полезны и в середине переписки, где как раз надо ответить на вопрос.
	 */
	const suggestionsEnabled =
		!isLoading &&
		!isDeletedUser &&
		!editing &&
		isInputEmpty &&
		staged.length === 0 &&
		!!activeConv?.house_id;

	// Ключ запроса привязан к последнему сообщению: пришло новое — подсказки
	// перегенерируются под него.
	const lastMessageID = messages.length > 0 ? messages[0].id : 0;
	const { data: suggestionsData, isLoading: suggestionsLoading } = useChatSuggestions(
		convID,
		lastMessageID,
		suggestionsEnabled,
	);
	const showSuggestions = suggestionsEnabled && (suggestionsLoading || !!suggestionsData?.suggestions.length);

	// Долгое нажатие по чипу — отправить сразу, без правки.
	const handleSuggestionSendNow = React.useCallback(
		(text: string) => {
			hapticTapMedium();
			setInputText(text);
			// Отправку запускаем следующим тиком: handleSend читает inputText из
			// состояния, а оно обновится только после ре-рендера.
			setTimeout(() => {
				sendRef.current?.();
			}, 0);
		},
		[],
	);

	return (
		<View style={{ flex: 1, backgroundColor: chatColors.background }}>
			<Stack.Screen options={{ headerShown: false }} />

			<View style={{ flex: 1 }}>

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
					ref={listRef}
					data={messages}
					keyExtractor={(item) => String(item.id)}
					// Высоты сообщений разные, поэтому FlatList не всегда может
					// сразу доскроллить к индексу. Без этого обработчика переход
					// к цитате роняет список исключением.
					onScrollToIndexFailed={({ index, averageItemLength }) => {
						listRef.current?.scrollToOffset({
							offset: index * Math.max(averageItemLength, 1),
							animated: true,
						});
					}}
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


				<Animated.View style={keyboardStickyStyle}>
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
					<StagedAttachmentsBar
						files={editing ? [] : staged}
						uploading={uploading}
						onRemove={removeStaged}
						onAddMore={handlePickMedia}
						canAddMore={staged.length < MAX_ATTACHMENTS_PER_MESSAGE}
					/>

					{editing ? (
						<EditPreviewBar message={editing} onCancel={cancelEditing} />
					) : replyTo ? (
						<ReplyPreviewBar
							message={replyTo}
							authorName={resolveAuthorName(replyTo.sender_id)}
							onCancel={cancelReply}
						/>
					) : null}

					{showSuggestions ? (
						<SuggestionChips
							suggestions={suggestionsData?.suggestions ?? []}
							generated={suggestionsData?.generated ?? false}
							loading={suggestionsLoading}
							onPick={handleInputChange}
							onSendNow={handleSuggestionSendNow}
						/>
					) : null}
					<View style={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 12 }} className="px-3 py-2.5">
						<MaterialSurface level="base" radius={29} style={styles.composer}>
						{/* Add Attachment Button */}
						<TouchableOpacity
							onPress={handlePickMedia}
							disabled={uploading || !!editing}
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
								placeholder={staged.length > 0 ? 'Добавьте подпись...' : 'Сообщение...'}
								placeholderTextColor={palette.inkMuted}
								value={inputText}
								onChangeText={handleInputChange}
								onBlur={stopOwnTyping}
								className="flex-1 pl-4 pr-1 py-2.5 text-ink max-h-24 text-[15px]"
								multiline
							/>
						</View>

						{/* Send Button. В режиме правки — галочка: та же кнопка
						    сохраняет изменения, и иконка должна об этом говорить. */}
						<IconButton
							icon={editing ? 'checkmark' : 'arrow-up'}
							iconSize={20}
							size={44}
							tone={canSend ? 'primary' : 'neutral'}
							filled={canSend}
							onPress={handleSend}
							disabled={!canSend}
							accessibilityLabel={editing ? 'Сохранить изменения' : 'Отправить сообщение'}
							style={{ marginLeft: 8 }}
						/>
						</MaterialSurface>
					</View>
					</Animated.View>
				)}
				</Animated.View>
			</View>

			{/* Attachments bottom sheet */}
			<BottomSheet visible={isAttachMenuVisible} onClose={() => setIsAttachMenuVisible(false)}>
				<View className="pt-1 pb-2">
					<View className="mb-4 flex-row items-center justify-between">
						<View className="min-w-0 flex-1">
							<Text className="text-xl font-extrabold text-ink">Добавить в сообщение</Text>
							<Text className="mt-1 text-sm text-ink-secondary">Выберите тип вложения</Text>
						</View>
						<IconButton
							icon="close"
							size={40}
							iconSize={20}
							onPress={() => setIsAttachMenuVisible(false)}
							accessibilityLabel="Закрыть вложения"
						/>
					</View>
					<View className="overflow-hidden rounded-[22px] border border-line bg-surface-muted">
						{[
							{ icon: 'camera-outline' as const, title: 'Камера', subtitle: 'Сделать снимок сейчас', action: takePhoto },
							{ icon: 'image-outline' as const, title: 'Фото', subtitle: 'Выбрать из галереи', action: pickImage },
						{ icon: 'videocam-outline' as const, title: 'Видео', subtitle: `До ${MAX_VIDEO_SECONDS} секунд, сжимается автоматически`, action: pickVideo },
							{ icon: 'document-text-outline' as const, title: 'Документ', subtitle: 'PDF, DOC, XLS и другие файлы', action: pickDocument },
						].map((item, index) => (
							<TouchableOpacity
								key={item.title}
								onPress={() => {
									setIsAttachMenuVisible(false);
									setTimeout(item.action, 220);
								}}
								activeOpacity={0.72}
								className={`flex-row items-center px-4 py-4 ${index > 0 ? 'border-t border-line' : ''}`}>
								<View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary-light">
									<Ionicons name={item.icon} size={21} color={palette.primary} />
								</View>
								<View className="ml-3 flex-1">
									<Text className="text-[15px] font-extrabold text-ink">{item.title}</Text>
									<Text className="mt-0.5 text-sm text-ink-secondary">{item.subtitle}</Text>
								</View>
								<Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
							</TouchableOpacity>
						))}
					</View>
				</View>
			</BottomSheet>

			<MessageActionsSheet
				message={actionsTarget}
				actions={actionsAvailability}
				onClose={closeActions}
				onReply={handleActionReply}
				onCopy={handleActionCopy}
				onEdit={startEditing}
				onDelete={handleActionDelete}
			/>

			<VideoPlayerModal uri={playingVideoUri} onClose={() => setPlayingVideoUri(null)} />

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
	composer: {
		minHeight: 58,
		borderRadius: 29,
		borderWidth: StyleSheet.hairlineWidth,
		padding: 6,
		flexDirection: 'row',
		alignItems: 'flex-end',
	},
});
