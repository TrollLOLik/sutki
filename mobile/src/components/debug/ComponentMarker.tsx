import { StyleSheet, Text, View } from 'react-native';

export type ComponentMarkerKind =
  | 'text'
  | 'icon'
  | 'button'
  | 'field'
  | 'surface'
  | 'navigation'
  | 'modal'
  | 'state'
  | 'media'
  | 'layout';

type ComponentMarkerProps = {
  kind: ComponentMarkerKind;
  name: string;
  placement?: 'top-left' | 'top-right';
};

// Temporary visual audit switch. Set to false or remove this module after the
// component migration has been checked on real screens.
export const COMPONENT_MARKERS_ENABLED = true;

const KIND_LABELS: Record<ComponentMarkerKind, string> = {
  text: 'T',
  icon: 'I',
  button: 'B',
  field: 'F',
  surface: 'C',
  navigation: 'N',
  modal: 'M',
  state: 'S',
  media: 'P',
  layout: 'L',
};

export function ComponentMarker({ kind, name, placement = 'top-left' }: ComponentMarkerProps) {
  if (!COMPONENT_MARKERS_ENABLED) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.marker,
        placement === 'top-right' ? styles.topRight : styles.topLeft,
      ]}>
      <Text style={styles.label}>{KIND_LABELS[kind]}</Text>
      <View style={styles.nameBubble}>
        <Text numberOfLines={1} style={styles.name}>
          {name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    top: 2,
    zIndex: 10000,
    elevation: 100,
    height: 14,
    minWidth: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: '#16A34A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  topLeft: {
    left: 2,
  },
  topRight: {
    right: 2,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
  },
  nameBubble: {
    position: 'absolute',
    top: 13,
    left: 0,
    maxWidth: 92,
    borderRadius: 3,
    backgroundColor: 'rgba(22, 163, 74, 0.94)',
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 7,
    lineHeight: 9,
    fontWeight: '800',
  },
});
