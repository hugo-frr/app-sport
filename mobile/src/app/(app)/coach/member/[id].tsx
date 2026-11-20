import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Linking, Text, View } from 'react-native';

import { ProgressList } from '@/components/ProgressList';
import { useToast } from '@/components/Toast';
import { Avatar, Badge, Button, ErrorView, IconButton, IconName, List, ListRow, Loading, Screen, SectionTitle, Tile } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { daysAgo, formatDateTime, formatEuros, formatShortDate, fullName, PAYMENT_METHODS } from '@/lib/format';
import { useDeletePayment, useMemberSummary, useSetMembership } from '@/lib/queries';
import type { BookingStatus, PaymentMethod } from '@/lib/types';
import { colors, space, type } from '@/theme';

const PAYMENT_ICON: Record<PaymentMethod, IconName> = {
  card: 'card',
  cash: 'cash',
  transfer: 'swap-horizontal',
  cheque: 'document-text',
  other: 'ellipsis-horizontal',
};

const BOOKING: Record<BookingStatus, [string, 'success' | 'danger' | 'info' | 'neutral']> = {
  present: ['Présent', 'success'],
  absent: ['Absent', 'danger'],
  booked: ['Inscrit', 'info'],
  cancelled: ['Annulé', 'neutral'],
};

/** Coach — fiche adhérent : dernière venue, séances, performances, paiements. */
export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = Number(id);
  const q = useMemberSummary(memberId);
  const membership = useSetMembership(memberId);
  const deletePayment = useDeletePayment();
  const toast = useToast();

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorView error={q.error} onRetry={q.refetch} />;
  const { member: m, payments, recent_bookings, attendance_last_30_days } = q.data;
  const up = m.payment_status === 'up_to_date';
  const suspended = m.membership_status === 'suspended';

  const toggleSuspend = async () => {
    const ok = await confirm(
      suspended ? 'Réactiver cet adhérent ?' : 'Suspendre cet adhérent ?',
      suspended ? '' : "Il ne pourra plus s'inscrire aux séances.",
    );
    if (ok) membership.mutate(suspended ? 'active' : 'suspended', { onError: (e) => toast(e.message, 'error') });
  };

  const onDeletePayment = async (pid: number) => {
    if (await confirm('Supprimer ce paiement ?', '', 'Supprimer')) deletePayment.mutate(pid, { onError: (e) => toast(e.message, 'error') });
  };

  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ alignItems: 'center', marginBottom: space.xl }}>
        <Avatar name={fullName(m)} id={m.id} size={84} />
        <Text style={[type.title2, { marginTop: space.md }]}>{fullName(m)}</Text>
        <Text style={type.subhead}>{m.email}</Text>
        <Text style={[type.footnote, { marginTop: 2 }]}>{daysAgo(m.last_visit)}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
          <Badge label={up ? 'À jour' : 'En retard'} tone={up ? 'success' : 'danger'} />
          {suspended && <Badge label="Suspendu" tone="warning" />}
        </View>
        {m.phone ? (
          <Button title={m.phone} icon="call" small variant="light" color={colors.success} onPress={() => Linking.openURL(`tel:${m.phone}`)} style={{ marginTop: space.md }} />
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.xl }}>
        <Tile label="Présences 30 j" value={attendance_last_30_days} color={colors.force} style={{ flex: 1 }} />
        <Tile
          label="Payé jusqu'au"
          value={m.paid_until ? formatShortDate(m.paid_until) : '–'}
          color={up ? colors.text : colors.danger}
          style={{ flex: 1.3 }}
        />
      </View>

      <SectionTitle
        right={
          <IconButton
            name="add"
            label="Enregistrer un paiement"
            onPress={() => router.push({ pathname: '/coach/payment-form', params: { userId: m.id, paidUntil: m.paid_until ?? '' } })}
          />
        }
      >
        Paiements
      </SectionTitle>
      <List footer={payments.length ? 'Appui long sur un paiement pour le supprimer.' : 'Aucun paiement enregistré.'}>
        {payments.map((p) => (
          <ListRow
            key={p.id}
            icon={PAYMENT_ICON[p.method]}
            iconColor={colors.success}
            title={<Text style={[type.metric, { fontSize: 17 }]}>{formatEuros(p.amount_cents)}</Text>}
            subtitle={`${PAYMENT_METHODS[p.method]}${p.note ? `, ${p.note}` : ''}`}
            value={`${formatShortDate(p.period_start)} – ${formatShortDate(p.period_end)}`}
            onLongPress={() => onDeletePayment(p.id)}
          />
        ))}
      </List>

      <List header="Dernières séances" footer={recent_bookings.length ? undefined : 'Aucune séance.'}>
        {recent_bookings.map((b) => (
          <ListRow
            key={b.id}
            title={b.session.title}
            subtitle={formatDateTime(b.session.starts_at)}
            right={<Badge label={BOOKING[b.status][0]} tone={BOOKING[b.status][1]} />}
          />
        ))}
      </List>

      <SectionTitle
        right={
          <IconButton
            name="create-outline"
            label="Saisir des performances"
            onPress={() => router.push({ pathname: '/log', params: { userId: m.id, name: m.first_name } })}
          />
        }
      >
        Performances
      </SectionTitle>
      <ProgressList member={m.id} />

      <List>
        <ListRow
          title={suspended ? "Réactiver l'adhésion" : "Suspendre l'adhésion"}
          destructive={!suspended}
          titleStyle={suspended ? { color: colors.primary } : undefined}
          onPress={toggleSuspend}
          chevron={false}
        />
      </List>
    </Screen>
  );
}
