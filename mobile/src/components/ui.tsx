import Ionicons from '@expo/vector-icons/Ionicons';
import { Children, ComponentProps, isValidElement, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { colors, radius, space, tint, type } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

// ------------------------------------------------------------------ écran & titres

/**
 * Écran défilant. `title` affiche un grand titre iOS (les onglets n'ont pas d'en-tête natif),
 * `overline` une ligne secondaire au-dessus (ex. la date du jour).
 */
export function Screen({
  children,
  title,
  overline,
  accessory,
  refreshing,
  onRefresh,
  scroll = true,
  edges,
}: {
  children: ReactNode;
  title?: string;
  overline?: string;
  accessory?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const header = title ? (
    <View style={styles.largeHeader}>
      <View style={{ flex: 1 }}>
        {overline ? <Text style={styles.overline}>{overline}</Text> : null}
        <Text style={type.largeTitle} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {accessory}
    </View>
  ) : null;
  return (
    <SafeAreaView style={styles.screen} edges={edges ?? (title ? ['top'] : [])}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.secondary} />
            ) : undefined
          }
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

/** Titre de section (casse normale, style iOS). */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={type.title3}>{children}</Text>
      {right}
    </View>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={type.title2}>{children}</Text>
      {sub ? <Text style={[type.subhead, { marginTop: 2 }]}>{sub}</Text> : null}
    </View>
  );
}

// ------------------------------------------------------------------ listes groupées iOS

/** Section « inset grouped » : les lignes sont séparées par un filet inséré. */
export function List({ children, header, footer, style }: { children: ReactNode; header?: string; footer?: string; style?: ViewStyle }) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[{ marginBottom: space.xl }, style]}>
      {header ? <Text style={styles.listHeader}>{header}</Text> : null}
      <View style={styles.list}>
        {items.map((child, i) => {
          // Filet aligné sur le texte, comme dans Réglages
          const p = child.props as { icon?: unknown; leading?: unknown };
          const inset = p.icon ? 60 : p.leading ? 64 : space.lg;
          return (
            <View key={child.key ?? i}>
              {i > 0 && <View style={[styles.separator, { marginLeft: inset }]} />}
              {child}
            </View>
          );
        })}
      </View>
      {footer ? <Text style={styles.listFooter}>{footer}</Text> : null}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  value,
  icon,
  iconColor = colors.force,
  leading,
  right,
  onPress,
  onLongPress,
  chevron,
  destructive,
  titleStyle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  icon?: IconName;
  iconColor?: string;
  leading?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  titleStyle?: TextStyle;
}) {
  const content = (
    <View style={styles.row}>
      {leading}
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: iconColor }]}>
          <Icon name={icon} size={17} color="#fff" />
        </View>
      ) : null}
      <View style={{ flex: 1, paddingVertical: 2 }}>
        <Text style={[type.body, destructive && { color: colors.danger }, titleStyle]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.footnote, { marginTop: 2 }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value != null ? (typeof value === 'string' || typeof value === 'number' ? <Text style={type.subhead}>{value}</Text> : value) : null}
      {right ? <View>{right}</View> : null}
      {(chevron ?? !!onPress) && !destructive ? <Icon name="chevron-forward" size={18} color={colors.tertiary} /> : null}
    </View>
  );
  if (!onPress && !onLongPress) return content;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => pressed && { backgroundColor: colors.elevated }}>
      {content}
    </Pressable>
  );
}

/** Pastille d'initiales ; la teinte est stable pour une même personne. */
const AVATAR_COLORS = ['#FF5E3A', '#F08C00', '#28B44C', '#00A99D', '#4353FF', '#8A5CF6', '#E8458B'];
export function Avatar({ name, id = 0, size = 36 }: { name: string; id?: number; size?: number }) {
  const color = AVATAR_COLORS[id % AVATAR_COLORS.length];
  const letters = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tint(color, 0.14),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color, fontWeight: '700', fontSize: size * 0.38 }}>{letters}</Text>
    </View>
  );
}

/** Bloc de contenu libre (graphiques, saisie…) — plus grand rayon que les listes. */
export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.75 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

// ------------------------------------------------------------------ actions

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'light';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  small,
  icon,
  color,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  small?: boolean;
  icon?: IconName;
  /** Couleur d'accent (ex. couleur du type d'exercice). */
  color?: string;
}) {
  const accent = color ?? colors.primary;
  const v = {
    primary: { bg: accent, fg: '#fff' },
    secondary: { bg: colors.card, fg: colors.text },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    ghost: { bg: 'transparent', fg: accent },
    light: { bg: tint(accent, 0.1), fg: accent },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg },
        (disabled || loading) && { opacity: 0.4 },
        pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon ? <Icon name={icon} size={small ? 16 : 19} color={v.fg} /> : null}
          <Text style={[styles.buttonText, small && { fontSize: 15 }, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Bouton rond d'en-tête (ex. « + »). */
export function IconButton({ name, onPress, color = colors.primary, label }: { name: IconName; onPress: () => void; color?: string; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: tint(color, 0.1) }, pressed && { opacity: 0.6 }]}
    >
      <Icon name={name} size={22} color={color} />
    </Pressable>
  );
}

// ------------------------------------------------------------------ saisie

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.tertiary}
        keyboardAppearance="light"
        selectionColor={colors.primary}
        {...props}
        style={[styles.input, props.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 14 }, props.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** Contrôle segmenté iOS : 2 à 4 options exclusives. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.segmented, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) haptic.tap();
              onChange(o.value);
            }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Pastilles de choix (nombreuses options : modèles, jours, catégories). */
export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  color = colors.text,
}: {
  options: { value: T; label: string }[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  color?: string;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              haptic.tap();
              onChange(o.value);
            }}
            style={[styles.chip, active && { backgroundColor: color === colors.text ? colors.primary : color }]}
          >
            <Text style={[styles.chipText, active && { color: '#fff' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Gros chiffre + boutons ronds −/+ : la saisie d'une série doit prendre moins de 5 secondes. */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  format,
  decimal,
  color = colors.force,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  format?: (v: number) => string;
  decimal?: boolean;
  color?: string;
  unit?: string;
}) {
  const set = (v: number) => {
    haptic.tap();
    onChange(Math.max(min, Math.round(v * 100) / 100));
  };
  const round = (name: IconName, delta: number, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a11y} ${label}`}
      onPress={() => set(value + delta)}
      style={({ pressed }) => [styles.stepBtn, { backgroundColor: tint(color, 0.12) }, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <Icon name={name} size={26} color={color} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        {round('remove', -step, 'Moins')}
        <View style={{ flex: 1, alignItems: 'center' }}>
          {format ? (
            <Text style={[type.metric, styles.stepValue]} adjustsFontSizeToFit numberOfLines={1}>
              {format(value)}
            </Text>
          ) : (
            <TextInput
              style={[type.metric, styles.stepValue]}
              keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
              keyboardAppearance="light"
              value={String(value).replace('.', ',')}
              selectTextOnFocus
              onChangeText={(t) => {
                const n = Number(t.replace(',', '.'));
                if (!Number.isNaN(n)) onChange(Math.max(min, n));
              }}
            />
          )}
          {unit ? <Text style={[type.caption, { marginTop: -2 }]}>{unit}</Text> : null}
        </View>
        {round('add', step, 'Plus')}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ états & données

export function Loading() {
  return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <ActivityIndicator color={colors.secondary} />
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Icon name="cloud-offline-outline" size={40} color={colors.tertiary} />
      <Text style={[type.subhead, { textAlign: 'center', marginVertical: space.md }]}>
        {error instanceof Error ? error.message : 'Une erreur est survenue.'}
      </Text>
      {onRetry ? <Button title="Réessayer" variant="secondary" small onPress={onRetry} /> : null}
    </View>
  );
}

export function Empty({ title, text, action, icon = 'sparkles-outline' }: { title: string; text?: string; action?: ReactNode; icon?: IconName }) {
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={44} color={colors.tertiary} />
      <Text style={[type.title3, { marginTop: space.md, textAlign: 'center' }]}>{title}</Text>
      {text ? <Text style={[type.subhead, { textAlign: 'center', marginTop: 4, maxWidth: 300 }]}>{text}</Text> : null}
      {action ? <View style={{ marginTop: space.lg, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'primary' | 'record';
}) {
  const t = {
    neutral: [colors.fill, colors.secondary],
    success: [colors.successSoft, colors.success],
    danger: [colors.dangerSoft, colors.danger],
    warning: [colors.warningSoft, colors.warning],
    info: [colors.infoSoft, colors.info],
    primary: [colors.primarySoft, colors.primary],
    record: [tint(colors.record, 0.14), colors.record],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t[0] }]}>
      <Text style={[styles.badgeText, { color: t[1] }]}>{label}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}>{children}</View>;
}

/** Tuile métrique : grande valeur colorée + libellé. */
export function Tile({
  label,
  value,
  unit,
  color = colors.text,
  icon,
  style,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  color?: string;
  icon?: IconName;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.tile, style]}>
      <Row style={{ gap: 6 }}>
        {icon ? <Icon name={icon} size={15} color={color} /> : null}
        <Text style={[type.footnote, { color: colors.secondary }]} numberOfLines={1}>
          {label}
        </Text>
      </Row>
      <Text style={{ marginTop: 6 }} numberOfLines={1} adjustsFontSizeToFit>
        <Text style={[type.metric, { fontSize: 28, color }]}>{value}</Text>
        {unit ? <Text style={[type.metric, { fontSize: 15, color }]}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

/** Compatibilité : ancienne API Stat. */
export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return <Tile label={label} value={value} color={tone} style={{ flex: 1 }} />;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 130 }, // place pour la barre flottante
  largeHeader: { flexDirection: 'row', alignItems: 'flex-end', marginTop: space.sm, marginBottom: space.lg },
  overline: { ...type.subhead, fontWeight: '600', marginBottom: 2 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.sm,
    marginBottom: space.md,
  },
  text: type.body,
  strong: type.headline,
  muted: type.subhead,
  list: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },
  listHeader: { ...type.footnote, marginLeft: space.lg, marginBottom: 6 },
  listFooter: { ...type.footnote, marginHorizontal: space.lg, marginTop: 6 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 48, paddingVertical: 10 },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md },
  button: { minHeight: 54, borderRadius: radius.md, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { minHeight: 36, borderRadius: radius.pill, paddingHorizontal: space.lg },
  buttonText: { fontSize: 17, fontWeight: '600', letterSpacing: -0.41 },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { ...type.footnote, marginBottom: 6, marginLeft: 4 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.text,
  },
  error: { color: colors.danger, marginTop: 6, fontSize: 13, marginLeft: 4 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  segmented: { flexDirection: 'row', backgroundColor: colors.fill, borderRadius: 9, padding: 2, marginBottom: space.lg },
  segment: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 7 },
  segmentActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: { fontSize: 13, fontWeight: '500', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.card },
  chipText: { fontSize: 15, fontWeight: '500', color: colors.text },
  stepper: { flex: 1 },
  stepperLabel: { ...type.caption, textAlign: 'center', marginBottom: 6 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 34, textAlign: 'center', minWidth: 56, padding: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, minHeight: 240 },
  empty: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.lg },
  tile: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg },
});
