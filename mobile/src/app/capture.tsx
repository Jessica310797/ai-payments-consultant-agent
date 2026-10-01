import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Note } from '../components/ui';
import { ApiError, readStatement } from '../lib/api';
import { useVisit } from '../lib/store';
import { C } from '../lib/theme';
import type { Page } from '../lib/types';

const PHOTO_QUALITY = 0.6; // plenty for Claude to read a statement, and keeps uploads small on mobile data

export default function Capture() {
  const insets = useSafeAreaInsets();
  const { visit, update } = useVisit();
  const [pages, setPages] = useState<Page[]>(visit.pages);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPdf = pages.length === 1 && pages[0].type === 'application/pdf';

  const addPhotos = (assets: ImagePicker.ImagePickerAsset[]) => {
    const start = pages.filter((p) => p.type !== 'application/pdf').length;
    const added = assets.map((a, i) => ({
      uri: a.uri,
      name: a.fileName || `page-${start + i + 1}.jpg`,
      type: a.mimeType || 'image/jpeg',
      file: a.file,
    }));
    setPages((cur) => [...cur.filter((p) => p.type !== 'application/pdf'), ...added]);
    setError(null);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera access is off - turn it on for Payments Consultant in your phone settings, or choose photos instead.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: PHOTO_QUALITY });
    if (!res.canceled) addPhotos(res.assets);
  };

  const choosePhotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: PHOTO_QUALITY,
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: 20,
    });
    if (!res.canceled) addPhotos(res.assets);
  };

  const choosePdf = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0];
    setPages([{ uri: a.uri, name: a.name || 'statement.pdf', type: 'application/pdf', file: a.file }]);
    setError(null);
  };

  const read = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await readStatement(pages);
      update({ pages, draft: out.draft, checks: out.checks, notes: out.notes, report: null, id: null });
      router.push('/check');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong reading the statement - please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
      <Card title="Add the Statement">
        <Text style={st.lead}>
          Photograph each page of the merchant's latest card statement or invoice, or choose the PDF they were emailed.
        </Text>
        <View style={{ gap: 10 }}>
          {Platform.OS !== 'web' ? <Button label="Take a photo" icon="📷" onPress={takePhoto} disabled={busy} /> : null}
          <Button label="Choose photos" icon="🖼" kind="secondary" onPress={choosePhotos} disabled={busy} />
          <Button label="Choose a PDF" icon="📄" kind="secondary" onPress={choosePdf} disabled={busy} />
        </View>

        {pages.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={st.h}>{isPdf ? 'PDF' : `${pages.length} page${pages.length > 1 ? 's' : ''}`}</Text>
            {isPdf ? (
              <View style={st.pdf}>
                <Text style={{ fontSize: 15, color: C.ink, flex: 1 }} numberOfLines={1}>
                  📄 {pages[0].name}
                </Text>
                <Pressable onPress={() => setPages([])} accessibilityLabel="Remove PDF" hitSlop={10}>
                  <Text style={st.remove}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <View style={st.thumbs}>
                {pages.map((p, i) => (
                  <View key={`${p.uri}-${i}`} style={st.thumbWrap}>
                    <Image source={{ uri: p.uri }} style={st.thumb} />
                    <Text style={st.thumbNo}>{i + 1}</Text>
                    <Pressable
                      onPress={() => setPages((cur) => cur.filter((_, j) => j !== i))}
                      accessibilityLabel={`Remove page ${i + 1}`}
                      style={st.thumbX}
                      hitSlop={8}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </Card>

      <Card title="Before You Send">
        <Pressable
          onPress={() => setConsent((c) => !c)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          style={st.consent}
        >
          <View style={[st.box, consent ? st.boxOn : null]}>{consent ? <Text style={st.tick}>✓</Text> : null}</View>
          <Text style={st.consentText}>
            The merchant has agreed to me using this statement to review their card fees.
          </Text>
        </Pressable>
        <Note>
          The statement is sent securely to our server and read by Claude (Anthropic's AI) to pull out the fee figures. Full card
          numbers aren't needed - cover any that appear. You'll check every figure before any results are shown.
        </Note>
      </Card>

      {error ? (
        <View style={st.error}>
          <Text style={{ color: C.bad, fontSize: 14, lineHeight: 20 }}>{error}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: 18, gap: 8 }}>
        <Button label={busy ? 'Reading the statement…' : 'Read statement'} onPress={read} disabled={!pages.length || !consent} busy={busy} />
        {busy ? <Note>Claude is reading the statement - this can take up to a minute.</Note> : null}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  lead: { fontSize: 15, color: C.ink, lineHeight: 21 },
  h: { fontSize: 14, fontWeight: '700', color: C.ink, marginTop: 6 },
  pdf: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F2EEE6', borderRadius: 10, padding: 12 },
  remove: { color: C.bad, fontWeight: '700' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { width: 92, height: 120, borderRadius: 10, overflow: 'hidden', backgroundColor: C.line },
  thumb: { width: '100%', height: '100%' },
  thumbNo: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: C.teal,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbX: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(29,43,41,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consent: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  box: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: C.teal },
  tick: { color: '#FFFFFF', fontWeight: '800' },
  consentText: { flex: 1, fontSize: 15, color: C.ink, lineHeight: 21 },
  error: { marginTop: 14, backgroundColor: '#FBE9E2', borderRadius: 12, padding: 12 },
});
