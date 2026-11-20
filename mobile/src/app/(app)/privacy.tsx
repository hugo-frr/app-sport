import { Text } from 'react-native';

import { Screen, SectionTitle, Title, styles } from '@/components/ui';
import { useUser } from '@/lib/auth';

const p = (t: string) => <Text style={[styles.text, { marginBottom: 8, lineHeight: 22 }]}>{t}</Text>;

/** Politique de confidentialité — à faire relire avant publication sur les stores. */
export default function PrivacyScreen() {
  const user = useUser();
  return (
    <Screen>
      <Title sub="Version 1, à compléter avec les coordonnées du responsable de traitement.">Vos données</Title>
      <SectionTitle>Responsable du traitement</SectionTitle>
      {p(`La salle « ${user.gym?.name ?? ''} » est responsable du traitement de vos données. App Sport agit en tant que sous-traitant.`)}
      <SectionTitle>Données collectées</SectionTitle>
      {p("Identité et contact (nom, prénom, email, téléphone facultatif), inscriptions et présences aux séances, performances saisies (charges, répétitions, temps, distances), paiements enregistrés par le coach.")}
      {p('Aucune donnée de santé (poids, blessures, mensurations) n’est collectée.')}
      <SectionTitle>Finalités</SectionTitle>
      {p('Gestion des séances et des présences, suivi de votre progression, suivi des paiements par la salle, envoi d’emails de confirmation.')}
      <SectionTitle>Hébergement et durée</SectionTitle>
      {p('Les données sont hébergées dans l’Union européenne et conservées tant que votre compte est actif.')}
      <SectionTitle>Vos droits</SectionTitle>
      {p('Vous pouvez à tout moment exporter vos données et supprimer votre compte depuis l’onglet Profil. Pour toute autre demande (rectification, opposition), contactez votre salle.')}
    </Screen>
  );
}
