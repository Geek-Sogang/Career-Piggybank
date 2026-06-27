import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

const STAGES = [
  { key: 'in', emoji: '📥', title: '넣는다 · 초창기', desc: '검증된 커리어 이력을 만든다' },
  { key: 'grow', emoji: '📈', title: '불린다 · 완숙기', desc: '불규칙 소득을 자산으로 굴린다' },
  { key: 'out', emoji: '📤', title: '꺼내 쓴다 · 은퇴기', desc: '은퇴 시점을 예측해 대비한다' },
];

export default function Home() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.brand}>Career Piggybank</Text>
        <Text style={styles.slogan}>당신이 ‘한 일’이, 당신의 자산이 됩니다.</Text>
      </View>

      {STAGES.map((s) => (
        <View key={s.key} style={styles.card}>
          <Text style={styles.cardEmoji}>{s.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardDesc}>{s.desc}</Text>
          </View>
        </View>
      ))}

      <Link href="/tax-envelope" style={styles.cta}>
        <Text style={styles.ctaText}>세금봉투 데모 열기 →</Text>
      </Link>

      <Text style={styles.footnote}>
        v0.1 초기 스캐폴드 · 데모 1막(세금봉투 결정론)이 온디바이스로 동작합니다.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  hero: { paddingVertical: 16 },
  brand: { fontSize: 26, fontWeight: '800', color: colors.hanaGreen },
  slogan: { fontSize: 15, color: colors.sub, marginTop: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardEmoji: { fontSize: 28 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  cardDesc: { fontSize: 13, color: colors.sub, marginTop: 2 },
  cta: {
    marginTop: 8,
    backgroundColor: colors.hanaGreen,
    borderRadius: 14,
    paddingVertical: 16,
    textAlign: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  footnote: { fontSize: 12, color: colors.sub, textAlign: 'center', marginTop: 8 },
});
