import { Pressable, Text, View } from 'react-native';

import { Badge, Button } from '@/components/ui';
import { formatTime } from '@/lib/format';
import type { Session } from '@/lib/types';
import { colors, radius, space, type } from '@/theme';

export function bookingBadge(s: Session) {
  const st = s.my_booking?.status;
  if (st === 'booked') return <Badge label="Inscrit" tone="info" />;
  if (st === 'present') return <Badge label="Présent" tone="success" />;
  if (st === 'absent') return <Badge label="Absent" tone="danger" />;
  if (s.status === 'draft') return <Badge label="Brouillon" tone="warning" />;
  if (s.status === 'done') return <Badge label="Terminée" />;
  if (s.spots_left === 0) return <Badge label="Complet" tone="danger" />;
  return null;
}

/** Jauge de remplissage : on lit d'un coup d'œil s'il reste de la place. */
export function FillGauge({ booked, capacity }: { booked: number; capacity: number }) {
  const ratio = capacity ? Math.min(1, booked / capacity) : 0;
  const color = ratio >= 1 ? colors.danger : ratio >= 0.75 ? colors.warning : colors.success;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.fill, overflow: 'hidden' }}>
        <View style={{ width: `${ratio * 100}%`, height: 4, backgroundColor: color, borderRadius: 2 }} />
      </View>
      <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>
        {capacity - booked > 0 ? `${capacity - booked} place${capacity - booked > 1 ? 's' : ''}` : 'Complet'}
      </Text>
    </View>
  );
}

export function SessionCard({
  session: s,
  onPress,
  onBook,
  onCancel,
  busy,
  showSpots = true,
}: {
  session: Session;
  onPress?: () => void;
  onBook?: () => void;
  onCancel?: () => void;
  busy?: boolean;
  showSpots?: boolean;
}) {
  const booked = s.my_booking?.status === 'booked';
  const canCancel = booked && new Date(s.can_cancel_until) > new Date();
  const canBook = (!s.my_booking || s.my_booking.status === 'cancelled') && s.status === 'published' && s.spots_left > 0;
  const accent = booked ? colors.info : s.status === 'draft' ? colors.warning : colors.force;
  const bookedCount = s.capacity - s.spots_left;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, pressed && { opacity: 0.8 }]}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ width: 58 }}>
          <Text style={[type.metric, { fontSize: 20 }]}>{formatTime(s.starts_at)}</Text>
          <Text style={type.caption}>{s.duration_minutes} min</Text>
        </View>
        <View style={{ width: 3, borderRadius: 2, backgroundColor: accent }} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
            <Text style={[type.headline, { flex: 1 }]} numberOfLines={2}>
              {s.title}
            </Text>
            {bookingBadge(s)}
          </View>
          {s.coach_name ? <Text style={[type.footnote, { marginTop: 2 }]}>avec {s.coach_name}</Text> : null}
          {showSpots && s.status !== 'done' ? <FillGauge booked={bookedCount} capacity={s.capacity} /> : null}
        </View>
      </View>
      {onBook && canBook && (
        <Button title="S'inscrire" small onPress={onBook} loading={busy} style={{ marginTop: space.md, alignSelf: 'flex-end' }} />
      )}
      {onCancel && canCancel && (
        <Button
          title="Se désinscrire"
          small
          variant="light"
          color={colors.danger}
          onPress={onCancel}
          loading={busy}
          style={{ marginTop: space.md, alignSelf: 'flex-end' }}
        />
      )}
    </Pressable>
  );
}

const cardStyle = { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, marginBottom: space.sm };

/** Regroupe des séances par jour local. */
export function groupByDay<T extends { starts_at: string }>(items: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const d = new Date(it.starts_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  return [...groups.entries()];
}
