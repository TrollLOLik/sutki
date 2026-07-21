import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import {
	ActivityIndicator,
	Animated,
	FlatList,
	LayoutAnimation,
	Platform,
	Pressable,
	ScrollView,
	Share,
	Text,
	useWindowDimensions,
	View,
	TouchableOpacity,
	StyleSheet,
	UIManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import YaMap, { Marker, Circle } from 'react-native-yamap-plus';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { ResilientImage } from '@/components/ResilientImage';
import { Button, IconButton, MaterialSurface, materialSurfaceColor } from '@/components/ui';
import { ImageViewerModal } from '@/components/ui/ImageViewerModal';
import { useFavoriteIds, useToggleFavorite } from '@/lib/api/favorites';
import { listingKeys, recordListingView, useListing, useListings, type ListListingsParams } from '@/lib/api/listings';
import { generateSecureUUID } from '@/lib/guestId';
import { formatRating, formatReviewsCount, formatRub } from '@/lib/format';
import { useSessionStore } from '@/store/session';
import { useAppTheme } from '@/theme/useAppTheme';
import { NavigationBackButton } from '@/components/NavigationBackButton';

export default function ListingDetailScreen() {
  const { palette, isDark } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const { width } = useWindowDimensions();
  const { data, isLoading, isError, refetch } = useListing(numericId);
  const queryClient = useQueryClient();
  const { data: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const isFavorite = favoriteIds?.has(numericId) ?? false;
  const insets = useSafeAreaInsets();
  const viewEventIDRef = useRef(generateSecureUUID());
  const viewRequestStartedRef = useRef(false);

  const { user } = useSessionStore();

  const isMountedRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useEffect(() => {
    setActivePhotoIndex(0);
    setIsExpanded(false);
    viewEventIDRef.current = generateSecureUUID();
    viewRequestStartedRef.current = false;
  }, [numericId]);

  useEffect(() => {
    if (!data || viewRequestStartedRef.current) return;
    viewRequestStartedRef.current = true;
    recordListingView(numericId, viewEventIDRef.current)
      .then((result) => {
        queryClient.setQueryData(listingKeys.detail(numericId), { ...data, views: result.views });
      })
      .catch(() => {
        // View analytics must never block or visibly disturb listing details.
      });
  }, [data, numericId, queryClient]);

  const isOwnListing = useMemo(() => {
    if (!data || !user) return false;
    return data.owner_id === user.id;
  }, [data, user]);

  const rules = useMemo(() => {
    if (!data) return [];
    const list: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [];

    if (data.check_in_after) {
      const time = data.check_in_after.slice(0, 5);
      list.push({
        key: 'check_in',
        label: `Заезд после ${time}`,
        icon: 'time-outline',
      });
    }

    if (data.check_out_before) {
      const time = data.check_out_before.slice(0, 5);
      list.push({
        key: 'check_out',
        label: `Выезд до ${time}`,
        icon: 'time-outline',
      });
    }

    if (data.smoking_allowed) {
      let label = '';
      let icon: keyof typeof Ionicons.glyphMap = 'flame-outline';
      if (data.smoking_allowed === 'allowed') {
        label = 'Курение разрешено';
      } else if (data.smoking_allowed === 'forbidden') {
        label = 'Курение запрещено';
        icon = 'ban-outline';
      } else if (data.smoking_allowed === 'on_balcony') {
        label = 'Курение только на балконе';
      }
      if (label) {
        list.push({ key: 'smoking', label, icon });
      }
    }

    if (data.pets_allowed) {
      let label = '';
      let icon: keyof typeof Ionicons.glyphMap = 'paw-outline';
      if (data.pets_allowed === 'allowed') {
        label = 'Можно с питомцами';
      } else if (data.pets_allowed === 'forbidden') {
        label = 'Без питомцев';
        icon = 'ban-outline';
      } else if (data.pets_allowed === 'on_request') {
        label = 'Питомцы по запросу';
      }
      if (label) {
        list.push({ key: 'pets', label, icon });
      }
    }

    if (data.children_allowed) {
      let label = '';
      let icon: keyof typeof Ionicons.glyphMap = 'people-outline';
      if (data.children_allowed === 'allowed') {
        label = 'Можно с детьми';
      } else if (data.children_allowed === 'forbidden') {
        label = 'Без детей';
        icon = 'ban-outline';
      } else if (data.children_allowed === 'on_request') {
        label = 'Дети по запросу';
      }
      if (label) {
        list.push({ key: 'children', label, icon });
      }
    }

    if (data.events_allowed) {
      let label = '';
      let icon: keyof typeof Ionicons.glyphMap = 'musical-notes-outline';
      if (data.events_allowed === 'allowed') {
        label = 'Вечеринки разрешены';
      } else if (data.events_allowed === 'forbidden') {
        label = 'Без вечеринок и мероприятий';
        icon = 'ban-outline';
      } else if (data.events_allowed === 'on_request') {
        label = 'Мероприятия по запросу';
      }
      if (label) {
        list.push({ key: 'events', label, icon });
      }
    }

    return list;
  }, [data]);

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const animVisible = useRef(new Animated.Value(0)).current;
  const isHeaderVisibleRef = useRef(false);
  const titleBottomRef = useRef(368);

  const headerBgOpacity = animVisible;
  const titleOpacity = animVisible;

  const titleTranslateY = useMemo(() => {
    return animVisible.interpolate({
      inputRange: [0, 1],
      outputRange: [10, 0],
    });
  }, [animVisible]);

  const handleMainScroll = (event: any) => {
    if (!isMountedRef.current) return;
    const y = event.nativeEvent.contentOffset.y;
    const headerHeight = (insets.top || 0) + 64;
    const threshold = titleBottomRef.current - headerHeight;
    if (y >= threshold) {
      if (!isHeaderVisibleRef.current) {
        isHeaderVisibleRef.current = true;
        Animated.timing(animVisible, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    } else {
      if (isHeaderVisibleRef.current) {
        isHeaderVisibleRef.current = false;
        Animated.timing(animVisible, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  const similarParams = useMemo<ListListingsParams>(() => {
    if (!data) return { limit: 0 };

    const rooms = Number.parseInt(data.rooms, 10);
    const priceWindow = Math.max(Math.round(data.price * 0.25), 1000);

    return {
      limit: 8,
      city: data.city || undefined,
      rooms: Number.isNaN(rooms) ? undefined : [rooms],
      priceMin: Math.max(0, data.price - priceWindow),
      priceMax: data.price + priceWindow,
    };
  }, [data]);

  const {
    data: similarData,
    isLoading: similarLoading,
    isError: similarError,
  } = useListings(similarParams, { enabled: !!data });

  const similarListings = useMemo(() => {
    const items = similarData?.items ?? [];
    return items
      .filter((item) => item.id !== numericId)
      .filter((item) => !user || item.owner_id !== user.id)
      .slice(0, 4);
  }, [numericId, similarData?.items, user]);

  const onScroll = (event: any) => {
    if (!isMountedRef.current) return;
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    setActivePhotoIndex(Math.round(index));
  };

  const handleShare = async () => {
    if (!data) return;
    try {
      const title = getListingTitle();
      const address = getListingSubtitle();
      const priceFormatted = formatRub(data.price);
      const url = `https://sutki.ru/listing/${numericId}`;
      const message = `${title}\n📍 ${address}\n💵 ${priceFormatted} ₽ / сутки\n\n🔗 ${url}`;

      await Share.share({
        message,
        url,
        title,
      });
    } catch (error) {
      console.log('Error sharing listing:', error);
    }
  };

  const getListingTitle = () => {
    const isCottage = data?.categories.some((c) => c.name.toLowerCase().includes('коттедж')) ?? false;
    if (isCottage) {
      return 'Уютный коттедж на сутки';
    }
    const roomsNum = parseInt(data?.rooms ?? '0', 10);
    if (roomsNum === 1) {
      return 'Уютная однокомнатная квартира на сутки';
    } else if (roomsNum > 1 && roomsNum <= 4) {
      return `Уютная ${roomsNum}-комнатная квартира на сутки`;
    } else {
      return 'Уютная квартира на сутки в центре';
    }
  };

  const getListingSubtitle = () => {
    if (!data) return '';
    const city = data.city;
    const address = data.address;
    if (
      address.toLowerCase().includes('ул.') ||
      address.toLowerCase().includes('улица') ||
      address.toLowerCase().includes('пр.')
    ) {
      return `${city}, ${address}`;
    }
    return `${city}, ул. ${address}`;
  };

  const formatRoomsPlural = (rooms: string) => {
    const n = parseInt(rooms, 10);
    if (isNaN(n) || n <= 0) return 'Студия';
    if (n === 1) return '1 комната';
    if (n >= 2 && n <= 4) return `${n} комнаты`;
    return `${n} комнат`;
  };

  const getServiceIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('wi-fi') || lower.includes('интернет') || lower.includes('wifi')) return 'wifi-outline';
    if (lower.includes('кондиционер') || lower.includes('охлаждение')) return 'snow-outline';
    if (lower.includes('стирал') || lower.includes('машина')) return 'water-outline';
    if (lower.includes('балкон') || lower.includes('лоджия')) return 'log-out-outline';
    if (lower.includes('кухня') || lower.includes('плита')) return 'restaurant-outline';
    if (lower.includes('тв') || lower.includes('телевизор') || lower.includes('tv')) return 'tv-outline';
    return 'apps-outline';
  };

  const toggleDescription = () => {
    LayoutAnimation.configureNext({
      duration: 280,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.spring, springDamping: 0.86 },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    setIsExpanded((value) => !value);
  };

  const screenBackground = isDark ? '#0D0F12' : '#F4F5F7';
  const headerBackground = isDark ? '#14161B' : '#FFFFFF';
  const raisedSurface = materialSurfaceColor(isDark, 'raised');

  return (
    <View style={{ flex: 1, backgroundColor: screenBackground }}>
      {isLoading ? (
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: screenBackground }}>
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={palette.primary} />
          </View>
        </SafeAreaView>
      ) : isError || !data ? (
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: screenBackground }}>
          <View className="flex-1 gap-4 px-4 justify-center">
            <EmptyState
              icon="cloud-offline-outline"
              title="Не удалось загрузить объявление"
              subtitle="Проверьте подключение и попробуйте снова."
            />
            <View className="px-8">
              <Button label="Повторить" variant="secondary" onPress={() => refetch()} />
            </View>
          </View>
        </SafeAreaView>
      ) : (
        <>
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
            {/* Header material becomes visible as content scrolls under it. */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: headerBgOpacity,
                overflow: 'hidden',
              }}>
              <BlurView
                intensity={88}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: isDark ? 'rgba(20,22,27,0.72)' : 'rgba(255,255,255,0.72)' },
                ]}
              />
            </Animated.View>

            {/* Back Button */}
            <NavigationBackButton
              fallback="/(tabs)"
              size={48}
              variant="material"
            />

            {/* Title in center */}
            <View style={{ flex: 1, minWidth: 0, justifyContent: 'center', paddingHorizontal: 10 }}>
              <Animated.View
                style={{
                  opacity: titleOpacity,
                  transform: [{ translateY: titleTranslateY }],
                }}
              >
                <Text numberOfLines={1} className="text-base font-bold text-ink">
                  {getListingTitle()}
                </Text>
              </Animated.View>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {!isOwnListing && (
                <IconButton
                  icon={isFavorite ? 'heart' : 'heart-outline'}
                  iconSize={22}
                  size={48}
                  selected={isFavorite}
                  tone="primary"
                  onPress={() => toggleFavorite.mutate({ id: numericId, isFavorite })}
                  disabled={numericId <= 0}
                  accessibilityLabel={isFavorite ? 'Убрать из избранного' : 'В избранное'}
                />
              )}
              <IconButton
                icon="share-outline"
                iconSize={22}
                size={48}
                tone="primary"
                onPress={handleShare}
                accessibilityLabel="Поделиться"
              />

            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            onScroll={handleMainScroll}
            scrollEventThrottle={16}
          >
            <View className="relative h-[340px] bg-surface-skeleton">
              {data.photos.length > 0 ? (
                <FlatList
                  data={data.photos}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={onScroll}
                  scrollEventThrottle={16}
                  keyExtractor={(p) => String(p.id)}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => {
                        setSelectedImageIndex(index);
                        setGalleryVisible(true);
                      }}
                    >
                      <ResilientImage
                        uri={item.url}
                        style={{ width, height: 340 }}
                        transition={150}
                      />
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Ionicons name="image-outline" size={48} color={palette.inkMuted} />
                </View>
              )}

              {data.photos.length > 0 && (
                <View className="absolute bottom-8 right-4 bg-black/40 px-2.5 py-1 rounded-full">
                  <Text className="text-[11px] font-semibold text-white">
                    {activePhotoIndex + 1} / {data.photos.length}
                  </Text>
                </View>
              )}
            </View>

            <ImageViewerModal
              visible={galleryVisible}
              images={data.photos.map((p) => p.url)}
              initialIndex={selectedImageIndex}
              onClose={() => setGalleryVisible(false)}
            />

            <View
              className="rounded-t-[28px] mt-[-24px] px-4 pt-6 pb-8 gap-6"
              style={{ backgroundColor: screenBackground }}>
              {/* Moderation Banner for Owner */}
              {isOwnListing && data.status && data.status !== 'active' && (
                <View
                  className="rounded-card border p-4"
                  style={{
                    borderRadius: 16,
                    backgroundColor: data.status === 'rejected' ? palette.dangerLight : palette.primaryLight,
                    borderColor: data.status === 'rejected' ? 'rgba(229, 72, 77, 0.2)' : 'rgba(255, 90, 31, 0.2)',
                  }}
                >
                  <View className="flex-row items-start gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                      <Ionicons
                        name={data.status === 'rejected' ? 'alert-circle-outline' : data.status === 'unpublished' ? 'eye-off-outline' : 'time-outline'}
                        size={22}
                        color={data.status === 'rejected' ? palette.danger : palette.primary}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-extrabold text-ink">
                        {data.status === 'rejected'
                          ? 'Объявление отклонено'
                          : data.status === 'unpublished'
                          ? 'Снято с публикации'
                          : data.status === 'moderation_review'
                          ? 'На ручной проверке'
                          : 'На проверке'}
                      </Text>
                      {data.status === 'rejected' && data.rejection_reason ? (
                        <Text className="mt-1 text-sm leading-5 text-ink-secondary">
                          Причина: {data.rejection_reason}. Отредактируйте объявление, чтобы отправить его на повторную проверку.
                        </Text>
                      ) : null}
                      {(data.status === 'pending_moderation' || data.status === 'moderation_review') && (
                        <Text className="mt-1 text-sm leading-5 text-ink-secondary">
                          Объявление проходит проверку модерации и скоро появится на платформе.
                        </Text>
                      )}
                      {data.status === 'unpublished' ? (
                        <Text className="mt-1 text-sm leading-5 text-ink-secondary">
                          Объявление не показывается в поиске. Опубликовать его снова можно в разделе «Мои объявления».
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              )}

              <View
                className="gap-1"
                onLayout={(event) => {
                  const { y, height } = event.nativeEvent.layout;
                  // Hero height minus the overlap of the content surface.
                  titleBottomRef.current = 316 + y + height;
                }}
              >
                <Text className="text-2xl font-extrabold text-ink leading-tight">{getListingTitle()}</Text>
                <View className="mt-1 flex-row items-start gap-2">
                  <Ionicons name="location-outline" size={17} color={palette.inkMuted} style={{ marginTop: 1 }} />
                  <Text className="flex-1 text-sm leading-5 text-ink-secondary">{getListingSubtitle()}</Text>
                </View>
              </View>

              <View className="flex-row" style={{ gap: 10 }}>
                <Pressable
                  onPress={() => router.push({ pathname: '/reviews/[id]', params: { id } })}
                  className="flex-1 flex-row items-center gap-2 rounded-2xl border border-line px-3 py-3 active:opacity-70"
                  style={{ backgroundColor: raisedSurface }}>
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-light">
                    <Ionicons name="star" size={17} color={palette.primary} />
                  </View>
                  <View>
                    <Text className="text-sm font-extrabold text-ink">{formatRating(data.rating)}</Text>
                    <Text className="text-[11px] text-ink-secondary">{formatReviewsCount(data.reviews_count)}</Text>
                  </View>
                </Pressable>

                <View
                  className="flex-1 flex-row items-center gap-2 rounded-2xl border border-line px-3 py-3"
                  style={{ backgroundColor: raisedSurface }}>
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-muted">
                    <Ionicons name="eye-outline" size={17} color={palette.inkSecondary} />
                  </View>
                  <View>
                    <Text className="text-sm font-extrabold text-ink">{data.views}</Text>
                    <Text className="text-[11px] text-ink-secondary">просмотров</Text>
                  </View>
                </View>
              </View>

              <View className="flex-row items-baseline gap-1">
                <Text className="text-[28px] font-extrabold text-ink">{formatRub(data.price)} ₽</Text>
                <Text className="text-sm text-ink-muted">/ сутки</Text>
              </View>

              <View className="flex-row flex-wrap gap-2">
                <View className="bg-surface-muted px-3 py-1.5 rounded-xl">
                  <Text className="text-xs font-semibold text-ink-secondary">{formatRoomsPlural(data.rooms)}</Text>
                </View>
                {data.area > 0 && (
                  <View className="bg-surface-muted px-3 py-1.5 rounded-xl">
                    <Text className="text-xs font-semibold text-ink-secondary">{data.area} м²</Text>
                  </View>
                )}
                <View className="bg-surface-muted px-3 py-1.5 rounded-xl">
                  <Text className="text-xs font-semibold text-ink-secondary">до {data.max_guests || Math.max(1, parseInt(data.rooms, 10) * 2)} гостей</Text>
                </View>
                <View className="bg-surface-muted px-3 py-1.5 rounded-xl">
                  <Text className="text-xs font-semibold text-ink-secondary">{(data.id % 9) + 1} этаж</Text>
                </View>
              </View>

              {data.description ? (
                <MaterialSurface level="raised" radius={18} style={{ padding: 16 }}>
                  <View className="gap-2">
                    <Text className="text-base font-bold text-ink">Описание</Text>
                    <Text
                      numberOfLines={isExpanded ? undefined : 3}
                      className="text-sm leading-5 text-ink-secondary">
                      {data.description}
                    </Text>
                    <Pressable
                      onPress={toggleDescription}
                      className="mt-1 flex-row items-center self-start py-1 active:opacity-70">
                      <Text className="mr-1 text-sm font-bold text-primary">
                        {isExpanded ? 'Свернуть' : 'Подробнее'}
                      </Text>
                      <MotiView
                        animate={{ rotate: isExpanded ? '180deg' : '0deg' }}
                        transition={{ type: 'spring', damping: 20, stiffness: 240 }}>
                        <Ionicons name="chevron-down" size={17} color={palette.primary} />
                      </MotiView>
                    </Pressable>
                  </View>
                </MaterialSurface>
              ) : null}

              {data.services.length > 0 ? (
                <View className="gap-3">
                  <Text className="text-base font-bold text-ink">Удобства</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {data.services.map((s) => (
                      <View
                        key={s.id}
                        style={{ width: '31.5%', backgroundColor: raisedSurface }}
                        className="rounded-xl border border-line p-2 flex-row items-center gap-1.5">
                        <Ionicons name={getServiceIcon(s.name)} size={20} color={palette.primary} />
                        <Text numberOfLines={2} className="text-[10px] font-semibold text-ink-secondary flex-1 leading-tight">
                          {s.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {rules.length > 0 ? (
                <View className="gap-3">
                  <Text className="text-base font-bold text-ink">Правила проживания</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {rules.map((rule) => (
                      <MaterialSurface
                        key={rule.key}
                        level="raised"
                        radius={16}
                        style={{
                          width: (width - 42) / 2,
                          minHeight: 76,
                          justifyContent: 'center',
                          paddingHorizontal: 12,
                          paddingVertical: 11,
                        }}>
                        <View className="flex-row items-center" style={{ gap: 9 }}>
                          <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light">
                            <Ionicons name={rule.icon} size={17} color={palette.primary} />
                          </View>
                          <Text className="flex-1 text-xs font-semibold leading-4 text-ink" numberOfLines={3}>
                            {rule.label}
                          </Text>
                        </View>
                      </MaterialSurface>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* AI Reviews Summary Card */}
              {data.reviews_summary ? (
                <View className="gap-3">
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="sparkles" size={16} color={palette.primary} />
                    <Text className="text-base font-bold text-ink">Что говорят гости (ИИ)</Text>
                  </View>
                  <MaterialSurface
                    level="raised"
                    radius={18}
                    style={{ borderColor: 'rgba(255,90,31,0.22)', padding: 16 }}>
                    <Text className="text-sm leading-5 text-ink-secondary">
                      {data.reviews_summary}
                    </Text>
                  </MaterialSurface>
                </View>
              ) : null}

              {/* Владелец жилья (Avito Style) */}
              <View className="gap-3">
                <Text className="text-base font-bold text-ink">Владелец жилья</Text>
                
                <MaterialSurface level="raised" radius={18} style={{ padding: 16 }}>
                  <Pressable
                    onPress={() => {
                      if (isOwnListing) {
                        router.navigate('/(tabs)/profile');
                        return;
                      }
                      router.push({
                        pathname: '/profile/[id]',
                        params: {
                          id: String(data.owner_id),
                          name: data.owner_name,
                          surname: data.owner_surname,
                          patronymic: data.owner_patronymic,
                          phone: data.owner_phone,
                          avatarUrl: data.owner_avatar_url,
                          rating: String(data.owner_rating),
                          reviewsCount: String(data.owner_reviews_count),
                          isVerified: data.owner_is_verified ? 'true' : 'false',
                          city: data.city,
                          listingId: id,
                        },
                      });
                    }}
                    className="flex-row items-start gap-4 active:opacity-80"
                  >
                    {/* Left: Avatar */}
                    <View className="w-14 h-14 rounded-full overflow-hidden bg-primary-light items-center justify-center flex-shrink-0">
                      {data.owner_avatar_url ? (
                        <Image
                          source={{ uri: data.owner_avatar_url }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                        />
                      ) : (
                        <Text className="text-xl font-bold text-primary">
                          {(() => {
                            const nameStr = [data.owner_name, data.owner_patronymic, data.owner_surname].filter(Boolean).join(' ');
                            const letter = nameStr ? nameStr[0] : (data.owner_phone ? 'Т' : 'А');
                            return letter.toUpperCase();
                          })()}
                        </Text>
                      )}
                    </View>

                    {/* Right: Info */}
                    <View className="flex-1 gap-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xl font-bold text-ink leading-tight flex-1">
                          {(() => {
                            const nameStr = [data.owner_name, data.owner_patronymic, data.owner_surname].filter(Boolean).join(' ');
                            return nameStr || 'Арендодатель';
                          })()}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
                      </View>
                      
                      {/* Rating row */}
                      <View className="flex-row items-center gap-1.5 mt-0.5">
                        <Text className="text-sm font-semibold text-ink">
                          {data.owner_rating > 0 ? data.owner_rating.toFixed(1) : '0.0'}
                        </Text>
                        <View className="flex-row items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Ionicons
                              key={star}
                              name="star"
                              size={12}
                              color={star <= Math.round(data.owner_rating || 0) ? '#FFB400' : '#E4E4E7'}
                            />
                          ))}
                        </View>
                        <Text className="text-sm text-ink-secondary">
                          {formatReviewsPlural(data.owner_reviews_count || 0)}
                        </Text>
                      </View>

                      {/* Active listings count */}
                      <Text className="text-sm text-ink-secondary">
                        {formatListingsPlural(data.owner_listings_count || 0)}
                      </Text>
                    </View>
                  </Pressable>


                  {/* Badges block */}
                  <View className="flex-row flex-wrap gap-2 mt-3 border-t border-line/60 pt-3">
                    {data.owner_is_verified && (
                      <View className="bg-success-light px-3 py-1 rounded-pill">
                        <Text className="text-xs font-semibold text-success">Документы проверены</Text>
                      </View>
                    )}
                    {data.owner_phone ? (
                      <View className="bg-primary-light px-3 py-1 rounded-pill">
                        <Text className="text-xs font-semibold text-primary">Телефон подтвержден</Text>
                      </View>
                    ) : null}
                  </View>
                </MaterialSurface>
              </View>

              {data.lat != null && data.lng != null && (data.qc_geo == null || data.qc_geo < 2) ? (
                <View className="gap-3">
                  <Text className="text-base font-bold text-ink">На карте</Text>
                  <Pressable
                    onPress={() => router.push(`/listing/${id}/location`)}
                    className="h-64 rounded-2xl border border-line/60 overflow-hidden relative"
                  >
                    <YaMap
                      style={{ width: '100%', height: '100%' }}
                      showUserPosition={false}
                      nightMode={isDark}
                      initialRegion={{ lat: data.lat, lon: data.lng, zoom: 14 }}
                    >
                      {data.radius > 0 ? (
                        <Circle
                          center={{ lat: data.lat, lon: data.lng }}
                          radius={data.radius}
                          fillColor="rgba(255, 90, 31, 0.1)"
                          strokeColor="rgba(255, 90, 31, 0.3)"
                          strokeWidth={1}
                        />
                      ) : (
                        <Marker point={{ lat: data.lat, lon: data.lng }} />
                      )}
                    </YaMap>
                    {/* Intercept touches to direct them to navigate */}
                    <View style={StyleSheet.absoluteFill} className="bg-transparent" />
                  </Pressable>
                  {data.location_summary ? (
                    <View
                      className="mt-1 px-4 py-3 rounded-2xl border border-line/60"
                      style={{ backgroundColor: raisedSurface }}>
                      <Text className="text-sm leading-5 text-ink-secondary">
                        {data.location_summary}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {(similarLoading || (!similarError && similarListings.length > 0)) ? (
                <View className="gap-3">
                  <View className="flex-row items-end justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-base font-bold text-ink">Похожие варианты</Text>
                      <Text className="mt-1 text-xs text-ink-secondary">
                        В том же городе и близком бюджете
                      </Text>
                    </View>
                    {similarListings.length > 0 ? (
                      <View className="rounded-pill bg-primary-light px-3 py-1">
                        <Text className="text-xs font-bold text-primary">{similarListings.length}</Text>
                      </View>
                    ) : null}
                  </View>

                  {similarLoading ? (
                    <View className="gap-3">
                      {[1, 2].map((item) => (
                        <View
                          key={item}
                          className="rounded-card border border-line p-3"
                          style={{ backgroundColor: raisedSurface }}>
                          <View className="flex-row gap-3">
                            <View className="h-28 w-[45%] rounded-field bg-surface-skeleton" />
                            <View className="flex-1 justify-between py-1">
                              <View className="gap-2">
                                <View className="h-3 w-20 rounded-pill bg-surface-skeleton" />
                                <View className="h-4 w-full rounded-pill bg-surface-skeleton" />
                                <View className="h-3 w-28 rounded-pill bg-surface-skeleton" />
                              </View>
                              <View className="h-5 w-24 rounded-pill bg-surface-skeleton" />
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View>
                      {similarListings.map((item) => {
                        const itemIsFavorite = favoriteIds?.has(item.id) ?? false;
                        return (
                          <ListingCard
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
              ) : null}
            </View>
          </ScrollView>

          <SafeAreaView
            edges={['bottom']}
            style={{
              backgroundColor: headerBackground,
              paddingHorizontal: 16,
              paddingTop: 12,
              shadowColor: '#000',
              shadowOpacity: isDark ? 0.3 : 0.09,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: -8 },
              elevation: 8,
            }}>
            {isOwnListing ? (
              <Button
                label="Редактировать"
                onPress={() => router.push({ pathname: '/create', params: { editId: id } } as any)}
              />
            ) : (
              <View className="flex-row items-center" style={{ gap: 14 }}>
                <View style={{ minWidth: 108 }}>
                  <Text className="text-lg font-extrabold text-ink">{formatRub(data.price)} ₽</Text>
                  <Text className="text-xs text-ink-muted">за сутки</Text>
                </View>
                <View className="flex-1">
                  <Button
                    label="Оставить заявку"
                    onPress={() => router.push({ pathname: '/booking/[id]', params: { id } })}
                  />
                </View>
              </View>
            )}
          </SafeAreaView>
        </>
      )}
    </View>
  );
}

const formatReviewsPlural = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) {
    return `${count} отзывов`;
  }
  if (mod10 === 1) {
    return `${count} отзыв`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} отзыва`;
  }
  return `${count} отзывов`;
};

const formatListingsPlural = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) {
    return `${count} объявлений`;
  }
  if (mod10 === 1) {
    return `${count} объявление`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} объявления`;
  }
  return `${count} объявлений`;
};
