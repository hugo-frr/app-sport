import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { colors, floating, radius } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const TAB_ICONS: Record<string, IconName> = {
  planning: 'calendar',
  workout: 'barbell',
  progress: 'stats-chart',
  today: 'today',
  sessions: 'calendar',
  members: 'people',
  exercises: 'list',
  profile: 'person',
};

/** Barre d'onglets flottante en verre dépoli, avec pastille sur l'onglet actif. */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => !(descriptors[r.key].options as { hidden?: boolean }).hidden);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.bar, floating]}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(20px)' } as object]} />
        ) : (
          <BlurView intensity={80} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
        )}
        {routes.map((route) => {
          const focused = state.routes[state.index]?.key === route.key;
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const icon = TAB_ICONS[route.name] ?? 'ellipse';
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptic.tap();
              navigateToTab(route.key);
            }
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              style={[styles.item, focused && styles.itemActive]}
            >
              <Ionicons name={focused ? icon : (`${icon}-outline` as IconName)} size={22} color={focused ? colors.primary : colors.secondary} />
              <Text style={[styles.label, focused && { color: colors.primary, fontWeight: '600' }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16 },
  bar: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    padding: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.96)' : 'transparent',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: radius.pill, gap: 2 },
  itemActive: { backgroundColor: colors.primarySoft },
  label: { fontSize: 10.5, fontWeight: '500', color: colors.secondary },
});
