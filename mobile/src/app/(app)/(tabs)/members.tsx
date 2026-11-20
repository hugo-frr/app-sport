import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Badge, Empty, ErrorView, Field, List, ListRow, Loading, Screen, Segmented } from '@/components/ui';
import { daysAgo, fullName } from '@/lib/format';
import { useMembers } from '@/lib/queries';
import type { PaymentStatus } from '@/lib/types';

type Filter = PaymentStatus | 'all';

/** Coach — Adhérents : dernière venue et statut de paiement. */
export default function MembersScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const q = useMembers({ search: search || undefined, payment_status: filter === 'all' ? undefined : filter });

  return (
    <Screen title="Adhérents" refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Field label="Rechercher" placeholder="Nom, prénom ou email" value={search} onChangeText={setSearch} autoCorrect={false} />
      <Segmented<Filter>
        options={[
          { value: 'all', label: 'Tous' },
          { value: 'up_to_date', label: 'À jour' },
          { value: 'late', label: 'En retard' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {q.isLoading && <Loading />}
      {q.error && <ErrorView error={q.error} onRetry={q.refetch} />}
      {q.data?.length === 0 && (
        <Empty icon="people-outline" title="Aucun adhérent" text="Partagez votre code d'invitation depuis l'onglet Profil." />
      )}
      {!!q.data?.length && (
        <List footer={`${q.data.length} adhérent${q.data.length > 1 ? 's' : ''}`}>
          {q.data.map((m) => (
            <ListRow
              key={m.id}
              leading={<Avatar name={fullName(m)} id={m.id} />}
              title={fullName(m)}
              subtitle={daysAgo(m.last_visit)}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge
                    label={m.payment_status === 'up_to_date' ? 'À jour' : 'En retard'}
                    tone={m.payment_status === 'up_to_date' ? 'success' : 'danger'}
                  />
                  {m.membership_status === 'suspended' && <Badge label="Suspendu" tone="warning" />}
                </View>
              }
              onPress={() => router.push({ pathname: '/coach/member/[id]', params: { id: m.id } })}
            />
          ))}
        </List>
      )}
    </Screen>
  );
}
