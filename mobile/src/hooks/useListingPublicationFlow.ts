import { useCallback } from 'react';
import { Linking } from 'react-native';

import { appAlert as Alert } from '@/components/AppAlert';
import { useAcceptDataDissemination, useLegalConsentStatus } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useListingPublication } from '@/lib/api/create-listing';

const DISSEMINATION_CONSENT_URL =
  'https://wigaj.ru/legal/personal-data-dissemination-consent';

function requiresDisseminationConsent(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 428) return false;
  const body = error.body as { error?: string; message?: string } | undefined;
  const message = body?.error ?? body?.message ?? '';
  return message === 'personal data dissemination consent required';
}

export function useListingPublicationFlow() {
  const publication = useListingPublication();
  const acceptDissemination = useAcceptDataDissemination();
  const { data: consentStatus } = useLegalConsentStatus();

  const hasDisseminationConsent = consentStatus?.items.some(
    (item) => item.type === 'personal_data_dissemination' && item.accepted,
  );

  const showFailure = useCallback((error: unknown) => {
    Alert.alert(
      'Не удалось изменить статус',
      error instanceof ApiError ? error.message : 'Попробуйте ещё раз.',
    );
  }, []);

  const publishAfterConsent = useCallback(
    async (id: number) => {
      try {
        await acceptDissemination.mutateAsync();
        await publication.mutateAsync({ id, published: true });
      } catch (error) {
        showFailure(error);
      }
    },
    [acceptDissemination, publication, showFailure],
  );

  const requestConsentAndPublish = useCallback(
    (id: number) => {
      Alert.alert(
        'Публичное размещение',
        'Для публикации нужно отдельно согласиться на распространение данных, которые будут видны в профиле и объявлении.',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Открыть документ',
            onPress: () => void Linking.openURL(DISSEMINATION_CONSENT_URL),
          },
          {
            text: 'Принимаю и публикую',
            onPress: () => void publishAfterConsent(id),
          },
        ],
      );
    },
    [publishAfterConsent],
  );

  const executePublication = useCallback(
    async (id: number, published: boolean) => {
      try {
        await publication.mutateAsync({ id, published });
      } catch (error) {
        if (published && requiresDisseminationConsent(error)) {
          requestConsentAndPublish(id);
          return;
        }
        showFailure(error);
      }
    },
    [publication, requestConsentAndPublish, showFailure],
  );

  const changePublication = useCallback(
    (id: number, published: boolean) => {
      if (published && hasDisseminationConsent === false) {
        requestConsentAndPublish(id);
        return;
      }

      Alert.alert(
        published ? 'Опубликовать объявление снова?' : 'Снять объявление с публикации?',
        published
          ? 'Объявление снова появится в поиске.'
          : 'Объявление исчезнет из поиска. Активное продвижение будет приостановлено.',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: published ? 'Опубликовать' : 'Снять',
            style: published ? 'default' : 'destructive',
            onPress: () => void executePublication(id, published),
          },
        ],
      );
    },
    [executePublication, hasDisseminationConsent, requestConsentAndPublish],
  );

  return {
    changePublication,
    isPending: publication.isPending || acceptDissemination.isPending,
  };
}
