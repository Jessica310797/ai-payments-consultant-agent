import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Button, Card, Note, TextField } from '../components/ui';
import { loadSettings, storeSettings } from '../lib/storage';
import { C } from '../lib/theme';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

export default function Settings() {
  const [apiUrl, setApiUrl] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setApiUrl(s.apiUrl ?? '');
      setAccessKey(s.accessKey ?? '');
    });
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Card title="Server">
        <TextField
          label="Server address"
          value={apiUrl}
          onChange={(v) => {
            setApiUrl(v);
            setSaved(false);
          }}
          placeholder={extra.apiUrl || 'https://your-server.onrender.com'}
        />
        <TextField
          label="Access key"
          value={accessKey}
          secure
          onChange={(v) => {
            setAccessKey(v);
            setSaved(false);
          }}
          placeholder="Leave blank to use the built-in key"
        />
        <Note>Leave these blank to use the app's built-in server. Only change them to test a different server.</Note>
        <Button
          label={saved ? 'Saved ✓' : 'Save'}
          onPress={() => storeSettings({ apiUrl: apiUrl.trim(), accessKey: accessKey.trim() }).then(() => setSaved(true))}
        />
      </Card>
      <Card title="Privacy">
        <Text style={{ color: C.ink, fontSize: 14, lineHeight: 20 }}>
          Completed checks are saved on this phone only. Statements are sent to the server to be read by Claude (Anthropic) and
          aren't stored there.
        </Text>
      </Card>
      <Note>{`\nVersion ${Constants.expoConfig?.version ?? ''}`}</Note>
    </ScrollView>
  );
}
