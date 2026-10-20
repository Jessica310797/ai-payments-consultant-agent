import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthFrame, FormError } from '../../components/auth-ui';
import { Button, Text, TextField } from '../../components/ui';
import { errorMessage, useAuth } from '../../lib/auth';
import { C } from '../../lib/theme';

const MIN_PASSWORD = 10; // same rule as the server

export default function Invite() {
  const { acceptInvite } = useAuth();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!code.trim() || !email.trim()) return setError('Enter your invite code and email.');
    if (password.length < MIN_PASSWORD) return setError(`Use a password of at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await acceptInvite(code, email, password);
    } catch (e) {
      setError(errorMessage(e, "Couldn't create your account. Check you're online and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title="Create your account"
      subtitle="Enter the invite code you were sent, then choose the email and password you'll log in with."
      footer={
        <View style={{ paddingHorizontal: 4 }}>
          <Button kind="ghost" label="I already have an account" onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))} />
        </View>
      }
    >
      <TextField label="Invite code" value={code} onChange={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" placeholder="ABCDE-FGHJK" returnKeyType="next" />
      <TextField label="Email" value={email} onChange={setEmail} keyboardType="email-address" autoComplete="email" textContentType="username" returnKeyType="next" placeholder="you@business.com.au" />
      <TextField label="Password" value={password} onChange={setPassword} secure autoComplete="new-password" textContentType="newPassword" returnKeyType="next" />
      <Text style={{ fontSize: 12, color: C.subtle, marginTop: -8 }}>At least {MIN_PASSWORD} characters.</Text>
      <TextField label="Confirm password" value={confirm} onChange={setConfirm} secure autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit} />
      <FormError message={error} />
      <Button label="Create account" onPress={submit} busy={busy} />
    </AuthFrame>
  );
}
