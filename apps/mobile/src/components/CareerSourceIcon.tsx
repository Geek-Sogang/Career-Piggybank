import { Image, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

// 크몽 공식 앱 아이콘(App Store 공개 artwork, 2026-07-19 확인)을 그대로 사용한다.
// 브랜드 형태를 다시 그리지 않아 작은 이력 카드에서도 실제 출처가 즉시 구분된다.
const kmongAppIcon = require('../../assets/brands/kmong-app-icon.jpg');

type SourceVisual = {
  emoji?: string;
  image?: typeof kmongAppIcon;
  background: string;
  label: string;
};

const sourceVisual = (counterparty: string): SourceVisual => {
  if (counterparty.includes('크몽')) {
    return { image: kmongAppIcon, background: '#8BFF72', label: '크몽 앱' };
  }
  if (counterparty.includes('스튜디오')) {
    return { emoji: '🎨', background: colors.orangeTint, label: '스튜디오 작업' };
  }
  if (counterparty.includes('커머스')) {
    return { emoji: '🛍️', background: colors.indigoTint, label: '커머스 작업' };
  }
  if (counterparty.includes('브릿지')) {
    return { emoji: '🤝', background: colors.greenTint, label: '협업 프로젝트' };
  }
  if (counterparty.includes('개인')) {
    return { emoji: '💻', background: colors.bufferTint, label: '개인 프로젝트' };
  }
  return { emoji: '💼', background: colors.line2, label: '검증된 일감' };
};

export function CareerSourceIcon({ counterparty, size = 42 }: { counterparty: string; size?: number }) {
  const visual = sourceVisual(counterparty);
  const radius = Math.round(size * 0.29);

  return (
    <View
      accessibilityLabel={visual.label}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: visual.background,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {visual.image ? (
        <Image source={visual.image} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text style={{ fontSize: Math.round(size * 0.48), lineHeight: Math.round(size * 0.62) }}>{visual.emoji}</Text>
      )}
    </View>
  );
}
