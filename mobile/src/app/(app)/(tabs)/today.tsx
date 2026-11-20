import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Hero, heroText, Segments } from '@/components/Hero';
import { Avatar, Badge, Empty, ErrorView, Icon, List, ListRow, Loading, Screen, Tile } from '@/components/ui';
import { daysAgo, formatLongDate, formatShortDate, formatTime, fullName, isoDate } from '@/lib/format';
import { useDashboard } from '@/lib/queries';
import type { Dashboard, Member } from '@/lib/types';
import { colors, radius, space, type } from '@/theme';

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Coach — Aujourd'hui : la journée en un coup d'œil, l'appel en un tap, puis le tableau de bord. */
export default function TodayScreen() {
  const q = useDashboard();
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorView error={q.error} onRetry={q.refetch} />;
  const d = q.data;
  const booked = d.today_sessions.reduce((n, s) => n + s.booked, 0);
  const present = d.today_sessions.reduce((n, s) => n + s.present, 0);

  return (
    <Screen title="Aujourd'hui" overline={formatLongDate()} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Hero>
        <Text style={heroText.overline}>
          {d.today_sessions.length
            ? `${d.today_sessions.length} séance${d.today_sessions.length > 1 ? 's' : ''} au programme`
            : 'Aucune séance au programme'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: space.sm }}>
          <Text style={[heroText.metric, { fontSize: 48 }]}>{present}</Text>
          <Text style={[heroText.body, { fontSize: 17 }]}>
            présent{present > 1 ? 's' : ''} sur {booked} inscrit{booked > 1 ? 's' : ''}
          </Text>
        </View>
        {booked > 0 && (
          <View style={{ marginTop: space.md }}>
            <Segments total={booked} done={present} />
          </View>
        )}
      </Hero>

      {d.today_sessions.length === 0 && <Empty icon="sunny-outline" title="Journée libre" text="Aucune séance planifiée aujourd'hui." />}
      {d.today_sessions.map((s) => (
        <TodaySession key={s.id} session={s} />
      ))}

      <Text style={[type.title3, { marginTop: space.lg, marginBottom: space.md }]}>Cette semaine</Text>
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.sm }}>
        <Tile label="Présences" value={d.week.total_present} color={colors.primary} style={{ flex: 1 }} />
        <Tile label="Adhérents" value={d.members_count} style={{ flex: 1 }} />
        <Tile
          label="Impayés"
          value={d.unpaid_members.length}
          color={d.unpaid_members.length ? colors.danger : colors.success}
          style={{ flex: 1 }}
        />
      </View>
      <WeekBars days={d.week.days} />

      <MemberList
        title={`Pas venus depuis ${d.inactive_days} jours`}
        members={d.inactive_members}
        detail={(m) => daysAgo(m.last_visit)}
        empty="Tout le monde est venu récemment."
      />
      <MemberList
        title="Paiements en retard"
        members={d.unpaid_members}
        detail={(m) => (m.paid_until ? `Fin le ${formatShortDate(m.paid_until)}` : 'Aucun paiement')}
        empty="Tous les adhérents sont à jour."
        danger
      />
    </Screen>
  );
}

function TodaySession({ session: s }: { session: Dashboard['today_sessions'][number] }) {
  const done = s.status === 'done';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/coach/session/[id]', params: { id: s.id } })}
      style={({ pressed }) => [
        { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, marginBottom: space.sm, gap: space.md },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ width: 56 }}>
          <Text style={[type.metric, { fontSize: 19 }]}>{formatTime(s.starts_at)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.headline}>{s.title}</Text>
          <Text style={type.footnote}>
            {done ? 'Appel terminé, ' : ''}
            {s.present}/{s.booked} présents
          </Text>
        </View>
        {done ? <Badge label="Clôturée" /> : null}
        <Icon name="chevron-forward" size={18} color={colors.tertiary} />
      </View>
      {s.booked > 0 && <Segments total={s.booked} done={s.present} color={colors.success} track={colors.fill} height={6} />}
    </Pressable>
  );
}

function WeekBars({ days }: { days: Dashboard['week']['days'] }) {
  const max = Math.max(1, ...days.map((x) => x.present));
  const today = isoDate();
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, marginBottom: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 10 }}>
        {days.map((day, i) => {
          const isToday = day.date === today;
          const future = day.date > today;
          return (
            <View key={day.date} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              {day.present > 0 && <Text style={[type.caption, { marginBottom: 4, fontVariant: ['tabular-nums'] }]}>{day.present}</Text>}
              <View
                style={{
                  width: '100%',
                  maxWidth: 24,
                  height: Math.max(6, (day.present / max) * 76),
                  borderRadius: 8,
                  backgroundColor: future ? colors.fill : isToday ? colors.primary : 'rgba(67,83,255,0.32)',
                }}
              />
              <Text style={[type.caption, { marginTop: 6 }, isToday && { color: colors.primary, fontWeight: '700' }]}>{WEEK[i]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MemberList({
  title,
  members,
  detail,
  empty,
  danger,
}: {
  title: string;
  members: Member[];
  detail: (m: Member) => string;
  empty: string;
  danger?: boolean;
}) {
  return (
    <List header={title} footer={members.length === 0 ? empty : undefined}>
      {members.map((m) => (
        <ListRow
          key={m.id}
          leading={<Avatar name={fullName(m)} id={m.id} size={36} />}
          title={fullName(m)}
          value={<Text style={[type.subhead, danger && { color: colors.danger }]}>{detail(m)}</Text>}
          onPress={() => router.push({ pathname: '/coach/member/[id]', params: { id: m.id } })}
        />
      ))}
    </List>
  );
}
