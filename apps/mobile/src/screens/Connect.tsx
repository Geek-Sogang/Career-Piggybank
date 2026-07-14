import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, Mascot, T } from '@/components/ui';
import { useApp, type ConnSrc } from '@/store';

export function Connect() {
  const { vals, flash, actions } = useApp();
  const c = vals.conn;
  return (
    <View style={{ gap: 14 }}>
      {/* 한도 카드 */}
      <View style={{ borderRadius: 22, padding: 20, backgroundColor: colors.green, overflow: 'hidden', shadowColor: colors.green, shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 14 } }}>
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,.82)' }}>연결할수록 올라가는 커리어 점수</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 8 }}>
          <Text style={{ fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: -1.2, ...T.num }}>{vals.score}</Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff', opacity: 0.9 }}>점</Text>
        </View>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,.78)', marginTop: 3 }}>데이터를 연결(give)하면 점수가 오르고 한도(get)가 커져요</Text>
        <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#fff', marginTop: 9 }}>검증 한도 ₩{vals.limitWon} <Text style={{ fontWeight: '600', color: 'rgba(255,255,255,.78)' }}>= 점수 × 검증 단계({vals.stage})</Text></Text>
        {flash ? (
          <Text style={{ position: 'absolute', top: 18, right: 18, backgroundColor: colors.pink, color: '#fff', fontSize: 12.5, fontWeight: '800', paddingVertical: 7, paddingHorizontal: 11, borderRadius: 11, overflow: 'hidden' }}>{flash}</Text>
        ) : null}
      </View>

      {/* 연결 토글 */}
      <Card p={0} style={{ paddingHorizontal: 16 }}>
        <Row first iconBg={colors.black} icon={<Icon name="github" size={24} color="#fff" />} title="GitHub" on={c.github} onText="+30점 반영됨" sub="개발 활동 · 커밋/PR" onPress={() => actions.toggle('github')} />
        <Row iconBg={colors.bufferTint} icon={<Icon name="card" size={22} color={colors.buffer} />} title="마이데이터" on={c.mydata} onText="+50점 반영됨" sub="입출금·소득 내역 (동의 필요)" onPress={() => actions.toggle('mydata')} />
        <Row iconBg={colors.greenTint} icon={<Icon name="building" size={22} color={colors.green} />} title="홈택스" on={c.hometax} onText="+40점 · 교차검증 시작됨" sub="3.3% 소득신고 검증" onPress={() => actions.toggle('hometax')} />
        <Row last iconBg={colors.indigoTint} icon={<Icon name="shieldCheck" size={22} color={colors.indigo} />} title="KOSA 경력인증" on={c.kosa} onText="+35점 · 협회 인증됨" sub="SW산업협회 경력·기술등급" onPress={() => actions.toggle('kosa')} />
      </Card>

      {/* 포트폴리오 직접 올리기 */}
      <Pressable onPress={() => actions.toggle('portfolio')}>
        <View style={{ borderWidth: 1.5, borderColor: c.portfolio ? colors.green : colors.dash, borderStyle: c.portfolio ? 'solid' : 'dashed', borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.portfolio ? colors.greenTint2 : '#fff' }}>
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c.portfolio ? colors.green : colors.greenTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={c.portfolio ? 'check' : 'plus'} size={22} color={c.portfolio ? '#fff' : colors.green} sw={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>포트폴리오 직접 올리기</Text>
            <Text style={{ fontSize: 11.5, fontWeight: c.portfolio ? '700' : '500', color: c.portfolio ? colors.green : colors.sub2, marginTop: 2 }}>{c.portfolio ? 'AI 진위검증 완료 ✓ · +20점' : 'Behance 외 작업물 업로드 · 원본은 저장 안 해요'}</Text>
          </View>
        </View>
      </Pressable>

      {/* 검증 상태 */}
      <Card p={0} style={{ paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.sub }}>검증 상태</Text>
        <Text style={{ fontSize: 12, fontWeight: '800', color: vals.stageColor, backgroundColor: vals.stageBg, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 10, overflow: 'hidden' }}>{vals.stage}</Text>
      </Card>
      {(c.hometax || c.kosa) ? (
        <View style={{ backgroundColor: colors.greenTint, borderWidth: 1, borderColor: '#D2E8E8', borderRadius: 14, padding: 13 }}>
          <Text style={{ fontSize: 12.5, color: colors.greenInk, fontWeight: '600', lineHeight: 19 }}>연결된 출처(홈택스 3.3% 신고·KOSA 협회 경력)와 입금 내역이 교차검증되어 ‘검증 완료’ 됐어요.</Text>
        </View>
      ) : null}

      {/* 다음 추천 연결 */}
      <View style={{ backgroundColor: colors.pinkTint, borderWidth: 1, borderColor: colors.pinkLine, borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Mascot head size={40} radius={12} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.pinkInk, letterSpacing: 0.2 }}>다음 추천 연결</Text>
          <Text style={{ fontSize: 13.5, fontWeight: '700', marginTop: 3, color: colors.ink }}>Behance 연결하면 점수가 더 올라요</Text>
          <Text style={{ fontSize: 11.5, color: '#B07089', marginTop: 2, fontWeight: '600' }}>+30점 · 디자인 포트폴리오</Text>
        </View>
        <Pressable onPress={() => actions.toggle('behance')} style={{ backgroundColor: colors.black, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 11 }}>
          <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '700' }}>{c.behance ? '연결됨' : '연결'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ icon, iconBg, title, on, onText, sub, onPress, first, last }: { icon: React.ReactNode; iconBg: string; title: string; on: boolean; onText: string; sub: string; onPress: () => void; first?: boolean; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line2 }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{title}</Text>
        {on ? <Text style={{ fontSize: 11.5, color: colors.green, fontWeight: '700', marginTop: 2 }}>{onText}</Text> : null}
        <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>{sub}</Text>
      </View>
      <Toggle on={on} onPress={onPress} />
    </View>
  );
}

function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: on ? colors.green : '#E2E5E9' }}>
      <View style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 }} />
    </Pressable>
  );
}
