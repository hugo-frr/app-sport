import { ReactNode, useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { UNIT_ICON } from '@/components/ProgressList';
import { useToast } from '@/components/Toast';
import { Button, Card, Icon, Stepper } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { formatDuration, formatKg, formatSet, formatShortDate, isoDate, summarizeSets } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useAddSet, useDeleteSet, useLastPerformances, usePerformances } from '@/lib/queries';
import type { LastPerformance, PerformanceSet, TemplateItem, Unit } from '@/lib/types';
import { colors, radius, space, tint, type, unitColor } from '@/theme';

export interface LoggerExercise {
  id: number;
  name: string;
  unit: Unit;
  video_url?: string;
  target?: TemplateItem;
}

export interface LoggerStats {
  done: number;
  target: number;
  next: string | null;
}

/** Saisie série par série pour une liste d'exercices (séance planifiée ou entraînement libre). */
export function WorkoutLogger({
  exercises,
  userId,
  bookingId,
  date = isoDate(),
  header,
}: {
  exercises: LoggerExercise[];
  userId?: number;
  bookingId?: number | null;
  date?: string;
  /** En-tête calculé à partir de l'avancement (carte héros). */
  header?: (stats: LoggerStats) => ReactNode;
}) {
  const ids = useMemo(() => [...new Set(exercises.map((e) => e.id))], [exercises]);
  const last = useLastPerformances(ids, userId, date);
  const today = usePerformances({ date, user: userId });
  const setsFor = (id: number) =>
    (today.data ?? []).filter((s) => s.exercise === id).sort((a, b) => a.set_number - b.set_number);

  // Progression globale de la séance : séries faites / séries prévues (plafonné par exercice)
  const planned = exercises.filter((e) => e.target);
  const stats: LoggerStats = {
    target: planned.reduce((n, e) => n + (e.target?.sets ?? 0), 0),
    done: planned.reduce((n, e) => n + Math.min(setsFor(e.id).length, e.target?.sets ?? 0), 0),
    next: planned.find((e) => setsFor(e.id).length < (e.target?.sets ?? 0))?.name ?? null,
  };

  return (
    <View>
      {header?.(stats)}
      {exercises.map((ex, i) => (
        <ExerciseLogger
          key={`${ex.id}-${i}`}
          exercise={ex}
          last={last.data?.[String(ex.id)] ?? null}
          sets={setsFor(ex.id)}
          userId={userId}
          bookingId={bookingId}
          date={date}
        />
      ))}
    </View>
  );
}

function initialValues(ex: LoggerExercise, last: LastPerformance | null, sets: PerformanceSet[]) {
  // Pré-remplissage : dernière série du jour > cible du coach > dernière fois
  const latest = sets[sets.length - 1];
  const lastFirst = last?.sets[0];
  const t = ex.target;
  return {
    reps: latest?.reps ?? t?.reps ?? lastFirst?.reps ?? 8,
    load: Number(latest?.load_kg ?? t?.target_load_kg ?? lastFirst?.load_kg ?? 0),
    duration: latest?.duration_seconds ?? t?.target_duration_seconds ?? lastFirst?.duration_seconds ?? 60,
    distance: latest?.distance_m ?? t?.target_distance_m ?? lastFirst?.distance_m ?? 1000,
  };
}

function targetLabel(ex: LoggerExercise): string | null {
  const t = ex.target;
  if (!t) return null;
  if (ex.unit === 'time') return `${t.sets} × ${formatDuration(t.target_duration_seconds)}`;
  if (ex.unit === 'distance') return `${t.sets} × ${t.target_distance_m ?? '–'} m`;
  const load = t.target_load_kg && Number(t.target_load_kg) > 0 ? ` à ${formatKg(t.target_load_kg)}` : '';
  return `${t.sets} × ${t.reps ?? '–'}${load}`;
}

const RECORD_LABEL: Record<string, (v: number) => string> = {
  load_kg: (v) => formatKg(v),
  reps: (v) => `${v} reps`,
  duration_seconds: (v) => formatDuration(v),
  distance_m: (v) => `${v} m`,
};

function ExerciseLogger({
  exercise,
  last,
  sets,
  userId,
  bookingId,
  date,
}: {
  exercise: LoggerExercise;
  last: LastPerformance | null;
  sets: PerformanceSet[];
  userId?: number;
  bookingId?: number | null;
  date: string;
}) {
  const toast = useToast();
  const addSet = useAddSet();
  const deleteSet = useDeleteSet();
  const [values, setValues] = useState<ReturnType<typeof initialValues> | null>(null);
  const v = values ?? initialValues(exercise, last, sets);
  const update = (patch: Partial<typeof v>) => setValues({ ...v, ...patch });
  const color = unitColor[exercise.unit];

  const target = targetLabel(exercise);
  const targetSets = exercise.target?.sets ?? 0;
  const done = targetSets > 0 && sets.length >= targetSets;

  const submit = async () => {
    try {
      const created = await addSet.mutateAsync({
        exercise: exercise.id,
        user: userId,
        booking: bookingId ?? undefined,
        date,
        set_number: sets.length + 1,
        ...(exercise.unit === 'kg_reps'
          ? { reps: v.reps, load_kg: v.load > 0 ? String(v.load) : null }
          : exercise.unit === 'time'
            ? { duration_seconds: v.duration }
            : { distance_m: v.distance }),
      });
      setValues(v); // on garde les valeurs pour la série suivante
      if (created.record) {
        const fmt = RECORD_LABEL[created.record.metric] ?? String;
        toast(`Nouveau record ! ${fmt(created.record.value)}, contre ${fmt(created.record.previous)} avant`, 'record');
      } else {
        haptic.success();
        toast(`Série ${created.set_number} enregistrée`);
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Échec de l’enregistrement', 'error');
    }
  };

  const confirmDelete = async (s: PerformanceSet) => {
    if (await confirm('Supprimer cette série ?', formatSet(exercise.unit, s), 'Supprimer')) deleteSet.mutate(s.id);
  };

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ padding: space.lg, paddingBottom: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tint(color, 0.12), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={done ? 'checkmark' : UNIT_ICON[exercise.unit]} size={20} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.headline}>{exercise.name}</Text>
            {target ? <Text style={[type.footnote, { color }]}>Objectif {target}</Text> : null}
          </View>
          {exercise.video_url ? (
            <Pressable accessibilityLabel="Voir la vidéo" hitSlop={10} onPress={() => Linking.openURL(exercise.video_url!)}>
              <Icon name="play-circle" size={28} color={colors.secondary} />
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md }}>
          <Icon name="time-outline" size={15} color={colors.secondary} />
          <Text style={type.footnote}>
            {last
              ? `La dernière fois, le ${formatShortDate(last.date)} : `
              : 'Première fois sur cet exercice'}
            {last ? <Text style={{ color: colors.text, fontWeight: '600' }}>{summarizeSets(exercise.unit, last.sets)}</Text> : null}
          </Text>
        </View>

        {(sets.length > 0 || targetSets > 0) && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.md }}>
            {sets.map((s) => (
              <Pressable
                key={s.id}
                onLongPress={() => confirmDelete(s)}
                accessibilityHint="Appui long pour supprimer"
                style={{ backgroundColor: tint(color, 0.12), borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 }}
              >
                <Text style={[type.metric, { fontSize: 14, color }]}>{formatSet(exercise.unit, s).replace(' reps', '')}</Text>
              </Pressable>
            ))}
            {Array.from({ length: Math.max(0, targetSets - sets.length) }, (_, i) => (
              <View key={`todo-${i}`} style={{ borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.separator, borderStyle: 'dashed', width: 44, height: 30 }} />
            ))}
          </View>
        )}
      </View>

      <View style={{ backgroundColor: colors.elevated, padding: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {exercise.unit === 'kg_reps' && (
            <>
              <Stepper label="Répétitions" value={v.reps} min={1} color={color} onChange={(reps) => update({ reps })} />
              <Stepper label="Charge" unit="kg" value={v.load} step={2.5} decimal color={color} onChange={(load) => update({ load })} />
            </>
          )}
          {exercise.unit === 'time' && (
            <Stepper label="Temps" value={v.duration} step={5} min={1} format={formatDuration} color={color} onChange={(duration) => update({ duration })} />
          )}
          {exercise.unit === 'distance' && (
            <Stepper label="Distance" unit="mètres" value={v.distance} step={100} min={1} color={color} onChange={(distance) => update({ distance })} />
          )}
        </View>
        <Button
          title={done ? `Ajouter une série (${sets.length + 1})` : `Valider la série ${sets.length + 1}`}
          icon="checkmark"
          color={color}
          variant={done ? 'light' : 'primary'}
          onPress={submit}
          loading={addSet.isPending}
        />
      </View>
    </Card>
  );
}
