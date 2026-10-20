import { ChartColumn } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, shadow } from '../lib/theme';
import { Text } from './ui';

/** Shared frame for the login and invite screens: logo, heading and a white card. */
export function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.brandDark, alignItems: 'center', justifyContent: 'center' }}>
            <ChartColumn size={22} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <View>
            <Text style={{ fontSize: 19, fontWeight: '600' }}>PayNavigate</Text>
            <Text style={{ fontSize: 13, color: C.subtle }}>Payments Intelligence</Text>
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 26, fontWeight: '600', letterSpacing: -0.4 }} accessibilityRole="header">{title}</Text>
          <Text style={{ fontSize: 15, color: C.subtle, marginTop: 4, lineHeight: 21 }}>{subtitle}</Text>
        </View>
        <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, gap: 14, ...shadow }}>{children}</View>
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ backgroundColor: C.dangerSoft, borderRadius: 12, padding: 12 }}>
      <Text style={{ color: C.danger, fontSize: 14, lineHeight: 20 }}>{message}</Text>
    </View>
  );
}
