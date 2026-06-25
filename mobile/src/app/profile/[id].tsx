import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  LayoutAnimation,
  Platform,
  UIManager,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Button, MetricTile, PastelIcon } from '@/components/ui';
import { useShimmer } from '@/hooks/useShimmer';
import { useFavoriteIds, useToggleFavorite } from '@/lib/api/favorites';
import { useListings } from '@/lib/api/listings';
import { formatRub } from '@/lib/format';
import { useFiltersStore, countActiveFilters } from '@/store/filters';
import { palette, shadows } from '@/theme/tokens';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function PublicProfileScreen() {
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
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { data: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Shimmer Sweep Animation from the shared hook
  const shimmerAnim = useShimmer();
  const windowWidth = Dimensions.get('window').width;
  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [-1, 1.5],
    outputRange: [-windowWidth, windowWidth * 1.5],
  });

  // Sticky Header animation logic
  const animVisible = useRef(new Animated.Value(0)).current;
  const isHeaderVisibleRef = useRef(false);

  const headerBgOpacity = animVisible;
  const titleOpacity = animVisible;

  const buttonBgOpacity = useMemo(() => {
    return animVisible.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    });
  }, [animVisible]);

  const titleTranslateY = useMemo(() => {
    return animVisible.interpolate({
      inputRange: [0, 1],
      outputRange: [10, 0],
    });
  }, [animVisible]);

  const iconColor = useMemo(() => {
    return animVisible.interpolate({
      inputRange: [0, 1],
      outputRange: ['#FFFFFF', palette.ink],
    });
  }, [animVisible]);

  const scrollY = useRef(new Animated.Value(0)).current;

  const bannerScale = scrollY.interpolate({
    inputRange: [-150, 0],
    outputRange: [1.2, 1],
    extrapolateRight: 'clamp',
  });

  const bannerTranslateY = scrollY.interpolate({
    inputRange: [-150, 0, 250],
    outputRange: [0, 0, 75],
    extrapolate: 'clamp',
  });

  const bannerOpacity = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const inlineActionsLayoutRef = useRef({ y: 0, height: 0 });
  const isStickyFooterVisibleRef = useRef(false);
  const footerAnim = useRef(new Animated.Value(0)).current;

  const handleMainScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const y = event.nativeEvent.contentOffset.y;
        const threshold = 120;
        if (y >= threshold) {
          if (!isHeaderVisibleRef.current) {
            isHeaderVisibleRef.current = true;
            Animated.timing(animVisible, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }).start();
          }
        } else {
          if (isHeaderVisibleRef.current) {
            isHeaderVisibleRef.current = false;
            Animated.timing(animVisible, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }).start();
          }
        }

        // Sticky buttons: should appear only when the inline action buttons are NOT on screen.
        // The ScrollView starts below the header, so the viewport spans from scroll y to scroll y + viewportHeight.
        const layout = inlineActionsLayoutRef.current;
        if (layout.y > 0) {
          const headerHeight = (insets.top || 0) + 64;
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
      },
    }
  );



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
  const hasFilters = activeFiltersCount > 0;

  // Listings list (load up to 100 listings so local filtering doesn't break pagination)
  const { data: listingsData, isLoading: listingsLoading } = useListings({ limit: 100 });
  const allListings = listingsData?.items ?? [];

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

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
    outputRange: [30, 0],
  });
  const filtersOpacity = searchAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [1, 0, 0],
  });

  const filteredListings = useMemo(() => {
    // 1. Filter by host owner_id
    let list = allListings.filter((item) => item.owner_id === numericId);

    // 2. Filter by search query (inline)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((item) => {
        const roomsNum = parseInt(item.rooms, 10);
        const cardTitle = (isNaN(roomsNum) || roomsNum <= 0) ? 'Современная студия' : `Уютная ${roomsNum}-комн. квартира`;
        return (
          cardTitle.toLowerCase().includes(q) ||
          item.address.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.city && item.city.toLowerCase().includes(q))
        );
      });
    }

    // 3. Filter by global filters store
    if (filters.priceMin !== null) {
      list = list.filter((item) => item.price >= filters.priceMin!);
    }
    if (filters.priceMax !== null) {
      list = list.filter((item) => item.price <= filters.priceMax!);
    }
    if (filters.rooms.length > 0) {
      list = list.filter((item) => {
        const itemRooms = parseInt(item.rooms, 10);
        const roomsCount = isNaN(itemRooms) ? 0 : itemRooms;
        return filters.rooms.some((r) => {
          if (r === 'studio') return roomsCount === 0;
          if (r === '1') return roomsCount === 1;
          if (r === '2') return roomsCount === 2;
          if (r === '3plus') return roomsCount >= 3;
          return false;
        });
      });
    }
    if (filters.city) {
      list = list.filter((item) =>
        item.city.toLowerCase().includes(filters.city!.toLowerCase())
      );
    }

    return list;
  }, [allListings, numericId, searchQuery, filters]);

  const handleCall = () => {
    if (!phone) {
      Alert.alert('Информация', 'Телефон владельца не указан.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Ошибка', 'Не удалось совершить звонок.');
    });
  };

  const handleMessage = () => {
    Alert.alert('Внимание', 'Прямой чат с хозяином находится в разработке.');
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

  // Listings count for metrics
  const hostListingsCount = useMemo(() => {
    return allListings.filter((item) => item.owner_id === numericId).length;
  }, [allListings, numericId]);

  return (
    <View className="flex-1 bg-surface-muted">
      {/* Sticky Header */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          paddingTop: (insets.top || 0) + 12,
          paddingBottom: 12,
        }}
        className="flex-row items-center px-4"
      >
        {/* Animated Solid Background Overlay */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: palette.surface,
            borderBottomWidth: 1,
            borderBottomColor: palette.line,
            opacity: headerBgOpacity,
          }}
        />

        {/* Back Button */}
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Назад"
          className="h-10 w-10 items-center justify-center rounded-full active:opacity-80 relative"
        >
          <Animated.View style={{ position: 'absolute', opacity: buttonBgOpacity }}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Animated.View>
          <Animated.View style={{ opacity: animVisible }}>
            <Ionicons name="chevron-back" size={24} color={palette.ink} />
          </Animated.View>
        </Pressable>

        {/* Title in center */}
        <View className="flex-1 px-3 justify-center">
          <Animated.View
            style={{
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            }}
          >
            <Text numberOfLines={1} className="text-base font-bold text-ink">
              {displayName}
            </Text>
          </Animated.View>
        </View>

        {/* Share Button */}
        <Pressable
          onPress={handleShare}
          accessibilityLabel="Поделиться"
          className="h-10 w-10 items-center justify-center rounded-full active:opacity-80 relative"
        >
          <Animated.View style={{ position: 'absolute', opacity: buttonBgOpacity }}>
            <Ionicons name="share-outline" size={22} color="#FFFFFF" />
          </Animated.View>
          <Animated.View style={{ opacity: animVisible }}>
            <Ionicons name="share-outline" size={22} color={palette.ink} />
          </Animated.View>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-28"
        onScroll={handleMainScroll}
        scrollEventThrottle={16}
      >
        {/* Profile Gradient Card with Sweep Animation */}
        <AnimatedLinearGradient
          colors={['#FF8E53', '#FF5A1F', '#FF2D55']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            paddingTop: (insets.top || 0) + 64,
            paddingBottom: 24,
            paddingHorizontal: 20,
            overflow: 'hidden',
            position: 'relative',
            transform: [
              { scale: bannerScale },
              { translateY: bannerTranslateY },
            ],
            opacity: bannerOpacity,
          }}
        >
          <View className="flex-row items-center gap-4">
            {/* Avatar container with double white border rings */}
            <View className="h-[84px] w-[84px] items-center justify-center rounded-full border border-white/40 p-[3px] flex-shrink-0">
              <View className="h-full w-full items-center justify-center rounded-full border-2 border-white bg-primary-light overflow-hidden">
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} className="h-full w-full rounded-full" />
                ) : (
                  <Text className="text-xl font-extrabold text-primary">{getInitials()}</Text>
                )}
              </View>
            </View>

            <View className="flex-1 justify-center">
              <View className="self-start rounded-pill bg-white/20 px-3 py-1">
                <Text className="text-xs font-bold text-white">Дом рядом</Text>
              </View>
              <Text numberOfLines={2} className="mt-1 text-2xl font-extrabold leading-8 text-white">
                {displayName}
              </Text>
              <Text numberOfLines={1} className="mt-0.5 text-sm leading-5 text-white opacity-95">
                {displayCity} · Хозяин
              </Text>
              {/* Rating block */}
              {ratingNum > 0 ? (
                <Pressable
                  onPress={onReviewsPress}
                  className="flex-row items-center gap-1.5 mt-1 active:opacity-75"
                >
                  <Ionicons name="star" size={14} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">{ratingNum.toFixed(1)}</Text>
                  <Text className="text-sm text-white/80">
                    ({reviewsCountNum} {formatReviewsPlural(reviewsCountNum)})
                  </Text>
                </Pressable>
              ) : (
                <View className="flex-row items-center gap-1 mt-1">
                  <Ionicons name="star" size={14} color="#FFFFFF" />
                  <Text className="text-sm text-white/80">Нет отзывов</Text>
                </View>
              )}
            </View>
          </View>

          {/* Shimmer shining sweep overlay */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 130,
              transform: [{ translateX: shimmerTranslateX }, { skewX: '-25deg' }],
            }}
            pointerEvents="none"
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </AnimatedLinearGradient>

        <View className="px-4">
          <Text className="mt-3 text-xs text-ink-muted">
            На Сутки.ру с 2024 года
          </Text>

        {/* 2x2 White Metrics Grid */}
        <View className="mt-4 gap-3">
          {/* Row 1: Listings & Rating */}
          <View className="flex-row gap-3">
            <MetricTile
              label="объявления"
              value={listingsLoading ? null : hostListingsCount}
              loading={listingsLoading}
            />
            <MetricTile
              label="рейтинг"
              value={listingsLoading ? null : (ratingNum > 0 ? ratingNum.toFixed(1) : '—')}
              loading={listingsLoading}
            />
          </View>

          {/* Row 2: Verification & Response Time */}
          <View className="flex-row gap-3">
            <MetricTile
              label="Документы проверены"
              value={verified ? 'Готово' : '—'}
              icon={<PastelIcon name="shield-checkmark-outline" />}
            />
            <MetricTile
              label="Среднее время ответа"
              value="12 мин"
              icon={<PastelIcon name="chatbubbles-outline" />}
            />
          </View>
        </View>

        {/* Actions Row */}
        <View
          onLayout={(e) => {
            inlineActionsLayoutRef.current = {
              y: e.nativeEvent.layout.y,
              height: e.nativeEvent.layout.height,
            };
          }}
          className="flex-row gap-3 mt-4"
        >
          <Pressable
            onPress={handleCall}
            className="flex-1 h-12 flex-row items-center justify-center gap-2 rounded-field bg-primary active:bg-primaryPressed"
          >
            <Ionicons name="call-outline" size={18} color="white" />
            <Text className="text-base font-semibold text-white">Позвонить</Text>
          </Pressable>

          <Pressable
            onPress={handleMessage}
            className="flex-1 h-12 flex-row items-center justify-center gap-2 rounded-field bg-surface-muted active:bg-surface-muted/80 border border-line"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={palette.ink} />
            <Text className="text-base font-semibold text-ink">Написать</Text>
          </Pressable>
        </View>

        {/* Listings Section */}
        <View className="mt-6 gap-3">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-lg font-bold text-ink">Объявления хозяина</Text>
            <Text className="text-sm font-semibold text-ink-secondary">
              {filteredListings.length} {formatListingsPlural(filteredListings.length)}
            </Text>
          </View>

          {/* Search & Filter Bar */}
          <View className="flex-row items-center gap-2">
            <View className="flex-1 h-12 flex-row items-center rounded-field border border-line bg-surface px-3">
              <Ionicons name="search" size={20} color={palette.inkMuted} />
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Поиск в профиле"
                placeholderTextColor={palette.inkMuted}
                className="ml-2 flex-1 text-base text-ink"
                returnKeyType="search"
                onFocus={() => {
                  setIsSearchFocused(true);
                }}
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  className="p-1 mr-1"
                >
                  <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
                </Pressable>
              )}
              <Animated.View style={{ width: filtersWidth, opacity: filtersOpacity, overflow: 'hidden' }}>
                <Pressable
                  accessibilityLabel="Фильтры"
                  onPress={() => router.push({ pathname: '/filters', params: { ownerId: String(numericId) } })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ width: 30 }}
                  className="p-1 relative justify-center items-center"
                >
                  <Ionicons name="options-outline" size={22} color={palette.primary} />
                  {activeFiltersCount > 0 && (
                    <View
                      style={{ height: 18, minWidth: 18 }}
                      className="absolute -right-1 -top-1 items-center justify-center rounded-full bg-primary px-1 border border-surface"
                    >
                      <Text className="text-[10px] font-bold text-white">{activeFiltersCount}</Text>
                    </View>
                  )}
                </Pressable>
              </Animated.View>
            </View>
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
            <View className="gap-2">
              {filteredListings.map((item) => {
                const itemIsFavorite = favoriteIds?.has(item.id) ?? false;
                return (
                  <HostListingCard
                    key={item.id}
                    listing={item}
                    isFavorite={itemIsFavorite}
                    onToggleFavorite={() => toggleFavorite.mutate({ id: item.id, isFavorite: itemIsFavorite })}
                    onPress={() => router.push({ pathname: '/listing/[id]', params: { id: String(item.id) } })}
                  />
                );
              })}
            </View>
          )}
        </View>
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
          <Pressable
            onPress={handleCall}
            className="flex-1 h-12 flex-row items-center justify-center gap-2 rounded-field bg-primary active:bg-primaryPressed"
          >
            <Ionicons name="call-outline" size={18} color="white" />
            <Text className="text-base font-semibold text-white">Позвонить</Text>
          </Pressable>

          <Pressable
            onPress={handleMessage}
            className="flex-1 h-12 flex-row items-center justify-center gap-2 rounded-field bg-surface-muted active:bg-surface-muted/80 border border-line"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={palette.ink} />
            <Text className="text-base font-semibold text-ink">Написать</Text>
          </Pressable>
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

          {listing.cover_url ? (
            <Image
              source={{ uri: listing.cover_url }}
              style={{ width: imgWidth, height: imgHeight }}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="image-outline" size={32} color={palette.inkMuted} />
            </View>
          )}
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

const formatReviewsPlural = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'отзывов';
  if (mod10 === 1) return 'отзыв';
  if (mod10 >= 2 && mod10 <= 4) return 'отзыва';
  return 'отзывов';
};

const formatListingsPlural = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'объявлений';
  if (mod10 === 1) return 'объявление';
  if (mod10 >= 2 && mod10 <= 4) return 'объявления';
  return 'объявлений';
};
