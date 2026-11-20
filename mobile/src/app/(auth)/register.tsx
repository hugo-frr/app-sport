import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text } from 'react-native';

import { Button, Field, Screen, Segmented, Title, styles } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { space } from '@/theme';

export default function RegisterScreen() {
  // Lien d'invitation : appsport://register?code=XXXX
  const params = useLocalSearchParams<{ code?: string }>();
  const { register } = useAuth();
  const [mode, setMode] = useState<'member' | 'coach'>('member');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
    invite_code: params.code ?? '',
    gym_name: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const { gym_name, invite_code, ...rest } = form;
      await register({
        ...rest,
        email: rest.email.trim(),
        ...(mode === 'coach' ? { gym_name } : { invite_code: invite_code.trim() }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Inscription impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F2F2F7' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        <Title sub="Rejoignez votre salle, ou créez la vôtre si vous êtes coach.">Créer un compte</Title>
        <Segmented
          options={[
            { value: 'member', label: 'Adhérent' },
            { value: 'coach', label: 'Coach' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <Field label="Prénom" value={form.first_name} onChangeText={set('first_name')} autoComplete="given-name" />
        <Field label="Nom" value={form.last_name} onChangeText={set('last_name')} autoComplete="family-name" />
        <Field
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Mot de passe (8 caractères min.)"
          value={form.password}
          onChangeText={set('password')}
          secureTextEntry
          autoComplete="new-password"
        />
        <Field label="Téléphone (facultatif)" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        {mode === 'member' ? (
          <Field
            label="Code d'invitation de la salle"
            value={form.invite_code}
            onChangeText={set('invite_code')}
            autoCapitalize="characters"
            placeholder="Ex : DEMO2026 (facultatif)"
          />
        ) : (
          <Field label="Nom de votre salle" value={form.gym_name} onChangeText={set('gym_name')} />
        )}
        {error ? <Text style={[styles.error, { marginBottom: space.md }]}>{error}</Text> : null}
        <Button
          title="Créer mon compte"
          onPress={submit}
          loading={loading}
          disabled={
            !form.email || !form.password || !form.first_name || !form.last_name || (mode === 'coach' && !form.gym_name)
          }
        />
        <Text style={[styles.muted, { marginTop: space.md, textAlign: 'center' }]}>
          En créant un compte, vous acceptez la politique de confidentialité, consultable dans votre profil.
        </Text>
        <Link href="/" asChild>
          <Button title="J'ai déjà un compte" variant="ghost" style={{ marginTop: space.sm }} />
        </Link>
      </Screen>
    </KeyboardAvoidingView>
  );
}
