import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppIcon, AppText, PressableScale } from '@/components/ui';
import { useAppTheme } from '@/theme/useAppTheme';

export interface ListingOwnerActionAvailability {
  canEdit: boolean;
  canPromote: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
}

export function getListingOwnerActionAvailability(
  status?: string | null,
): ListingOwnerActionAvailability {
  const normalizedStatus = status ?? 'active';
  return {
    canEdit: true,
    canPromote: normalizedStatus !== 'rejected' && normalizedStatus !== 'unpublished',
    canPublish: normalizedStatus === 'unpublished',
    canUnpublish: normalizedStatus === 'active',
  };
}

interface ListingOwnerActionsProps {
  compact?: boolean;
  primaryAction?: 'edit' | 'promote' | 'publish';
  onEdit?: () => void;
  onPromote?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  style?: StyleProp<ViewStyle>;
}

interface OwnerAction {
  id: 'edit' | 'promote' | 'publish' | 'unpublish';
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone: 'solid' | 'tinted' | 'surface';
}

function OwnerActionButton({
  action,
  compact,
}: {
  action: OwnerAction;
  compact: boolean;
}) {
  const { palette } = useAppTheme();
  const solid = action.tone === 'solid';
  const tinted = action.tone === 'tinted';
  const foreground = solid
    ? '#FFFFFF'
    : tinted
      ? palette.primary
      : palette.inkSecondary;

  return (
    <PressableScale
      accessibilityLabel={action.label}
      accessibilityRole="button"
      hitSlop={compact ? 3 : 0}
      pressedScale={0.96}
      onPress={(event) => {
        event.stopPropagation();
        action.onPress();
      }}
      style={styles.actionCell}>
      <View
        style={[
          styles.actionButton,
          compact ? styles.compactButton : styles.regularButton,
          {
            borderColor: solid
              ? 'rgba(255,255,255,0.18)'
              : tinted
                ? palette.primary
                : palette.line,
            backgroundColor: solid
              ? palette.primary
              : tinted
                ? palette.primaryLight
                : palette.surfaceMuted,
            shadowColor: solid ? palette.primary : '#000000',
            shadowOpacity: solid ? 0.2 : 0,
            shadowRadius: solid ? 8 : 0,
            shadowOffset: { width: 0, height: 4 },
            elevation: solid ? 3 : 0,
          },
        ]}>
        <AppIcon name={action.icon} size={compact ? 17 : 16} color={foreground} />
        {!compact ? (
          <AppText numberOfLines={1} style={[styles.actionLabel, { color: foreground }]}>
            {action.label}
          </AppText>
        ) : null}
      </View>
    </PressableScale>
  );
}

export function ListingOwnerActions({
  compact = false,
  primaryAction,
  onEdit,
  onPromote,
  onPublish,
  onUnpublish,
  style,
}: ListingOwnerActionsProps) {
  const actions: OwnerAction[] = [];
  if (onEdit) {
    actions.push({
      id: 'edit',
      icon: 'create-outline',
      label: 'Изменить',
      onPress: onEdit,
      tone: primaryAction === 'edit' ? 'solid' : 'surface',
    });
  }
  if (onPromote) {
    actions.push({
      id: 'promote',
      icon: 'rocket-outline',
      label: 'Продвигать',
      onPress: onPromote,
      tone: primaryAction === 'promote' ? 'solid' : 'tinted',
    });
  }
  if (onUnpublish) {
    actions.push({
      id: 'unpublish',
      icon: 'eye-off-outline',
      label: 'Снять',
      onPress: onUnpublish,
      tone: 'surface',
    });
  }
  if (onPublish) {
    actions.push({
      id: 'publish',
      icon: 'cloud-upload-outline',
      label: 'Опубликовать',
      onPress: onPublish,
      tone: primaryAction === 'publish' ? 'solid' : 'tinted',
    });
  }

  if (actions.length === 0) return null;

  return (
    <View style={[styles.actions, compact ? styles.compactActions : null, style]}>
      {actions.map((action) => (
        <OwnerActionButton key={action.id} action={action} compact={compact} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 7,
  },
  compactActions: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.18)',
    paddingTop: 8,
  },
  actionCell: {
    minWidth: 0,
    flex: 1,
  },
  actionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
  },
  compactButton: {
    height: 36,
    borderRadius: 12,
  },
  regularButton: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 7,
  },
  actionLabel: {
    minWidth: 0,
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
});
