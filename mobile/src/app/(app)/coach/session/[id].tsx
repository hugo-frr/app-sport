import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Segments } from '@/components/Hero';
import { useToast } from '@/components/Toast';
import { Avatar, Badge, Button, Card, Empty, ErrorView, Icon, List, ListRow, Loading, Screen } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { formatDay, formatTime, fullName } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useAttendance, useMembers, useSaveSession, useSession, useSetAttendance } from '@/lib/queries';
import type { Attendee } from '@/lib/types';
import { colors, space, type } from '@/theme';

/** Coach — fiche séance : appel en un tap, publication, saisie des perfs d'un adhérent. */
export default function CoachSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const session = useSession(sessionId);
  const attendance = useAttendance(sessionId);
  const setAttendance = useSetAttendance(sessionId);
  const save = useSaveSession();
  const toast = useToast();
  const [addingWalkIn, setAddingWalkIn] = useState(false);

  if (session.isLoading || attendance.isLoading) return <Loading />;
  if (session.error || !session.data) return <ErrorView error={session.error} onRetry={session.refetch} />;
  const s = session.data;
  const list = attendance.data ?? [];
  const presentCount = list.filter((a) => a.status === 'present').length;

  const toggle = (a: Attendee) => {
    haptic.tap();
    setAttendance.mutate(
      { attendees: [{ user: a.user_id, present: a.status !== 'present' }] },
      { onError: (e) => toast(e.message, 'error') },
    );
  };

  const close = async () => {
    if (!(await confirm('Clôturer la séance ?', 'Les inscrits non pointés seront marqués absents.', 'Clôturer'))) return;
    setAttendance.mutate(
      { attendees: [], close: true },
      { onSuccess: () => toast('Séance clôturée'), onError: (e) => toast(e.message, 'error') },
    );
  };

  const setStatus = (status: 'draft' | 'published') =>
    save.mutate(
      { id: s.id, status },
      {
        onSuccess: () => toast(status === 'published' ? 'Séance publiée' : 'Séance repassée en brouillon'),
        onError: (e) => toast(e.message, 'error'),
      },
    );

  const statusBadge =
    s.status === 'draft' ? <Badge label="Brouillon" tone="warning" /> : s.status === 'published' ? <Badge label="Publiée" tone="success" /> : <Badge label="Clôturée" />;

  return (
    <Screen refreshing={attendance.isRefetching} onRefresh={() => (attendance.refetch(), session.refetch())}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Text
              style={{ color: colors.primary, fontSize: 17, paddingHorizontal: 8 }}
              onPress={() => router.push({ pathname: '/coach/session-form', params: { id: s.id } })}
            >
              Modifier
            </Text>
          ),
        }}
      />
      <Text style={[type.subhead, { fontWeight: '600' }]}>
        {formatDay(s.starts_at, true)} à {formatTime(s.starts_at)}
      </Text>
      <Text style={[type.largeTitle, { marginBottom: space.lg }]}>{s.title}</Text>

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={[type.metric, { fontSize: 40, color: colors.success }]}>{presentCount}</Text>
              <Text style={type.subhead}>
                présent{presentCount > 1 ? 's' : ''} sur {list.length}
              </Text>
            </View>
            <Text style={type.footnote}>
              {s.capacity} places, {s.duration_minutes} min
              {s.template_name && s.template_name !== s.title ? `, modèle ${s.template_name}` : ''}
            </Text>
          </View>
          {statusBadge}
        </View>
        {list.length > 0 && <Segments total={list.length} done={presentCount} color={colors.success} track={colors.fill} />}
      </Card>
      {s.status === 'draft' && (
        <Button title="Publier la séance" onPress={() => setStatus('published')} loading={save.isPending} style={{ marginBottom: space.xl }} />
      )}

      {list.length === 0 ? (
        <Empty icon="people-outline" title="Aucun inscrit" text="Ajoutez les présents venus sans inscription." />
      ) : (
        <List header="Appel" footer="Touchez un adhérent pour le pointer présent.">
          {list.map((a) => (
            <AttendeeRow
              key={a.id}
              attendee={a}
              onToggle={() => toggle(a)}
              onLog={() =>
                router.push({ pathname: '/log', params: { sessionId: s.id, userId: a.user_id, bookingId: a.id, name: a.first_name } })
              }
            />
          ))}
        </List>
      )}

      {addingWalkIn ? (
        <WalkInPicker
          exclude={list.map((a) => a.user_id)}
          onPick={(userId) => {
            setAddingWalkIn(false);
            setAttendance.mutate({ attendees: [{ user: userId, present: true }] }, { onError: (e) => toast(e.message, 'error') });
          }}
        />
      ) : (
        <Button title="Ajouter un présent non inscrit" icon="person-add" variant="light" onPress={() => setAddingWalkIn(true)} />
      )}

      <View style={{ gap: space.sm, marginTop: space.sm }}>
        {s.status !== 'done' && <Button title="Clôturer la séance" variant="secondary" onPress={close} />}
        {s.status === 'published' && <Button title="Repasser en brouillon" variant="ghost" onPress={() => setStatus('draft')} />}
      </View>
    </Screen>
  );
}

function AttendeeRow({ attendee: a, onToggle, onLog }: { attendee: Attendee; onToggle: () => void; onLog: () => void }) {
  const present = a.status === 'present';
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: present }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 12 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: present ? colors.success : 'transparent',
            borderWidth: present ? 0 : 1.5,
            borderColor: colors.tertiary,
          }}
        >
          {present && <Icon name="checkmark" size={20} color="#fff" />}
        </View>
        <Avatar name={fullName(a)} id={a.user_id} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={type.body}>{fullName(a)}</Text>
          <Text style={[type.footnote, a.status === 'absent' && { color: colors.danger }, present && { color: colors.success }]}>
            {present ? 'Présent' : a.status === 'absent' ? 'Absent' : 'Inscrit'}
          </Text>
        </View>
        <Button title="Perfs" small variant="light" onPress={onLog} />
      </View>
    </Pressable>
  );
}

function WalkInPicker({ exclude, onPick }: { exclude: number[]; onPick: (id: number) => void }) {
  const q = useMembers({});
  const members = (q.data ?? []).filter((m) => !exclude.includes(m.id));
  return (
    <List header="Choisir un adhérent" footer={!q.isLoading && members.length === 0 ? 'Tous les adhérents sont déjà dans la liste.' : undefined}>
      {members.map((m) => (
        <ListRow
          key={m.id}
          leading={<Avatar name={fullName(m)} id={m.id} size={32} />}
          title={fullName(m)}
          right={<Icon name="add-circle" size={24} color={colors.success} />}
          chevron={false}
          onPress={() => onPick(m.id)}
        />
      ))}
    </List>
  );
}
