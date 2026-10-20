import { useState } from 'react';
import { View } from 'react-native';
import { AuthFrame, FormError } from '../../components/auth-ui';
import { Button, Text, TextField, TextLink } from '../../components/ui';
import { errorMessage, useAuth } from '../../lib/auth';
import { C } from '../../lib/theme';

export default function Login() {
  const { logIn, notice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    setError(null);
    try {
      await logIn(email, password);
    } catch (e) {
      setError(errorMessage(e, "Couldn't log in. Check you're online and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title="Log in"
      subtitle="See what your business pays for card payments, and what changed from 1 October."
      footer={
        <View style={{ gap: 14, paddingHorizontal: 4 }}>
          <TextLink to="/invite" label="Have an invite code? Create your account" />
          <Text style={{ fontSize: 13, color: C.subtle, lineHeight: 19 }}>
            Forgot your password? Ask your PayNavigate contact to reset your account and send you a new invite code.
          </Text>
        </View>
      }
    >
      {notice ? <Text style={{ fontSize: 14, color: C.subtle }}>{notice}</Text> : null}
      <TextField label="Email" value={email} onChange={setEmail} keyboardType="email-address" autoComplete="email" textContentType="username" returnKeyType="next" placeholder="you@business.com.au" />
      <TextField label="Password" value={password} onChange={setPassword} secure autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
      <FormError message={error} />
      <Button label="Log in" onPress={submit} busy={busy} />
    </AuthFrame>
  );
}
