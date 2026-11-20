import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ExercisePicker } from '@/components/ExercisePicker';
import { useToast } from '@/components/Toast';
import { Button, Card, Field, Loading, Row, Screen, SectionTitle, Stepper, styles } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { formatDuration } from '@/lib/format';
import { useDeleteTemplate, useSaveTemplate, useTemplates } from '@/lib/queries';
import type { TemplateItem, WorkoutTemplate } from '@/lib/types';
import { colors, space, unitColor } from '@/theme';

export default function TemplateFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = id ? Number(id) : undefined;
  const templates = useTemplates();
  const existing = templates.data?.find((x) => x.id === editing);
  if (editing && !existing) return <Loading />;
  return <TemplateForm editing={editing} existing={existing} />;
}

function TemplateForm({ editing, existing }: { editing?: number; existing?: WorkoutTemplate }) {
  const save = useSaveTemplate();
  const remove = useDeleteTemplate();
  const toast = useToast();
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [items, setItems] = useState<TemplateItem[]>(existing?.items ?? []);

  const update = (i: number, patch: Partial<TemplateItem>) =>
    setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, dir: -1 | 1) =>
    setItems((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const submit = async () => {
    try {
      await save.mutateAsync({
        id: editing,
        name,
        description,
        items: items.map((it, order) => ({ ...it, id: undefined, order })),
      });
      toast('Modèle enregistré');
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const onDelete = async () => {
    if (!(await confirm('Supprimer ce modèle ?', 'Les séances déjà planifiées sont conservées.'))) return;
    remove.mutate(editing!, { onSuccess: () => router.back(), onError: (e) => toast(e.message, 'error') });
  };

  return (
    <Screen>
      <Field label="Nom" value={name} onChangeText={setName} placeholder="Ex : Force — full body" />
      <Field label="Description" value={description} onChangeText={setDescription} multiline />

      <SectionTitle>Exercices ({items.length})</SectionTitle>
      {items.map((it, i) => (
        <Card key={`${it.exercise}-${i}`} style={{ borderLeftWidth: 3, borderLeftColor: unitColor[it.exercise_unit ?? 'kg_reps'] }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[styles.strong, { flex: 1 }]}>
              {i + 1}. {it.exercise_name}
            </Text>
            <Pressable onPress={() => move(i, -1)} hitSlop={8}>
              <Text style={styles.strong}>↑</Text>
            </Pressable>
            <Pressable onPress={() => move(i, 1)} hitSlop={8}>
              <Text style={styles.strong}>↓</Text>
            </Pressable>
            <Pressable onPress={() => setItems((l) => l.filter((_, j) => j !== i))} hitSlop={8}>
              <Text style={[styles.strong, { color: colors.danger }]}>✕</Text>
            </Pressable>
          </Row>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <Stepper label="Séries" value={it.sets} min={1} onChange={(sets) => update(i, { sets })} />
            {it.exercise_unit === 'kg_reps' && (
              <Stepper label="Reps" value={it.reps ?? 8} min={1} onChange={(reps) => update(i, { reps })} />
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            {it.exercise_unit === 'kg_reps' && (
              <Stepper
                label="Charge"
                unit="kg"
                value={Number(it.target_load_kg ?? 0)}
                step={2.5}
                decimal
                onChange={(v) => update(i, { target_load_kg: v ? String(v) : null })}
              />
            )}
            {it.exercise_unit === 'time' && (
              <Stepper
                label="Temps"
                color={colors.endurance}
                value={it.target_duration_seconds ?? 60}
                step={5}
                format={formatDuration}
                onChange={(v) => update(i, { target_duration_seconds: v })}
              />
            )}
            {it.exercise_unit === 'distance' && (
              <Stepper
                label="Distance"
                unit="mètres"
                color={colors.distance}
                value={it.target_distance_m ?? 1000}
                step={100}
                onChange={(v) => update(i, { target_distance_m: v })}
              />
            )}
            <Stepper
              label="Repos"
              color={colors.info}
              value={it.rest_seconds ?? 90}
              step={15}
              format={formatDuration}
              onChange={(v) => update(i, { rest_seconds: v })}
            />
          </View>
        </Card>
      ))}
      <ExercisePicker
        onPick={(e) =>
          setItems((l) => [
            ...l,
            {
              exercise: e.id,
              exercise_name: e.name,
              exercise_unit: e.unit,
              order: l.length,
              sets: 3,
              reps: e.unit === 'kg_reps' ? 10 : null,
              target_load_kg: null,
              target_duration_seconds: e.unit === 'time' ? 60 : null,
              target_distance_m: e.unit === 'distance' ? 1000 : null,
              rest_seconds: 90,
              notes: '',
            },
          ])
        }
      />
      <Button title="Enregistrer le modèle" onPress={submit} loading={save.isPending} disabled={!name} />
      {editing && <Button title="Supprimer" variant="danger" onPress={onDelete} style={{ marginTop: space.sm }} />}
    </Screen>
  );
}
