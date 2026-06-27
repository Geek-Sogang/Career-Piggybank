import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Mascot } from '@/components/ui';
import { useApp } from '@/store';

const FEATURES: { icon: IconName; bg: string; color: string; text: string }[] = [
  { icon: 'ledgerDoc', bg: colors.greenTint, color: colors.green, text: '일을 데이터로 — 자동 기록' },
  { icon: 'shieldCheck', bg: colors.greenTint, color: colors.green, text: '3자 교차검증 — 신뢰 증명' },
  { icon: 'cardLink', bg: colors.pinkTint, color: colors.pinkStrong, text: '한도·상품으로 — 평생 자산' },
];

export function Intro() {
  const { actions } = useApp();
  const [step, setStep] = useState<'splash' | 'login' | 'onboarding'>('splash');

  if (step === 'splash') {
    return (
      <Pressable onPress={() => setStep('login')} style={{ flex: 1, backgroundColor: colors.green }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }} edges={['top', 'bottom']}>
          <Mascot size={230} />
          <Text style={{ fontSize: 27, fontWeight: '800', color: '#fff', letterSpacing: -0.8, marginTop: 14 }}>커리어 저금통</Text>
          <Text style={{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,.85)', textAlign: 'center', lineHeight: 22, marginTop: 8 }}>당신이 ‘한 일’이,{'\n'}당신의 자산이 됩니다.</Text>
          <Text style={{ position: 'absolute', bottom: 34, fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,.6)' }}>하나금융그룹</Text>
        </SafeAreaView>
      </Pressable>
    );
  }

  if (step === 'login') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, paddingHorizontal: 26, paddingBottom: 30 }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <Mascot head size={84} radius={26} style={{ borderWidth: 1, borderColor: colors.line }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.7, color: colors.ink }}>커리어 저금통</Text>
              <Text style={{ fontSize: 13.5, color: colors.sub2, fontWeight: '500', marginTop: 6 }}>긱워커를 위한 생활금융</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.green, borderWidth: 1.5, borderColor: '#B7DDDD', paddingVertical: 7, paddingHorizontal: 13, borderRadius: 11, overflow: 'hidden' }}>하나원큐</Text>
              <Icon name="arrowRight" size={20} color="#C2C7CE" sw={2.2} />
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#fff', backgroundColor: colors.green, paddingVertical: 7, paddingHorizontal: 13, borderRadius: 11, overflow: 'hidden' }}>빅워커 코너</Text>
            </View>
          </View>
          <View style={{ gap: 12 }}>
            <Pressable onPress={() => setStep('onboarding')} style={{ backgroundColor: colors.green, borderRadius: 15, paddingVertical: 17, alignItems: 'center', shadowColor: colors.green, shadowOpacity: 0.55, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>하나원큐로 시작하기</Text>
            </Pressable>
            <Text style={{ fontSize: 12, color: colors.sub2, textAlign: 'center', fontWeight: '500', lineHeight: 18 }}>하나원큐 인증 후 ‘빅워커 코너’로 자동 연결돼요</Text>
            <Pressable onPress={() => setStep('onboarding')}><Text style={{ fontSize: 13.5, color: colors.sub, textAlign: 'center', fontWeight: '600', marginTop: 2 }}>다른 방법으로 로그인</Text></Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // onboarding
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ height: 40, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 22 }}>
        <Pressable onPress={actions.enter}><Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.sub3 }}>건너뛰기</Text></Pressable>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 26, paddingBottom: 28 }}>
        <View style={{ height: 240, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 4 }}>
          <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: colors.greenTint }} />
          <Mascot size={200} />
        </View>
        <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.7, lineHeight: 33, marginTop: 26, color: colors.ink }}>무형의 커리어가,{'\n'}평생 자산이 됩니다</Text>
        <Text style={{ fontSize: 13.5, color: colors.sub, fontWeight: '500', lineHeight: 22, marginTop: 10 }}>일한 기록을 데이터로 쌓고, 3자 교차검증으로 증명해 한도와 상품으로 연결해요.</Text>
        <View style={{ gap: 14, marginTop: 24 }}>
          {FEATURES.map((f) => (
            <View key={f.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: f.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={f.icon} size={20} color={f.color} />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink2 }}>{f.text}</Text>
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 16 }}>
          <View style={{ width: 22, height: 7, borderRadius: 4, backgroundColor: colors.green }} />
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.dash }} />
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.dash }} />
        </View>
        <Pressable onPress={actions.enter} style={{ backgroundColor: colors.green, borderRadius: 15, paddingVertical: 17, alignItems: 'center', shadowColor: colors.green, shadowOpacity: 0.55, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>시작하기</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
