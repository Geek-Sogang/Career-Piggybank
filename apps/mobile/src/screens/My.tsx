import { useEffect, useState, type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  getGigProfile, getPersona, getPersonalizationV2, readPersona, setManagementOverride,
  type GigProfile, type Persona, type PersonalizationV2,
} from '@/api';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Card, Mascot } from '@/components/ui';
import { useApp, type Push } from '@/store';

const MENU: { icon: IconName; color: string; label: string; push: Exclude<Push, null> }[] = [
  { icon: 'shield', color: colors.green, label: '데이터 주권 · 관리', push: 'dataSovereignty' },
  { icon: 'cardLink', color: colors.pinkStrong, label: '상품 연결', push: 'products' },
  { icon: 'gear', color: colors.sub, label: '알림 · 설정', push: 'settings' },
];

const STRUCTURE_UI: Record<string, { label: string; levels: Record<string, string> }> = {
  income_stability: {
    label: '정산 사이 흐름',
    levels: {
      안정: '비슷한 금액이 꾸준히 들어와요',
      변동: '달마다 금액이 조금씩 달라요',
      고변동: '달마다 들어오는 금액 차이가 커요',
      '관측 부족': '수입 흐름을 조금 더 지켜볼게요',
    },
  },
  income_source_structure: {
    label: '돈이 들어오는 곳',
    levels: {
      '단일 의존': '한 곳에 대한 의존도가 높아요',
      '소수 집중': '몇 곳에 수입이 집중돼 있어요',
      다각화: '여러 곳에서 나눠 들어와요',
      '관측 부족': '정산처를 조금 더 확인할게요',
    },
  },
};

const DECISION_UI: Record<string, {
  question: string;
  levels: Record<string, string>;
  reasons: Record<string, string>;
}> = {
  safety_fund_strategy: {
    question: '다음 정산 전, 얼마나 남겨둘까요?',
    levels: {
      '확보 우선': '안전자금을 먼저 채워요',
      균형: '생활과 안전자금을 균형 있게 나눠요',
      '활용 우선': '남는 돈을 다음 목표에도 활용해요',
    },
    reasons: {
      '확보 우선': '수입 공백이 와도 생활이 흔들리지 않게 먼저 지켜둘게요.',
      균형: '최근 수입 공백과 저축 여력을 함께 봤어요.',
      '활용 우선': '안전자금 여유를 지키면서 다른 목표도 함께 볼 수 있어요.',
    },
  },
  management_support: {
    question: '피기가 얼마나 챙겨드릴까요?',
    levels: {
      자율: '필요할 때만 짧게 알려드릴게요',
      가이드: '중요한 선택마다 함께 설명해드릴게요',
      '적극 관리': '놓치기 쉬운 다음 행동을 먼저 알려드릴게요',
    },
    reasons: {
      자율: '거래 기록과 커리어 관리를 스스로 꾸준히 하고 있어요.',
      가이드: '선택할 때 근거를 같이 보면 더 편하게 관리할 수 있어요.',
      '적극 관리': '입금 뒤 해야 할 일을 하나씩 먼저 안내해드릴게요.',
    },
  },
  goal_pacing: {
    question: '남은 돈은 어느 시점의 목표에 둘까요?',
    levels: {
      '현재 우선': '지금 필요한 목표를 먼저 봐요',
      균형: '지금과 미래 목표를 함께 봐요',
      '미래 우선': '장기 목표를 먼저 챙겨요',
    },
    reasons: {
      '현재 우선': '보호할 돈을 남긴 뒤 가까운 목표의 사용 시점을 먼저 봐요.',
      균형: '목표 기한과 사용 가능한 여윳돈을 함께 비교해요.',
      '미래 우선': '보호할 돈을 남긴 뒤 장기 목표에 더 천천히 나눠 담아요.',
    },
  },
};

const FACT_LABELS: Record<string, string> = {
  F01: '수입 금액 변화', F02: '정산처 분산', F03: '입금 간격', F04: '가장 긴 수입 공백',
  F05: '공백기 지출', F06: '입금 직후 소비', F07: '생활비 흐름', F08: '업무 경비',
  F09: '저축 여력', F10: '거래 기록', F11: '제안 선택', F12: '안전자금 조정',
  F13: '커리어 연결', F14: '관측 기간',
};

const AXIS_UI: Record<string, {
  tag: string;
  low: string;
  middle: string;
  high: string;
}> = {
  risk_tolerance: {
    tag: '안전자금',
    low: '안전자금을 먼저 챙기는 편이에요',
    middle: '생활과 안전자금을 함께 보는 편이에요',
    high: '여유가 생기면 다음 목표에도 활용하는 편이에요',
  },
  time_preference: {
    tag: '지금과 미래',
    low: '지금 필요한 지출을 더 먼저 보는 편이에요',
    middle: '지금과 미래를 함께 보는 편이에요',
    high: '미래 준비를 더 먼저 챙기는 편이에요',
  },
  self_control: {
    tag: '정산 뒤 지출',
    low: '정산 뒤 지출이 한꺼번에 몰리는 편이에요',
    middle: '상황에 따라 지출 흐름이 달라져요',
    high: '큰 정산 뒤에도 지출 흐름이 고른 편이에요',
  },
  planning: {
    tag: '기록 관리',
    low: '필요할 때 한 번씩 기록을 챙기는 편이에요',
    middle: '중요한 기록부터 챙기는 편이에요',
    high: '거래와 커리어 기록을 꾸준히 관리해요',
  },
};

const AXIS_FACT_PRIORITY: Record<string, string[]> = {
  risk_tolerance: ['F12', 'F09', 'F04'],
  time_preference: ['F12', 'F06', 'F09'],
  self_control: ['F06', 'F05', 'F07'],
  planning: ['F13', 'F10', 'F07', 'F03'],
};

function friendlyFacts(ids: string[], axis: string): string {
  const directionalIds = ids.filter((id) => id !== 'F14');
  const priority = AXIS_FACT_PRIORITY[axis] ?? [];
  const ordered = [
    ...priority.filter((id) => directionalIds.includes(id)),
    ...directionalIds.filter((id) => !priority.includes(id)),
  ];
  const labels = ordered.map((id) => FACT_LABELS[id]).filter(Boolean);
  return [...new Set(labels)].slice(0, 4).join(' · ');
}

function friendlyAxisResult(key: string, value: number): string {
  const ui = AXIS_UI[key];
  if (!ui) return '최근 기록을 조금 더 지켜보고 있어요';
  if (value <= 0.3) return ui.low;
  if (value >= 0.7) return ui.high;
  return ui.middle;
}

export function My() {
  const { vals, actions } = useApp();
  const [detailOpen, setDetailOpen] = useState(false);
  const [v2, setV2] = useState<PersonalizationV2 | null>(null);
  const [v2Error, setV2Error] = useState(false);
  const loadV2 = () => getPersonalizationV2()
    .then((profile) => { setV2(profile); setV2Error(false); })
    .catch(() => setV2Error(true));
  useEffect(() => { loadV2(); }, []);
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Mascot head size={56} radius={16} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.4, color: colors.ink }}>조대흠</Text>
          <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>프리랜스 개발자 · 28세</Text>
        </View>
        <Text style={{ fontSize: 11.5, fontWeight: '800', color: vals.stageColor, backgroundColor: vals.stageBg, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 10, overflow: 'hidden' }}>{vals.stage} ✓</Text>
      </Card>

      <Card style={{ flexDirection: 'row' }}>
        <MyStat value={`${vals.verified.count}건`} label="검증" />
        <MyStat value={vals.stage} label="검증 단계" color={vals.stageColor} borderLeft />
        <MyStat value={`${vals.score}점`} label="커리어 점수" borderLeft />
      </Card>

      {/* 긱 구조 2 + 금융 대응 3 — 측정·판독·서비스 매핑을 분리한다. */}
      {v2 && <GigProfileCard v2={v2} />}
      {v2 && <FinancialResponseCard v2={v2} onUpdated={setV2} />}
      {!v2 && v2Error && (
        <Card>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>개인화 프로필을 불러오지 못했어요</Text>
          <Pressable onPress={loadV2} style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.green }}>다시 불러오기</Text>
          </Pressable>
        </Card>
      )}

      {/* 판단 근거 자세히 보기 — 4축 원본 판독(게이지·근거·신선도)은 접힘 안으로 */}
      <Card p={0} style={{ paddingHorizontal: 16 }}>
        <Pressable onPress={() => setDetailOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15 }}>
          <Icon name="shield" size={20} color="#7C5CBF" />
          <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.ink }}>왜 이렇게 맞췄는지 보기</Text>
          <Text style={{ fontSize: 11, fontWeight: '500', color: colors.sub3 }}>{detailOpen ? '접기' : '거래·정산 기록 기반'}</Text>
          <Icon name="chevronRight" size={18} color="#C2C7CE" sw={2.2} />
        </Pressable>
      </Card>
      {detailOpen && v2 && <PersonalizationMapCard v2={v2} />}
      {detailOpen && <PersonaCard onChanged={loadV2} />}

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

// 긱워커 일감·정산 프로필 — V2 계약의 구조 2축을 생활 언어로 직접 소비한다.
// archetype·notes는 같은 결정론 gig_profile의 설명층으로만 함께 보여준다.
function GigProfileCard({ v2 }: { v2: PersonalizationV2 }) {
  const [gig, setGig] = useState<GigProfile | null>(null);
  useEffect(() => { getGigProfile().then(setGig).catch(() => {}); }, []);
  return (
    <View style={{ backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 18, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>내 일감·정산 흐름</Text>
        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.green, backgroundColor: '#fff', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>입금 기록으로 확인</Text>
      </View>
      {/* 한 줄 유형 — 자기를 알아보게 */}
      <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.greenInk, lineHeight: 20, marginTop: 8 }}>
        {gig?.archetype ?? '입금 원장에서 측정한 긱 소득 구조예요'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: '#fff', borderRadius: 10 }}>
        {['일감', '정산', '다음 공백'].map((step, index) => (
          <View key={step} style={{ flex: index === 2 ? 0 : 1, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 10.5, fontWeight: '800', color: index === 1 ? colors.green : colors.sub2 }}>{step}</Text>
            {index < 2 && <Text style={{ flex: 1, textAlign: 'center', fontSize: 11, color: colors.greenLine }}>→</Text>}
          </View>
        ))}
      </View>
      {/* V2 구조 2축 — 발표의 2+2와 제품 화면을 같은 계약으로 맞춘다. */}
      <View style={{ flexDirection: 'row', gap: 7, marginTop: 12 }}>
        {v2.gig_structure.map((axis) => (
          <View key={axis.key} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 }}>
            <Text style={{ fontSize: 9.5, fontWeight: '500', color: colors.sub3 }}>{STRUCTURE_UI[axis.key]?.label ?? axis.label}</Text>
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.ink, marginTop: 2, lineHeight: 17 }}>
              {STRUCTURE_UI[axis.key]?.levels[axis.level] ?? axis.level}
            </Text>
            <Text style={{ fontSize: 9.5, fontWeight: '400', color: colors.sub2, marginTop: 4, lineHeight: 13 }}>{axis.detail}</Text>
          </View>
        ))}
      </View>
      {gig && gig.notes.length > 0 && (
        <View style={{ marginTop: 10, gap: 3 }}>
          {gig.notes.slice(0, 4).map((n, i) => (
            <Text key={i} style={{ fontSize: 10.5, color: colors.sub2, fontWeight: '400', lineHeight: 15 }}>· {n}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

// 금융 대응 카드(V2) — 성향을 안전자금·관리 강도·목표 자금 페이스로 번역한다.
// 근거가 부족하면 '판단 보류'를 정직하게 표시하고, 관리 강도는 사용자가 언제든 직접 고른다
// (선택은 별도 저장 — 권장값을 덮어쓰지 않고, 실행 승인 게이트와 무관하다).
const MGMT_LEVELS = ['자율', '가이드', '적극 관리'];
const MGMT_BUTTON_COPY: Record<string, string> = {
  자율: '간단히', 가이드: '함께', '적극 관리': '꼼꼼히',
};

function FinancialResponseCard({ v2, onUpdated }: {
  v2: PersonalizationV2;
  onUpdated: (profile: PersonalizationV2) => void;
}) {
  const [saving, setSaving] = useState(false);
  const safety = v2.financial_response.find((d) => d.key === 'safety_fund_strategy');
  const mgmt = v2.financial_response.find((d) => d.key === 'management_support');
  const pacing = v2.financial_response.find((d) => d.key === 'goal_pacing');
  if (!safety || !mgmt || !pacing) return null;

  const pick = async (level: string | null) => {
    if (saving) return;
    setSaving(true);
    try { onUpdated(await setManagementOverride(level)); } catch {}
    setSaving(false);
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>정산 흐름에 맞춘 돈 관리</Text>
        <Text style={{ fontSize: 10, fontWeight: '800', color: '#7C5CBF', backgroundColor: '#F5F1FB', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>나에게 맞춤</Text>
      </View>
      <Text style={{ fontSize: 11, color: colors.sub2, fontWeight: '400', lineHeight: 16, marginTop: 6 }}>
        고정 월급이 아니라 다음 정산까지 버티는 흐름을 기준으로 맞췄어요.
      </Text>

      {/* 안전자금 운용 방향 — 실제 정책은 같은 raw 위험감내 연속값을 소비하고, 여기는 표시 번역. */}
      <V2DecisionRow decision={safety} />

      {/* 권장 관리 강도 + 사용자 선택 — 권장은 관측 행동 기반, 선택이 항상 이긴다 */}
      <V2DecisionRow decision={mgmt} overrideLevel={v2.management_override} />
      <View style={{ flexDirection: 'row', gap: 7, marginTop: 9 }}>
        {MGMT_LEVELS.map((level) => {
          const active = v2.effective_management === level;
          return (
            <Pressable key={level} disabled={saving} onPress={() => pick(level === v2.management_override ? null : level)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11, borderWidth: 1.4, borderColor: active ? '#7C5CBF' : colors.line2, backgroundColor: active ? '#F5F1FB' : '#fff' }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: active ? '#7C5CBF' : colors.sub2 }}>
                {MGMT_BUTTON_COPY[level]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {v2.management_override && (
        <Pressable onPress={() => pick(null)} disabled={saving} style={{ marginTop: 7 }}>
          <Text style={{ fontSize: 10.5, color: colors.sub2, fontWeight: '400' }}>
            내가 고른 방식이에요 · 피기 추천은 {DECISION_UI.management_support.levels[mgmt.level]}
          </Text>
        </Pressable>
      )}

      {/* 시간선호는 보호금액 이후 여윳돈의 목표 시점에만 연결한다. */}
      <V2DecisionRow decision={pacing} />

      <Text style={{ fontSize: 10.5, color: colors.sub3, fontWeight: '400', lineHeight: 15, marginTop: 10 }}>
        정산 흐름이 바뀌면 추천도 다시 맞춰져요. 어떤 방식을 골라도 돈이 움직이기 전에는 항상 확인해요.
      </Text>
    </Card>
  );
}

function PersonalizationMapCard({ v2 }: { v2: PersonalizationV2 }) {
  const output = Object.fromEntries(v2.financial_response.map((decision) => [decision.key, decision]));
  const rows = [
    {
      title: '안전자금 운용',
      formula: '소득 안정성 + 현재 버퍼 + 안전 여유',
      result: output.safety_fund_strategy?.level ?? '판단 보류',
    },
    {
      title: '권장 관리 방식',
      formula: '지출 조절 + 관리 습관 + 사용자 선택',
      result: v2.effective_management,
    },
    {
      title: '목표별 금융 제안',
      formula: '돈의 시간 + 목표 기한 + 사용 가능 금액',
      result: output.goal_pacing?.level ?? '판단 보류',
    },
  ];
  return (
    <Card>
      <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>나에게 맞춰지는 과정</Text>
      <Text style={{ fontSize: 10.5, fontWeight: '400', color: colors.sub2, lineHeight: 15, marginTop: 4 }}>측정할 수 있는 구조와 AI가 읽은 행동을 섞지 않고 마지막 결정에서 결합해요.</Text>

      <MapStage number="1" title="긱 소득 구조" badge="규칙·통계">
        <MapLine title="소득 안정성" detail="F01 변동성 + F03 입금 간격 + F04 최장 공백" />
        <MapLine title="소득원 구조" detail="F02 집중도 + 반복 발주처 + 플랫폼·프로젝트 리듬" />
      </MapStage>
      <MapArrow />
      <MapStage number="2" title="금융 행동 성향" badge="EXAONE 판독">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {['안전 여유', '돈의 시간', '지출 조절', '관리 습관'].map((label) => (
            <Text key={label} style={{ fontSize: 10.5, fontWeight: '700', color: '#6D4AA7', backgroundColor: '#F5F1FB', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' }}>{label}</Text>
          ))}
        </View>
      </MapStage>
      <MapArrow />
      <MapStage number="3" title="서비스 개인화" badge="구조 + 성향">
        <View style={{ gap: 8 }}>
          {rows.map((row) => (
            <View key={row.title} style={{ borderRadius: 10, backgroundColor: '#F7F8FA', padding: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '800', color: colors.ink }}>{row.title}</Text>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.green }}>{row.result}</Text>
              </View>
              <Text style={{ fontSize: 9.5, fontWeight: '400', color: colors.sub2, marginTop: 3 }}>{row.formula}</Text>
            </View>
          ))}
        </View>
      </MapStage>
      <Text style={{ fontSize: 9.5, fontWeight: '400', color: colors.sub3, lineHeight: 14, marginTop: 10 }}>세금·필수경비·기본생활비는 성향과 무관하게 보호하고, 어떤 제안도 실행 전에는 항상 확인해요.</Text>
    </Card>
  );
}

function MapStage({ number, title, badge, children }: { number: string; title: string; badge: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 12, borderWidth: 1, borderColor: colors.line2, borderRadius: 12, padding: 11 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <View style={{ width: 21, height: 21, borderRadius: 11, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>{number}</Text></View>
        <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '800', color: colors.ink }}>{title}</Text>
        <Text style={{ fontSize: 9.5, fontWeight: '700', color: colors.sub2 }}>{badge}</Text>
      </View>
      {children}
    </View>
  );
}

function MapLine({ title, detail }: { title: string; detail: string }) {
  return <View style={{ marginTop: 4 }}><Text style={{ fontSize: 11, fontWeight: '700', color: colors.ink }}>{title}</Text><Text style={{ fontSize: 9.5, fontWeight: '400', color: colors.sub2, lineHeight: 14, marginTop: 2 }}>{detail}</Text></View>;
}

function MapArrow() {
  return <Text style={{ textAlign: 'center', color: colors.green, fontSize: 15, fontWeight: '800', marginVertical: -2 }}>↓</Text>;
}

function V2DecisionRow({ decision, overrideLevel }: { decision: import('@/api').V2Decision; overrideLevel?: string | null }) {
  const onHold = decision.decision_status === 'insufficient_evidence';
  const ui = DECISION_UI[decision.key];
  const effectiveLevel = overrideLevel ?? decision.level;
  const displayLevel = ui?.levels[effectiveLevel] ?? effectiveLevel;
  const reason = onHold && !overrideLevel
    ? '최근 기록을 조금 더 확인한 뒤 다시 맞춰드릴게요.'
    : (ui?.reasons[effectiveLevel] ?? decision.basis);
  return (
    <View style={{ marginTop: 12, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.ink }}>
          {ui?.question ?? decision.label}{' '}
          {onHold && <Text style={{ fontSize: 10, color: colors.sub3, fontWeight: '600' }}>{overrideLevel ? '추천 확인 중' : '아직 기본 설정'}</Text>}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '800', color: onHold ? colors.sub2 : '#7C5CBF' }}>
          {displayLevel}
        </Text>
        {overrideLevel && (
          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.sub3, backgroundColor: '#F2F4F6', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' }}>내가 선택</Text>
        )}
      </View>
      <Text style={{ fontSize: 10.5, color: colors.sub2, fontWeight: '400', lineHeight: 15 }}>{reason}</Text>
    </View>
  );
}

// 내부 4축은 유지하되 사용자는 생활 질문·관측 결과·읽은 기록으로 이해한다.
const AXIS_ORDER = ['risk_tolerance', 'time_preference', 'self_control', 'planning'];

function PersonaCard({ onChanged }: { onChanged?: () => void }) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [missing, setMissing] = useState(false);
  const [reading, setReading] = useState(false);
  const load = () => getPersona().then((p) => { setPersona(p); setMissing(false); }).catch(() => setMissing(true));
  useEffect(() => { load(); }, []);

  const runRead = async () => {
    setReading(true);
    try { await readPersona(); await load(); onChanged?.(); } catch {}
    setReading(false);
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>피기가 살펴본 돈 관리 습관</Text>
        <Text style={{ fontSize: 10, fontWeight: '800', color: '#7C5CBF', backgroundColor: '#F5F1FB', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>최근 기록 기반</Text>
      </View>
      {missing || !persona ? (
        <View style={{ marginTop: 10, gap: 10 }}>
          <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '500', lineHeight: 18 }}>
            {reading
              ? '최근 입금·지출·정산 기록을 살펴보고 있어요 … 잠시만 기다려주세요.'
              : '최근 입금·지출·정산 기록을 바탕으로 나에게 편한 돈 관리 방식을 맞춰볼게요.'}
          </Text>
          {!reading && (
            <Pressable onPress={runRead} style={{ borderWidth: 1.4, borderColor: '#E2D8F3', backgroundColor: '#F5F1FB', borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#7C5CBF' }}>최근 기록으로 맞춰보기</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={{ marginTop: 12, gap: 11 }}>
          <Text style={{ fontSize: 10.5, color: colors.sub2, fontWeight: '400', lineHeight: 15 }}>
            성격 검사가 아니라 실제 입금·지출·정산 흐름에서 확인한 관리 습관이에요.
          </Text>
          {AXIS_ORDER.map((key) => {
            const a = persona.axes[key];
            if (!a) return null;
            return (
              <View key={key} style={{ gap: 5, backgroundColor: '#FAF9FC', borderRadius: 11, padding: 11 }}>
                <View style={{ alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: a.fallback ? colors.sub2 : '#7C5CBF', backgroundColor: a.fallback ? '#ECEFF2' : '#EEE8F8', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>
                    {AXIS_UI[key]?.tag ?? a.label}
                  </Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: a.fallback ? colors.sub2 : colors.ink, lineHeight: 18, marginTop: 6 }}>
                    {a.fallback ? '아직 단정하지 않고 더 지켜볼게요' : friendlyAxisResult(key, a.value)}
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: '#EDEFF2', overflow: 'hidden' }}>
                  <View style={{ width: `${a.value * 100}%`, height: 6, borderRadius: 3, backgroundColor: a.fallback ? '#C9CED4' : '#7C5CBF' }} />
                </View>
                <Text style={{ fontSize: 10, fontWeight: '400', color: colors.sub3, lineHeight: 14 }}>
                  살펴본 기록 · {friendlyFacts(a.evidence, key) || '관련 기록을 더 모으는 중'}
                </Text>
              </View>
            );
          })}
          {persona.staleness?.stale && (
            <Pressable onPress={runRead} disabled={reading} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFF8ED', borderWidth: 1, borderColor: '#F3E3C2', borderRadius: 11, padding: 10 }}>
              <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '500', color: '#9A6B15', lineHeight: 16 }}>
                {reading ? '최근 기록으로 다시 맞추는 중 …' : `그 사이 거래 ${persona.staleness.new_txns}건이 쌓였어요. 돈 관리 방식을 다시 맞춰볼까요?`}
              </Text>
              {!reading && <Icon name="chevronRight" size={14} color="#9A6B15" sw={2.2} />}
            </Pressable>
          )}
          {!persona.staleness?.stale && (
            <Pressable onPress={runRead} disabled={reading} style={{ alignSelf: 'flex-start', paddingVertical: 3 }}>
              <Text style={{ fontSize: 10.5, color: '#7C5CBF', fontWeight: '700' }}>
                {reading ? '최근 기록으로 다시 맞추는 중 …' : '최근 기록으로 다시 맞추기'}
              </Text>
            </Pressable>
          )}
          <Text style={{ fontSize: 10.5, color: colors.sub3, fontWeight: '400', lineHeight: 15 }}>
            각 주제와 관련된 입금·지출·정산·커리어 연결 기록만 살펴봐요. 앱을 자주 열었는지는 성향 판단에 쓰지 않아요.
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
      <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '400', marginTop: 2 }}>{label}</Text>
    </View>
  );
}
