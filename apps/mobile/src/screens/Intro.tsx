import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { CharacterImage } from '@/components/CharacterImage';
import { useApp } from '@/store';

// 온보딩 3페이지 — 토스 프로모 문법: 파스텔 풀블리드 + 큰 3D 캐릭터 + 굵은 카피.
const INTRO_PAGES: { bg: string; kicker: string; title: string; sub: string }[] = [
  {
    bg: '#EAF2FB', kicker: '하나은행 커리어 저금통',
    title: '귀여운데 강력하다,\n긱워커의 저금통',
    sub: "당신이 '한 일'이, 당신의 자산이 됩니다",
  },
  {
    bg: '#FBEFF2', kicker: '정산 리듬에 맞춘 성장',
    title: '정산을 승인하면\n저금통도 함께 자라요',
    sub: '10레벨마다 새로운 모습으로 바뀌어요.\n커가는 모습을 지켜봐 주세요.',
  },
  {
    bg: '#EAF5F2', kicker: '검증이 곧 신뢰',
    title: '검증된 일감이\n금융 신뢰가 됩니다',
    sub: '3.3% 정산 입금을 승인하면\n검증 이력과 커리어 점수로 쌓여요.',
  },
];

export function Intro() {
  const { actions } = useApp();
  const [page, setPage] = useState(0);

  // 온보딩 — 토스 프로모 문법 3페이지
  const current = INTRO_PAGES[page];
  const last = page === INTRO_PAGES.length - 1;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: current.bg }} edges={['top', 'bottom']}>
      <View style={{ height: 40, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 22 }}>
        <Pressable onPress={actions.enter}><Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.sub2 }}>건너뛰기</Text></Pressable>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 28 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub, textAlign: 'center', marginTop: 6 }}>{current.kicker}</Text>
        <Text style={{ fontSize: 29, fontWeight: '800', letterSpacing: -0.8, lineHeight: 39, color: colors.ink, textAlign: 'center', marginTop: 12 }}>
          {current.title}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.sub, lineHeight: 21, textAlign: 'center', marginTop: 12 }}>
          {current.sub}
        </Text>

        {/* 캐릭터 파일업 — 배경 없는 컷아웃이 파스텔 위에 바로 (토스: 큰 3D가 화면의 주인공) */}
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {page === 0 && (
            <View style={{ height: 300, marginHorizontal: -28 }}>
              <CharacterImage cutout skin="sparkle" job="creator" width={196} height={196} style={{ position: 'absolute', left: -10, bottom: 66, transform: [{ rotate: '-10deg' }] }} />
              <CharacterImage cutout skin="growing" job="designer" width={196} height={196} style={{ position: 'absolute', right: -10, bottom: 58, transform: [{ rotate: '10deg' }] }} />
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: -6, alignItems: 'center', zIndex: 2 }}>
                <CharacterImage cutout skin="wave" job="developer" width={258} height={258} />
              </View>
            </View>
          )}
          {page === 1 && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
              <CharacterImage cutout skin="growing" job="developer" width={112} height={112} style={{ opacity: 0.5 }} />
              <CharacterImage cutout skin="wave" job="developer" width={226} height={226} />
              <CharacterImage cutout skin="sturdy" job="developer" width={112} height={112} style={{ opacity: 0.5 }} />
            </View>
          )}
          {page === 2 && (
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <CharacterImage cutout skin="sturdy" job="developer" width={228} height={228} />
            </View>
          )}
        </View>
      </View>

      <View style={{ paddingHorizontal: 26, paddingBottom: 24, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          {INTRO_PAGES.map((_, i) => (
            <View key={i} style={{ width: i === page ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === page ? colors.green : 'rgba(15,18,23,.14)' }} />
          ))}
        </View>
        <Pressable
          onPress={last ? actions.enter : () => setPage(page + 1)}
          style={{ backgroundColor: colors.green, borderRadius: 15, paddingVertical: 17, alignItems: 'center', shadowColor: colors.green, shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>{last ? '시작하기' : '다음'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
