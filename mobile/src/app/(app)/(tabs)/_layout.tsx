import { Tabs } from 'expo-router';

import { FloatingTabBar } from '@/components/FloatingTabBar';
import { useUser } from '@/lib/auth';
import { colors } from '@/theme';

/** Une seule app, deux jeux d'onglets selon le rôle. Barre flottante ; chaque écran dessine son grand titre. */
export default function TabsLayout() {
  const user = useUser();
  const coach = user.role === 'coach';
  const show = (visible: boolean) => (visible ? {} : { href: null });

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      {/* Adhérent */}
      <Tabs.Screen name="planning" options={{ title: 'Planning', ...show(!coach) }} />
      <Tabs.Screen name="workout" options={{ title: 'Ma séance', ...show(!coach) }} />
      <Tabs.Screen name="progress" options={{ title: 'Progrès', ...show(!coach) }} />
      {/* Coach */}
      <Tabs.Screen name="today" options={{ title: "Aujourd'hui", ...show(coach) }} />
      <Tabs.Screen name="sessions" options={{ title: 'Séances', ...show(coach) }} />
      <Tabs.Screen name="members" options={{ title: 'Adhérents', ...show(coach) }} />
      <Tabs.Screen name="exercises" options={{ title: 'Exercices', ...show(coach) }} />
      {/* Commun */}
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
