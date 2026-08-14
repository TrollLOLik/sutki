import type { Ref } from 'react';
import { TextInput, View } from 'react-native';

import { AppHeader, IconButton, SearchField } from '@/components/ui';
import { useAppTheme } from '@/theme/useAppTheme';

interface SearchOverlayHeaderProps {
  onChangeText: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  placeholder: string;
  query: string;
  inputRef?: Ref<TextInput>;
}

export function SearchOverlayHeader({
  onChangeText,
  onClose,
  onSubmit,
  placeholder,
  query,
  inputRef,
}: SearchOverlayHeaderProps) {
  const { palette } = useAppTheme();

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: palette.line }}>
      <AppHeader
        title="Поиск"
        showBorder={false}
        leading={
          <IconButton
            accessibilityLabel="Закрыть поиск"
            icon="close"
            onPress={onClose}
            size={48}
          />
        }
        style={{ minHeight: 66, paddingVertical: 9 }}
      />
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <SearchField
          ref={inputRef}
          showSoftInputOnFocus
          value={query}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder={placeholder}
        />
      </View>
    </View>
  );
}
