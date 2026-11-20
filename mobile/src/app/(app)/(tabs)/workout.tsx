import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Hero, heroText, Segments } from '@/components/Hero';
import { LoggerStats, WorkoutLogger } from '@/components/WorkoutLogger';
import { Button, Card, Empty, ErrorView, Loading, Screen } from '@/components/ui';
import { formatDateTime, formatLongDate, formatTime, isoDate } from '@/lib/format';
import { useSession, useSessions } from '@/lib/queries';
import { space, type } from '@/theme';

/** "Ma séance" : anneaux de progression, exercices du jour avec cibles, saisie série par série. */
export default function WorkoutScreen() {
  const today = isoDate();
  const todays = useSessions({ date: today });
  const upcoming = useSessions({ upcoming: true });
  const mine = (todays.data ?? []).filter((s) => s.my_booking && ['booked', 'present'].includes(s.my_booking.status));
  const current = mine[0];
  const detail = useSession(current?.id);

  if (todays.isLoading || (current && detail.isLoading)) return <Loading />;
  if (todays.error) return <ErrorView error={todays.error} onRetry={todays.refetch} />;

  if (!current) {
    const next = (upcoming.data ?? []).find((s) => s.my_booking?.status === 'booked');
    return (
      <Screen title="Ma séance" overline={formatLongDate()} refreshing={todays.isRefetching} onRefresh={todays.refetch}>
        <Empty
          icon="barbell-outline"
          title="Pas de séance aujourd'hui"
          text={next ? `Prochaine séance : ${next.title}, ${formatDateTime(next.starts_at).toLowerCase()}.` : 'Inscrivez-vous à une séance depuis le planning.'}
          action={
            <>
              <Button title="Démarrer un entraînement libre" icon="play" onPress={() => router.push('/log')} />
              <Button title="Voir le planning" variant="ghost" onPress={() => router.push('/planning')} style={{ marginTop: space.sm }} />
            </>
          }
        />
      </Screen>
    );
  }

  const items = detail.data?.items ?? [];
  const hero = (stats?: LoggerStats) => (
    <Hero>
      <Text style={heroText.overline}>
        Aujourd&apos;hui à {formatTime(current.starts_at)}
        {current.coach_name ? `, avec ${current.coach_name}` : ''}
      </Text>
      <Text style={heroText.title}>{current.title}</Text>
      {stats && stats.target > 0 ? (
        <View style={{ marginTop: space.xl, gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={[heroText.metric, { fontSize: 44 }]}>{stats.done}</Text>
            <Text style={[heroText.body, { fontSize: 17 }]}>sur {stats.target} séries</Text>
          </View>
          <Segments total={stats.target} done={stats.done} />
          <Text style={heroText.body}>
            {stats.next ? `À suivre : ${stats.next}` : 'Séance terminée, bravo !'}
          </Text>
        </View>
      ) : null}
    </Hero>
  );
  return (
    <Screen title="Ma séance" overline={formatLongDate()} refreshing={detail.isRefetching} onRefresh={detail.refetch}>
      {items.length === 0 ? (
        <>
          {hero()}
          <Card>
          <Text style={type.subhead}>Pas de programme pour cette séance : ajoutez vos exercices librement.</Text>
          </Card>
        </>
      ) : (
        <WorkoutLogger
          header={hero}
          bookingId={current.my_booking?.id}
          exercises={items.map((it) => ({
            id: it.exercise,
            name: it.exercise_name ?? '',
            unit: it.exercise_unit ?? 'kg_reps',
            video_url: it.exercise_video_url,
            target: it,
          }))}
        />
      )}
      <Button
        title="Ajouter un autre exercice"
        icon="add"
        variant="secondary"
        onPress={() => router.push({ pathname: '/log', params: { bookingId: current.my_booking?.id } })}
      />
    </Screen>
  );
}
