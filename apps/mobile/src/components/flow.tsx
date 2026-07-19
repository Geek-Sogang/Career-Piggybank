import { View, Text, Pressable, ScrollView } from 'react-native';
import { colors } from '@/theme/colors';

// 데모 플로우(영상 9~12) 공용 뼈대 — 토스식 진행형 UX.
// 한 화면 = 한 목적 = 한 액션. 상단 진행 점 + 본문 스크롤 + 하단 단일 CTA.

/** 상단 진행 인디케이터 (현재 단계만 길게). */
export function StepDots({ total, index }: { total: number; index: number }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{ width: i === index ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i <= index ? colors.green : colors.line }} />
      ))}
    </View>
  );
}

/** 뒤로/닫기 + 진행 점 헤더. */
export function FlowHeader({ total, index, onBack }: { total: number; index: number; onBack: () => void }) {
  return (
    <View style={{ height: 52, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' }}>
      <Pressable onPress={onBack} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <ChevronLeft />
      </Pressable>
      <StepDots total={total} index={index} />
      <View style={{ width: 44 }} />
    </View>
  );
}

function ChevronLeft() {
  return (
    <View style={{ width: 24, height: 24 }}>
      <View style={{ position: 'absolute', left: 8, top: 5, width: 11, height: 2, backgroundColor: colors.ink, borderRadius: 2, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', left: 8, top: 12, width: 11, height: 2, backgroundColor: colors.ink, borderRadius: 2, transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}

/** 본문(스크롤) + 하단 단일 CTA(+선택 보조 버튼). */
export function Frame({ children, cta, ctaSub, onCta, ctaDisabled, secondary, onSecondary }: {
  children: React.ReactNode; cta: string; ctaSub?: string; onCta: () => void; ctaDisabled?: boolean; secondary?: string; onSecondary?: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, gap: 8 }}>
        {ctaSub ? <Text style={{ fontSize: 11.5, color: colors.sub3, fontWeight: '500', textAlign: 'center' }}>{ctaSub}</Text> : null}
        <Pressable
          onPress={ctaDisabled ? undefined : onCta}
          style={{ backgroundColor: ctaDisabled ? colors.dash : colors.green, borderRadius: 16, paddingVertical: 17, alignItems: 'center', shadowColor: colors.green, shadowOpacity: ctaDisabled ? 0 : 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>{cta}</Text>
        </Pressable>
        {secondary ? (
          <Pressable onPress={onSecondary} style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.sub2 }}>{secondary}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** 키커 + 큰 제목 + 서브. ai=true면 키커를 AI 보라로 (AI가 판단한 장에만). */
export function Title({ kicker, title, sub, ai }: { kicker?: string; title: string; sub?: string; ai?: boolean }) {
  return (
    <View style={{ marginBottom: 22 }}>
      {kicker ? <Text style={{ fontSize: 13, fontWeight: '700', color: ai ? colors.ai : colors.green, marginBottom: 8 }}>{kicker}</Text> : null}
      <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.6, lineHeight: 33, color: colors.ink }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 14, fontWeight: '500', color: colors.sub, lineHeight: 21, marginTop: 10 }}>{sub}</Text> : null}
    </View>
  );
}
