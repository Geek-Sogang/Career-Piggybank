import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { CareerPiggybank } from '@/components/CareerPiggybank';
import { colors } from '@/theme/colors';
import { useApp } from '@/store';

const carePiggyVideo = require('../../assets/videos/care-piggy.mp4');

// 미션 탭 — 게임 층 전용 화면: 저금통 무대 + 오늘의 미션 + 성장 로드맵.
// 신뢰 층(검증 일감·점수)은 커리어 탭이, 돈(목표 봉투·페이싱)은 정산 탭이 담당한다.
export function Missions() {
  const { vals, actions } = useApp();
  const [careVisible, setCareVisible] = useState(false);
  const player = useVideoPlayer(carePiggyVideo, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = false;
    videoPlayer.volume = 1;
  });
  useEffect(() => {
    if (!careVisible) return;
    player.currentTime = 0;
    player.muted = false;
    player.volume = 1;
    player.play();
  }, [careVisible, player]);
  const openCare = () => {
    setCareVisible(true);
  };
  const closeCare = () => {
    player.pause();
    setCareVisible(false);
  };
  return (
    <>
      <View style={{ gap: 14 }}>
        <CareerPiggybank
          piggybank={vals.piggybank}
          verifiedCount={vals.verified.count}
          onAddCareer={() => actions.pushScr('jobProof')}
          onWriteScrap={() => actions.pushScr('scrapWrite')}
          onMissionUpdated={actions.refreshCareer}
          onOpenLedger={() => actions.openTransactions('unverified')}
          onCarePiggy={openCare}
        />
      </View>

      <Modal visible={careVisible} transparent animationType="fade" onRequestClose={closeCare}>
        <View style={{ flex: 1, backgroundColor: 'rgba(17,24,39,.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', maxWidth: 360, borderRadius: 24, backgroundColor: '#fff', padding: 16, shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } }}>
            <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: colors.line2, aspectRatio: 4 / 3 }}>
              <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink, textAlign: 'center', marginTop: 18 }}>돼지 저금통 돌보기 완료</Text>
            <Text style={{ fontSize: 12.5, fontWeight: '400', lineHeight: 18, color: colors.sub2, textAlign: 'center', marginTop: 6 }}>오늘도 피기에게 관심을 저금했어요</Text>
            <Pressable onPress={closeCare} style={{ backgroundColor: colors.green, borderRadius: 14, alignItems: 'center', paddingVertical: 13, marginTop: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>확인</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
