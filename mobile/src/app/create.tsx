import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
	Alert,
	TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { presignMediaUpload, uploadToS3 } from '@/lib/api/media';
import { api } from '@/lib/api/client';
import { env } from '@/lib/env';
import { storeRef } from '@/lib/api/store-ref';

import { Button, Chip, Input } from '@/components/ui';
import {
  useCategories,
  useCreateListing,
  useServices,
  useUpdateListing,
  type NewListingInput,
} from '@/lib/api/create-listing';
import { useListing } from '@/lib/api/listings';
import { suggestCities, suggestAddress, type DaDataSuggestion } from '@/lib/api/cities';
import { useCreateListingStore } from '@/store/create-listing';
import { palette } from '@/theme/tokens';
import YaMap, { Marker, Search, AddressKind, Animation } from 'react-native-yamap-plus';
import * as Location from 'expo-location';

const TOTAL_STEPS = 6;
const LISTING_PRICE_RUB = 199;
const ROOM_OPTIONS = ['1', '2', '3', '4', '5+'];

const formatTimeInput = (text: string) => {
  const digits = text.replace(/\D/g, '').split('');
  const result: string[] = [];
  
  for (let i = 0; i < digits.length; i++) {
    const d = digits[i];
    const len = result.length;
    
    if (len === 0) {
      if (d >= '3' && d <= '9') {
        result.push('0');
        result.push(d);
      } else {
        result.push(d);
      }
    } else if (len === 1) {
      const hour = parseInt(result[0] + d, 10);
      if (hour <= 23) {
        result.push(d);
      } else {
        result[0] = '2';
        result.push('3');
      }
    } else if (len === 2) {
      if (d >= '0' && d <= '5') {
        result.push(d);
      }
    } else if (len === 3) {
      result.push(d);
    }
    
    if (result.length >= 4) {
      break;
    }
  }
  
  if (result.length === 0) return '';
  if (result.length <= 2) return result.join('');
  return `${result.slice(0, 2).join('')}:${result.slice(2).join('')}`;
};

const STEP_TITLES = [
  'Тип жилья',
  'Адрес',
  'Параметры',
  'Описание',
  'Фотографии',
  'Публикация',
];

export default function CreateListingScreen() {
  const draft = useCreateListingStore();
  const { data: categories } = useCategories();
  const { data: services } = useServices();
  const createListing = useCreateListing();

  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditing = editId != null && editId.length > 0;
  const editListingId = isEditing ? Number(editId) : undefined;

  const { data: editListing, isLoading: isEditLoading } = useListing(editListingId);
  const updateListing = useUpdateListing();

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [published, setPublished] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [previousDescription, setPreviousDescription] = useState('');

  const [loadedEdit, setLoadedEdit] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, { progress: number; error: boolean; key?: string }>>({});

  const generateAIDescription = async (action: string = 'generate') => {
    if (action === 'generate' && !draft.city) {
      Alert.alert('Недостаточно данных', 'Пожалуйста, укажите город на первом шаге, чтобы составить описание.');
      return;
    }
    if (action === 'neighborhood' && !draft.city) {
      Alert.alert('Недостаточно данных', 'Пожалуйста, укажите город на первом шаге.');
      return;
    }

    const currentText = draft.description || '';
    setPreviousDescription(currentText);
    setIsGeneratingDescription(true);
    draft.setField('description', ''); // Start with empty field to stream text into

    try {
      const selectedAmenities = (services ?? [])
        .filter((s) => draft.serviceIds.includes(s.id))
        .map((s) => s.name);

      const rulesList: string[] = [];
      if (draft.smokingAllowed === 'allowed') rulesList.push('Можно курить');
      else if (draft.smokingAllowed === 'on_balcony') rulesList.push('Курение разрешено только на балконе');
      else if (draft.smokingAllowed === 'forbidden') rulesList.push('Курение запрещено');

      if (draft.petsAllowed === 'allowed') rulesList.push('Можно с питомцами');
      else if (draft.petsAllowed === 'on_request') rulesList.push('Питомцы по согласованию');
      else if (draft.petsAllowed === 'forbidden') rulesList.push('Без питомцев');

      if (draft.childrenAllowed === 'allowed') rulesList.push('Можно с детьми');
      else if (draft.childrenAllowed === 'on_request') rulesList.push('Дети по согласованию');
      else if (draft.childrenAllowed === 'forbidden') rulesList.push('Без детей');

      if (draft.eventsAllowed === 'allowed') rulesList.push('Разрешены вечеринки');
      else if (draft.eventsAllowed === 'on_request') rulesList.push('Вечеринки по согласованию');
      else if (draft.eventsAllowed === 'forbidden') rulesList.push('Без вечеринок');

      const token = storeRef.getState?.()?.accessToken;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${env.apiUrl}/api/v1/ai/listing-description`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          city: draft.city,
          street: draft.street,
          rooms: draft.countRoom,
          area: parseInt(draft.area) || 0,
          price: parseInt(draft.price) || 0,
          amenities: selectedAmenities,
          house_rules: rulesList,
          draft_description: currentText,
          action,
          stream: true,
          category: (categories ?? []).find((c) => draft.categoryIds.includes(c.id))?.name || 'Жилье',
          max_guests: parseInt(draft.maxGuests) || 0,
          check_in_after: draft.checkInAfter,
          check_out_before: draft.checkOutBefore,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ошибка API: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      const reader = (response.body as any).getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        draft.setField('description', accumulated);
      }
    } catch (err: any) {
      console.warn('[CreateListing] AI generation error:', err);
      Alert.alert('ИИ временно недоступен', err.message || 'Не удалось обработать текст. Попробуйте позже.');
      // Restore description back if failed
      draft.setField('description', currentText);
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  useEffect(() => {
    if (isEditing && editListing && !loadedEdit) {
      useCreateListingStore.setState({
        categoryIds: editListing.categories.map((c) => c.id),
        countRoom: editListing.rooms,
        city: editListing.city,
        street: editListing.street || '',
        houseNumber: editListing.house_number || '',
        lat: editListing.lat || null,
        lng: editListing.lng || null,
        qcGeo: editListing.qc_geo || null,
        area: String(editListing.area),
        price: String(editListing.price),
        maxGuests: editListing.max_guests != null ? String(editListing.max_guests) : '',
        serviceIds: editListing.services.map((s) => s.id),
        description: editListing.description,
        photos: editListing.photos.map((p) => p.url),
        checkInAfter: editListing.check_in_after || '',
        checkOutBefore: editListing.check_out_before || '',
        smokingAllowed: editListing.smoking_allowed || '',
        petsAllowed: editListing.pets_allowed || '',
        childrenAllowed: editListing.children_allowed || '',
        eventsAllowed: editListing.events_allowed || '',
      });

      const initialStatuses: Record<string, { progress: number; error: boolean; key: string }> = {};
      editListing.photos.forEach((p) => {
        let key = '';
        if (p.url.includes('/listings/')) {
          key = 'listings/' + p.url.split('/listings/').pop();
        } else {
          key = p.url;
        }
        initialStatuses[p.url] = { progress: 1, error: false, key };
      });
      setUploadStatuses(initialStatuses);
      setLoadedEdit(true);
    }
  }, [isEditing, editListing, loadedEdit]);

  useEffect(() => {
    if (!isEditing) {
      draft.reset();
      setUploadStatuses({});
    }
  }, [isEditing]);

  const uploadListingPhoto = async (uri: string) => {
    if (uploadStatuses[uri]?.key && !uploadStatuses[uri]?.error) {
      return;
    }

    setUploadStatuses((prev) => ({
      ...prev,
      [uri]: { progress: 0, error: false },
    }));

    try {
      const fileName = uri.split('/').pop() || 'photo.jpg';
      const ext = fileName.split('.').pop() || 'jpg';
      const mimeType = `image/${ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg'}`;
      const size = 1024 * 1024; // fallback size

      const target = await presignMediaUpload(fileName, size, mimeType, 'listing');
      await uploadToS3(uri, target, fileName, mimeType, (progress) => {
        setUploadStatuses((prev) => ({
          ...prev,
          [uri]: { ...prev[uri], progress },
        }));
      });

      setUploadStatuses((prev) => ({
        ...prev,
        [uri]: { progress: 1, error: false, key: target.key },
      }));
    } catch (err) {
      console.error('[CreateListing] Upload photo failed:', err);
      setUploadStatuses((prev) => ({
        ...prev,
        [uri]: { progress: 0, error: true },
      }));
    }
  };

  const pickListingPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Разрешение отклонено', 'Нам нужен доступ к галерее для выбора фото.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 10 - draft.photos.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newUris = result.assets.map((a) => a.uri);
      newUris.forEach((uri) => {
        draft.addPhoto(uri);
        uploadListingPhoto(uri);
      });
    }
  };

  // City autocomplete
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [cityFocused, setCityFocused] = useState(false);
  const cityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!cityFocused) return;
    if (cityTimer.current) clearTimeout(cityTimer.current);
    if (draft.city.trim().length < 2) {
      setCitySuggestions([]);
      return;
    }
    cityTimer.current = setTimeout(() => {
      suggestCities(draft.city.trim()).then(setCitySuggestions);
    }, 300);
    return () => {
      if (cityTimer.current) clearTimeout(cityTimer.current);
    };
  }, [draft.city, cityFocused]);

  // References for map and loop prevention
  const mapRef = useRef<any>(null);
  const isProgrammaticRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  // Address suggestions
  const [streetSuggestions, setStreetSuggestions] = useState<DaDataSuggestion[]>([]);
  const [streetFocused, setStreetFocused] = useState(false);
  const streetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [houseSuggestions, setHouseSuggestions] = useState<DaDataSuggestion[]>([]);
  const [houseFocused, setHouseFocused] = useState(false);
  const houseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Non-modal banner state for reverse geocoding
  const [suggestedAddressText, setSuggestedAddressText] = useState<string | null>(null);
  const [suggestedCoords, setSuggestedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestedComponents, setSuggestedComponents] = useState<any[] | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const centerMap = (lat: number, lng: number, zoom = 16) => {
    if (mapRef.current) {
      isProgrammaticRef.current = true;
      mapRef.current.setCenter({ lat, lon: lng }, zoom, 0, 0, 0.4, Animation.SMOOTH);
    }
  };

  const hasCenteredRef = useRef(false);

  // Center map once when Step 1 loads
  useEffect(() => {
    if (step !== 1) {
      hasCenteredRef.current = false;
      return;
    }
    if (mapReady && mapRef.current && !hasCenteredRef.current) {
      hasCenteredRef.current = true;
      if (draft.lat != null && draft.lng != null) {
        const t = setTimeout(() => {
          centerMap(draft.lat!, draft.lng!, 16);
        }, 150);
        return () => clearTimeout(t);
      } else if (draft.city.trim().length > 0) {
        const fullAddress = [
          draft.city.trim(),
          draft.street.trim(),
          draft.houseNumber.trim(),
        ].filter(Boolean).join(', ');

        const t = setTimeout(() => {
          Search.geocodeAddress(fullAddress)
            .then((point) => {
              if (point && point.lat != null && point.lon != null) {
                centerMap(point.lat, point.lon, draft.street ? 16 : 11);
              }
            })
            .catch((err) => {
              console.warn('[CreateListing] Initial geocode error:', err);
            });
        }, 150);
        return () => clearTimeout(t);
      }
    }
  }, [step, mapReady, draft.city, draft.street, draft.houseNumber, draft.lat, draft.lng]);

  // Load street suggestions
  useEffect(() => {
    if (!streetFocused) return;
    if (streetTimer.current) clearTimeout(streetTimer.current);
    if (draft.street.trim().length < 2) {
      setStreetSuggestions([]);
      return;
    }
    streetTimer.current = setTimeout(() => {
      suggestAddress(draft.street.trim(), 'street', draft.city.trim()).then(setStreetSuggestions);
    }, 300);
    return () => {
      if (streetTimer.current) clearTimeout(streetTimer.current);
    };
  }, [draft.street, streetFocused, draft.city]);

  // Load house suggestions
  useEffect(() => {
    if (!houseFocused) return;
    if (houseTimer.current) clearTimeout(houseTimer.current);
    if (draft.houseNumber.trim().length === 0) {
      setHouseSuggestions([]);
      return;
    }
    houseTimer.current = setTimeout(() => {
      suggestAddress(draft.houseNumber.trim(), 'house', draft.city.trim(), draft.street.trim()).then(setHouseSuggestions);
    }, 300);
    return () => {
      if (houseTimer.current) clearTimeout(houseTimer.current);
    };
  }, [draft.houseNumber, houseFocused, draft.city, draft.street]);

  const handleCameraChangeEnd = async (event: any) => {
    // Loop prevention check
    if (isProgrammaticRef.current) {
      isProgrammaticRef.current = false;
      return;
    }

    const nativeEvent = event?.nativeEvent;
    let lat: number | undefined;
    let lon: number | undefined;

    if (nativeEvent?.point) {
      lat = nativeEvent.point.lat;
      lon = nativeEvent.point.lon;
    } else if (event?.point) {
      lat = event.point.lat;
      lon = event.point.lon;
    }

    if (lat == null || lon == null) return;

    try {
      const res = await Search.searchPoint({ lat, lon }, 18);
      if (res && res.formatted) {
        setSuggestedAddressText(res.formatted);
        setSuggestedCoords({ lat, lng: lon });
        setSuggestedComponents(res.Components || []);
      }
    } catch (err) {
      console.error('[CreateListing] Reverse geocode error:', err);
    }
  };

  const applySuggestedAddress = () => {
    if (!suggestedCoords || !suggestedComponents) return;

    let country = '';
    let region = '';
    let area = '';
    let locality = '';
    let district = '';
    let street = '';
    let house = '';

    suggestedComponents.forEach((c) => {
      const name = c.name;
      const kindVal = c.kind;

      const isKind = (typeStr: string, typeEnum: AddressKind) => {
        if (typeof kindVal === 'number') return kindVal === typeEnum;
        if (typeof kindVal === 'string') {
          const lower = kindVal.toLowerCase();
          return lower === typeStr || lower === String(typeEnum);
        }
        return false;
      };

      if (isKind('locality', AddressKind.LOCALITY)) {
        locality = name;
      } else if (isKind('street', AddressKind.STREET) || isKind('route', AddressKind.ROUTE)) {
        street = name;
      } else if (isKind('house', AddressKind.HOUSE)) {
        house = name;
      } else if (isKind('country', AddressKind.COUNTRY)) {
        country = name;
      } else if (isKind('region', AddressKind.REGION) || isKind('province', AddressKind.PROVINCE)) {
        region = name;
      } else if (isKind('area', AddressKind.AREA)) {
        area = name;
      } else if (isKind('district', AddressKind.DISTRICT)) {
        district = name;
      }
    });

    const finalCity = locality || district || area || region || country || '';
    
    // Clean up street name to remove designator prefixes/suffixes (e.g. "улица", "ул.")
    let finalStreet = street.trim();
    const designatorsPattern = /^(улица|ул\.?|проспект|просп\.?|пр-кт|пр\.?|переулок|пер\.?|проезд|пр-д\.?|бульвар|б-вар|б-р\.?|набережная|наб\.?|шоссе|ш\.?)\s+|[\s,]+(улица|ул\.?|проспект|просп\.?|пр-кт|пр\.?|переулок|пер\.?|проезд|пр-д\.?|бульвар|б-вар|б-р\.?|набережная|наб\.?|шоссе|ш\.?)$/gi;
    finalStreet = finalStreet.replace(designatorsPattern, '').trim();

    // Clean up house number if it contains street name or comma
    let finalHouse = house.trim();
    if (finalHouse.includes(',')) {
      finalHouse = finalHouse.split(',').pop()?.trim() || '';
    }
    if (street && finalHouse.toLowerCase().includes(street.toLowerCase())) {
      finalHouse = finalHouse.replace(new RegExp(street, 'gi'), '').trim();
    }
    if (finalStreet && finalHouse.toLowerCase().includes(finalStreet.toLowerCase())) {
      finalHouse = finalHouse.replace(new RegExp(finalStreet, 'gi'), '').trim();
    }
    finalHouse = finalHouse.replace(/^[\s,]+|[\s,]+$/g, '');

    draft.setField('city', finalCity);
    draft.setField('street', finalStreet);
    draft.setField('houseNumber', finalHouse);

    draft.setField('lat', suggestedCoords.lat);
    draft.setField('lng', suggestedCoords.lng);
    draft.setField('qcGeo', 0); // Manually verified exact level

    setSuggestedAddressText(null);
    setSuggestedCoords(null);
    setSuggestedComponents(null);
  };

  const locateMe = async () => {
    setIsLocating(true);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          'Службы геолокации отключены',
          'Пожалуйста, включите службы геолокации (GPS) в настройках вашего устройства.'
        );
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Доступ запрещен', 'Разрешите доступ к местоположению в настройках устройства.');
        return;
      }

      // Race position request against 3s timeout
      const getPositionPromise = (async () => {
        let tempLoc = await Location.getLastKnownPositionAsync();
        if (!tempLoc) {
          tempLoc = await Location.getCurrentPositionAsync({ 
            accuracy: Location.Accuracy.Balanced,
          });
        }
        return tempLoc;
      })();

      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 3000)
      );

      const loc = await Promise.race([getPositionPromise, timeoutPromise]);

      if (!loc) {
        Alert.alert(
          'Не удалось получить геопозицию',
          'Убедитесь, что GPS включен, у устройства есть доступ к спутникам и повторите попытку.'
        );
        return;
      }

      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;

      centerMap(lat, lng, 16);

      const res = await Search.searchPoint({ lat, lon: lng }, 18);
      if (res && res.formatted) {
        setSuggestedAddressText(res.formatted);
        setSuggestedCoords({ lat, lng });
        setSuggestedComponents(res.Components || []);
      }
    } catch (err) {
      console.warn('[CreateListing] Locate me error:', err);
      Alert.alert(
        'Ошибка геолокации',
        'Не удалось получить геопозицию. Убедитесь, что службы геолокации включены и у приложения есть доступ.'
      );
    } finally {
      setIsLocating(false);
    }
  };

  const close = () => {
    draft.reset();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  if (isEditing && isEditLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface justify-center items-center">
        <ActivityIndicator color={palette.primary} />
      </SafeAreaView>
    );
  }

  const validateStep = (s: number): string | null => {
    switch (s) {
      case 0:
        if (draft.categoryIds.length === 0) return 'Выберите тип жилья';
        if (!draft.countRoom) return 'Укажите количество комнат';
        return null;
      case 1:
        if (draft.city.trim().length < 2) return 'Укажите город';
        if (draft.street.trim().length < 2) return 'Укажите улицу';
        if (draft.houseNumber.trim().length < 1) return 'Укажите номер дома';
        return null;
      case 2:
        if (!(Number(draft.area) > 0)) return 'Укажите площадь';
        if (!(Number(draft.price) > 0)) return 'Укажите цену за ночь';
        return null;
      case 3: {
        if (draft.description.trim().length < 10) return 'Добавьте описание (минимум 10 символов)';
        const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
        if (draft.checkInAfter && !timeRegex.test(draft.checkInAfter)) {
          return 'Время заезда должно быть в формате ЧЧ:ММ (например, 14:00)';
        }
        if (draft.checkOutBefore && !timeRegex.test(draft.checkOutBefore)) {
          return 'Время выезда должно быть в формате ЧЧ:ММ (например, 12:00)';
        }
        return null;
      }
      case 4: {
        const statuses = draft.photos.map((uri) => uploadStatuses[uri]);
        const hasUploading = statuses.some((s) => s && !s.key && !s.error);
        const hasError = statuses.some((s) => s && s.error);
        if (hasUploading) {
          return 'Пожалуйста, дождитесь окончания загрузки всех фотографий.';
        }
        if (hasError) {
          return 'Некоторые фотографии не удалось загрузить. Попробуйте еще раз или удалите их.';
        }
        return null;
      }
      default:
        return null;
    }
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const goBack = () => {
    setError(null);
    if (step === 0) close();
    else setStep((s) => s - 1);
  };

  const handlePublish = async () => {
    setError(null);
    const payload: NewListingInput = {
      city: draft.city.trim(),
      street: draft.street.trim(),
      house_number: draft.houseNumber.trim(),
      description: draft.description.trim(),
      price: Math.round(Number(draft.price)),
      count_room: draft.countRoom.replace('+', ''),
      area: Math.round(Number(draft.area)),
      max_guests: draft.maxGuests !== '' ? Math.round(Number(draft.maxGuests)) : null,
      lat: draft.lat,
      lng: draft.lng,
      qc_geo: draft.qcGeo,
      service_ids: draft.serviceIds,
      category_ids: draft.categoryIds,
      check_in_after: draft.checkInAfter || null,
      check_out_before: draft.checkOutBefore || null,
      smoking_allowed: draft.smokingAllowed || null,
      pets_allowed: draft.petsAllowed || null,
      children_allowed: draft.childrenAllowed || null,
      events_allowed: draft.eventsAllowed || null,
      photos: draft.photos.map((p) => uploadStatuses[p]?.key).filter(Boolean) as string[],
    };

    if (isEditing) {
      try {
        await updateListing.mutateAsync({ id: editListingId!, input: payload });
        setPublished(true);
      } catch (e) {
        setError('Не удалось сохранить изменения. Попробуйте ещё раз.');
      }
      return;
    }

    setPaying(true);
    // Payment is a front-end stub for the MVP (no YooKassa yet): simulate the
    // 199 ₽ charge, then create the listing.
    await new Promise((r) => setTimeout(r, 900));
    try {
      await createListing.mutateAsync(payload);
      setPaying(false);
      setPublished(true);
    } catch (e) {
      setPaying(false);
      setError('Не удалось опубликовать объявление. Попробуйте ещё раз.');
    }
  };

  const progress = useMemo(() => (step + 1) / TOTAL_STEPS, [step]);

  if (published) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center px-6">
          <MotiView
            from={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 12 }}
            className="h-20 w-20 items-center justify-center rounded-full bg-success-light">
            <Ionicons name="checkmark" size={44} color={palette.success} />
          </MotiView>
          <Text className="mt-6 text-center text-2xl font-bold text-ink">
            {isEditing ? 'Объявление обновлено!' : 'Объявление опубликовано!'}
          </Text>
          <Text className="mt-2 text-center text-base text-ink-secondary">
            {isEditing
              ? 'Изменения уже видны в поиске. Управлять им можно в разделе «Мои объявления».'
              : 'Оно уже доступно в поиске. Управлять им можно в разделе «Мои объявления».'}
          </Text>
          <View style={{ width: '100%', maxWidth: 320, gap: 12, marginTop: 32 }}>
            <Button
              label="Мои объявления"
              onPress={() => {
                draft.reset();
                router.replace('/my-listings' as any);
              }}
            />
            <Button
              label="На главную"
              variant="secondary"
              onPress={() => {
                draft.reset();
                router.replace('/(tabs)');
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <Pressable onPress={goBack} className="h-10 w-10 items-center justify-center active:opacity-60">
          <Ionicons name={step === 0 ? 'close' : 'arrow-back'} size={26} color={palette.ink} />
        </Pressable>
        <Text className="text-base font-semibold text-ink">{STEP_TITLES[step]}</Text>
        <Text className="w-10 text-right text-sm font-medium text-ink-muted">
          {step + 1}/{TOTAL_STEPS}
        </Text>
      </View>

      {/* Progress bar */}
      <View className="mx-4 h-1.5 overflow-hidden rounded-pill bg-surface-muted">
        <MotiView
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: 'timing', duration: 250 }}
          className="h-full rounded-pill bg-primary"
        />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <View className="gap-6">
              <View className="gap-3">
                <Text className="text-base font-semibold text-ink">Какое жильё вы сдаёте?</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(categories ?? []).map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      selected={draft.categoryIds.includes(c.id)}
                      onPress={() => draft.toggleCategory(c.id)}
                    />
                  ))}
                  {categories == null && <ActivityIndicator color={palette.primary} />}
                </View>
              </View>
              <View className="gap-3">
                <Text className="text-base font-semibold text-ink">Количество комнат</Text>
                <View className="flex-row flex-wrap gap-2">
                  {ROOM_OPTIONS.map((r) => (
                    <Chip
                      key={r}
                      label={r}
                      selected={draft.countRoom === r}
                      onPress={() => draft.setField('countRoom', r)}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}



          {step === 1 && (
            <View className="gap-5">
              {/* City Input */}
              <View className="gap-2">
                <Text className="text-sm font-medium text-ink-secondary">Город</Text>
                <Input
                  icon="location-outline"
                  placeholder="Например, Магнитогорск"
                  value={draft.city}
                  onChangeText={(t) => draft.setField('city', t)}
                  onFocus={() => setCityFocused(true)}
                  onBlur={() => setTimeout(() => setCityFocused(false), 150)}
                />
                {cityFocused && citySuggestions.length > 0 && (
                  <View className="overflow-hidden rounded-field border border-line bg-surface z-50">
                    {citySuggestions.slice(0, 5).map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => {
                          draft.setField('city', c);
                          setCitySuggestions([]);
                          setCityFocused(false);
                          Search.geocodeAddress(c)
                            .then((point) => {
                              if (point && point.lat != null && point.lon != null) {
                                draft.setField('lat', point.lat);
                                draft.setField('lng', point.lon);
                                draft.setField('qcGeo', 3); // City level
                                centerMap(point.lat, point.lon, 11);
                              }
                            })
                            .catch((err) => console.warn('[CreateListing] City selection geocode error:', err));
                        }}
                        className="border-b border-line px-4 py-3 active:bg-surface-muted">
                        <Text className="text-sm text-ink">{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Street Input */}
              <View className="gap-2">
                <Text className="text-sm font-medium text-ink-secondary">Улица</Text>
                <Input
                  icon="map-outline"
                  placeholder="Улица"
                  value={draft.street}
                  onChangeText={(t) => draft.setField('street', t)}
                  onFocus={() => setStreetFocused(true)}
                  onBlur={() => setTimeout(() => setStreetFocused(false), 150)}
                />
                {streetFocused && streetSuggestions.length > 0 && (
                  <View className="overflow-hidden rounded-field border border-line bg-surface z-50">
                    {streetSuggestions.slice(0, 5).map((s) => (
                      <Pressable
                        key={s.value}
                        onPress={() => {
                          const val = s.data.street || s.value;
                          draft.setField('street', val);
                          setStreetSuggestions([]);
                          setStreetFocused(false);
                          Search.geocodeAddress(`${draft.city.trim()}, ${val}`)
                            .then((point) => {
                              if (point && point.lat != null && point.lon != null) {
                                draft.setField('lat', point.lat);
                                draft.setField('lng', point.lon);
                                draft.setField('qcGeo', 2); // Street level
                                centerMap(point.lat, point.lon, 14);
                              }
                            })
                            .catch((err) => console.warn('[CreateListing] Street selection geocode error:', err));
                        }}
                        className="border-b border-line px-4 py-3 active:bg-surface-muted">
                        <Text className="text-sm text-ink">{s.value}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* House Input */}
              <View className="gap-2">
                <Text className="text-sm font-medium text-ink-secondary">Дом</Text>
                <Input
                  icon="home-outline"
                  placeholder="Номер дома"
                  value={draft.houseNumber}
                  onChangeText={(t) => draft.setField('houseNumber', t)}
                  onFocus={() => setHouseFocused(true)}
                  onBlur={() => setTimeout(() => setHouseFocused(false), 150)}
                />
                {houseFocused && houseSuggestions.length > 0 && (
                  <View className="overflow-hidden rounded-field border border-line bg-surface z-50">
                    {houseSuggestions.slice(0, 5).map((h) => (
                      <Pressable
                        key={h.value}
                        onPress={() => {
                          const val = h.data.house || h.value;
                          draft.setField('houseNumber', val);
                          setHouseSuggestions([]);
                          setHouseFocused(false);

                          if (h.data.geo_lat && h.data.geo_lon) {
                            const lat = parseFloat(h.data.geo_lat);
                            const lng = parseFloat(h.data.geo_lon);
                            const qc = h.data.qc_geo ? parseInt(h.data.qc_geo, 10) : 0;
                            
                            draft.setField('lat', lat);
                            draft.setField('lng', lng);
                            draft.setField('qcGeo', qc);

                            centerMap(lat, lng, 16);
                          }
                        }}
                        className="border-b border-line px-4 py-3 active:bg-surface-muted">
                        <Text className="text-sm text-ink">{h.value}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Interactive Yandex Map */}
              <View className="h-[280px] rounded-2xl border border-line overflow-hidden relative mt-2 bg-surface-muted">
                <YaMap
                  ref={(ref) => {
                    mapRef.current = ref;
                    if (ref && !mapReady) {
                      setMapReady(true);
                    }
                  }}
                  style={{ width: '100%', height: '100%' }}
                  showUserPosition={false}
                  onCameraPositionChangeEnd={handleCameraChangeEnd}
                  initialRegion={{
                    lat: draft.lat || 55.7558,
                    lon: draft.lng || 37.6173,
                    zoom: draft.lat ? 16 : 10,
                  }}
                >
                  {draft.lat != null && draft.lng != null && (
                    <Marker point={{ lat: draft.lat, lon: draft.lng }} />
                  )}
                </YaMap>
                
                {/* Static Center Pin Selector */}
                <View style={{ position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -18 }, { translateY: -42 }] }} pointerEvents="none">
                  <Ionicons name="location" size={36} color={palette.primary} />
                </View>

                {/* Locate Me FAB */}
                <Pressable
                  onPress={locateMe}
                  disabled={isLocating}
                  className="absolute top-3 right-3 bg-surface border border-line h-10 w-10 rounded-full items-center justify-center shadow active:bg-surface-muted"
                >
                  {isLocating ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <Ionicons name="locate-outline" size={20} color={palette.ink} />
                  )}
                </Pressable>

                {/* Non-modal geocoded address banner */}
                {suggestedAddressText && (
                  <View className="absolute bottom-3 left-3 right-3 bg-surface border border-line rounded-2xl p-3 flex-row items-center justify-between shadow-lg">
                    <View className="flex-1 mr-3">
                      <Text className="text-[10px] uppercase font-bold text-ink-secondary tracking-wider">Найдено на карте</Text>
                      <Text className="text-xs font-semibold text-ink mt-0.5" numberOfLines={2}>
                        {suggestedAddressText}
                      </Text>
                    </View>
                    <Pressable
                      onPress={applySuggestedAddress}
                      className="bg-primary px-3 py-2 rounded-xl active:opacity-85"
                    >
                      <Text className="text-xs font-bold text-white">Применить</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          )}

          {step === 2 && (
            <View className="gap-5">
              <View className="flex-row gap-3">
                <View className="flex-1 gap-2">
                  <Text className="text-sm font-medium text-ink-secondary">Площадь, м²</Text>
                  <Input
                    icon="resize-outline"
                    placeholder="45"
                    keyboardType="number-pad"
                    value={draft.area}
                    onChangeText={(t) => draft.setField('area', t.replace(/[^0-9]/g, ''))}
                  />
                </View>
                <View className="flex-1 gap-2">
                  <Text className="text-sm font-medium text-ink-secondary">Цена за ночь, ₽</Text>
                  <Input
                    icon="cash-outline"
                    placeholder="2500"
                    keyboardType="number-pad"
                    value={draft.price}
                    onChangeText={(t) => draft.setField('price', t.replace(/[^0-9]/g, ''))}
                  />
                </View>
              </View>
              <View className="gap-2">
                <Text className="text-sm font-medium text-ink-secondary">Гостей (макс.)</Text>
                <Input
                  icon="people-outline"
                  placeholder="4"
                  keyboardType="number-pad"
                  value={draft.maxGuests}
                  onChangeText={(t) => draft.setField('maxGuests', t.replace(/[^0-9]/g, ''))}
                />
              </View>
              <View className="gap-3">
                <Text className="text-base font-semibold text-ink">Удобства</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(services ?? []).map((s) => (
                    <Chip
                      key={s.id}
                      label={s.name}
                      selected={draft.serviceIds.includes(s.id)}
                      onPress={() => draft.toggleService(s.id)}
                    />
                  ))}
                  {services == null && <ActivityIndicator color={palette.primary} />}
                </View>
              </View>
            </View>
          )}

          {step === 3 && (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-ink">Расскажите о жилье</Text>
                <TouchableOpacity
                  onPress={() => generateAIDescription(draft.description && draft.description.trim().length > 0 ? 'improve' : 'generate')}
                  disabled={isGeneratingDescription}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
                  activeOpacity={0.7}
                >
                  {isGeneratingDescription ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <Ionicons name="sparkles" size={14} color={palette.primary} />
                  )}
                  <Text className="text-xs font-semibold text-primary">
                    {isGeneratingDescription 
                      ? 'Обработка...' 
                      : (draft.description && draft.description.trim().length > 0 ? 'Улучшить текст' : 'Сгенерировать черновик')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View className="rounded-field border border-line bg-surface px-4 py-3">
                <TextInput
                  placeholder="Опишите квартиру, район, что рядом, правила заселения…"
                  placeholderTextColor={palette.inkMuted}
                  value={draft.description}
                  onChangeText={(t) => draft.setField('description', t)}
                  multiline
                  textAlignVertical="top"
                  editable={!isGeneratingDescription}
                  style={{ minHeight: 160, fontSize: 15, color: isGeneratingDescription ? palette.inkMuted : palette.ink }}
                />
              </View>
              
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-ink-muted">
                  {draft.description ? draft.description.trim().length : 0} / 1500 символов
                </Text>
                {previousDescription ? (
                  <TouchableOpacity
                    disabled={isGeneratingDescription}
                    onPress={() => {
                      draft.setField('description', previousDescription);
                      setPreviousDescription('');
                    }}
                    className="flex-row items-center gap-1 active:opacity-75"
                  >
                    <Ionicons name="arrow-undo-outline" size={13} color={palette.primary} />
                    <Text className="text-xs font-semibold text-primary">Отменить изменения</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {draft.description && draft.description.trim().length > 0 ? (
                <View className="mt-1">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} className="py-1">
                    <TouchableOpacity
                      disabled={isGeneratingDescription}
                      onPress={() => generateAIDescription('shorter')}
                      className="px-3 py-1.5 rounded-full bg-surface border border-line active:bg-surface-muted"
                    >
                      <Text className="text-xs text-ink-secondary">📝 Короче</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={isGeneratingDescription}
                      onPress={() => generateAIDescription('longer')}
                      className="px-3 py-1.5 rounded-full bg-surface border border-line active:bg-surface-muted"
                    >
                      <Text className="text-xs text-ink-secondary">✍️ Подробнее</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={isGeneratingDescription}
                      onPress={() => generateAIDescription('friendly')}
                      className="px-3 py-1.5 rounded-full bg-surface border border-line active:bg-surface-muted"
                    >
                      <Text className="text-xs text-ink-secondary">😊 Дружелюбнее</Text>
                    </TouchableOpacity>
                    {draft.city ? (
                      <TouchableOpacity
                        disabled={isGeneratingDescription}
                        onPress={() => generateAIDescription('neighborhood')}
                        className="px-3 py-1.5 rounded-full bg-surface border border-line active:bg-surface-muted"
                      >
                        <Text className="text-xs text-ink-secondary">📍 Про район</Text>
                      </TouchableOpacity>
                    ) : null}
                  </ScrollView>
                </View>
              ) : null}

              {/* Rules UI */}
              <View className="mt-4 gap-4">
                <Text className="text-base font-semibold text-ink">Правила заселения</Text>
                
                <View className="flex-row gap-3">
                  <View className="flex-1 gap-2">
                    <Text className="text-sm font-medium text-ink-secondary">Заезд после (ЧЧ:ММ)</Text>
                    <Input
                      placeholder="14:00"
                      value={draft.checkInAfter}
                      onChangeText={(t) => draft.setField('checkInAfter', formatTimeInput(t))}
                      maxLength={5}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View className="flex-1 gap-2">
                    <Text className="text-sm font-medium text-ink-secondary">Выезд до (ЧЧ:ММ)</Text>
                    <Input
                      placeholder="12:00"
                      value={draft.checkOutBefore}
                      onChangeText={(t) => draft.setField('checkOutBefore', formatTimeInput(t))}
                      maxLength={5}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                {/* Rules options */}
                <View className="gap-3 mt-2">
                  <Text className="text-sm font-medium text-ink-secondary">Курение</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {[
                      { value: 'allowed', label: 'Можно' },
                      { value: 'forbidden', label: 'Запрещено' },
                      { value: 'on_balcony', label: 'На балконе' },
                    ].map((opt) => (
                      <Chip
                        key={opt.value}
                        label={opt.label}
                        selected={draft.smokingAllowed === opt.value}
                        onPress={() => {
                          draft.setField('smokingAllowed', draft.smokingAllowed === opt.value ? '' : opt.value);
                        }}
                      />
                    ))}
                  </View>
                </View>

                <View className="gap-3">
                  <Text className="text-sm font-medium text-ink-secondary">Домашние животные</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {[
                      { value: 'allowed', label: 'Можно' },
                      { value: 'forbidden', label: 'Запрещено' },
                      { value: 'on_request', label: 'По запросу' },
                    ].map((opt) => (
                      <Chip
                        key={opt.value}
                        label={opt.label}
                        selected={draft.petsAllowed === opt.value}
                        onPress={() => {
                          draft.setField('petsAllowed', draft.petsAllowed === opt.value ? '' : opt.value);
                        }}
                      />
                    ))}
                  </View>
                </View>

                <View className="gap-3">
                  <Text className="text-sm font-medium text-ink-secondary">Можно с детьми</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {[
                      { value: 'allowed', label: 'Можно' },
                      { value: 'forbidden', label: 'Запрещено' },
                      { value: 'on_request', label: 'По запросу' },
                    ].map((opt) => (
                      <Chip
                        key={opt.value}
                        label={opt.label}
                        selected={draft.childrenAllowed === opt.value}
                        onPress={() => {
                          draft.setField('childrenAllowed', draft.childrenAllowed === opt.value ? '' : opt.value);
                        }}
                      />
                    ))}
                  </View>
                </View>

                <View className="gap-3">
                  <Text className="text-sm font-medium text-ink-secondary">Вечеринки и мероприятия</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {[
                      { value: 'allowed', label: 'Можно' },
                      { value: 'forbidden', label: 'Запрещено' },
                      { value: 'on_request', label: 'По запросу' },
                    ].map((opt) => (
                      <Chip
                        key={opt.value}
                        label={opt.label}
                        selected={draft.eventsAllowed === opt.value}
                        onPress={() => {
                          draft.setField('eventsAllowed', draft.eventsAllowed === opt.value ? '' : opt.value);
                        }}
                      />
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}

          {step === 4 && (
            <View className="gap-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-ink">Фотографии ({draft.photos.length} / 10)</Text>
                {draft.photos.length > 0 && draft.photos.length < 10 && (
                  <TouchableOpacity onPress={pickListingPhotos} activeOpacity={0.7}>
                    <Text className="text-sm font-semibold text-primary">Добавить еще</Text>
                  </TouchableOpacity>
                )}
              </View>

              {draft.photos.length === 0 ? (
                <TouchableOpacity
                  onPress={pickListingPhotos}
                  activeOpacity={0.7}
                  className="items-center justify-center gap-3 rounded-card border border-dashed border-line bg-surface-muted px-6 py-12"
                >
                  <Ionicons name="images-outline" size={40} color={palette.primary} />
                  <Text className="text-center text-sm font-semibold text-ink">Добавить фотографии</Text>
                  <Text className="text-center text-xs text-ink-secondary leading-4 px-4">
                    Выберите до 10 фотографий жилья. Первая выбранная станет обложкой объявления.
                  </Text>
                </TouchableOpacity>
              ) : (
                <View className="flex-row flex-wrap gap-2.5">
                  {draft.photos.map((uri, index) => {
                    const status = uploadStatuses[uri];
                    const isUploading = status && !status.key && !status.error;
                    const isError = status?.error;

                    return (
                      <View key={uri} className="relative h-24 w-[31%] rounded-xl overflow-hidden bg-surface-muted border border-line">
                        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                        
                        {/* Badges */}
                        {index === 0 && (
                          <View className="absolute bottom-1 left-1 bg-primary px-1.5 py-0.5 rounded-md">
                            <Text className="text-[9px] font-bold text-white uppercase">Главное</Text>
                          </View>
                        )}

                        {/* Upload Status Overlays */}
                        {isUploading && (
                          <View className="absolute inset-0 bg-black/50 items-center justify-center">
                            <ActivityIndicator size="small" color="#FFFFFF" />
                            <Text className="text-[10px] text-white font-semibold mt-1">
                              {Math.round((status?.progress || 0) * 100)}%
                            </Text>
                          </View>
                        )}

                        {isError && (
                          <TouchableOpacity
                            onPress={() => uploadListingPhoto(uri)}
                            activeOpacity={0.8}
                            className="absolute inset-0 bg-black/60 items-center justify-center gap-1"
                          >
                            <Ionicons name="alert-circle" size={20} color="#FF453A" />
                            <Text className="text-[9px] text-white font-bold text-center">Повторить</Text>
                          </TouchableOpacity>
                        )}

                        {/* Delete Button */}
                        <TouchableOpacity
                          onPress={() => draft.removePhoto(uri)}
                          activeOpacity={0.7}
                          className="absolute top-1 right-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"
                        >
                          <Ionicons name="close" size={14} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
              <Text className="text-center text-xs text-ink-muted mt-2">Можно опубликовать объявление без фотографий.</Text>
            </View>
          )}

          {step === 5 && (
            <View className="gap-5">
              <Text className="text-base font-semibold text-ink">
                {isEditing ? 'Проверьте и сохраните' : 'Проверьте и опубликуйте'}
              </Text>
              <View className="gap-3 rounded-card border border-line bg-surface p-4">
                <SummaryRow label="Адрес" value={`${draft.city}, ${draft.street} ${draft.houseNumber}`} />
                <SummaryRow label="Комнат" value={draft.countRoom} />
                <SummaryRow label="Площадь" value={`${draft.area} м²`} />
                <SummaryRow label="Цена" value={`${draft.price} ₽ / ночь`} />
                {draft.checkInAfter ? <SummaryRow label="Заезд после" value={draft.checkInAfter} /> : null}
                {draft.checkOutBefore ? <SummaryRow label="Выезд до" value={draft.checkOutBefore} /> : null}
              </View>
              {!isEditing && (
                <View className="flex-row items-center justify-between rounded-card bg-primary-light p-4">
                  <View className="flex-1 pr-3">
                    <Text className="text-base font-semibold text-ink">Разовая плата за публикацию</Text>
                    <Text className="text-sm text-ink-secondary">
                      Объявление будет активно сразу после оплаты.
                    </Text>
                  </View>
                  <Text className="text-xl font-bold text-primary">{LISTING_PRICE_RUB} ₽</Text>
                </View>
              )}
            </View>
          )}

          {error && <Text className="mt-4 text-sm font-medium text-danger">{error}</Text>}
        </ScrollView>

        {/* Footer */}
        <View className="border-t border-line px-5 pb-2 pt-3">
          {step < TOTAL_STEPS - 1 ? (
            <Button label="Далее" onPress={goNext} />
          ) : (
            <Button
              label={
                isEditing
                  ? (updateListing.isPending ? 'Сохранение…' : 'Сохранить изменения')
                  : (paying ? 'Оплата…' : `Оплатить ${LISTING_PRICE_RUB} ₽ и опубликовать`)
              }
              variant="success"
              loading={isEditing ? updateListing.isPending : (paying || createListing.isPending)}
              onPress={handlePublish}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-ink-secondary">{label}</Text>
      <Text className="flex-1 pl-4 text-right text-sm font-medium text-ink">{value}</Text>
    </View>
  );
}
