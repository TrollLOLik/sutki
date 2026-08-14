import React, { useCallback, useRef, useState } from 'react';
import {
	FlatList,
	Keyboard,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	Pressable,
	RefreshControl,
	View,
} from 'react-native';
import Animated, {
	cancelAnimation,
	Easing,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useSessionStore } from '@/store/session';
import { useConversations, ConversationSummary } from '@/lib/api/chat';
import { requireAuth } from '@/lib/requireAuth';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppIcon, AppText, Button, CountedTabs, EmptyState, LoadErrorState, Spinner } from '@/components/ui';
import { ConversationListSkeleton } from '@/components/DomainListSkeletons';
import { ConversationRow } from '@/components/chat/ConversationRow';
import { PersonalListToolbar, type SortOption } from '@/components/PersonalListToolbar';
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

type CollapsibleSectionProps = {
	expanded: boolean;
	height: number;
	progress: SharedValue<number>;
	children: React.ReactNode;
};

function CollapsibleSection({ expanded, height, progress, children }: CollapsibleSectionProps) {
	const animatedStyle = useAnimatedStyle(() => {
		const value = progress.value;

		return {
			height: height * value,
			opacity: value,
			transform: [{ translateY: -12 * (1 - value) }],
		};
	}, [height]);

	return (
		<Animated.View
			pointerEvents={expanded ? 'auto' : 'none'}
			style={[
				{
				overflow: 'hidden',
				flexShrink: 0,
				},
				animatedStyle,
			]}>
			{children}
		</Animated.View>
	);
}

const TITLE_SECTION_HEIGHT = 68;
const TOOLBAR_SECTION_HEIGHT = 64;
const TABS_SECTION_HEIGHT = 54;
const HEADER_TOP_OFFSET = 10;
const HEADER_HIDE_DISTANCE = 8;
const HEADER_SHOW_DISTANCE = 16;

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

export default function MessagesScreen() {
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
	const headerProgress = useSharedValue(1);
	const [headerExpanded, setHeaderExpanded] = useState(true);
	const headerExpandedRef = useRef(true);
	const lastOffsetRef = useRef(0);
	const directionRef = useRef<-1 | 0 | 1>(0);
	const directionDistanceRef = useRef(0);

	const setHeaderVisibility = useCallback((expanded: boolean) => {
		if (headerExpandedRef.current === expanded) return;

		headerExpandedRef.current = expanded;
		setHeaderExpanded(expanded);
		cancelAnimation(headerProgress);
		headerProgress.set(withTiming(expanded ? 1 : 0, {
			duration: expanded ? 320 : 280,
			easing: Easing.bezier(0.22, 1, 0.36, 1),
		}));
	}, [headerProgress]);

	const showHeader = useCallback(() => {
		directionRef.current = 0;
		directionDistanceRef.current = 0;
		setHeaderVisibility(true);
	}, [setHeaderVisibility]);

	const handleScroll = useCallback((event: ScrollEvent) => {
		handleTabBarScroll(event);

		const offset = Math.max(0, event.nativeEvent.contentOffset.y);
		const delta = offset - lastOffsetRef.current;
		lastOffsetRef.current = offset;

		if (offset <= HEADER_TOP_OFFSET) {
			showHeader();
			return;
		}

		if (Math.abs(delta) < 0.25 || Math.abs(delta) > 120) return;

		const direction: -1 | 1 = delta > 0 ? 1 : -1;
		if (directionRef.current !== direction) {
			directionRef.current = direction;
			directionDistanceRef.current = 0;
		}
		directionDistanceRef.current += Math.abs(delta);

		const threshold = direction === 1 ? HEADER_HIDE_DISTANCE : HEADER_SHOW_DISTANCE;
		if (directionDistanceRef.current < threshold) return;

		setHeaderVisibility(direction === -1);
		directionDistanceRef.current = 0;
	}, [handleTabBarScroll, setHeaderVisibility, showHeader]);

	const handleTabChange = (nextTab: ConversationTab) => {
		if (tab === nextTab) return;
		showHeader();
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
				<Spinner label="Проверяем сессию" />
			</SafeAreaView>
		);
	}

	if (status !== 'authenticated') {
		return (
			<SafeAreaView edges={['top']} className="flex-1 bg-surface justify-center items-center px-8">
				<View className="items-center mb-6">
					<View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary/10">
						<AppIcon name="chatbubbles-outline" size={40} color={palette.primary} />
					</View>
					<AppText variant="title" align="center" style={{ marginBottom: 8 }}>
						Сообщения
					</AppText>
					<AppText className="text-center text-base text-ink-secondary px-4 leading-6">
						Войдите в аккаунт, чтобы общаться с владельцами жилья и обсуждать детали бронирования.
					</AppText>
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
					<AppText variant="screenTitle" style={{ fontSize: 30, lineHeight: 36 }}>
						Сообщения
					</AppText>
				</View>
				<ConversationListSkeleton />
			</SafeAreaView>
		);
	}

	if (isError && !conversations) {
		return (
			<SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: screenBackground }}>
				<View className="px-5 pb-4 pt-4">
					<AppText variant="screenTitle" style={{ fontSize: 30, lineHeight: 36 }}>
						Сообщения
					</AppText>
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
	const hasToolbar = allConversations.length > 0;
	const expandedHeaderHeight = TITLE_SECTION_HEIGHT
		+ (hasToolbar ? TOOLBAR_SECTION_HEIGHT : 0)
		+ TABS_SECTION_HEIGHT;

	return (
		<SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: screenBackground }}>
			<View style={{ flex: 1, overflow: 'hidden' }}>
				<View
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						width: '100%',
						zIndex: 20,
						elevation: 8,
						backgroundColor: screenBackground,
					}}>
					<CollapsibleSection
						expanded={headerExpanded}
						height={TITLE_SECTION_HEIGHT}
						progress={headerProgress}>
						<Pressable accessible={false} onPress={Keyboard.dismiss} className="px-5 pb-4 pt-4">
							<AppText variant="screenTitle" style={{ fontSize: 30, lineHeight: 36 }}>
								Сообщения
							</AppText>
						</Pressable>
					</CollapsibleSection>
					{hasToolbar ? (
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

					<CollapsibleSection
						expanded={headerExpanded}
						height={TABS_SECTION_HEIGHT}
						progress={headerProgress}>
						<CountedTabs
							items={CONVERSATION_TABS.map((item) => ({ ...item, count: conversationCounts[item.value] }))}
							value={tab}
							onChange={handleTabChange}
						/>
					</CollapsibleSection>
				</View>

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
					contentContainerStyle={
						filteredConversations.length === 0
							? { flexGrow: 1, paddingTop: expandedHeaderHeight + 2, paddingBottom: 110 }
							: { paddingTop: expandedHeaderHeight + 2, paddingBottom: 110 }
					}
					showsVerticalScrollIndicator={false}
					keyboardDismissMode="on-drag"
					keyboardShouldPersistTaps="handled"
					onScroll={handleScroll}
					scrollEventThrottle={16}
					ListEmptyComponent={
						<View className="flex-1 justify-center px-6">
							<EmptyState icon="chatbubble-ellipses-outline" title={emptyTitle} subtitle={emptySubtitle} />
						</View>
					}
					refreshControl={
						<RefreshControl
							refreshing={isFetching}
							onRefresh={refetch}
							tintColor={palette.primary}
							colors={[palette.primary]}
							progressViewOffset={expandedHeaderHeight}
						/>
					}
				/>
			</View>
		</SafeAreaView>
	);
}
