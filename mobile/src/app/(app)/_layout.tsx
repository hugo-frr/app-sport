import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="session/[id]" options={{ title: 'Séance' }} />
      <Stack.Screen name="log" options={{ title: 'Saisie' }} />
      <Stack.Screen name="progress/[exerciseId]" options={{ title: 'Progression' }} />
      <Stack.Screen name="history" options={{ title: 'Mes présences' }} />
      <Stack.Screen name="privacy" options={{ title: 'Confidentialité' }} />
      <Stack.Screen name="delete-account" options={{ title: 'Supprimer mon compte', presentation: 'modal' }} />
      <Stack.Screen name="coach/session/[id]" options={{ title: 'Appel' }} />
      <Stack.Screen name="coach/session-form" options={{ title: 'Séance', presentation: 'modal' }} />
      <Stack.Screen name="coach/template-form" options={{ title: 'Modèle de séance', presentation: 'modal' }} />
      <Stack.Screen name="coach/exercise-form" options={{ title: 'Exercice', presentation: 'modal' }} />
      <Stack.Screen name="coach/member/[id]" options={{ title: 'Adhérent' }} />
      <Stack.Screen name="coach/payment-form" options={{ title: 'Paiement', presentation: 'modal' }} />
    </Stack>
  );
}
