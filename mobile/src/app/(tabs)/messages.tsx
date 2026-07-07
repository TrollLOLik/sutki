import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { differenceInDays, format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';

import { useSessionStore } from '@/store/session';
import { useConversations, ConversationSummary } from '@/lib/api/chat';
import { requireAuth } from '@/lib/requireAuth';
import { useAppTheme } from '@/theme/useAppTheme';
import { Button } from '@/components/ui';
import { formatRooms } from '@/lib/format';

export default function MessagesScreen() {
  const { palette } = useAppTheme();
	const router = useRouter();
	const status = useSessionStore((state) => state.status);
	const sessionUser = useSessionStore((state) => state.user);
	const { data: conversations, isLoading, refetch, isFetching } = useConversations();
	const [searchQuery, setSearchQuery] = useState('');

	const handleConversationPress = (conv: ConversationSummary) => {
		router.push({
			pathname: `/chat/${conv.conversation_id}` as any,
			params: {
				title: `${conv.other_user_name} ${conv.other_user_surname}`.trim(),
				otherUserId: conv.other_user_id,
				houseId: conv.house_id ? String(conv.house_id) : undefined,
			},
		});
	};

	const formatRelativeTime = (timeStr: string) => {
		try {
			const date = new Date(timeStr);
			if (isToday(date)) {
				return format(date, 'HH:mm');
			}
			if (isYesterday(date)) {
				return 'Вчера';
			}
			if (differenceInDays(new Date(), date) < 7) {
				return format(date, 'EEEE', { locale: ru });
			}
			return format(date, 'd MMM', { locale: ru });
		} catch {
			return '';
		}
	};

	if (status === 'loading') {
		return (
			<SafeAreaView edges={['top']} className="flex-1 bg-surface justify-center items-center">
				<ActivityIndicator size="large" color={palette.primary} />
			</SafeAreaView>
		);
	}

	if (status !== 'authenticated') {
		return (
			<SafeAreaView edges={['top']} className="flex-1 bg-surface justify-center items-center px-8">
				<View className="items-center mb-6">
					<View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary/10">
						<Ionicons name="chatbubbles-outline" size={40} color={palette.primary} />
					</View>
					<Text className="text-center text-xl font-bold text-ink mb-2">Сообщения</Text>
					<Text className="text-center text-base text-ink-secondary px-4 leading-6">
						Войдите в аккаунт, чтобы вести переписку с хозяевами квартир и обсуждать детали бронирования.
					</Text>
				</View>
				<Button
					label="Войти в профиль"
					onPress={() => requireAuth('generic')}
					className="w-56 mt-4"
				/>
			</SafeAreaView>
		);
	}

	if (isLoading) {
		return (
			<SafeAreaView edges={['top']} className="flex-1 bg-surface justify-center items-center">
				<ActivityIndicator size="large" color={palette.primary} />
			</SafeAreaView>
		);
	}

	// Filter conversations by search query
	const filteredConversations = conversations?.filter((c) => {
		const fullName = `${c.other_user_name} ${c.other_user_surname}`.toLowerCase();
		const body = c.last_message_body.toLowerCase();
		const query = searchQuery.toLowerCase();
		return fullName.includes(query) || body.includes(query);
	}) ?? [];

	const renderItem = ({ item, index }: { item: ConversationSummary; index: number }) => {
		const initials = ((item.other_user_name?.[0] ?? '') + (item.other_user_surname?.[0] ?? '')).toUpperCase();
		const hasUnread = item.unread_count > 0;
		const hasPreview = !!item.last_message_body;
		const isLast = index === filteredConversations.length - 1;

		const isLastMessageByMe = item.last_message_sender_id === sessionUser?.id;
		const isLastMessageRead =
			item.other_last_read_message_id &&
			item.last_message_id &&
			item.last_message_id <= item.other_last_read_message_id;

		return (
			<TouchableOpacity
				activeOpacity={0.7}
				onPress={() => handleConversationPress(item)}
				className="flex-row px-4 items-center bg-surface active:bg-surfaceMuted py-3"
			>
				{/* Avatar Container */}
				<View className="relative">
					{item.other_user_avatar_url && !item.other_user_deleted ? (
						<Image
							source={{ uri: item.other_user_avatar_url }}
							style={{ width: 48, height: 48, borderRadius: 24 }}
							contentFit="cover"
							transition={200}
						/>
					) : (
						<View className="w-12 h-12 rounded-full bg-surfaceMuted items-center justify-center">
							<Ionicons name="person-outline" size={20} color={palette.inkMuted} />
						</View>
					)}
				</View>

				{/* Info Container with iOS-style separator */}
				<View className={`flex-1 ml-4 flex-row items-center pr-1 ${isLast ? '' : 'border-b border-line/30'}`}>
					<View className="flex-1 justify-center py-1">
                        <View className="flex-row justify-between items-center mb-1">
                          <View className="flex-1 mr-4">
                            <Text
                              numberOfLines={1}
                              style={{ lineHeight: 20, includeFontPadding: false, textAlignVertical: 'center' }}
                              className={`text-[16px] text-ink ${hasUnread ? 'font-extrabold' : 'font-semibold'}`}
                            >
                              {item.other_user_deleted
                                ? 'Удаленный профиль'
                                : `${item.other_user_name} ${item.other_user_surname}`.trim() || 'Пользователь'}
                            </Text>
                          </View>
                          <Text
                            style={{ lineHeight: 20, includeFontPadding: false, textAlignVertical: 'center' }}
                            className={`text-xs ${hasUnread ? 'text-primary font-bold' : 'text-ink-muted font-medium'}`}
                          >
                            {formatRelativeTime(item.last_activity)}
                          </Text>
                        </View>

						{/* House/Listing context subtitle */}
						{item.house_id && (
							<View className="flex-row items-center mb-1">
								<Ionicons name="home-outline" size={13} color={palette.inkMuted} className="mr-1" />
								<Text numberOfLines={1} className="text-xs text-ink-muted flex-1 font-medium">
									{item.house_count_room ? `${formatRooms(item.house_count_room)}, ` : ''}
									{item.house_street ? `${item.house_street}` : ''}
									{item.house_number ? `, д. ${item.house_number}` : ''}
								</Text>
							</View>
						)}

						<View className="flex-row items-center justify-between">
							<View className="flex-row items-center flex-1 mr-4">
								{isLastMessageByMe && hasPreview && (
									<View className="mr-1.5 justify-center">
										{isLastMessageRead ? (
											<Ionicons name="checkmark-done" size={16} color={palette.primary} />
										) : (
											<Ionicons name="checkmark" size={16} color={palette.inkMuted} />
										)}
									</View>
								)}
								<Text
									numberOfLines={1}
									className={`text-[14px] flex-1 ${
										hasUnread ? 'text-ink font-bold' : 'text-ink-secondary'
									} ${!hasPreview ? 'italic text-ink-muted font-normal' : ''}`}
								>
									{hasPreview ? item.last_message_body : 'Начните переписку'}
								</Text>
							</View>

							{hasUnread && (
								<View className="bg-primary px-2 py-0.5 rounded-full min-w-[20px] items-center justify-center">
									<Text className="text-white text-[10px] font-bold">
										{item.unread_count}
									</Text>
								</View>
							)}
						</View>
					</View>

					{/* House/Listing Cover Image Thumbnail on the right */}
					{item.house_id && item.house_cover_path ? (
						<Image
							source={{ uri: item.house_cover_path }}
							style={{ width: 48, height: 48, borderRadius: 8, marginLeft: 12 }}
							contentFit="cover"
							transition={200}
						/>
					) : null}
				</View>
			</TouchableOpacity>
		);
	};

	return (
		<SafeAreaView edges={['top']} className="flex-1 bg-surface">
			{/* Custom Premium Header */}
			<View className="px-5 pt-4 pb-2 bg-surface">
				<Text className="text-3xl font-extrabold text-ink tracking-tight">Сообщения</Text>

				{/* Copy Main Page Search Bar Design */}
				{conversations && conversations.length > 0 && (
					<View className="h-12 flex-row items-center rounded-field border border-line bg-surface px-3 mt-3 mb-1">
						<Ionicons name="search" size={20} color={palette.inkMuted} />
						<TextInput
							placeholder="Поиск по перепискам..."
							placeholderTextColor={palette.inkMuted}
							value={searchQuery}
							onChangeText={setSearchQuery}
							className="ml-2 flex-1 text-base text-ink p-0"
						/>
						{searchQuery.length > 0 && (
							<TouchableOpacity onPress={() => setSearchQuery('')}>
								<Ionicons name="close-circle" size={18} color={palette.inkMuted} />
							</TouchableOpacity>
						)}
					</View>
				)}
			</View>

			<FlatList
				data={filteredConversations}
				keyExtractor={(item) => String(item.conversation_id)}
				renderItem={renderItem}
				contentContainerStyle={
					filteredConversations.length === 0 ? { flexGrow: 1 } : undefined
				}
				ListEmptyComponent={
					<View className="flex-1 items-center justify-center px-8 py-10 bg-surface">
						<View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surfaceMuted">
							<Ionicons name="chatbubble-ellipses-outline" size={28} color={palette.inkMuted} />
						</View>
						<Text className="text-center text-lg font-bold text-ink">
							{searchQuery ? 'Ничего не найдено' : 'Сообщений пока нет'}
						</Text>
						<Text className="mt-2 text-center text-[15px] text-ink-secondary leading-6 px-4">
							{searchQuery
								? 'Попробуйте изменить запрос или имя собеседника.'
								: 'Здесь будут ваши переписки с хозяевами квартир.'}
						</Text>
					</View>
				}
				ListFooterComponent={
					filteredConversations.length > 0 ? (
						<View className="py-6 items-center">
							<Text className="text-xs text-ink-muted">Это все переписки</Text>
						</View>
					) : null
				}
				refreshControl={
					<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={palette.primary} />
				}
			/>
		</SafeAreaView>
	);
}
