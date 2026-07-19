import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { getCareerScraps, type CareerScrap } from '@/api';
import { colors } from '@/theme/colors';
import { Card } from '@/components/ui';
import { ScrapComposer } from '@/components/CareerPiggybank';
import { useApp } from '@/store';

// 커리어 조각 저금 — 전용 페이지. 오늘 한 일·배운 것을 한 줄로 저금한다.
// 하루 첫 조각만 1 XP, 완료·스크랩은 성향 판단에 쓰지 않는다(측정 오염 금지).
export function ScrapWrite() {
  const { actions } = useApp();
  const [scraps, setScraps] = useState<CareerScrap[]>([]);
  useEffect(() => { getCareerScraps().then(setScraps).catch(() => {}); }, []);

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>오늘 한 일을 한 줄로 저금해요</Text>
        <Text style={{ fontSize: 11.5, fontWeight: '400', color: colors.sub2, lineHeight: 16, marginTop: 5 }}>
          아티클·레포·레퍼런스, 끝낸 일, 배운 점 — 무엇이든 좋아요. 모인 조각은 커리어 조각 모음에 쌓여요.
        </Text>
        <ScrapComposer
          onSaved={async (scrap) => {
            setScraps((current) => [scrap, ...current]);
            await actions.refreshCareer();
            actions.back();
          }}
          onCancel={actions.back}
        />
      </Card>

      {scraps.length > 0 && (
        <Card>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>모은 조각 {scraps.length}개</Text>
          <View style={{ marginTop: 10, gap: 8 }}>
            {scraps.slice(0, 8).map((scrap) => (
              <View key={scrap.id} style={{ borderRadius: 10, backgroundColor: colors.bg, padding: 11 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.green }}>{formatDate(scrap.created_at)}</Text>
                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.ink, lineHeight: 17, marginTop: 4 }}>{scrap.content}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </View>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}
