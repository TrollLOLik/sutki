import {
  ActivityIndicator,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { cn } from '@/lib/cn';
import { useAppTheme } from '@/theme/useAppTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonMode = 'solid' | 'outline' | 'soft' | 'ghost';
export type ButtonTone = 'primary' | 'neutral' | 'danger' | 'success' | 'warning';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  icon?: AppIconName;
  startIcon?: AppIconName;
  endIcon?: AppIconName;
  variant?: ButtonVariant;
  mode?: ButtonMode;
  tone?: ButtonTone;
  size?: ButtonSize;
  stretched?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

const sizes: Record<ButtonSize, { height: number; radius: number; fontSize: number; iconSize: number }> = {
  sm: { height: 42, radius: 14, fontSize: 14, iconSize: 18 },
  md: { height: 48, radius: 16, fontSize: 15, iconSize: 19 },
  lg: { height: 56, radius: 18, fontSize: 16, iconSize: 20 },
};

function legacyAppearance(variant: ButtonVariant): { mode: ButtonMode; tone: ButtonTone } {
  switch (variant) {
    case 'secondary':
      return { mode: 'soft', tone: 'neutral' };
    case 'success':
      return { mode: 'solid', tone: 'primary' };
    case 'danger':
      return { mode: 'soft', tone: 'danger' };
    case 'ghost':
      return { mode: 'ghost', tone: 'primary' };
    default:
      return { mode: 'solid', tone: 'primary' };
  }
}

export function Button({
  label,
  icon,
  startIcon,
  endIcon,
  variant = 'primary',
  mode,
  tone,
  size = 'lg',
  stretched = true,
  loading = false,
  disabled,
  className,
  style,
  ...rest
}: ButtonProps) {
  const { palette, isDark } = useAppTheme();
  const fallback = legacyAppearance(variant);
  const resolvedMode = mode ?? fallback.mode;
  const resolvedTone = tone ?? fallback.tone;
  const metrics = sizes[size];
  const leadingIcon = startIcon ?? icon;
  const isDisabled = Boolean(disabled || loading);

  const toneColor =
    resolvedTone === 'danger'
      ? palette.danger
      : resolvedTone === 'success'
        ? palette.success
        : resolvedTone === 'warning'
          ? palette.star
          : resolvedTone === 'neutral'
            ? palette.ink
            : palette.primary;
  const toneLight =
    resolvedTone === 'danger'
      ? palette.dangerLight
      : resolvedTone === 'success'
        ? palette.successLight
        : resolvedTone === 'warning'
          ? isDark
            ? '#332B16'
            : '#FFF7DE'
          : resolvedTone === 'neutral'
            ? palette.surfaceMuted
            : palette.primaryLight;

  const solidNeutral = resolvedMode === 'solid' && resolvedTone === 'neutral';
  const backgroundColor =
    resolvedMode === 'solid'
      ? solidNeutral
        ? palette.ink
        : toneColor
      : resolvedMode === 'soft'
        ? toneLight
        : resolvedMode === 'outline'
          ? palette.surface
          : 'transparent';
  const foreground =
    resolvedMode === 'solid'
      ? solidNeutral
        ? palette.surface
        : '#FFFFFF'
      : toneColor;
  const borderColor =
    resolvedMode === 'outline'
      ? toneColor
      : resolvedMode === 'soft'
        ? resolvedTone === 'neutral'
          ? palette.line
          : toneLight
        : resolvedMode === 'solid'
          ? 'rgba(255,255,255,0.18)'
          : 'transparent';
  const elevated = resolvedMode === 'solid' && resolvedTone !== 'neutral' && !isDisabled;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading || undefined }}
      disabled={isDisabled}
      disabledOpacity={1}
      pressedScale={0.965}
      className={cn(
        'relative min-w-0 items-center justify-center',
        stretched && 'w-full',
        className,
      )}
      style={[{ height: metrics.height, borderRadius: metrics.radius }, style]}
      {...rest}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          borderRadius: metrics.radius,
          borderWidth: resolvedMode === 'ghost' ? 0 : 1,
          borderColor,
          backgroundColor,
          opacity: isDisabled ? 0.48 : 1,
          shadowColor: elevated ? toneColor : '#000000',
          shadowOpacity: elevated ? 0.2 : 0,
          shadowRadius: elevated ? 12 : 0,
          shadowOffset: { width: 0, height: 6 },
          elevation: elevated ? 3 : 0,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          minWidth: 0,
          maxWidth: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 14,
          opacity: isDisabled ? 0.64 : 1,
        }}>
        {loading ? (
          <ActivityIndicator color={foreground} />
        ) : (
          <>
            {leadingIcon ? (
              <AppIcon name={leadingIcon} size={metrics.iconSize} color={foreground} />
            ) : null}
            <AppText
              variant="button"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={{
                minWidth: 0,
                flexShrink: 1,
                color: foreground,
                fontSize: metrics.fontSize,
                fontWeight: '800',
              }}>
              {label}
            </AppText>
            {endIcon ? (
              <AppIcon name={endIcon} size={metrics.iconSize} color={foreground} />
            ) : null}
          </>
        )}
      </View>
    </PressableScale>
  );
}
