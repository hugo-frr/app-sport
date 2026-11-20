import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Share, Text, View } from 'react-native';

import { useToast } from '@/components/Toast';
import { Badge, Button, Card, List, ListRow, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { formatShortDate, fullName, initials } from '@/lib/format';
import { useRegenerateCode, useSubscription } from '@/lib/queries';
import { colors, space, tint, type } from '@/theme';

export default function ProfileScreen() {
  const user = useUser();
  const { signOut, reloadUser } = useAuth();
  const coach = user.role === 'coach';
  const toast = useToast();

  const exportData = async () => {
    try {
      const data = await api.get<object>('/auth/me/export');
      await Share.share({ title: 'Mes données', message: JSON.stringify(data, null, 2) });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export impossible', 'error');
    }
  };

  const logout = async () => {
    if (await confirm('Se déconnecter ?', '', 'Se déconnecter')) signOut();
  };

  return (
    <Screen title="Profil">
      <View style={{ alignItems: 'center', marginBottom: space.xl }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: tint(colors.primary, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[type.metric, { fontSize: 34, color: colors.primary }]}>{initials(user)}</Text>
        </View>
        <Text style={[type.title2, { marginTop: space.md }]}>{fullName(user)}</Text>
        <Text style={type.subhead}>
          {coach ? 'Coach' : 'Adhérent'}, {user.gym?.name}
        </Text>
      </View>

      {coach ? <InviteCard onChanged={reloadUser} /> : <MemberSection />}

      <List header="Compte">
        <ListRow icon="mail" iconColor={colors.info} title={user.email} chevron={false} />
        <ListRow icon="lock-closed" iconColor="#636366" title="Confidentialité" onPress={() => router.push('/privacy')} />
        <ListRow icon="share-outline" iconColor={colors.success} title="Exporter mes données" onPress={exportData} />
      </List>
      <List>
        <ListRow title="Se déconnecter" onPress={logout} chevron={false} titleStyle={{ color: colors.primary }} />
        <ListRow title="Supprimer mon compte" destructive onPress={() => router.push('/delete-account')} />
      </List>
    </Screen>
  );
}

function MemberSection() {
  const sub = useSubscription();
  const up = sub.data?.status === 'up_to_date';
  return (
    <List header="Abonnement">
      <ListRow
        icon="card"
        iconColor={up ? colors.success : colors.danger}
        title={sub.data?.paid_until ? `Payé jusqu'au ${formatShortDate(sub.data.paid_until)}` : 'Aucun paiement enregistré'}
        right={sub.data ? <Badge label={up ? 'À jour' : 'En retard'} tone={up ? 'success' : 'danger'} /> : undefined}
        chevron={false}
      />
      <ListRow icon="checkmark-done" iconColor={colors.force} title="Mes présences" onPress={() => router.push('/history')} />
    </List>
  );
}

function InviteCard({ onChanged }: { onChanged: () => Promise<void> }) {
  const user = useUser();
  const regenerate = useRegenerateCode();
  const code = user.gym?.invite_code ?? '';
  const link = Linking.createURL('/register', { queryParams: { code } });

  const share = () =>
    Share.share({ message: `Rejoins ${user.gym?.name} sur App Sport ! Code d'invitation : ${code}\n${link}` });

  const confirmRegenerate = async () => {
    if (!(await confirm('Nouveau code ?', "L'ancien code et les liens déjà envoyés ne fonctionneront plus.", 'Générer')))
      return;
    await regenerate.mutateAsync();
    await onChanged();
  };

  return (
    <Card style={{ alignItems: 'center', paddingVertical: space.xl, marginBottom: space.xl }}>
      <Text style={type.subhead}>Code d&apos;invitation</Text>
      <Text style={[type.metric, { fontSize: 40, letterSpacing: 6, marginVertical: space.sm }]} selectable>
        {code}
      </Text>
      <Button title="Inviter des adhérents" icon="share-outline" onPress={share} style={{ alignSelf: 'stretch', marginTop: space.sm }} />
      <Button title="Générer un nouveau code" variant="ghost" small onPress={confirmRegenerate} loading={regenerate.isPending} style={{ marginTop: space.sm }} />
    </Card>
  );
}
