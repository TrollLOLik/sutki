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
	Alert,
	Keyboard,
	LayoutAnimation,
	UIManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useQueryClient, InfiniteData } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ImageViewerModal } from '@/components/ui/ImageViewerModal';

import { useSessionStore } from '@/store/session';
import { useChatStore, ChatMessage } from '@/store/chatStore';
import {
	chatKeys,
	useMessages,
	useSendMessage,
	useReadMessages,
	presignUpload,
	useConversations,
} from '@/lib/api/chat';
import { uploadToS3 } from '@/lib/api/media';
import { useListing } from '@/lib/api/listings';
import { api } from '@/lib/api/client';
import { useAppTheme } from '@/theme/useAppTheme';
import { formatRooms } from '@/lib/format';
import { Button, BottomSheet } from '@/components/ui';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ChatDialogScreen() {
  const { palette } = useAppTheme();
	const router = useRouter();
	const params = useLocalSearchParams<{ id: string; title?: string; otherUserId?: string; houseId?: string }>();
	const convID = parseInt(params.id ?? '0', 10);
	const otherUserTitle = params.title ?? 'Чат';

	const insets = useSafeAreaInsets();
	const queryClient = useQueryClient();

	const sessionUser = useSessionStore((state) => state.user);
	const centrifuge = useChatStore((state) => state.centrifuge);
	const socketStatus = useChatStore((state) => state.status);
	const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);

	const [inputText, setInputText] = useState('');
	const [uploading, setUploading] = useState(false);
	const [isAttachMenuVisible, setIsAttachMenuVisible] = useState(false);

	const {
		data,
		isLoading,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		refetch,
	} = useMessages(convID);

	// Load listing context if available
	const { data: conversations } = useConversations();
	const activeConv = conversations?.find((c) => c.conversation_id === convID);
	const houseID = activeConv?.house_id || (params.houseId ? parseInt(params.houseId, 10) : undefined);
	const { data: listing } = useListing(houseID);

	const { mutateAsync: performSendMessage } = useSendMessage(convID);
	const { mutate: performReadMessages } = useReadMessages(convID);

	const messages = data?.pages.flat().filter(Boolean) ?? [];

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

	// Mark active conversation on mount/unmount
	useEffect(() => {
		setActiveConversationId(convID);
		return () => setActiveConversationId(null);
	}, [convID]);

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
			const payload = ctx.data as { type: string; message?: ChatMessage; user_id?: number; message_id?: number };
			console.log('[Chat] Event on channel:', channel, payload);

			if (payload.type === 'message.new' && payload.message) {
				const newMsg = payload.message;

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
			sub.unsubscribe();
			centrifuge.removeSubscription(sub);
		};
	}, [centrifuge, socketStatus, convID]);

	const handleSend = async () => {
		const text = inputText.trim();
		if (!text) return;

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
			type: '*/*',
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
			Alert.alert('Ошибка загрузки', 'Не удалось загрузить и отправить файл. Попробуйте еще раз.');
		} finally {
			setUploading(false);
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
		const isMe = item.sender_id === sessionUser?.id;
		const isPending = item.pending;
		const isFailed = item.failed;

		return (
			<View className={`flex-row my-1 px-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
				<View
					className={`max-w-[78%] rounded-[18px] px-3.5 py-2.5 ${
						isMe ? 'bg-primary rounded-tr-[4px]' : 'bg-surfaceMuted border border-line/30 rounded-tl-[4px]'
					}`}
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
									className="mb-1.5 rounded-xl overflow-hidden bg-surfaceMuted border border-line/20"
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
							<View key={att.id} className={`flex-row items-center p-2.5 rounded-xl mb-1.5 w-[220px] ${isMe ? 'bg-white/10' : 'bg-background/40'}`}>
								<Ionicons name="document-text" size={24} color={isMe ? '#fff' : palette.primary} />
								<View className="ml-2.5 flex-1">
									<Text numberOfLines={1} className={`text-xs ${isMe ? 'text-white' : 'text-ink'} font-semibold`}>
										{att.file_name}
									</Text>
									<Text className={`text-[10px] ${isMe ? 'text-white/70' : 'text-inkMuted'} mt-0.5`}>
										{(att.size_bytes / 1024).toFixed(1)} КБ
									</Text>
								</View>
							</View>
						);
					})}

					{/* Render text body */}
					{item.body ? (
						<Text className={`text-[15px] leading-[20px] ${isMe ? 'text-white' : 'text-ink'}`}>
							{item.body}
						</Text>
					) : null}

					{/* Time & Sent Status Info */}
					<View className="flex-row justify-end items-center mt-1 self-end">
						<Text className={`text-[10px] ${isMe ? 'text-white/75' : 'text-inkMuted'} mr-1`}>
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

	const initials = (otherUserTitle[0] || '?').toUpperCase();
	const isInputEmpty = !inputText.trim();
	const isDeletedUser = !!activeConv?.other_user_deleted;

	return (
		<View style={{ flex: 1, backgroundColor: palette.surface }}>
			<Stack.Screen options={{ headerShown: false }} />

			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				style={{ flex: 1 }}
				keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
			>

			{/* Custom Gorgeous Header */}
			<View style={{ paddingTop: insets.top }} className="flex-row items-center px-4 py-3 bg-surface border-b border-line/45 justify-between">
				<View className="flex-row items-center flex-1">
					<Pressable
						onPress={() => router.back()}
						accessibilityLabel="Назад"
						style={{
							width: 40,
							height: 40,
							alignItems: 'center',
							justifyContent: 'center',
							borderRadius: 20,
							backgroundColor: palette.surfaceMuted,
						}}
						className="mr-3 active:opacity-80"
					>
						<Ionicons name="chevron-back" size={22} color={palette.ink} />
					</Pressable>

					{activeConv?.other_user_avatar_url && !isDeletedUser ? (
						<Image
							source={{ uri: activeConv.other_user_avatar_url }}
							className="w-10 h-10 rounded-full bg-surfaceMuted"
							contentFit="cover"
						/>
					) : (
						<View className="w-10 h-10 rounded-full bg-surfaceMuted items-center justify-center">
							<Ionicons name="person-outline" size={18} color={palette.inkMuted} />
						</View>
					)}

					<View className="ml-3 flex-1">
						<Text numberOfLines={1} className="font-bold text-[16px] text-ink">
							{isDeletedUser ? 'Удаленный профиль' : otherUserTitle}
						</Text>
						<Text className={`text-[11px] mt-0.5 font-medium ${isDeletedUser ? 'text-inkMuted' : 'text-primary'}`}>
							{isDeletedUser ? 'Профиль удален' : (socketStatus === 'connected' ? 'В сети' : 'Был недавно')}
						</Text>
					</View>
				</View>

				<View className="flex-row items-center">
					{!isDeletedUser && (
						socketStatus === 'connecting' ? (
							<ActivityIndicator size="small" color={palette.primary} className="mr-2" />
						) : socketStatus === 'disconnected' ? (
							<Ionicons name="cloud-offline-outline" size={20} color="#EF4444" className="mr-2" />
						) : (
							<View className="w-2.5 h-2.5 rounded-full bg-primary mr-2" />
						)
					)}
				</View>
			</View>

			{/* Sticky Listing Context Header */}
			{listing && (
				<View className="flex-row items-center px-4 py-2.5 bg-surface border-b border-line/40 justify-between">
					<View className="flex-row items-center flex-1 mr-3">
						<Image
							source={{ uri: listing.cover_url }}
							className="w-12 h-12 rounded-lg bg-surfaceMuted"
							contentFit="cover"
						/>
						<View className="ml-3 flex-1 justify-center">
							<Text numberOfLines={1} className="text-[14px] font-bold text-ink">
								{`${formatRooms(listing.rooms)}, ${listing.address}`}
							</Text>
							<Text className="text-xs text-primary font-bold mt-0.5">
								{listing.price.toLocaleString('ru-RU')} ₽ / сутки
							</Text>
						</View>
					</View>
					<TouchableOpacity
						onPress={() => router.push(`/listing/${listing.id}` as any)}
						activeOpacity={0.7}
						className="bg-primaryLight px-4 py-1.5 rounded-full active:bg-primaryLight/80"
					>
						<Text className="text-primary font-bold text-xs">Подробнее</Text>
					</TouchableOpacity>
				</View>
			)}

			{isLoading ? (
				<View className="flex-1 justify-center items-center bg-surface">
					<ActivityIndicator size="large" color={palette.primary} />
				</View>
			) : messages.length === 0 ? (
				/* Perfectly Centered Welcome Empty State */
				<View className="flex-1 justify-center items-center px-8 bg-surface">
					<View className="w-22 h-22 rounded-full bg-primary/10 items-center justify-center mb-6">
						<Ionicons name="chatbubbles" size={44} color={palette.primary} />
					</View>
					<Text className="text-xl font-bold text-ink text-center mb-2">
						Начните общение с хозяином
					</Text>
					<Text className="text-sm text-inkSecondary text-center leading-6 max-w-[300px]">
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
					contentContainerStyle={{ paddingVertical: 12 }}
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
									<Text className="mt-1 text-sm leading-5 text-inkSecondary">
										Вы не можете писать этому пользователю, так как его профиль удален.
									</Text>
								</View>
							</View>
						</View>
					</View>
				) : (
					<View style={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 12 }} className="flex-row items-center px-4 py-3 border-t border-line/30 bg-surface shadow-sm">
						{/* Add Attachment Button */}
						<TouchableOpacity
							onPress={handlePickMedia}
							disabled={uploading}
							className="w-10 h-10 rounded-full bg-surfaceMuted items-center justify-center mr-2 active:bg-line/40"
							activeOpacity={0.7}
						>
							{uploading ? (
								<ActivityIndicator size="small" color={palette.primary} />
							) : (
								<Ionicons name="attach-outline" size={22} color={palette.inkSecondary} />
							)}
						</TouchableOpacity>

						{/* Text Input */}
						<TextInput
							placeholder="Сообщение..."
							value={inputText}
							onChangeText={setInputText}
							className="flex-1 bg-surfaceMuted px-5 py-2.5 rounded-2xl text-ink max-h-24 text-[15px]"
							multiline
						/>

						{/* Send Button */}
						<TouchableOpacity
							onPress={handleSend}
							disabled={isInputEmpty}
							style={{
								backgroundColor: isInputEmpty ? palette.surfaceMuted : palette.primary,
							}}
							className="w-10 h-10 rounded-full items-center justify-center ml-2"
							activeOpacity={0.7}
						>
							<Ionicons
								name="arrow-up"
								size={20}
								color={isInputEmpty ? palette.inkMuted : '#fff'}
							/>
						</TouchableOpacity>
					</View>
				)}
			</KeyboardAvoidingView>

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
							<Text className="text-xs text-inkSecondary mt-0.5">Сделать снимок сейчас</Text>
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
							<Text className="text-xs text-inkSecondary mt-0.5">Выбрать из галереи устройства</Text>
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
							<Text className="text-xs text-inkSecondary mt-0.5">Файл любого формата</Text>
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
