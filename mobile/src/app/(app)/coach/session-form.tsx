import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useToast } from '@/components/Toast';
import { Button, Chips, Field, Loading, Screen, Segmented, Stepper, styles } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { addDays, formatDay, isoDate } from '@/lib/format';
import { useDeleteSession, useSaveSession, useSession, useTemplates } from '@/lib/queries';
import type { Session, SessionStatus } from '@/lib/types';
import { colors, radius, space } from '@/theme';

export default function SessionFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = id ? Number(id) : undefined;
  const existing = useSession(editing);
  if (editing && !existing.data) return <Loading />;
  return <SessionForm editing={editing} existing={existing.data} />;
}

function SessionForm({ editing, existing }: { editing?: number; existing?: Session }) {
  const templates = useTemplates();
  const save = useSaveSession();
  const remove = useDeleteSession();
  const toast = useToast();
  const startsAt = existing ? new Date(existing.starts_at) : null;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [day, setDay] = useState(isoDate(startsAt ?? new Date()));
  const [time, setTime] = useState(
    startsAt ? `${String(startsAt.getHours()).padStart(2, '0')}:${String(startsAt.getMinutes()).padStart(2, '0')}` : '18:30',
  );
  const [duration, setDuration] = useState(existing?.duration_minutes ?? 60);
  const [capacity, setCapacity] = useState(existing?.capacity ?? 12);
  const [kind, setKind] = useState<'group' | 'individual'>(existing?.kind ?? 'group');
  const [template, setTemplate] = useState<number | null>(existing?.template ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const days = useMemo(() => {
    const base = new Date();
    const list = Array.from({ length: 21 }, (_, i) => isoDate(addDays(base, i)));
    return list.includes(day) ? list : [day, ...list];
  }, [day]);

  const submit = async (status?: SessionStatus) => {
    const match = /^(\d{1,2})[:h](\d{2})$/.exec(time.trim());
    if (!match) return toast('Heure invalide (format 18:30)', 'error');
    const [y, m, d] = day.split('-').map(Number);
    const starts = new Date(y, m - 1, d, Number(match[1]), Number(match[2]));
    try {
      await save.mutateAsync({
        id: editing,
        title: title || templates.data?.find((t) => t.id === template)?.name || 'Séance',
        starts_at: starts.toISOString(),
        duration_minutes: duration,
        capacity,
        kind,
        template,
        notes,
        ...(status ? { status } : {}),
      });
      toast(status === 'published' ? 'Séance publiée' : 'Séance enregistrée');
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!(await confirm('Supprimer la séance ?', '', 'Supprimer'))) return;
    remove.mutate(editing!, {
      onSuccess: () => {
        toast('Séance supprimée');
        router.dismissAll();
      },
      onError: (e) => toast(e.message, 'error'),
    });
  };

  return (
    <Screen>
      <Text style={styles.label}>Modèle de séance</Text>
      <Chips
        options={[{ value: 0, label: 'Aucun' }, ...(templates.data ?? []).map((t) => ({ value: t.id, label: t.name }))]}
        value={template ?? 0}
        onChange={(v) => setTemplate(v || null)}
      />
      <Field label="Titre" value={title} onChangeText={setTitle} placeholder="Par défaut : nom du modèle" />
      <Text style={styles.label}>Jour</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
        <Chips options={days.map((d) => ({ value: d, label: formatDay(d) }))} value={day} onChange={setDay} />
      </ScrollView>
      <Field label="Heure" value={time} onChangeText={setTime} placeholder="18:30" keyboardType="numbers-and-punctuation" />
      <Text style={styles.label}>Type</Text>
      <Segmented<'group' | 'individual'>
        options={[
          { value: 'group', label: 'Collective' },
          { value: 'individual', label: 'Individuelle' },
        ]}
        value={kind}
        onChange={(k) => {
          setKind(k);
          if (k === 'individual') setCapacity(1);
        }}
      />
      <View style={{ flexDirection: 'row', gap: space.lg, backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, marginBottom: space.lg }}>
        <Stepper label="Durée" unit="minutes" value={duration} step={15} min={15} onChange={setDuration} color={colors.info} />
        <Stepper label="Capacité" unit="places" value={capacity} min={1} onChange={setCapacity} color={colors.info} />
      </View>
      <Field label="Notes (visibles par les adhérents)" value={notes} onChangeText={setNotes} multiline />

      {editing ? (
        <>
          <Button title="Enregistrer" onPress={() => submit()} loading={save.isPending} />
          <Button title="Supprimer" variant="danger" onPress={confirmDelete} style={{ marginTop: space.sm }} />
        </>
      ) : (
        <>
          <Button title="Publier maintenant" onPress={() => submit('published')} loading={save.isPending} />
          <Button
            title="Enregistrer en brouillon"
            variant="secondary"
            onPress={() => submit('draft')}
            style={{ marginTop: space.sm }}
          />
        </>
      )}
    </Screen>
  );
}
