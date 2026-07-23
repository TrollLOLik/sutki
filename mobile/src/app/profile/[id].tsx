import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { ListingLayoutToggle } from '@/components/ListingLayoutToggle';
import { ResilientImage } from '@/components/ResilientImage';
import { Button, IconButton } from '@/components/ui';
import { ProfileHero, ProfileMetricGrid } from '@/components/profile/ProfileOverview';
import { useFavoriteIds, useToggleFavorite } from '@/lib/api/favorites';
import { filtersToListParams, useListings } from '@/lib/api/listings';
import { formatRub } from '@/lib/format';
import { useFiltersStore, countActiveFilters } from '@/store/filters';
import { useFindOrCreateConversation } from '@/lib/api/chat';
import { ApiError } from '@/lib/api/client';
import { useHostResponseStats } from '@/lib/api/hostStats';
import { formatHostResponseTime } from '@/lib/formatHostStats';
import { shadows } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import { NavigationBackButton } from '@/components/NavigationBackButton';
import { requireAuth } from '@/lib/requireAuth';
import { useSessionStore } from '@/store/session';
import { appAlert as Alert } from '@/components/AppAlert';
import { useListingLayoutStore } from '@/store/listing-layout';

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
    reviewsCount,
    isVerified,
    city,
    listingId,
  } = useLocalSearchParams<{
    id: string;
    name?: string;
    surname?: string;
    patronymic?: string;
    phone?: string;
    avatarUrl?: string;
    rating?: string;
    reviewsCount?: string;
    isVerified?: string;
    city?: string;
    listingId?: string;
  }>();

  const numericId = Number(id);
  const sessionUserId = useSessionStore((state) => state.user?.id);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { data: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const layoutMode = useListingLayoutStore((state) => state.discovery);
  const toggleLayoutMode = useListingLayoutStore((state) => state.toggleMode);

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



  const displayName = [name, patronymic, surname].filter(Boolean).join(' ') || 'Арендодатель';
  const displayCity = city || 'Челябинск';
  const ratingNum = rating ? Number(rating) : 0;
  const reviewsCountNum = reviewsCount ? Number(reviewsCount) : 0;
  const verified = isVerified === 'true';

  const getInitials = () => {
    const parts = [name, surname].filter((p): p is string => !!p);
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
    if (!phone) {
      Alert.alert('Информация', 'Телефон владельца не указан.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Ошибка', 'Не удалось совершить звонок.');
    });
  };

  const { mutateAsync: findOrCreateConv, isPending: isCreatingChat } = useFindOrCreateConversation();

  const handleMessage = async () => {
    if (!requireAuth('generic')) return;
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
      const url = `https://sutki.ru/profile/${numericId}`;
      const message = `Профиль арендодателя ${displayName} на Сутки.ру\nРейтинг: ${ratingNum > 0 ? ratingNum.toFixed(1) + ' ★' : 'Нет оценок'}\n🔗 ${url}`;
      await Share.share({
        message,
        url,
        title: `Профиль ${displayName}`,
      });
    } catch (error) {
      console.log('Error sharing profile:', error);
    }
  };

  // Open host reviews page (isHost = true)
  const onReviewsPress = () => {
    router.push({
      pathname: '/reviews/[id]',
      params: { id: String(numericId), isHost: 'true' },
    });
  };

  const hostListingsCount = hostListingCountData?.total ?? 0;

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
            accessibilityLabel="Поделиться профилем"
            icon="share-outline"
            iconSize={21}
            onPress={handleShare}
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
          avatarUri={avatarUrl || null}
          city={displayCity}
          initials={getInitials()}
          name={displayName}
          onRatingPress={onReviewsPress}
          rating={ratingNum}
          reviewsCount={reviewsCountNum}
          subtitle="Арендодатель"
          verifiedLabel={phone ? 'Номер подтверждён' : verified ? 'Профиль подтверждён' : undefined}
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
              tone: 'neutral',
            },
            {
              icon: phone ? 'checkmark-circle-outline' : 'call-outline',
              label: 'Номер телефона',
              value: phone ? 'Подтверждён' : 'Не указан',
              tone: phone ? 'success' : 'neutral',
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
          {phone ? (
            <View className="flex-1">
              <Button label="Позвонить" icon="call-outline" onPress={handleCall} />
            </View>
          ) : null}
          <View className="flex-1">
            <Button
              label="Написать"
              icon="chatbubble-ellipses-outline"
              loading={isCreatingChat}
              onPress={handleMessage}
              variant={phone ? 'secondary' : 'primary'}
            />
          </View>
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
            <View
              style={{
                flex: 1,
                height: 48,
                marginRight: 10,
                paddingHorizontal: 12,
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 24,
                borderWidth: 1,
                borderColor: palette.line,
                backgroundColor: palette.surface,
                shadowColor: '#1A1A1A',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
                elevation: 3,
              }}>
              <Ionicons name="search" size={20} color={palette.inkMuted} />
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Поиск в профиле"
                placeholderTextColor={palette.inkMuted}
                style={{ flex: 1, paddingVertical: 0, marginLeft: 8, marginRight: 8, fontSize: 14, fontWeight: '500', color: palette.ink }}
                returnKeyType="search"
                onFocus={() => {
                  setIsSearchFocused(true);
                }}
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  className="h-8 w-8 items-center justify-center"
                >
                  <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
                </Pressable>
              )}
            </View>
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
        <View className="flex-row gap-3">
          {phone ? (
            <View className="flex-1">
              <Button label="Позвонить" icon="call-outline" onPress={handleCall} size="md" />
            </View>
          ) : null}
          <View className="flex-1">
            <Button
              label="Написать"
              icon="chatbubble-ellipses-outline"
              loading={isCreatingChat}
              onPress={handleMessage}
              size="md"
              variant={phone ? 'secondary' : 'primary'}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Custom listing card matching LK tokens: white card, large photo, shadows.card, pastel orange "Открыть" button.
 */
function HostListingCard({
  listing,
  onPress,
  isFavorite,
  onToggleFavorite,
}: {
  listing: any;
  onPress: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const { palette } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const cardInnerWidth = screenWidth - 32;
  const imgWidth = cardInnerWidth * 0.45;
  const imgHeight = imgWidth * (3 / 4);

  const getCardTitle = () => {
    const roomsNum = parseInt(listing.rooms, 10);
    if (isNaN(roomsNum) || roomsNum <= 0) {
      return 'Современная студия';
    }
    return `Уютная ${roomsNum}-комн. квартира`;
  };

  const formatRoomsPlural = (rooms: string) => {
    const n = parseInt(rooms, 10);
    if (isNaN(n) || n <= 0) return 'Студия';
    if (n === 1) return '1 комната';
    if (n >= 2 && n <= 4) return `${n} комнаты`;
    return `${n} комнат`;
  };

  const metroTime = (listing.id % 12) + 4;
  const showSuccessBadge = listing.id % 2 === 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="mb-4 rounded-[24px] border border-line bg-surface p-3 active:opacity-95"
      style={shadows.card}
    >
      <View className="flex-row gap-3">
        {/* Left: Image with rounded corners */}
        <View
          style={{
            width: imgWidth,
            height: imgHeight,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: palette.surfaceSkeleton,
            position: 'relative',
          }}
        >
          {showSuccessBadge ? (
            <View
              style={{
                position: 'absolute',
                left: 8,
                top: 8,
                borderRadius: 999,
                backgroundColor: '#2EAD6B',
                paddingHorizontal: 8,
                paddingVertical: 3,
                zIndex: 10,
              }}
            >
              <Text style={{ fontSize: 8, fontWeight: '700', color: '#fff', lineHeight: 10 }}>
                Свободно сегодня
              </Text>
            </View>
          ) : (
            <View
              style={{
                position: 'absolute',
                left: 8,
                top: 8,
                borderRadius: 999,
                backgroundColor: '#2F80ED',
                paddingHorizontal: 8,
                paddingVertical: 3,
                zIndex: 10,
              }}
            >
              <Text style={{ fontSize: 8, fontWeight: '700', color: '#fff', lineHeight: 10 }}>
                Проверено
              </Text>
            </View>
          )}

          <ResilientImage
            uri={listing.cover_url}
            style={{ width: imgWidth, height: imgHeight }}
            fallbackSize={32}
            transition={150}
          />
        </View>

        {/* Right: Details */}
        <View className="flex-1 justify-between py-0.5">
          <View className="gap-1">
            {/* Rating & Favorite */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1">
                <Ionicons name="star" size={14} color="#FFB400" />
                <Text className="text-xs font-bold text-ink">{listing.rating.toFixed(1).replace('.', ',')}</Text>
                <Text className="text-xs text-ink-muted">({listing.reviews_count})</Text>
              </View>
              {onToggleFavorite ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                  }}
                  hitSlop={8}
                >
                  <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={20}
                    color={isFavorite ? palette.primary : palette.inkSecondary}
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Title */}
            <Text numberOfLines={2} className="text-sm font-bold text-ink leading-tight">
              {getCardTitle()}
            </Text>

            {/* Address */}
            <Text numberOfLines={1} className="text-xs text-ink-secondary">
              {listing.address}
            </Text>

            {/* Metro */}
            <View className="flex-row items-center gap-1 mt-0.5">
              <Text className="text-danger font-black text-xs leading-none">М</Text>
              <Text numberOfLines={1} className="text-[11px] text-ink-secondary">
                {listing.city}, {metroTime} мин
              </Text>
            </View>

            {/* Specs */}
            <View className="flex-row items-center gap-2.5 mt-1.5 flex-wrap">
              <View className="flex-row items-center gap-0.5">
                <Ionicons name="expand-outline" size={12} color={palette.inkMuted} />
                <Text className="text-[10px] text-ink-secondary">{listing.area} м²</Text>
              </View>
              <View className="flex-row items-center gap-0.5">
                <Ionicons name="bed-outline" size={12} color={palette.inkMuted} />
                <Text numberOfLines={1} className="text-[10px] text-ink-secondary">
                  {formatRoomsPlural(listing.rooms)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom Part: Price and Pastel Button */}
      <View className="flex-row justify-between items-center mt-3 pt-1">
        <View className="flex-row items-baseline gap-1">
          <Text className="text-lg font-black text-ink">{formatRub(listing.price)} ₽</Text>
          <Text className="text-xs text-ink-muted">/ ночь</Text>
        </View>

        <Pressable
          onPress={onPress}
          className="rounded-full bg-primary-light px-6 py-2.5 active:opacity-85"
        >
          <Text className="text-sm font-bold text-primary">Открыть</Text>
        </Pressable>
      </View>
    </Pressable>
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
