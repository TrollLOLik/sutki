import { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { MotiView } from 'moti';
import { type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ComponentMarker } from '@/components/debug/ComponentMarker';
import { NavigationBackButton } from '@/components/NavigationBackButton';
import { ScreenContainer } from '@/components/ui';
import { useKeyboardStickyStyle } from '@/hooks/useKeyboardStickyStyle';
import { useAppTheme } from '@/theme/useAppTheme';

interface AuthStepScreenProps {
  children: ReactNode;
  description: ReactNode;
  footer: ReactNode;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  fallback?: Href;
}

/** Shared auth layout: one header, one keyboard strategy and one motion language. */
export function AuthStepScreen({
  children,
  description,
  footer,
  icon,
  title,
  fallback = '/welcome',
}: AuthStepScreenProps) {
  const { palette } = useAppTheme();
  const keyboardStickyStyle = useKeyboardStickyStyle();

  return (
    <ScreenContainer centered>
      <ComponentMarker kind="layout" name="AuthStepScreen" />
      <View style={{ flex: 1 }}>
        <View style={{ height: 72, justifyContent: 'center', alignItems: 'flex-start' }}>
          <NavigationBackButton fallback={fallback} size={48} variant="material" />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: 18,
            paddingBottom: 116,
          }}>
          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 190 }}>
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: palette.primaryLight,
                borderWidth: 1,
                borderColor: `${palette.primary}33`,
                marginBottom: 22,
              }}>
              <Ionicons name={icon} size={27} color={palette.primary} />
            </View>

            <Text
              style={{
                color: palette.ink,
                fontSize: 30,
                lineHeight: 36,
                fontWeight: '800',
                letterSpacing: 0,
              }}>
              {title}
            </Text>
            <Text
              style={{
                color: palette.inkSecondary,
                fontSize: 16,
                lineHeight: 23,
                marginTop: 9,
                maxWidth: 480,
              }}>
              {description}
            </Text>

            <View style={{ marginTop: 32 }}>{children}</View>
          </MotiView>
        </ScrollView>

        <Animated.View
          pointerEvents="box-none"
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingTop: 10,
              paddingBottom: 8,
              backgroundColor: palette.surface,
            },
            keyboardStickyStyle,
          ]}>
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 180, delay: 80 }}>
            {footer}
          </MotiView>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}
