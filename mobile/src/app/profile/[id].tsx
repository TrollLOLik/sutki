import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
  useWindowDimensions,
  BackHandler,
  type TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListingCard } from '@/components/ListingCard';
import { ListingLayoutToggle } from '@/components/ListingLayoutToggle';
import { Button, EmptyState, IconButton, InlineAlert, SearchField } from '@/components/ui';
import { ImageViewerModal } from '@/components/ui/ImageViewerModal';
import { ProfileHero, ProfileMetricGrid } from '@/components/profile/ProfileOverview';
import { useFavoriteIds, useToggleFavorite } from '@/lib/api/favorites';
import { filtersToListParams, useListings } from '@/lib/api/listings';
import { useFiltersStore, countActiveFilters } from '@/store/filters';
import { useFindOrCreateConversation } from '@/lib/api/chat';
import { ApiError } from '@/lib/api/client';
import { useHostResponseStats } from '@/lib/api/hostStats';
import { usePublicProfile } from '@/lib/api/profiles';
import { formatHostResponseTime } from '@/lib/formatHostStats';
import { formatMemberSince } from '@/lib/formatMemberSince';
import { useAppTheme } from '@/theme/useAppTheme';
import { NavigationBackButton } from '@/components/NavigationBackButton';
import { requireAuth } from '@/lib/requireAuth';
import { useSessionStore } from '@/store/session';
import { appAlert as Alert } from '@/components/AppAlert';
import { useListingLayoutStore } from '@/store/listing-layout';
import { env } from '@/lib/env';
import { ReportSheet } from '@/components/safety/ReportSheet';
import { UserActionsSheet } from '@/components/safety/UserActionsSheet';
import { useBlockUser, useUnblockUser, useUserBlockState } from '@/lib/api/abuse';

export default function PublicProfileScreen() {
  const { palette } = useAppTheme();
  const {
    id,
    name,
    surname,
    patronymic,
    phone,
    avatarUrl,
    rating,
    city,
  } = useLocalSearchParams<{
    id: string;
    name?: string;
    surname?: string;
    patronymic?: string;
    phone?: string;
    avatarUrl?: string;
    rating?: string;
    city?: string;
  }>();

  const numericId = Number(id);
  const { data: publicProfile } = usePublicProfile(Number.isFinite(numericId) ? numericId : undefined);
  const sessionUserId = useSessionStore((state) => state.user?.id);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { data: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const layoutMode = useListingLayoutStore((state) => state.discovery);
  const toggleLayoutMode = useListingLayoutStore((state) => state.toggleMode);
  const [avatarViewerVisible, setAvatarViewerVisible] = useState(false);
  const [userActionsVisible, setUserActionsVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const canQueryBlockState = sessionUserId != null && Number.isFinite(numericId) && numericId > 0 && numericId !== sessionUserId;
  const { data: blockState } = useUserBlockState(numericId, canQueryBlockState);
  const blockUser = useBlockUser(numericId);
  const unblockUser = useUnblockUser(numericId);
  const isBlocked = blockState?.blocked === true;
  const blockedByMe = blockState?.blocked_by_me === true;

  useEffect(() => {
    if (sessionUserId != null && numericId === sessionUserId) {
      router.replace('/(tabs)/profile');
    }
  }, [numericId, sessionUserId]);

  const inlineActionsLayoutRef = useRef({ y: 0, height: 0 });
  const isStickyFooterVisibleRef = useRef(false);
  const footerAnim = useRef(new Animated.Value(0)).current;

  const handleMainScroll = (event: any) => {
        const y = event.nativeEvent.contentOffset.y;
        const layout = inlineActionsLayoutRef.current;
        if (layout.y > 0) {
          const headerHeight = 70;
          const viewportHeight = screenHeight - headerHeight;
          const isInlineVisible = (layout.y + layout.height > y) && (layout.y < y + viewportHeight);

          if (!isInlineVisible) {
            if (!isStickyFooterVisibleRef.current) {
              isStickyFooterVisibleRef.current = true;
              Animated.timing(footerAnim, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
              }).start();
            }
          } else {
            if (isStickyFooterVisibleRef.current) {
              isStickyFooterVisibleRef.current = false;
              Animated.timing(footerAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }).start();
            }
          }
        }
  };



  const resolvedName = publicProfile?.name || name;
  const resolvedSurname = publicProfile?.surname || surname;
  const resolvedPatronymic = publicProfile?.patronymic || patronymic;
  const publicPhone = publicProfile?.phone || phone || '';
  const publicAvatarUrl = publicProfile?.avatar_url || avatarUrl || '';
  const displayName =
    [resolvedName, resolvedPatronymic, resolvedSurname].filter(Boolean).join(' ') || 'Арендодатель';
  const displayCity = publicProfile?.city || city || 'Город не указан';
  const ratingNum = publicProfile?.rating ?? (rating ? Number(rating) : 0);
  const memberSince = formatMemberSince(publicProfile?.created_at);

  const getInitials = () => {
    const parts = [resolvedName, resolvedSurname].filter((p): p is string => !!p);
    if (parts.length === 0) return 'А';
    return parts.map((part) => part.trim()[0]).join('').toUpperCase();
  };

  // Filter integration: subscribe to the global filters store
  const filters = useFiltersStore();
  const activeFiltersCount = countActiveFilters(filters);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const listingParams = useMemo(() => ({
    ...filtersToListParams(filters, searchQuery, { limit: 100 }),
    ownerId: Number.isFinite(numericId) ? numericId : undefined,
  }), [filters, numericId, searchQuery]);
  const { data: listingsData, isLoading: listingsLoading } = useListings(listingParams);
  const { data: hostListingCountData } = useListings({
    ownerId: Number.isFinite(numericId) ? numericId : undefined,
    limit: 1,
  });
  const {
    data: hostResponseStats,
    isLoading: hostResponseStatsLoading,
  } = useHostResponseStats(Number.isFinite(numericId) ? numericId : undefined);
  const filteredListings = listingsData?.items ?? [];

  const searchAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(searchAnim, {
      toValue: isSearchFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isSearchFocused]);

  useEffect(() => {
    if (!isSearchFocused) return;
    const backAction = () => {
      setIsSearchFocused(false);
      searchInputRef.current?.blur();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isSearchFocused]);

  const cancelWidth = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 80],
  });
  const cancelOpacity = searchAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, 0, 1],
  });

  const filtersWidth = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [48, 0],
  });
  const filtersOpacity = searchAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [1, 0, 0],
  });

  const handleCall = () => {
    if (isBlocked) {
      Alert.alert('Действие недоступно', 'Контакты скрыты, пока между пользователями действует блокировка.');
      return;
    }
    if (!publicPhone) {
      Alert.alert('Информация', 'Телефон владельца не указан.');
      return;
    }
    Linking.openURL(`tel:${publicPhone}`).catch(() => {
      Alert.alert('Ошибка', 'Не удалось совершить звонок.');
    });
  };

  const { mutateAsync: findOrCreateConv, isPending: isCreatingChat } = useFindOrCreateConversation();

  const handleMessage = async () => {
    if (!requireAuth('generic')) return;
    if (isBlocked) {
      Alert.alert('Обмен сообщениями недоступен', 'Чтобы снова написать пользователю, сначала снимите блокировку.');
      return;
    }
    try {
      const res = await findOrCreateConv({
        houseID: null,
        userID: numericId,
      });
      router.push({
        pathname: `/chat/${res.conversation_id}` as any,
        params: {
          title: displayName || 'Пользователь',
          otherUserId: numericId,
        },
      });
    } catch (err) {
      Alert.alert('Ошибка', err instanceof ApiError ? err.message : 'Не удалось открыть чат.');
    }
  };

  const handleShare = async () => {
    try {
      const url = `${env.appUrl}/profile/${numericId}`;
      const message = `Профиль ${displayName} в ВИГАЖ\nРейтинг: ${ratingNum > 0 ? ratingNum.toFixed(1) + ' ★' : 'Нет оценок'}\n🔗 ${url}`;
      await Share.share({
        message,
        url,
        title: `Профиль ${displayName}`,
      });
    } catch (error) {
      console.log('Error sharing profile:', error);
    }
  };

  const openReport = () => {
    if (!requireAuth('generic')) return;
    setUserActionsVisible(false);
    setTimeout(() => setReportVisible(true), 220);
  };

  const confirmBlock = () => {
    if (!requireAuth('generic')) return;
    setUserActionsVisible(false);
    Alert.alert(
      'Заблокировать пользователя?',
      'Новые сообщения, звонки и заявки между вами станут недоступны. Существующие бронирования сохранятся.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Заблокировать',
          style: 'destructive',
          onPress: () => {
            blockUser.mutate(undefined, {
              onError: (caught) => {
                Alert.alert('Не удалось заблокировать', caught instanceof ApiError ? caught.message : 'Попробуйте ещё раз.');
              },
            });
          },
        },
      ],
    );
  };

  const handleUnblock = () => {
    setUserActionsVisible(false);
    unblockUser.mutate(undefined, {
      onError: (caught) => {
        Alert.alert('Не удалось разблокировать', caught instanceof ApiError ? caught.message : 'Попробуйте ещё раз.');
      },
    });
  };

  // Open host reviews page (isHost = true)
  const onReviewsPress = () => {
    router.push({
      pathname: '/reviews/[id]',
      params: { id: String(numericId), isHost: 'true' },
    });
  };

  const hostListingsCount = publicProfile?.listings_count ?? hostListingCountData?.total ?? 0;

  const renderContactActions = (size: 'md' | 'lg' = 'lg') => {
    if (isBlocked) {
      if (blockedByMe) {
        return (
          <Button
            label="Разблокировать"
            icon="person-add-outline"
            mode="soft"
            tone="neutral"
            size={size}
            loading={unblockUser.isPending}
            onPress={handleUnblock}
          />
        );
      }
      return (
        <InlineAlert compact title="Обмен сообщениями недоступен">
          Текущие бронирования сохраняются, но создать новый чат или заявку нельзя.
        </InlineAlert>
      );
    }

    return (
      <View className="flex-1 flex-row gap-3">
        {publicPhone ? (
          <View className="flex-1">
            <Button label="Позвонить" icon="call-outline" onPress={handleCall} size={size} />
          </View>
        ) : null}
        <View className="flex-1">
          <Button
            label="Написать"
            icon="chatbubble-ellipses-outline"
            loading={isCreatingChat}
            onPress={handleMessage}
            size={size}
            variant={publicPhone ? 'secondary' : 'primary'}
          />
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.surface }}>
        <View
          className="h-[70px] flex-row items-center px-4"
          style={{ borderBottomWidth: 1, borderBottomColor: palette.line }}>
          <NavigationBackButton fallback="/(tabs)" size={48} variant="material" />
          <View className="flex-1 items-center px-3">
            <Text numberOfLines={1} className="text-xl font-extrabold text-ink">
              Профиль
            </Text>
          </View>
          <IconButton
            accessibilityLabel="Действия с профилем"
            icon="ellipsis-horizontal"
            iconSize={21}
            onPress={() => setUserActionsVisible(true)}
            size={48}
          />
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ backgroundColor: palette.surface }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 128, gap: 16 }}
        onScroll={handleMainScroll}
        scrollEventThrottle={16}
      >
        <ProfileHero
          avatarActionIcon="expand-outline"
          avatarPressLabel="Открыть фото профиля"
          avatarUri={publicAvatarUrl || null}
          city={displayCity}
          initials={getInitials()}
          name={displayName}
          onAvatarPress={
            publicAvatarUrl ? () => setAvatarViewerVisible(true) : undefined
          }
          subtitle={memberSince}
        />

        <ProfileMetricGrid
          metrics={[
            {
              icon: 'home-outline',
              label: 'Объявления',
              value: hostListingsCount,
              loading: listingsLoading,
            },
            {
              icon: 'star-outline',
              label: 'Рейтинг',
              value: ratingNum > 0 ? ratingNum.toFixed(1) : '—',
              onPress: onReviewsPress,
              tone: 'neutral',
            },
            {
              icon: isBlocked ? 'ban-outline' : publicPhone ? 'checkmark-circle-outline' : 'call-outline',
              label: isBlocked ? 'Контакты' : 'Номер телефона',
              value: isBlocked ? 'Недоступны' : publicPhone ? 'Подтверждён' : 'Не указан',
              tone: !isBlocked && publicPhone ? 'success' : 'neutral',
            },
            {
              icon: 'chatbubbles-outline',
              label: 'Среднее время ответа',
              value: formatHostResponseTime(hostResponseStats),
              loading: hostResponseStatsLoading,
            },
          ]}
        />

        <View
          onLayout={(e) => {
            inlineActionsLayoutRef.current = {
              y: e.nativeEvent.layout.y,
              height: e.nativeEvent.layout.height,
            };
          }}
          className="flex-row gap-3">
          {renderContactActions()}
        </View>

        <View className="mt-1 gap-3">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-xl font-extrabold text-ink">Объявления</Text>
            <Text className="text-sm font-semibold text-ink-secondary">
              {filteredListings.length} {formatListingsPlural(filteredListings.length)}
            </Text>
          </View>

          {/* Search & Filter Bar */}
          <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <SearchField
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Поиск в профиле"
              returnKeyType="search"
              onFocus={() => setIsSearchFocused(true)}
              containerStyle={{ flex: 1, marginRight: 10 }}
            />
            <Animated.View
              style={{
                width: filtersWidth,
                opacity: filtersOpacity,
                overflow: 'hidden',
                marginRight: 10,
              }}
            >
              <ListingLayoutToggle
                mode={layoutMode}
                onToggle={() => toggleLayoutMode('discovery')}
              />
            </Animated.View>
            <Animated.View style={{ width: filtersWidth, opacity: filtersOpacity, overflow: 'visible' }}>
                <Pressable
                  accessibilityLabel="Фильтры"
                  onPress={() => router.push({ pathname: '/filters', params: { ownerId: String(numericId) } })}
                  style={{
                    position: 'relative',
                    width: 48,
                    height: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: palette.line,
                    backgroundColor: palette.surface,
                    shadowColor: '#1A1A1A',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 6,
                    elevation: 3,
                  }}
                >
                  <Ionicons name="options-outline" size={22} color={palette.primary} />
                  {activeFiltersCount > 0 && (
                    <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.primary }}>
                      <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>{activeFiltersCount}</Text>
                    </View>
                  )}
                </Pressable>
            </Animated.View>
            <Animated.View style={{ width: cancelWidth, opacity: cancelOpacity, overflow: 'hidden' }}>
              <Pressable
                onPress={() => {
                  setIsSearchFocused(false);
                  setSearchQuery('');
                  searchInputRef.current?.blur();
                }}
                style={{ width: 80 }}
                className="pl-3 pr-1 h-12 justify-center"
              >
                <Text className="text-base font-semibold text-primary" numberOfLines={1}>Отменить</Text>
              </Pressable>
            </Animated.View>
          </View>

          {/* Listings List */}
          {listingsLoading ? (
            <View className="py-8 justify-center items-center">
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : filteredListings.length === 0 ? (
            <EmptyState
              icon="search-outline"
              title="Ничего не найдено"
              subtitle="Попробуйте изменить поисковый запрос или фильтры."
            />
          ) : (
            <View
              style={{
                flexDirection: layoutMode === 'grid' ? 'row' : 'column',
                flexWrap: layoutMode === 'grid' ? 'wrap' : 'nowrap',
                gap: layoutMode === 'grid' ? 12 : 8,
              }}
            >
              {filteredListings.map((item) => {
                const itemIsFavorite = favoriteIds?.has(item.id) ?? false;
                return (
                  <View key={item.id} style={layoutMode === 'grid' ? { width: '48%' } : undefined}>
                    <ListingCard
                      listing={item}
                      layout={layoutMode}
                      isFavorite={itemIsFavorite}
                      onToggleFavorite={() => toggleFavorite.mutate({ id: item.id, isFavorite: itemIsFavorite })}
                      onPress={() => router.push({ pathname: '/listing/[id]', params: { id: String(item.id) } })}
                      onBook={
                        sessionUserId !== item.owner_id
                          ? () =>
                              router.push({
                                pathname: '/booking/[id]',
                                params: { id: String(item.id) },
                              })
                          : undefined
                      }
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Buttons */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: palette.surface,
          borderTopWidth: 1,
          borderTopColor: palette.line,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: (insets.bottom || 0) + 12,
          transform: [
            {
              translateY: footerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [150, 0],
              }),
            },
          ],
          opacity: footerAnim,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
          elevation: 10,
          zIndex: 30,
        }}
      >
        <View className="flex-row gap-3">{renderContactActions('md')}</View>
      </Animated.View>

      <UserActionsSheet
        visible={userActionsVisible}
        userName={displayName}
        blocked={isBlocked}
        blockedByMe={blockedByMe}
        busy={blockUser.isPending || unblockUser.isPending}
        onClose={() => setUserActionsVisible(false)}
        onShare={() => {
          setUserActionsVisible(false);
          setTimeout(handleShare, 220);
        }}
        onReport={openReport}
        onBlock={confirmBlock}
        onUnblock={handleUnblock}
      />

      <ReportSheet
        visible={reportVisible}
        targetType="user"
        targetID={numericId}
        targetLabel={displayName}
        onClose={() => setReportVisible(false)}
      />

      <ImageViewerModal
        visible={avatarViewerVisible}
        images={publicAvatarUrl ? [publicAvatarUrl] : []}
        onClose={() => setAvatarViewerVisible(false)}
      />
    </View>
  );
}


const formatListingsPlural = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'объявлений';
  if (mod10 === 1) return 'объявление';
  if (mod10 >= 2 && mod10 <= 4) return 'объявления';
  return 'объявлений';
};
