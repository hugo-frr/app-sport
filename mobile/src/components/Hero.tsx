import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { colors, floating, heroGradient, radius, space } from '@/theme';

/** Carte « héros » en dégradé : un seul usage par écran principal (la séance du jour, la journée du coach). */
export function Hero({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.shadow, style]}>
      <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        {/* halo lumineux discret pour donner de la profondeur */}
        <View style={styles.glow} />
        {children}
      </LinearGradient>
    </View>
  );
}

export const heroText = StyleSheet.create({
  overline: { color: 'rgba(255,255,255,0.78)', fontSize: 15, fontWeight: '600' },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: 0.2, marginTop: 2 },
  body: { color: 'rgba(255,255,255,0.85)', fontSize: 15 },
  metric: { color: '#fff', fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
});

/**
 * Barre de progression segmentée : un segment par série (ou par adhérent),
 * plein quand c'est fait. Plus lisible qu'un pourcentage.
 */
export function Segments({
  total,
  done,
  color = '#fff',
  track = 'rgba(255,255,255,0.28)',
  height = 8,
}: {
  total: number;
  done: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  if (total <= 0) return null;
  const many = total > 24;
  if (many) {
    return (
      <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(1, done / total) * 100}%`, height, backgroundColor: color, borderRadius: height / 2 }} />
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height, borderRadius: height / 2, backgroundColor: i < done ? color : track }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { ...floating, shadowColor: colors.primary, shadowOpacity: 0.28, borderRadius: radius.xl, marginBottom: space.xl },
  card: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden' },
  glow: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
