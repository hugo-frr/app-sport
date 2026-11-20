import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Field, Screen, styles } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { space } from '@/theme';

export default function JoinScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { reloadUser, signOut, user } = useAuth();
  const [code, setCode] = useState(params.code ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.post('/gyms/join', { code: code.trim() });
      await reloadUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Rejoindre une salle" overline={`Bonjour ${user?.first_name ?? ''}`} edges={['top', 'bottom']}>
      <Text style={[styles.muted, { marginBottom: 24 }]}>Saisissez le code d&apos;invitation donné par votre coach.</Text>
      <Field
        label="Code d'invitation"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="Ex : DEMO2026"
      />
      {error ? <Text style={[styles.error, { marginBottom: space.md }]}>{error}</Text> : null}
      <Button title="Rejoindre" onPress={submit} loading={loading} disabled={!code} />
      <Button title="Se déconnecter" variant="ghost" onPress={signOut} style={{ marginTop: space.md }} />
    </Screen>
  );
}
