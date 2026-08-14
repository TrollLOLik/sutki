import { View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { SelectionRow } from '@/components/ui/SelectionRow';
import type { AppIconName } from '@/components/ui/AppIcon';
import type { DialogTone } from '@/components/ui/DialogHeader';

export interface SelectionSheetOption<T extends string> {
  value: T;
  label: string;
  icon?: AppIconName;
  disabled?: boolean;
}

export interface SelectionSheetProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: AppIconName;
  tone?: DialogTone;
  value: T;
  options: SelectionSheetOption<T>[];
  onChange: (value: T) => void;
}

export function SelectionSheet<T extends string>({
  visible,
  onClose,
  title,
  subtitle,
  icon = 'options-outline',
  tone = 'primary',
  value,
  options,
  onChange,
}: SelectionSheetProps<T>) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={icon}
      tone={tone}>
      <View style={{ gap: 8 }}>
        {options.map((option) => (
          <SelectionRow
            key={option.value}
            label={option.label}
            selected={option.value === value}
            icon={option.icon}
            disabled={option.disabled}
            onPress={() => {
              onChange(option.value);
              onClose();
            }}
          />
        ))}
      </View>
    </BottomSheet>
  );
}
