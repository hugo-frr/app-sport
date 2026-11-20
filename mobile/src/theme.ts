import type { Unit } from '@/lib/types';

/**
 * Thème « iOS clair » : fond groupé système, surfaces blanches, une couleur de marque (bleu électrique),
 * et une teinte par type d'exercice. Les ombres sont réservées aux éléments flottants.
 */
export const colors = {
  bg: '#F2F2F7', // systemGroupedBackground
  card: '#FFFFFF',
  elevated: '#F6F6FA', // zone de saisie à l'intérieur d'une carte
  fill: 'rgba(118,118,128,0.12)', // tertiarySystemFill
  separator: 'rgba(60,60,67,0.18)',
  border: 'rgba(60,60,67,0.18)',
  text: '#0B0B0F',
  secondary: 'rgba(60,60,67,0.62)',
  muted: 'rgba(60,60,67,0.62)',
  tertiary: 'rgba(60,60,67,0.3)',

  primary: '#4353FF',
  primaryDark: '#2E3BD6',
  primarySoft: 'rgba(67,83,255,0.1)',

  force: '#FF5E3A',
  endurance: '#00A99D',
  distance: '#8A5CF6',
  record: '#F5A600',

  success: '#28B44C',
  successSoft: 'rgba(52,199,89,0.14)',
  danger: '#FF3B30',
  dangerSoft: 'rgba(255,59,48,0.1)',
  warning: '#F08C00',
  warningSoft: 'rgba(255,149,0,0.14)',
  info: '#4353FF',
  infoSoft: 'rgba(67,83,255,0.1)',
};

/** Dégradé de la carte « héros » (une seule par écran principal). */
export const heroGradient = ['#4353FF', '#7B4DFF', '#B44CF0'] as const;

export const unitColor: Record<Unit, string> = {
  kg_reps: colors.force,
  time: colors.endurance,
  distance: colors.distance,
};

/** Couleur + alpha (hex #RRGGBB). */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 22, xl: 28, pill: 999 };

/** Ombre douce, réservée aux éléments qui flottent (barre d'onglets, toast, carte héros). */
export const floating = {
  shadowColor: '#1B1F3B',
  shadowOpacity: 0.12,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
  elevation: 8,
};

/** Échelle typographique iOS (Dynamic Type, taille « Large »). */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: '800' as const, letterSpacing: 0.2, color: colors.text },
  title2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.35, color: colors.text },
  title3: { fontSize: 20, fontWeight: '700' as const, letterSpacing: 0.38, color: colors.text },
  headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.41, color: colors.text },
  body: { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.41, color: colors.text },
  callout: { fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.32, color: colors.text },
  subhead: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.24, color: colors.secondary },
  footnote: { fontSize: 13, fontWeight: '400' as const, letterSpacing: -0.08, color: colors.secondary },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.secondary },
  /** Chiffres : graisse forte, chasse fixe pour que les valeurs ne « dansent » pas. */
  metric: { fontWeight: '700' as const, fontVariant: ['tabular-nums' as const], letterSpacing: -0.4, color: colors.text },
};
