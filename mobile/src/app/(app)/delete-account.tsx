import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Field, Screen, styles } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { space } from '@/theme';

export default function DeleteAccountScreen() {
  const { signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.delete('/auth/me', { password });
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible');
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={[styles.text, { marginBottom: space.lg, lineHeight: 22 }]}>
        Cette action est définitive : votre profil, vos inscriptions, vos performances et votre historique de paiements
        seront supprimés. Pensez à exporter vos données avant.
      </Text>
      <Field label="Confirmez avec votre mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={[styles.error, { marginBottom: space.md }]}>{error}</Text> : null}
      <Button title="Supprimer définitivement" variant="danger" onPress={submit} loading={loading} disabled={!password} />
    </Screen>
  );
}
