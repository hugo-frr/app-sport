import { Alert, Platform } from 'react-native';

/** Confirmation multiplateforme (Alert natif ; window.confirm sur le web). */
export function confirm(title: string, message = '', confirmLabel = 'Confirmer'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n${message}`) ?? true);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}
