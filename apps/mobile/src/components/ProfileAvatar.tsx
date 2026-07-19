import { View, type ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { CharacterImage, characterRender } from '@/components/CharacterImage';
import { MY_JOB, skinKeyFor } from '@/components/CareerPiggybank';
import { Mascot } from '@/components/ui';
import { usePersonalizationV2 } from '@/lib/personalization';

// 프로필 아바타 — 사용자 자리(홈 헤더·마이 카드)는 내 3D 캐릭터가 얼굴이다.
// 코치 접점(FAB·챗)은 피기 마스코트 유지 — 사용자와 코치를 얼굴로 구분한다.
// 판독 전(기본 스킨)은 렌더가 없어 2D 마스코트로 폴백.
// v2는 세션 공유 캐시(usePersonalizationV2)에서 읽어 진입마다 깜빡이지 않게 한다.
export function ProfileAvatar({ size, style }: { size: number; style?: ViewStyle }) {
  const v2 = usePersonalizationV2();
  const skin = skinKeyFor(v2);
  if (characterRender(skin, MY_JOB, true) == null) {
    return <Mascot head size={size} radius={size / 2} style={style as never} />;
  }
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.bufferTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      <CharacterImage cutout skin={skin} job={MY_JOB} width={size * 0.86} height={size * 0.86} />
    </View>
  );
}

// 플로우 히어로 — '나'를 보여주는 자리(연동 인트로·페르소나 공개 등)의 대형 3D 캐릭터.
// 코치가 말하는 자리(로딩·알림·챗)는 피기 마스코트를 유지한다. 판독 전엔 2D 폴백.
export function CharacterHero({ size, radius, bg = colors.pinkTint }: { size: number; radius: number; bg?: string }) {
  const v2 = usePersonalizationV2();
  const skin = skinKeyFor(v2);
  if (characterRender(skin, MY_JOB, true) == null) return <Mascot head size={size} radius={radius} />;
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <CharacterImage cutout skin={skin} job={MY_JOB} width={size * 0.86} height={size * 0.86} />
    </View>
  );
}
