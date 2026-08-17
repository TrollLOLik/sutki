import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { appAlert } from '@/components/AppAlert';
import { DomainCard } from '@/components/domain/DomainCard';
import {
  AppText,
  BottomSheet,
  Button,
  DialogActions,
  SelectionRow,
  TextArea,
} from '@/components/ui';
import { ApiError } from '@/lib/api/client';
import {
  useCreateReport,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/api/abuse';

const reasons: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Спам или навязчивая реклама' },
  { value: 'fraud', label: 'Мошенничество' },
  { value: 'harassment', label: 'Оскорбления или травля' },
  { value: 'inappropriate_content', label: 'Неприемлемый контент' },
  { value: 'personal_data', label: 'Раскрытие персональных данных' },
  { value: 'other', label: 'Другая причина' },
];

interface ReportSheetProps {
  visible: boolean;
  targetType: ReportTargetType;
  targetID: number;
  targetLabel?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

type ReportFormProps = Omit<ReportSheetProps, 'visible'>;

function ReportForm({
  targetType,
  targetID,
  targetLabel,
  onClose,
  onSubmitted,
}: ReportFormProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const createReport = useCreateReport();

  const submit = async () => {
    if (!reason) {
      setError('Выберите причину жалобы.');
      return;
    }
    setError('');
    try {
      await createReport.mutateAsync({
        target_type: targetType,
        target_id: targetID,
        reason,
        details,
      });
      onClose();
      onSubmitted?.();
      setTimeout(() => {
        appAlert.alert(
          'Жалоба отправлена',
          'Мы сохранили жалобу и передали её на проверку. Спасибо, что помогаете поддерживать порядок.',
        );
      }, 220);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось отправить жалобу. Попробуйте ещё раз.');
    }
  };

  return (
    <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 8, gap: 16 }}>
        <DomainCard radius={22} style={{ overflow: 'hidden' }}>
          {reasons.map((item, index) => (
            <View
              key={item.value}
              style={index > 0 ? { borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.16)' } : undefined}>
              <SelectionRow
                label={item.label}
                selected={reason === item.value}
                onPress={() => {
                  setReason(item.value);
                  setError('');
                }}
              />
            </View>
          ))}
        </DomainCard>

        <View style={{ gap: 8 }}>
          <AppText variant="label">Комментарий</AppText>
          <TextArea
            value={details}
            onChangeText={setDetails}
            placeholder="Опишите ситуацию, если это поможет проверке"
            maxLength={1000}
            minHeight={124}
            showCount
          />
        </View>

        {error ? <AppText tone="danger">{error}</AppText> : null}

        <DialogActions
          secondary={<Button label="Отмена" mode="soft" tone="neutral" onPress={onClose} />}
          primary={
            <Button
              label="Отправить"
              startIcon="flag-outline"
              loading={createReport.isPending}
              onPress={submit}
            />
          }
        />
    </ScrollView>
  );
}

export function ReportSheet({ visible, ...formProps }: ReportSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={formProps.onClose}
      title="Пожаловаться"
      subtitle={formProps.targetLabel ? `Объект жалобы: ${formProps.targetLabel}` : 'Выберите причину'}
      icon="flag-outline"
      tone="warning"
      height="86%"
      contentKey={`${formProps.targetType}-${formProps.targetID}`}>
      <ReportForm
        key={`${formProps.targetType}-${formProps.targetID}-${visible ? 'open' : 'closed'}`}
        {...formProps}
      />
    </BottomSheet>
  );
}
