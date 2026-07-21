import { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavigationBackButton } from '@/components/NavigationBackButton';
import { ScreenContainer } from '@/components/ui';
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
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const safeAreaAdjustment = Platform.OS === 'ios' ? insets.bottom : 0;
    const syncKeyboardMetrics = () => {
      const metrics = Keyboard.metrics();
      setKeyboardHeight(metrics ? Math.max(0, metrics.height - safeAreaAdjustment) : 0);
    };
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(Math.max(0, event.endCoordinates.height - safeAreaAdjustment));
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    const metricsTimer = setTimeout(syncKeyboardMetrics, 0);
    return () => {
      clearTimeout(metricsTimer);
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [insets.bottom]);

  const footerOffset = keyboardHeight > 0 ? keyboardHeight + 10 : 0;

  return (
    <ScreenContainer centered>
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
            paddingBottom: 116 + footerOffset,
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

        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: footerOffset,
            paddingTop: 10,
            paddingBottom: keyboardHeight > 0 ? 0 : 8,
            backgroundColor: palette.surface,
          }}>
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 180, delay: 80 }}>
            {footer}
          </MotiView>
        </View>
      </View>
    </ScreenContainer>
  );
}
