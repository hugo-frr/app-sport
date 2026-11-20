import { ProgressList } from '@/components/ProgressList';
import { Screen } from '@/components/ui';
import { useProgressOverview } from '@/lib/queries';

export default function ProgressTab() {
  const q = useProgressOverview('me');
  return (
    <Screen title="Progression" refreshing={q.isRefetching} onRefresh={q.refetch}>
      <ProgressList member="me" />
    </Screen>
  );
}
