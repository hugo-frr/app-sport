import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { colors, floating, radius, tint, type } from '@/theme';

type Tone = 'record' | 'success' | 'error';
const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

const TONES: Record<Tone, { icon: IconName; color: string }> = {
  record: { icon: 'trophy', color: colors.record },
  success: { icon: 'checkmark', color: colors.success },
  error: { icon: 'alert', color: colors.danger },
};

/** Notification en capsule blanche flottante, en haut de l'écran. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, tone: Tone = 'success') => {
      setToast({ message, tone });
      if (tone === 'record') haptic.record();
      else if (tone === 'error') haptic.error();
      if (timer.current) clearTimeout(timer.current);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 90 }).start();
      timer.current = setTimeout(
        () => Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null)),
        tone === 'record' ? 3200 : 2000,
      );
    },
    [anim],
  );

  const t = toast ? TONES[toast.tone] : null;
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && t && (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            {
              top: insets.top + 8,
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
            },
          ]}
        >
          <View style={[styles.icon, { backgroundColor: toast.tone === 'record' ? colors.record : tint(t.color, 0.14) }]}>
            <Icon name={t.icon} size={18} color={toast.tone === 'record' ? '#fff' : t.color} />
          </View>
          <Text style={[type.headline, { flexShrink: 1, fontSize: 15 }]} numberOfLines={2}>
            {toast.message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toast: {
    ...floating,
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 18,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
  },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
