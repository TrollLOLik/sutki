import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export interface DialogActionsProps {
  reset?: ReactNode;
  secondary?: ReactNode;
  primary: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function ActionSlot({ children }: { children: ReactNode }) {
  return <View style={{ minWidth: 0, flex: 1 }}>{children}</View>;
}

export function DialogActions({ reset, secondary, primary, style }: DialogActionsProps) {
  return (
    <View
      style={[
        {
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        style,
      ]}>
      {reset ? <ActionSlot>{reset}</ActionSlot> : null}
      {secondary ? <ActionSlot>{secondary}</ActionSlot> : null}
      <ActionSlot>{primary}</ActionSlot>
    </View>
  );
}
