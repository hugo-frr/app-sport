import { useState } from 'react';
import { Text, View } from 'react-native';

import { UNIT_ICON } from '@/components/ProgressList';
import { Field, List, ListRow } from '@/components/ui';
import { UNIT_LABELS } from '@/lib/format';
import { useExercises } from '@/lib/queries';
import type { Exercise } from '@/lib/types';
import { colors, type, unitColor } from '@/theme';

export function ExercisePicker({ onPick, exclude = [], title = 'Ajouter un exercice' }: { onPick: (e: Exercise) => void; exclude?: number[]; title?: string }) {
  const q = useExercises();
  const [search, setSearch] = useState('');
  const list = (q.data ?? []).filter(
    (e) => !exclude.includes(e.id) && `${e.name} ${e.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <View style={{ marginTop: 8 }}>
      <Field label={title} placeholder="Rechercher un exercice" value={search} onChangeText={setSearch} />
      {list.length > 0 ? (
        <List>
          {list.slice(0, 30).map((e) => (
            <ListRow
              key={e.id}
              icon={UNIT_ICON[e.unit]}
              iconColor={unitColor[e.unit]}
              title={e.name}
              subtitle={e.category || UNIT_LABELS[e.unit]}
              right={<Text style={{ color: colors.primary, fontSize: 24, fontWeight: '300' }}>+</Text>}
              chevron={false}
              onPress={() => onPick(e)}
            />
          ))}
        </List>
      ) : (
        !q.isLoading && <Text style={[type.subhead, { marginLeft: 4, marginBottom: 16 }]}>Aucun exercice trouvé.</Text>
      )}
    </View>
  );
}
