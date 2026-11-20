import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text } from 'react-native';

import { ExercisePicker } from '@/components/ExercisePicker';
import { Segments } from '@/components/Hero';
import { LoggerExercise, WorkoutLogger } from '@/components/WorkoutLogger';
import { Card, Loading, Screen, styles } from '@/components/ui';
import { colors, space, type } from '@/theme';
import { formatDay, isoDate } from '@/lib/format';
import { usePerformances, useSession } from '@/lib/queries';

/**
 * Saisie des performances.
 * - sessionId : exercices du modèle de la séance
 * - userId : le coach saisit pour un adhérent
 * - sans paramètre : entraînement libre (PerformanceSet sans séance)
 */
export default function LogScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; bookingId?: string; userId?: string; name?: string; date?: string }>();
  const sessionId = params.sessionId ? Number(params.sessionId) : undefined;
  const userId = params.userId ? Number(params.userId) : undefined;
  const bookingId = params.bookingId ? Number(params.bookingId) : undefined;
  const session = useSession(sessionId);
  const date = params.date ?? (session.data ? isoDate(new Date(session.data.starts_at)) : isoDate());
  const already = usePerformances({ date, user: userId });
  const [extra, setExtra] = useState<LoggerExercise[]>([]);

  const exercises = useMemo(() => {
    const fromSession: LoggerExercise[] = (session.data?.items ?? []).map((it) => ({
      id: it.exercise,
      name: it.exercise_name ?? '',
      unit: it.exercise_unit ?? 'kg_reps',
      video_url: it.exercise_video_url,
      target: it,
    }));
    // Exercices déjà saisis aujourd'hui hors programme (ex. retour sur l'écran)
    const seen = new Set(fromSession.map((e) => e.id));
    const fromToday: LoggerExercise[] = [];
    for (const s of already.data ?? []) {
      if (!seen.has(s.exercise)) {
        seen.add(s.exercise);
        fromToday.push({ id: s.exercise, name: s.exercise_name, unit: s.exercise_unit });
      }
    }
    return [...fromSession, ...fromToday, ...extra.filter((e) => !seen.has(e.id))];
  }, [session.data, already.data, extra]);

  if ((sessionId && session.isLoading) || already.isLoading) return <Loading />;

  const title = session.data?.title ?? 'Entraînement libre';
  return (
    <Screen>
      <Stack.Screen options={{ title: params.name ? `Pour ${params.name}` : '' }} />
      <Text style={[type.subhead, { fontWeight: '600' }]}>{formatDay(date, true)}</Text>
      <Text style={[type.largeTitle, { marginBottom: space.lg }]}>{title}</Text>
      {exercises.length === 0 && (
        <Card>
          <Text style={styles.muted}>Choisissez un exercice ci-dessous pour commencer.</Text>
        </Card>
      )}
      <WorkoutLogger
        header={(st) =>
          sessionId && st.target > 0 ? (
            <Card style={{ gap: 10 }}>
              <Text style={type.headline}>
                {st.done} sur {st.target} séries
              </Text>
              <Segments total={st.target} done={st.done} color={colors.primary} track={colors.fill} />
            </Card>
          ) : null
        }
        exercises={exercises} userId={userId} bookingId={bookingId} date={date} />
      <ExercisePicker
        exclude={exercises.map((e) => e.id)}
        onPick={(e) => setExtra((x) => [...x, { id: e.id, name: e.name, unit: e.unit, video_url: e.video_url }])}
      />
    </Screen>
  );
}
