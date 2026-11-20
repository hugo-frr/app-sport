import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerTitle: '', headerBackButtonDisplayMode: 'minimal', headerTintColor: '#4353FF', headerStyle: { backgroundColor: '#F2F2F7' }, contentStyle: { backgroundColor: '#F2F2F7' } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="register" />
    </Stack>
  );
}
