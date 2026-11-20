import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { Text } from 'react-native';

import { groupByDay, SessionCard } from '@/components/SessionCard';
import { Empty, ErrorView, IconButton, List, ListRow, Loading, Screen, Segmented } from '@/components/ui';
import { formatDay, isoDate } from '@/lib/format';
import { useSessions, useTemplates } from '@/lib/queries';
import { colors, space, type } from '@/theme';

type Tab = 'planning' | 'past' | 'templates';

/** Coach — Séances : planning (brouillons inclus), historique et modèles. */
export default function CoachSessionsScreen() {
  const [tab, setTab] = useState<Tab>('planning');
  return (
    <Screen
      title="Séances"
      accessory={
        tab !== 'past' ? (
          <IconButton
            name="add"
            label={tab === 'templates' ? 'Nouveau modèle' : 'Planifier une séance'}
            onPress={() => router.push(tab === 'templates' ? '/coach/template-form' : '/coach/session-form')}
          />
        ) : null
      }
    >
      <Segmented<Tab>
        options={[
          { value: 'planning', label: 'À venir' },
          { value: 'past', label: 'Passées' },
          { value: 'templates', label: 'Modèles' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'templates' ? <Templates /> : <Planning past={tab === 'past'} />}
    </Screen>
  );
}

function Planning({ past }: { past: boolean }) {
  const today = isoDate();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const q = useSessions(past ? { upcoming: false, date_from: isoDate(from) } : { date_from: today });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView error={q.error} onRetry={q.refetch} />;
  const sessions = past ? [...(q.data ?? [])].reverse() : (q.data ?? []);
  if (sessions.length === 0)
    return (
      <Empty
        icon="calendar-outline"
        title={past ? 'Aucune séance passée' : 'Aucune séance planifiée'}
        text={past ? undefined : 'Appuyez sur + pour planifier votre première séance.'}
      />
    );
  return (
    <>
      {groupByDay(sessions).map(([day, items]) => (
        <Fragment key={day}>
          <Text style={[type.title3, { marginTop: space.sm, marginBottom: space.sm }]}>{formatDay(day, true)}</Text>
          {items.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onPress={() => router.push({ pathname: '/coach/session/[id]', params: { id: s.id } })}
            />
          ))}
        </Fragment>
      ))}
    </>
  );
}

function Templates() {
  const q = useTemplates();
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView error={q.error} onRetry={q.refetch} />;
  const list = q.data ?? [];
  if (!list.length)
    return (
      <Empty
        icon="list-outline"
        title="Aucun modèle"
        text="Un modèle regroupe des exercices avec leurs séries, répétitions et charges cibles."
      />
    );
  return (
    <List footer="Un modèle se réutilise pour chaque séance planifiée.">
      {list.map((t) => (
        <ListRow
          key={t.id}
          icon="list"
          iconColor={colors.force}
          title={t.name}
          subtitle={t.items.map((i) => i.exercise_name).join(', ')}
          value={`${t.items.length}`}
          onPress={() => router.push({ pathname: '/coach/template-form', params: { id: t.id } })}
        />
      ))}
    </List>
  );
}
