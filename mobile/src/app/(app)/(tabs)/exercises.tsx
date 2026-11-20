import { router } from 'expo-router';
import { useState } from 'react';

import { UNIT_ICON } from '@/components/ProgressList';
import { Empty, ErrorView, Field, IconButton, List, ListRow, Loading, Screen } from '@/components/ui';
import { UNIT_LABELS } from '@/lib/format';
import { useExercises } from '@/lib/queries';
import type { Exercise } from '@/lib/types';
import { unitColor } from '@/theme';

/** Coach — Bibliothèque d'exercices, groupée par catégorie. */
export default function ExercisesScreen() {
  const q = useExercises();
  const [search, setSearch] = useState('');
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView error={q.error} onRetry={q.refetch} />;

  const list = (q.data ?? []).filter((e) => `${e.name} ${e.category}`.toLowerCase().includes(search.toLowerCase()));
  const groups = new Map<string, Exercise[]>();
  for (const e of list) groups.set(e.category || 'Sans catégorie', [...(groups.get(e.category || 'Sans catégorie') ?? []), e]);

  return (
    <Screen
      title="Exercices"
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
      accessory={<IconButton name="add" label="Nouvel exercice" onPress={() => router.push('/coach/exercise-form')} />}
    >
      <Field label="Rechercher" value={search} onChangeText={setSearch} placeholder="Squat, dos, cardio…" />
      {list.length === 0 && (
        <Empty
          icon="barbell-outline"
          title="Aucun exercice"
          text="Pour en créer beaucoup d'un coup, utilisez l'administration web (/admin)."
        />
      )}
      {[...groups.entries()].map(([cat, items]) => (
        <List key={cat} header={cat}>
          {items.map((e) => (
            <ListRow
              key={e.id}
              icon={UNIT_ICON[e.unit]}
              iconColor={unitColor[e.unit]}
              title={e.name}
              value={UNIT_LABELS[e.unit]}
              onPress={() => router.push({ pathname: '/coach/exercise-form', params: { id: e.id } })}
            />
          ))}
        </List>
      ))}
    </Screen>
  );
}
