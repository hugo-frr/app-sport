import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { UNIT_ICON } from '@/components/ProgressList';
import { bookingBadge, FillGauge } from '@/components/SessionCard';
import { useToast } from '@/components/Toast';
import { Button, Card, ErrorView, List, ListRow, Loading, Screen } from '@/components/ui';
import { formatDateTime, formatDay, formatDuration, formatKg, formatTime } from '@/lib/format';
import { useBooking, useSession } from '@/lib/queries';
import type { TemplateItem } from '@/lib/types';
import { colors, space, type, unitColor } from '@/theme';

export function targetText(it: TemplateItem) {
  if (it.exercise_unit === 'time') return `${it.sets} × ${formatDuration(it.target_duration_seconds)}`;
  if (it.exercise_unit === 'distance') return `${it.sets} × ${it.target_distance_m ?? '–'} m`;
  const load = it.target_load_kg && Number(it.target_load_kg) > 0 ? ` à ${formatKg(it.target_load_kg)}` : '';
  return `${it.sets} × ${it.reps ?? '–'}${load}`;
}

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useSession(Number(id));
  const booking = useBooking();
  const toast = useToast();

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorView error={q.error} onRetry={q.refetch} />;
  const s = q.data;
  const status = s.my_booking?.status;
  const canCancel = status === 'booked' && new Date(s.can_cancel_until) > new Date();
  const canBook = (!status || status === 'cancelled') && s.status === 'published' && s.spots_left > 0;
  const act = (action: 'book' | 'cancel') =>
    booking.mutate(
      { id: s.id, action },
      {
        onSuccess: () => toast(action === 'book' ? 'Inscription confirmée' : 'Désinscription enregistrée'),
        onError: (e) => toast(e.message, 'error'),
      },
    );

  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      <Text style={[type.subhead, { fontWeight: '600' }]}>{formatDay(s.starts_at, true)}</Text>
      <Text style={[type.largeTitle, { marginBottom: space.lg }]}>{s.title}</Text>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={[type.metric, { fontSize: 40 }]}>{formatTime(s.starts_at)}</Text>
            <Text style={type.subhead}>
              {s.duration_minutes} min{s.coach_name ? `, avec ${s.coach_name}` : ''}
            </Text>
          </View>
          {bookingBadge(s)}
        </View>
        {s.status !== 'done' && <FillGauge booked={s.capacity - s.spots_left} capacity={s.capacity} />}
        {s.notes ? <Text style={[type.callout, { marginTop: space.md }]}>{s.notes}</Text> : null}
        {canCancel && (
          <Text style={[type.footnote, { marginTop: space.md }]}>
            Désinscription possible jusqu&apos;à {formatDateTime(s.can_cancel_until).toLowerCase()}
          </Text>
        )}
      </Card>

      <View style={{ gap: space.sm, marginBottom: space.xl }}>
        {canBook && <Button title="S'inscrire" onPress={() => act('book')} loading={booking.isPending} />}
        {(status === 'booked' || status === 'present') && (
          <Button
            title="Saisir mes performances"
            icon="create-outline"
            onPress={() => router.push({ pathname: '/log', params: { sessionId: s.id, bookingId: s.my_booking!.id } })}
          />
        )}
        {canCancel && <Button title="Se désinscrire" variant="secondary" onPress={() => act('cancel')} loading={booking.isPending} />}
      </View>

      {s.items && s.items.length > 0 && (
        <List header="Programme">
          {s.items.map((it) => (
            <ListRow
              key={it.id}
              icon={UNIT_ICON[it.exercise_unit ?? 'kg_reps']}
              iconColor={unitColor[it.exercise_unit ?? 'kg_reps']}
              title={it.exercise_name}
              subtitle={[it.rest_seconds ? `Repos ${formatDuration(it.rest_seconds)}` : null, it.notes || null].filter(Boolean).join(', ') || undefined}
              value={<Text style={[type.metric, { fontSize: 15, color: colors.secondary }]}>{targetText(it)}</Text>}
            />
          ))}
        </List>
      )}
    </Screen>
  );
}
