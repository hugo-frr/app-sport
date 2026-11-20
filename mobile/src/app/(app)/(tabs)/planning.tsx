import { router } from 'expo-router';
import { Fragment } from 'react';
import { Text } from 'react-native';

import { groupByDay, SessionCard } from '@/components/SessionCard';
import { useToast } from '@/components/Toast';
import { Empty, ErrorView, Loading, Screen } from '@/components/ui';
import { formatDay, formatLongDate } from '@/lib/format';
import { useBooking, useSessions } from '@/lib/queries';
import { space, type } from '@/theme';

export default function PlanningScreen() {
  const q = useSessions({ upcoming: true });
  const booking = useBooking();
  const toast = useToast();

  const act = (id: number, action: 'book' | 'cancel') =>
    booking.mutate(
      { id, action },
      {
        onSuccess: () => toast(action === 'book' ? 'Inscription confirmée' : 'Désinscription enregistrée'),
        onError: (e) => toast(e.message, 'error'),
      },
    );

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView error={q.error} onRetry={q.refetch} />;
  const sessions = q.data ?? [];

  return (
    <Screen title="Planning" overline={formatLongDate()} refreshing={q.isRefetching} onRefresh={q.refetch}>
      {sessions.length === 0 && (
        <Empty icon="calendar-outline" title="Aucune séance publiée" text="Votre coach n'a pas encore publié le planning." />
      )}
      {groupByDay(sessions).map(([day, items]) => (
        <Fragment key={day}>
          <Text style={[type.title3, { marginTop: space.md, marginBottom: space.sm }]}>{formatDay(day, true)}</Text>
          {items.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onPress={() => router.push({ pathname: '/session/[id]', params: { id: s.id } })}
              onBook={() => act(s.id, 'book')}
              onCancel={() => act(s.id, 'cancel')}
              busy={booking.isPending && booking.variables?.id === s.id}
            />
          ))}
        </Fragment>
      ))}
    </Screen>
  );
}
