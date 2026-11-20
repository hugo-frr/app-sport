import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import { Button, Field, Icon, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, floating, heroGradient, space, type } from '@/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']}>
        <View style={{ alignItems: 'center', marginTop: 48, marginBottom: 40 }}>
          {/* Marque : icône d'app en dégradé, comme sur l'écran d'accueil iOS */}
          <View style={[floating, { shadowColor: colors.primary, shadowOpacity: 0.35, borderRadius: 26 }]}>
            <LinearGradient
              colors={heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 92, height: 92, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="barbell" size={48} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={[type.largeTitle, { marginTop: space.xl, fontSize: 36 }]}>App Sport</Text>
          <Text style={[type.subhead, { marginTop: 4, textAlign: 'center' }]}>
            Vos séances, vos présences, vos progrès.
          </Text>
        </View>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="vous@exemple.fr"
        />
        <Field
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={submit}
        />
        {error ? <Text style={[type.footnote, { color: colors.danger, marginBottom: space.md, marginLeft: 4 }]}>{error}</Text> : null}
        <Button title="Se connecter" onPress={submit} loading={loading} disabled={!email || !password} />
        <Link href="/register" asChild>
          <Button title="Créer un compte" variant="ghost" style={{ marginTop: space.sm }} />
        </Link>
      </Screen>
    </KeyboardAvoidingView>
  );
}
