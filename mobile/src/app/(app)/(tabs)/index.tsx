import { Redirect } from 'expo-router';

import { useUser } from '@/lib/auth';

export default function Home() {
  const user = useUser();
  return <Redirect href={user.role === 'coach' ? '/today' : '/planning'} />;
}
