import { useEffect, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import { getPersonalizationV2, type PersonalizationV2 } from '@/api';
import { CharacterImage, characterRender } from '@/components/CharacterImage';
import { MY_JOB, skinKeyFor } from '@/components/CareerPiggybank';
import { Mascot } from '@/components/ui';

// 프로필 아바타 — 사용자 자리(홈 헤더·마이 카드)는 내 3D 캐릭터가 얼굴이다.
// 코치 접점(FAB·챗)은 피기 마스코트 유지 — 사용자와 코치를 얼굴로 구분한다.
// 판독 전(기본 스킨)은 렌더가 없어 2D 마스코트로 폴백.
export function ProfileAvatar({ size, style }: { size: number; style?: ViewStyle }) {
  const [v2, setV2] = useState<PersonalizationV2 | null>(null);
  useEffect(() => {
    getPersonalizationV2().then(setV2).catch(() => {});
  }, []);
  const skin = skinKeyFor(v2);
  if (characterRender(skin, MY_JOB, true) == null) {
    return <Mascot head size={size} radius={size / 2} style={style as never} />;
  }
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#EAF2FB', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      <CharacterImage cutout skin={skin} job={MY_JOB} width={size * 0.86} height={size * 0.86} />
    </View>
  );
}
