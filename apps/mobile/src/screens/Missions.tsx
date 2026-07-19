import { View } from 'react-native';
import { CareerPiggybank } from '@/components/CareerPiggybank';
import { useApp } from '@/store';

// 미션 탭 — 게임 층 전용 화면: 저금통 무대 + 오늘의 미션 + 성장 로드맵.
// 신뢰 층(검증 일감·점수)은 커리어 탭이, 돈(목표 봉투·페이싱)은 정산 탭이 담당한다.
export function Missions() {
  const { vals, actions } = useApp();
  return (
    <View style={{ gap: 14 }}>
      <CareerPiggybank
        piggybank={vals.piggybank}
        verifiedCount={vals.verified.count}
        onAddCareer={() => actions.pushScr('jobProof')}
        onMissionUpdated={actions.refreshCareer}
        onOpenLedger={() => actions.nav('ledger')}
      />
    </View>
  );
}
