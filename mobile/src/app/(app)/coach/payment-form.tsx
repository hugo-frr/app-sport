import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { useToast } from '@/components/Toast';
import { Button, Chips, Field, Screen, Segmented, styles } from '@/components/ui';
import { addDays, isoDate, PAYMENT_METHODS, parseDay } from '@/lib/format';
import { useAddPayment } from '@/lib/queries';
import type { PaymentMethod } from '@/lib/types';
import { space } from '@/theme';

type Formula = 'month' | 'quarter' | 'year' | 'custom';
const MONTHS: Record<Exclude<Formula, 'custom'>, number> = { month: 1, quarter: 3, year: 12 };

function periodEnd(start: string, months: number) {
  const d = parseDay(start);
  const end = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  return isoDate(addDays(end, -1));
}

/** Coach — saisie manuelle d'un paiement reçu (espèces, virement, CB sur place). */
export default function PaymentForm() {
  const { userId, paidUntil } = useLocalSearchParams<{ userId: string; paidUntil?: string }>();
  const add = useAddPayment();
  const toast = useToast();
  // La nouvelle période démarre le lendemain de la fin de la précédente si elle est encore en cours
  const defaultStart =
    paidUntil && paidUntil >= isoDate() ? isoDate(addDays(parseDay(paidUntil), 1)) : isoDate();
  const [amount, setAmount] = useState('45');
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [formula, setFormula] = useState<Formula>('month');
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(periodEnd(defaultStart, 1));
  const [paidOn, setPaidOn] = useState(isoDate());
  const [note, setNote] = useState('');

  const applyFormula = (f: Formula, s = start) => {
    setFormula(f);
    if (f !== 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(s)) setEnd(periodEnd(s, MONTHS[f]));
  };

  const submit = async () => {
    const cents = Math.round(Number(amount.replace(',', '.')) * 100);
    if (!cents || cents <= 0) return toast('Montant invalide', 'error');
    try {
      await add.mutateAsync({
        user: Number(userId),
        amount_cents: cents,
        paid_on: paidOn,
        method,
        period_start: start,
        period_end: end,
        note,
      });
      toast('Paiement enregistré');
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'error');
    }
  };

  return (
    <Screen>
      <Field label="Montant (€)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Text style={styles.label}>Moyen de paiement</Text>
      <Chips
        options={(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHODS[m] }))}
        value={method}
        onChange={setMethod}
      />
      <Text style={styles.label}>Formule</Text>
      <Segmented<Formula>
        options={[
          { value: 'month', label: '1 mois' },
          { value: 'quarter', label: '3 mois' },
          { value: 'year', label: '1 an' },
          { value: 'custom', label: 'Libre' },
        ]}
        value={formula}
        onChange={(f) => applyFormula(f)}
      />
      <Field
        label="Début de période (AAAA-MM-JJ)"
        value={start}
        onChangeText={(s) => {
          setStart(s);
          if (formula !== 'custom') applyFormula(formula, s);
        }}
      />
      <Field
        label="Fin de période (AAAA-MM-JJ)"
        value={end}
        onChangeText={(e) => {
          setEnd(e);
          setFormula('custom');
        }}
      />
      <Field label="Date du paiement" value={paidOn} onChangeText={setPaidOn} />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Ex : carnet 10 séances" />
      <Button title="Enregistrer le paiement" onPress={submit} loading={add.isPending} style={{ marginTop: space.sm }} />
    </Screen>
  );
}
