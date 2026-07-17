import { Image, type ImageStyle } from 'react-native';

// 3D 캐릭터 렌더 — 페르소나 스킨 4종 × 직군 소품 3종 (민영 생성 v1, 그리드에서 분리).
// 기본(중립·판독 전) 스킨은 렌더가 없어 호출부가 2D 마스코트로 폴백한다.
// 렌더 배경은 연회색 스튜디오 톤 — 컨테이너 배경을 같은 톤으로 맞춰 무대처럼 쓴다.

export type CharacterSkin = 'sturdy' | 'growing' | 'wave' | 'sparkle';
export type CharacterJob = 'developer' | 'designer' | 'creator';

export const RENDER_BG = '#E9EAEB';

const RENDERS: Record<CharacterSkin, Record<CharacterJob, number>> = {
  sturdy: {
    developer: require('../../assets/characters/sturdy-developer.png'),
    designer: require('../../assets/characters/sturdy-designer.png'),
    creator: require('../../assets/characters/sturdy-creator.png'),
  },
  growing: {
    developer: require('../../assets/characters/growing-developer.png'),
    designer: require('../../assets/characters/growing-designer.png'),
    creator: require('../../assets/characters/growing-creator.png'),
  },
  wave: {
    developer: require('../../assets/characters/wave-developer.png'),
    designer: require('../../assets/characters/wave-designer.png'),
    creator: require('../../assets/characters/wave-creator.png'),
  },
  sparkle: {
    developer: require('../../assets/characters/sparkle-developer.png'),
    designer: require('../../assets/characters/sparkle-designer.png'),
    creator: require('../../assets/characters/sparkle-creator.png'),
  },
};

export function characterRender(skin: string, job: CharacterJob = 'developer'): number | null {
  return (RENDERS as Record<string, Record<CharacterJob, number>>)[skin]?.[job] ?? null;
}

export function CharacterImage({ skin, job = 'developer', width, height, radius = 18, style }: {
  skin: string; job?: CharacterJob;
  width: number; height: number; radius?: number;
  style?: ImageStyle | ImageStyle[];
}) {
  const source = characterRender(skin, job);
  if (source == null) return null;
  return (
    <Image
      source={source}
      style={[{ width, height, borderRadius: radius, backgroundColor: RENDER_BG }, style as ImageStyle]}
      resizeMode="cover"
    />
  );
}
