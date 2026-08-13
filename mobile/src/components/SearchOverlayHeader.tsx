import type { Ref } from 'react';
import { Text, TextInput, View } from 'react-native';

import { IconButton, SearchField } from '@/components/ui';
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
    <View style={{ paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: palette.line }}>
      <View style={{ height: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton accessibilityLabel="Закрыть поиск" icon="close" onPress={onClose} size={48} />
        <Text style={{ color: palette.ink, fontSize: 21, lineHeight: 26, fontWeight: '800' }}>Поиск</Text>
        <View style={{ width: 48, height: 48 }} />
      </View>
      <SearchField
        ref={inputRef}
        showSoftInputOnFocus
        value={query}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
      />
    </View>
  );
}
