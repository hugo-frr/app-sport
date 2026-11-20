import { router } from 'expo-router';
import { Text } from 'react-native';

import { Empty, ErrorView, List, ListRow, Loading } from '@/components/ui';
import { formatKg, formatShortDate } from '@/lib/format';
import { useProgressOverview } from '@/lib/queries';
import type { ExerciseOverview, Unit } from '@/lib/types';
import { type, unitColor } from '@/theme';

export const UNIT_ICON = { kg_reps: 'barbell', time: 'stopwatch', distance: 'footsteps' } as const;

/** Exercices pratiqués, groupés par catégorie → courbes. member = 'me' ou id (coach). */
export function ProgressList({ member }: { member: 'me' | number }) {
  const q = useProgressOverview(member);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView error={q.error} onRetry={q.refetch} />;
  const items = q.data?.exercises ?? [];
  if (!items.length)
    return (
      <Empty
        icon="trending-up"
        title="Aucune performance"
        text="Vos courbes apparaîtront ici dès votre première série enregistrée."
      />
    );

  const groups = new Map<string, ExerciseOverview[]>();
  for (const e of items) groups.set(e.category || 'Autres', [...(groups.get(e.category || 'Autres') ?? []), e]);

  return (
    <>
      {[...groups.entries()].map(([cat, list]) => (
        <List key={cat} header={cat}>
          {list.map((e) => (
            <ListRow
              key={e.exercise}
              icon={UNIT_ICON[e.unit as Unit]}
              iconColor={unitColor[e.unit as Unit]}
              title={e.name}
              subtitle={`${e.sessions_count} séance${e.sessions_count > 1 ? 's' : ''}, le ${formatShortDate(e.last_date)}`}
              value={e.max_load ? <Text style={[type.metric, { fontSize: 17, color: unitColor.kg_reps }]}>{formatKg(e.max_load)}</Text> : undefined}
              onPress={() =>
                router.push({
                  pathname: '/progress/[exerciseId]',
                  params: { exerciseId: e.exercise, ...(member !== 'me' ? { userId: member } : {}) },
                })
              }
            />
          ))}
        </List>
      ))}
    </>
  );
}
