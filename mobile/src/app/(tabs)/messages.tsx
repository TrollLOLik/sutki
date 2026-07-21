import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
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
import { EmptyState } from '@/components/EmptyState';
import { PersonalListToolbar, type SortOption } from '@/components/PersonalListToolbar';
import { formatRooms } from '@/lib/format';

type ConversationSort = 'recent' | 'oldest' | 'unread';

const CONVERSATION_SORT_OPTIONS: SortOption<ConversationSort>[] = [
	{ value: 'recent', label: 'Сначала новые', icon: 'time-outline' },
	{ value: 'oldest', label: 'Сначала старые', icon: 'hourglass-outline' },
	{ value: 'unread', label: 'Сначала непрочитанные', icon: 'mail-unread-outline' },
];

export default function MessagesScreen() {
	const { palette, isDark } = useAppTheme();
	const screenBackground = isDark ? '#0D0F12' : '#F4F5F7';
	const softBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(18,24,32,0.07)';
	const router = useRouter();
	const status = useSessionStore((state) => state.status);
	const sessionUser = useSessionStore((state) => state.user);
	const { data: conversations, isLoading, refetch, isFetching } = useConversations();
	const [searchQuery, setSearchQuery] = useState('');
	const [sort, setSort] = useState<ConversationSort>('recent');
	const [sortVisible, setSortVisible] = useState(false);

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
	const filteredConversations = (conversations?.filter((c) => {
		const fullName = `${c.other_user_name} ${c.other_user_surname}`.toLowerCase();
		const body = c.last_message_body.toLowerCase();
		const query = searchQuery.toLowerCase();
		return fullName.includes(query) || body.includes(query);
	}) ?? []).sort((a, b) => {
		if (sort === 'unread') {
			const unreadDifference = b.unread_count - a.unread_count;
			if (unreadDifference !== 0) return unreadDifference;
		}
		const activityDifference = new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
		return sort === 'oldest' ? -activityDifference : activityDifference;
	});
	const renderItem = ({ item, index }: { item: ConversationSummary; index: number }) => {
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
				activeOpacity={0.62}
				onPress={() => handleConversationPress(item)}
				style={{ paddingLeft: 18 }}
			>
				<View className="flex-row items-center">
					<View className="relative">
						{item.other_user_avatar_url && !item.other_user_deleted ? (
							<Image
								source={{ uri: item.other_user_avatar_url }}
								style={{ width: 58, height: 58, borderRadius: 29 }}
								contentFit="cover"
								transition={160}
							/>
						) : (
							<View className="h-[58px] w-[58px] items-center justify-center rounded-full bg-surface-muted">
								<Ionicons name="person-outline" size={23} color={palette.inkMuted} />
							</View>
						)}
						{hasUnread ? (
							<View
								style={{ borderColor: screenBackground }}
								className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-[3px] bg-primary"
							/>
						) : null}
					</View>

					<View
						style={{
							flex: 1,
							minHeight: 90,
							marginLeft: 14,
							paddingVertical: 14,
							paddingRight: 18,
							borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
							borderBottomColor: softBorder,
						}}
					>
						<View className="flex-row items-center">
							<View className="flex-1">
								<View className="flex-row items-center">
									<Text numberOfLines={1} className={`mr-3 flex-1 text-[17px] leading-6 text-ink ${hasUnread ? 'font-extrabold' : 'font-bold'}`}>
										{item.other_user_deleted
											? 'Удаленный профиль'
											: `${item.other_user_name} ${item.other_user_surname}`.trim() || 'Пользователь'}
									</Text>
									<Text className={`text-[12px] leading-5 ${hasUnread ? 'font-bold text-primary' : 'font-medium text-ink-muted'}`}>
										{formatRelativeTime(item.last_activity)}
									</Text>
								</View>

								{item.house_id ? (
									<View className="mt-1 flex-row items-center">
										<Ionicons name="home-outline" size={14} color={palette.inkMuted} />
										<Text numberOfLines={1} className="ml-1.5 flex-1 text-[12px] leading-5 text-ink-muted">
											{item.house_count_room ? `${formatRooms(item.house_count_room)}, ` : ''}
											{item.house_street ?? ''}{item.house_number ? `, д. ${item.house_number}` : ''}
										</Text>
									</View>
								) : null}

								<View className="mt-1 flex-row items-center">
									{isLastMessageByMe && hasPreview ? (
										<Ionicons
											name={isLastMessageRead ? 'checkmark-done' : 'checkmark'}
											size={16}
											color={isLastMessageRead ? palette.primary : palette.inkMuted}
											style={{ marginRight: 5 }}
										/>
									) : null}
									<Text numberOfLines={1} className={`flex-1 text-[14px] leading-5 ${hasUnread ? 'font-bold text-ink' : hasPreview ? 'text-ink-secondary' : 'italic text-ink-muted'}`}>
										{hasPreview ? item.last_message_body : 'Начните переписку'}
									</Text>
									{hasUnread ? (
										<View className="ml-2 min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5">
											<Text className="text-[10px] font-extrabold text-white">{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
										</View>
									) : null}
								</View>
							</View>

							{item.house_id && item.house_cover_path ? (
								<Image
									source={{ uri: item.house_cover_path }}
									style={{ width: 48, height: 48, borderRadius: 12, marginLeft: 12 }}
									contentFit="cover"
									transition={160}
								/>
							) : null}
						</View>
					</View>
				</View>
			</TouchableOpacity>
		);
	};

	return (
		<SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: screenBackground }}>
			<View className="px-5 pb-4 pt-4">
				<Text className="text-[30px] leading-9 font-extrabold text-ink">Сообщения</Text>
			</View>

			{conversations && conversations.length > 0 ? (
				<PersonalListToolbar
					query={searchQuery}
					onQueryChange={setSearchQuery}
					placeholder="Поиск по перепискам..."
					sort={sort}
					sortOptions={CONVERSATION_SORT_OPTIONS}
					sortVisible={sortVisible}
					onSortVisibleChange={setSortVisible}
					onSortChange={setSort}
				/>
			) : null}

			<FlatList
				data={filteredConversations}
				keyExtractor={(item) => String(item.conversation_id)}
				renderItem={renderItem}
				contentContainerStyle={filteredConversations.length === 0
					? { flexGrow: 1, paddingTop: 2, paddingBottom: 110 }
					: { paddingTop: 2, paddingBottom: 110 }}
				showsVerticalScrollIndicator={false}
				ListEmptyComponent={
					<View className="flex-1 justify-center px-6">
						<EmptyState
							icon="chatbubble-ellipses-outline"
							title={searchQuery ? 'Ничего не найдено' : 'Сообщений пока нет'}
							subtitle={searchQuery
								? 'Попробуйте изменить запрос или имя собеседника.'
								: 'Здесь появятся ваши переписки по объявлениям и заявкам.'}
						/>
					</View>
				}
				refreshControl={
					<RefreshControl
						refreshing={isFetching}
						onRefresh={refetch}
						tintColor={palette.primary}
						colors={[palette.primary]}
						progressViewOffset={72}
					/>
				}
			/>
		</SafeAreaView>
	);
}
