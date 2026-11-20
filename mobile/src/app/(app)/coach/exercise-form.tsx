import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, Text } from 'react-native';

import { useToast } from '@/components/Toast';
import { Button, Chips, Field, Loading, Row, Screen, Segmented, styles } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { UNIT_LABELS } from '@/lib/format';
import { useDeleteExercise, useExercises, useSaveExercise } from '@/lib/queries';
import type { Exercise, Unit } from '@/lib/types';
import { colors, space } from '@/theme';

export default function ExerciseFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = id ? Number(id) : undefined;
  const exercises = useExercises();
  const existing = exercises.data?.find((x) => x.id === editing);
  if (editing && !existing) return <Loading />;
  return <ExerciseForm editing={editing} existing={existing} all={exercises.data ?? []} />;
}

function ExerciseForm({ editing, existing, all }: { editing?: number; existing?: Exercise; all: Exercise[] }) {
  const save = useSaveExercise();
  const remove = useDeleteExercise();
  const toast = useToast();
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    category: existing?.category ?? '',
    unit: existing?.unit ?? ('kg_reps' as Unit),
    higher_is_better: existing?.higher_is_better ?? true,
    video_url: existing?.video_url ?? '',
    description: existing?.description ?? '',
  });
  const categories = [...new Set(all.map((e) => e.category).filter(Boolean))];

  const submit = async () => {
    try {
      await save.mutateAsync({ id: editing, ...form });
      toast('Exercice enregistré');
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const onDelete = async () => {
    if (!(await confirm('Supprimer cet exercice ?', "L'historique des performances associé sera supprimé."))) return;
    remove.mutate(editing!, { onSuccess: () => router.back(), onError: (e) => toast(e.message, 'error') });
  };

  return (
    <Screen>
      <Field label="Nom" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
      <Field
        label="Catégorie / groupe musculaire"
        value={form.category}
        onChangeText={(category) => setForm({ ...form, category })}
        placeholder="Jambes, Dos, Cardio…"
      />
      {categories.length > 0 && (
        <Chips
          options={categories.map((c) => ({ value: c, label: c }))}
          value={form.category}
          onChange={(category) => setForm({ ...form, category })}
        />
      )}
      <Text style={styles.label}>Type de mesure</Text>
      <Segmented<Unit>
        options={(Object.keys(UNIT_LABELS) as Unit[]).map((u) => ({ value: u, label: UNIT_LABELS[u] }))}
        value={form.unit}
        onChange={(unit) => setForm({ ...form, unit, higher_is_better: unit === 'time' ? form.higher_is_better : true })}
      />
      {form.unit === 'time' && (
        <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
          <Text style={[styles.text, { flex: 1 }]}>Plus long = mieux (gainage). Décochez pour un chrono (rameur 500 m).</Text>
          <Switch
            value={form.higher_is_better}
            onValueChange={(higher_is_better) => setForm({ ...form, higher_is_better })}
            trackColor={{ true: colors.primary }}
          />
        </Row>
      )}
      <Field
        label="Vidéo (lien)"
        value={form.video_url}
        onChangeText={(video_url) => setForm({ ...form, video_url })}
        autoCapitalize="none"
        keyboardType="url"
        placeholder="https://…"
      />
      <Field
        label="Consignes"
        value={form.description}
        onChangeText={(description) => setForm({ ...form, description })}
        multiline
      />
      <Button title="Enregistrer" onPress={submit} loading={save.isPending} disabled={!form.name} />
      {editing && <Button title="Supprimer" variant="danger" onPress={onDelete} style={{ marginTop: space.sm }} />}
    </Screen>
  );
}
