import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { LineChart } from '@/components/LineChart';
import { Card, Empty, ErrorView, Icon, List, ListRow, Loading, Screen, Segmented, Tile } from '@/components/ui';
import { formatDistance, formatDuration, formatKg, formatShortDate, summarizeSets, UNIT_LABELS } from '@/lib/format';
import { useProgress } from '@/lib/queries';
import type { ProgressPoint, Unit } from '@/lib/types';
import { colors, space, type, unitColor } from '@/theme';

type Metric = 'max_load' | 'volume' | 'estimated_1rm' | 'max_reps' | 'best_duration' | 'max_distance';

const METRICS: Record<Unit, { value: Metric; label: string }[]> = {
  kg_reps: [
    { value: 'max_load', label: 'Charge' },
    { value: 'volume', label: 'Volume' },
    { value: 'estimated_1rm', label: '1RM' },
    { value: 'max_reps', label: 'Reps' },
  ],
  time: [{ value: 'best_duration', label: 'Temps' }],
  distance: [{ value: 'max_distance', label: 'Distance' }],
};

const LABEL: Record<Metric, string> = {
  max_load: 'Charge max',
  volume: 'Volume par séance',
  estimated_1rm: '1RM estimé',
  max_reps: 'Répétitions max',
  best_duration: 'Meilleur temps',
  max_distance: 'Distance max',
};

const FORMAT: Record<Metric, (v: number) => string> = {
  max_load: formatKg,
  volume: (v) => `${Math.round(v).toLocaleString('fr-FR')} kg`,
  estimated_1rm: formatKg,
  max_reps: (v) => `${v}`,
  best_duration: formatDuration,
  max_distance: formatDistance,
};

const RECORD_KEY = {
  max_load: 'max_load',
  volume: 'max_volume',
  estimated_1rm: 'estimated_1rm',
  max_reps: 'max_reps',
  best_duration: 'best_duration',
  max_distance: 'max_distance',
} as const;

export default function ProgressDetail() {
  const params = useLocalSearchParams<{ exerciseId: string; userId?: string }>();
  const q = useProgress(params.userId ?? 'me', Number(params.exerciseId));
  const [metric, setMetric] = useState<Metric | null>(null);

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorView error={q.error} onRetry={q.refetch} />;
  const { exercise, points, records, last } = q.data;
  const color = unitColor[exercise.unit];
  const hasLoad = points.some((p) => p.max_load);
  const options = METRICS[exercise.unit].filter((m) => hasLoad || !['max_load', 'volume', 'estimated_1rm'].includes(m.value));
  const current = metric ?? options[0]?.value ?? 'max_reps';
  const fmt = FORMAT[current];
  const series = points
    .filter((p) => p[current as keyof ProgressPoint] != null)
    .map((p) => ({ date: p.date, value: Number(p[current as keyof ProgressPoint]) }));
  const record = records[RECORD_KEY[current]];
  const first = series[0]?.value;
  const latest = series[series.length - 1]?.value;
  const lowerBetter = current === 'best_duration' && !exercise.higher_is_better;
  const delta = first != null && latest != null ? latest - first : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      <Text style={[type.subhead, { fontWeight: '600', color }]}>{UNIT_LABELS[exercise.unit]}</Text>
      <Text style={[type.largeTitle, { marginBottom: space.lg }]}>{exercise.name}</Text>

      {points.length === 0 ? (
        <Empty icon="trending-up" title="Pas encore de données" />
      ) : (
        <>
          {/* Le record en grand : c'est ce qu'on vient voir */}
          {record && (
            <View style={{ marginBottom: space.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="trophy" size={16} color={colors.record} />
                <Text style={[type.subhead, { color: colors.record, fontWeight: '600' }]}>
                  Record, {LABEL[current].toLowerCase()}
                </Text>
              </View>
              <Text style={[type.metric, { fontSize: 56, lineHeight: 64 }]}>{fmt(record.value)}</Text>
              <Text style={type.footnote}>
                le {formatShortDate(record.date)}
                {delta != null && delta !== 0 && series.length > 1 ? (
                  <Text style={{ color: (lowerBetter ? delta < 0 : delta > 0) ? colors.success : colors.danger }}>
                    {'   '}
                    {delta > 0 ? '+' : '−'}
                    {fmt(Math.abs(delta))} depuis le début
                  </Text>
                ) : null}
              </Text>
            </View>
          )}

          {options.length > 1 && <Segmented options={options} value={current} onChange={setMetric} />}
          <Card style={{ paddingHorizontal: space.md }}>
            <LineChart points={series} format={fmt} recordValue={record?.value} color={color} />
          </Card>

          <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.xl }}>
            <Tile label="Séances" value={q.data.sessions_count} style={{ flex: 1 }} />
            {exercise.unit === 'kg_reps' && hasLoad && (
              <Tile
                label="1RM estimé"
                value={records.estimated_1rm ? Math.round(records.estimated_1rm.value) : '–'}
                unit={records.estimated_1rm ? 'kg' : undefined}
                color={color}
                style={{ flex: 1 }}
              />
            )}
            {exercise.unit === 'kg_reps' && (
              <Tile label="Reps max" value={records.max_reps?.value ?? '–'} style={{ flex: 1 }} />
            )}
          </View>

          {last && (
            <List header="La dernière fois">
              <ListRow
                icon="time"
                iconColor={color}
                title={summarizeSets(exercise.unit, last.sets)}
                subtitle={formatShortDate(last.date)}
              />
            </List>
          )}

          <List header="Historique">
            {[...series].reverse().map((p) => (
              <ListRow
                key={p.date}
                title={formatShortDate(p.date)}
                value={
                  <Text style={[type.metric, { fontSize: 17, color: record && p.value === record.value ? colors.record : colors.text }]}>
                    {fmt(p.value)}
                  </Text>
                }
              />
            ))}
          </List>
        </>
      )}
    </Screen>
  );
}
