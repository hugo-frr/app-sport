import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Empty, ErrorView, List, ListRow, Loading, Screen, Tile } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { useBookings } from '@/lib/queries';
import type { BookingStatus } from '@/lib/types';
import { colors, space } from '@/theme';

const LABEL: Record<BookingStatus, [string, 'success' | 'danger' | 'info' | 'neutral']> = {
  present: ['Présent', 'success'],
  absent: ['Absent', 'danger'],
  booked: ['Inscrit', 'info'],
  cancelled: ['Annulé', 'neutral'],
};

export default function HistoryScreen() {
  const q = useBookings();
  const [now] = useState(() => Date.now());
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView error={q.error} onRetry={q.refetch} />;
  const items = q.data ?? [];
  const present = items.filter((b) => b.status === 'present').length;
  const since30 = items.filter(
    (b) => b.status === 'present' && now - new Date(b.session.starts_at).getTime() < 30 * 86_400_000,
  ).length;

  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.xl }}>
        <Tile label="Présences" value={present} color={colors.success} icon="checkmark-circle" style={{ flex: 1 }} />
        <Tile label="Sur 30 jours" value={since30} icon="calendar" color={colors.force} style={{ flex: 1 }} />
      </View>
      {items.length === 0 && <Empty icon="calendar-outline" title="Aucune séance pour l'instant" />}
      {items.length > 0 && (
        <List>
          {items.map((b) => (
            <ListRow
              key={b.id}
              title={b.session.title}
              subtitle={formatDateTime(b.session.starts_at)}
              right={<Badge label={LABEL[b.status][0]} tone={LABEL[b.status][1]} />}
            />
          ))}
        </List>
      )}
    </Screen>
  );
}
