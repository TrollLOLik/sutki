import React, { useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	Keyboard,
	Pressable,
	RefreshControl,
	Text,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useSessionStore } from '@/store/session';
import { useConversations, ConversationSummary } from '@/lib/api/chat';
import { requireAuth } from '@/lib/requireAuth';
import { useAppTheme } from '@/theme/useAppTheme';
import { Button, CountedTabs, EmptyState, LoadErrorState } from '@/components/ui';
import { ConversationListSkeleton } from '@/components/DomainListSkeletons';
import { ConversationRow } from '@/components/chat/ConversationRow';
import { PersonalListToolbar, type SortOption } from '@/components/PersonalListToolbar';
import { CollapsibleHeader, useCollapsibleHeader } from '@/components/CollapsibleHeader';
import { useScrollHideTabBar } from '@/hooks/useScrollHideTabBar';

type ConversationSort = 'recent' | 'oldest' | 'unread';
type ConversationTab = 'all' | 'renting' | 'hosting';

const CONVERSATION_TABS: { value: ConversationTab; label: string }[] = [
	{ value: 'all', label: 'Все' },
	{ value: 'renting', label: 'Я снимаю' },
	{ value: 'hosting', label: 'Я сдаю' },
];

const CONVERSATION_SORT_OPTIONS: SortOption<ConversationSort>[] = [
	{ value: 'recent', label: 'Сначала новые', icon: 'time-outline' },
	{ value: 'oldest', label: 'Сначала старые', icon: 'hourglass-outline' },
	{ value: 'unread', label: 'Сначала непрочитанные', icon: 'mail-unread-outline' },
];

export default function MessagesScreen() {
	const collapsibleHeader = useCollapsibleHeader();
	const handleTabBarScroll = useScrollHideTabBar();
	const { palette, isDark } = useAppTheme();
	const screenBackground = isDark ? '#0D0F12' : '#F4F5F7';
	const softBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(18,24,32,0.07)';
	const router = useRouter();
	const status = useSessionStore((state) => state.status);
	const sessionUser = useSessionStore((state) => state.user);
	const {
		data: conversations,
		isLoading,
		isError,
		refetch,
		isFetching,
	} = useConversations();
	const [searchQuery, setSearchQuery] = useState('');
	const [sort, setSort] = useState<ConversationSort>('recent');
	const [sortVisible, setSortVisible] = useState(false);
	const [tab, setTab] = useState<ConversationTab>('all');

	const handleTabChange = (nextTab: ConversationTab) => {
		if (tab === nextTab) return;
		collapsibleHeader.show();
		setTab(nextTab);
	};

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
						Войдите в аккаунт, чтобы общаться с владельцами жилья и обсуждать детали бронирования.
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
			<SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: screenBackground }}>
				<View className="px-5 pb-4 pt-4">
					<Text className="text-[30px] leading-9 font-extrabold text-ink">Сообщения</Text>
				</View>
				<ConversationListSkeleton />
			</SafeAreaView>
		);
	}

	if (isError && !conversations) {
		return (
			<SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: screenBackground }}>
				<View className="px-5 pb-4 pt-4">
					<Text className="text-[30px] leading-9 font-extrabold text-ink">Сообщения</Text>
				</View>
				<LoadErrorState title="Не удалось загрузить сообщения" loading={isFetching} onRetry={() => refetch()} />
			</SafeAreaView>
		);
	}

	const allConversations = conversations ?? [];
	const matchesConversationTab = (conversation: ConversationSummary, targetTab: ConversationTab) => {
		if (targetTab === 'all') return true;
		if (conversation.house_owner_id == null || sessionUser?.id == null) return false;
		const isHosting = conversation.house_owner_id === sessionUser.id;
		return targetTab === 'hosting' ? isHosting : !isHosting;
	};
	const conversationCounts: Record<ConversationTab, number> = {
		all: allConversations.length,
		renting: allConversations.filter((conversation) => matchesConversationTab(conversation, 'renting')).length,
		hosting: allConversations.filter((conversation) => matchesConversationTab(conversation, 'hosting')).length,
	};
	const conversationsForTab = allConversations.filter((conversation) => matchesConversationTab(conversation, tab));

	// Filter conversations by search query
	const filteredConversations = conversationsForTab.filter((c) => {
		const fullName = `${c.other_user_name} ${c.other_user_surname}`.toLowerCase();
		const body = c.last_message_body.toLowerCase();
		const query = searchQuery.toLowerCase();
		return fullName.includes(query) || body.includes(query);
	}).sort((a, b) => {
		if (sort === 'unread') {
			const unreadDifference = b.unread_count - a.unread_count;
			if (unreadDifference !== 0) return unreadDifference;
		}
		const activityDifference = new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
		return sort === 'oldest' ? -activityDifference : activityDifference;
	});
	const emptyTitle = searchQuery.trim()
		? 'Ничего не найдено'
		: tab === 'hosting'
			? 'Чатов по вашим объявлениям пока нет'
			: tab === 'renting'
				? 'Чатов с владельцами пока нет'
				: 'Сообщений пока нет';
	const emptySubtitle = searchQuery.trim()
		? 'Попробуйте изменить запрос или имя собеседника.'
		: tab === 'hosting'
			? 'Здесь появятся переписки с гостями по вашим объявлениям.'
			: tab === 'renting'
				? 'Здесь появятся переписки по объявлениям, которые вы рассматриваете.'
				: 'Здесь появятся ваши переписки по объявлениям и заявкам.';

	return (
		<SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: screenBackground }}>
			<Pressable accessible={false} onPress={Keyboard.dismiss} className="px-5 pb-4 pt-4">
				<Text className="text-[30px] leading-9 font-extrabold text-ink">Сообщения</Text>
			</Pressable>

			<View style={{ flex: 1, overflow: 'hidden' }}>
			<CollapsibleHeader controller={collapsibleHeader} style={{ backgroundColor: screenBackground }}>
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

				<CountedTabs
					items={CONVERSATION_TABS.map((item) => ({ ...item, count: conversationCounts[item.value] }))}
					value={tab}
					onChange={handleTabChange}
				/>

			</CollapsibleHeader>

			<FlatList
				data={filteredConversations}
				keyExtractor={(item) => String(item.conversation_id)}
				renderItem={({ item, index }) => (
					<ConversationRow
						conversation={item}
						currentUserId={sessionUser?.id}
						isLast={index === filteredConversations.length - 1}
						screenBackground={screenBackground}
						dividerColor={softBorder}
						onPress={() => handleConversationPress(item)}
					/>
				)}
				contentContainerStyle={filteredConversations.length === 0
					? { flexGrow: 1, paddingTop: collapsibleHeader.height + 2, paddingBottom: 110 }
					: { paddingTop: collapsibleHeader.height + 2, paddingBottom: 110 }}
				showsVerticalScrollIndicator={false}
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				onScroll={(event) => {
					collapsibleHeader.onScroll(event);
					handleTabBarScroll(event);
				}}
				onScrollBeginDrag={collapsibleHeader.onScrollBeginDrag}
				onScrollEndDrag={collapsibleHeader.onScrollEndDrag}
				scrollEventThrottle={16}
				ListEmptyComponent={
					<View className="flex-1 justify-center px-6">
						<EmptyState
							icon="chatbubble-ellipses-outline"
							title={emptyTitle}
							subtitle={emptySubtitle}
						/>
					</View>
				}
				refreshControl={
					<RefreshControl
						refreshing={isFetching}
						onRefresh={refetch}
						tintColor={palette.primary}
						colors={[palette.primary]}
						progressViewOffset={collapsibleHeader.height}
					/>
				}
			/>
			</View>
		</SafeAreaView>
	);
}
