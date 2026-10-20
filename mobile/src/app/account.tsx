import { useState } from 'react';
import { View } from 'react-native';
import { FormError } from '../components/auth-ui';
import { Bullets, Button, Card, Row, Screen, Text, TextField } from '../components/ui';
import { errorMessage, useAuth } from '../lib/auth';
import { C } from '../lib/theme';

export default function Account() {
  const { profile, logOut, deleteAccount } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'out' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!password) return setError('Enter your password to confirm.');
    setBusy('delete');
    setError(null);
    try {
      await deleteAccount(password);
    } catch (e) {
      setError(errorMessage(e, "Couldn't delete your account. Check you're online and try again."));
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Card title="Your account">
        <View>
          <Row label="Email" value={profile?.email ?? '—'} />
          <Row label="Business" value={profile?.merchant.name ?? '—'} />
        </View>
        <Button kind="secondary" label="Log out" busy={busy === 'out'} onPress={() => { setBusy('out'); logOut(); }} />
      </Card>
      <Card title="Delete account">
        <Text style={{ fontSize: 14, lineHeight: 21, color: C.subtle }}>Deleting your account:</Text>
        <Bullets muted items={[
          'removes your login from PayNavigate straight away, and logs you out on every device;',
          "can't be undone - you'd need a new invite code to come back;",
          "doesn't remove other people's logins for your business.",
        ]} />
        {confirming ? (
          <View style={{ gap: 12 }}>
            <TextField label="Enter your password to confirm" value={password} onChange={setPassword} secure autoComplete="current-password" textContentType="password" />
            <FormError message={error} />
            <Button label="Delete my account" onPress={remove} busy={busy === 'delete'} />
            <Button kind="ghost" label="Cancel" onPress={() => { setConfirming(false); setPassword(''); setError(null); }} />
          </View>
        ) : (
          <Button kind="secondary" label="Delete account…" onPress={() => setConfirming(true)} />
        )}
      </Card>
    </Screen>
  );
}
