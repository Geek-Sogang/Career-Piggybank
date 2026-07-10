import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { getGigProfile, getPersona, readPersona, type GigProfile, type Persona } from '@/api';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Card, Mascot } from '@/components/ui';
import { useApp, type Push } from '@/store';

const MENU: { icon: IconName; color: string; label: string; push: Exclude<Push, null> }[] = [
  { icon: 'shield', color: colors.green, label: '데이터 주권 · 관리', push: 'dataSovereignty' },
  { icon: 'cardLink', color: colors.pinkStrong, label: '상품 연결', push: 'products' },
  { icon: 'gear', color: colors.sub, label: '알림 · 설정', push: 'settings' },
];

export function My() {
  const { vals, actions } = useApp();
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Mascot head size={56} radius={16} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.4, color: colors.ink }}>조대흠</Text>
          <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>프리랜스 개발자 · 28세</Text>
        </View>
        <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.green, backgroundColor: colors.greenTint, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 10, overflow: 'hidden' }}>확정 ✓</Text>
      </Card>

      <Card style={{ flexDirection: 'row' }}>
        <MyStat value="12건" label="검증" />
        <MyStat value="확정" label="검증 단계" color={colors.green} borderLeft />
        <MyStat value={`${vals.score}점`} label="커리어 점수" borderLeft />
      </Card>

      {/* 긱워커 소득 프로필 — 결정론 구조 층(항상 있음). 심리 축보다 앞에 세워 '긱 특화'를 도드라지게 */}
      <GigProfileCard />

      {/* 페르소나 — ④ 프로필 판독의 SSOT. 판독은 명시 트리거만(핫패스 보호), 폴백 축은 정직 표기 */}
      <PersonaCard />

      <Card p={0} style={{ paddingHorizontal: 16 }}>
        {MENU.map((m, i) => (
          <Pressable key={m.label} onPress={() => actions.pushScr(m.push)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15, borderBottomWidth: i < MENU.length - 1 ? 1 : 0, borderBottomColor: colors.line2 }}>
            <Icon name={m.icon} size={20} color={m.color} />
            <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{m.label}</Text>
            <Icon name="chevronRight" size={18} color="#C2C7CE" sw={2.2} />
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

// 긱워커 소득 프로필 카드 — 결정론 구조(측정). 심리 축(AI)과 달리 '초록=측정' 톤.
function GigProfileCard() {
  const [gig, setGig] = useState<GigProfile | null>(null);
  useEffect(() => { getGigProfile().then(setGig).catch(() => {}); }, []);
  if (!gig) return null;
  const dims: [string, string][] = [
    ['소득 변동성', gig.volatility],
    ['소득원 구조', gig.concentration],
    ['수입 리듬', gig.rhythm + (gig.is_multi_gig ? ' · N잡' : '')],
    ['커리어 국면', gig.phase],
  ];
  return (
    <View style={{ backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 18, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>내 긱워커 소득 프로필</Text>
        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.green, backgroundColor: '#fff', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>원장 측정</Text>
      </View>
      {/* 한 줄 유형 — 자기를 알아보게 */}
      <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.greenInk, lineHeight: 20, marginTop: 8 }}>{gig.archetype}</Text>
      {/* 4차원 칩 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
        {dims.map(([label, val]) => (
          <View key={label} style={{ backgroundColor: '#fff', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 }}>
            <Text style={{ fontSize: 9.5, fontWeight: '700', color: colors.sub3 }}>{label}</Text>
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.ink, marginTop: 1 }}>{val}</Text>
          </View>
        ))}
      </View>
      {gig.notes.length > 0 && (
        <View style={{ marginTop: 10, gap: 3 }}>
          {gig.notes.slice(0, 4).map((n, i) => (
            <Text key={i} style={{ fontSize: 10.5, color: colors.sub2, fontWeight: '500', lineHeight: 15 }}>· {n}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

// 성향 4축 카드 — 값(0~1 게이지)·근거 팩트·신선도. AI가 판단한 영역이라 보라 배지.
const AXIS_ORDER = ['risk_tolerance', 'time_preference', 'self_control', 'planning'];

function PersonaCard() {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [missing, setMissing] = useState(false);
  const [reading, setReading] = useState(false);
  const load = () => getPersona().then((p) => { setPersona(p); setMissing(false); }).catch(() => setMissing(true));
  useEffect(() => { load(); }, []);

  const runRead = async () => {
    setReading(true);
    try { await readPersona(); await load(); } catch {}
    setReading(false);
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>내 금융 성향</Text>
        <Text style={{ fontSize: 10, fontWeight: '800', color: '#7C5CBF', backgroundColor: '#F5F1FB', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>AI 판독</Text>
      </View>
      {missing || !persona ? (
        <View style={{ marginTop: 10, gap: 10 }}>
          <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '500', lineHeight: 18 }}>
            {reading
              ? '피기가 원장의 사실들을 읽고 있어요 … 축당 몇 초씩 걸려요 (온디바이스 AI)'
              : '아직 성향을 읽지 않았어요 — 원장에서 측정한 사실만 근거로 4가지 축을 판독해요'}
          </Text>
          {!reading && (
            <Pressable onPress={runRead} style={{ borderWidth: 1.4, borderColor: '#E2D8F3', backgroundColor: '#F5F1FB', borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#7C5CBF' }}>내 성향 읽기</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={{ marginTop: 12, gap: 11 }}>
          {AXIS_ORDER.map((key) => {
            const a = persona.axes[key];
            if (!a) return null;
            return (
              <View key={key} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.ink }}>
                    {a.label}{' '}
                    {a.fallback && <Text style={{ fontSize: 10, color: colors.sub3, fontWeight: '600' }}>판단 보류(중립)</Text>}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.sub2 }}>
                    {a.evidence.length > 0 ? `근거 ${a.evidence.join('·')}` : '—'}
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: '#EDEFF2', overflow: 'hidden' }}>
                  <View style={{ width: `${a.value * 100}%`, height: 6, borderRadius: 3, backgroundColor: a.fallback ? '#C9CED4' : '#7C5CBF' }} />
                </View>
              </View>
            );
          })}
          {persona.staleness?.stale && (
            <Pressable onPress={runRead} disabled={reading} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFF8ED', borderWidth: 1, borderColor: '#F3E3C2', borderRadius: 11, padding: 10 }}>
              <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '600', color: '#9A6B15', lineHeight: 16 }}>
                {reading ? '다시 읽는 중 …' : `그 사이 거래 ${persona.staleness.new_txns}건이 쌓였어요 — 성향을 다시 읽어볼까요?`}
              </Text>
              {!reading && <Icon name="chevronRight" size={14} color="#9A6B15" sw={2.2} />}
            </Pressable>
          )}
          <Text style={{ fontSize: 10.5, color: colors.sub3, fontWeight: '500', lineHeight: 15 }}>
            원장에서 측정한 사실(F01~F12)만 근거로 판독 — 근거가 부족한 축은 중립을 지켜요
          </Text>
        </View>
      )}
    </Card>
  );
}

function MyStat({ value, label, color, borderLeft }: { value: string; label: string; color?: string; borderLeft?: boolean }) {
  return (
    <View style={{ flex: 1, borderLeftWidth: borderLeft ? 1 : 0, borderLeftColor: colors.line, paddingLeft: borderLeft ? 16 : 0 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: color || colors.ink }}>{value}</Text>
      <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600', marginTop: 2 }}>{label}</Text>
    </View>
  );
}
