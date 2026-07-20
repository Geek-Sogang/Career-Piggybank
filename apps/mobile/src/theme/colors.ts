/** Career-Piggybank 팔레트 — Claude Design '커리어 저금통 데모' 소스값과 1:1. */
export const colors = {
  // 코어
  green: '#008485',
  greenDark: '#00666B',
  greenInk: '#0A6B6C',
  greenTint: '#E8F4F4',
  greenTint2: '#F1F8F8',
  greenLine: '#DCEDED',

  // 마스코트 핑크
  pink: '#FF8FB1',
  pinkStrong: '#FF6F9C',
  pinkInk: '#E05A86',
  pinkTint: '#FFF1F6',
  pinkLine: '#FBD9E6',

  // 텍스트 / 라인 / 배경
  ink: '#1A1A1A',
  ink2: '#3A4047',
  sub: '#6B7280',
  sub2: '#8A9098',
  sub3: '#9AA1A9',
  faint: '#A8AEB6',
  faint2: '#B6BBC2',
  line: '#F0F1F3',
  line2: '#F2F3F5',
  line3: '#EEF0F2',
  line4: '#E2E5E9',
  dash: '#D7DBE0',
  bg: '#F7F8FA',
  bg2: '#FBFBFC',
  card: '#FFFFFF',

  // 4봉투
  tax: '#E5484D',
  taxInk: '#C2383C',
  taxBg: '#FDECEC',
  expense: '#F2A516',
  buffer: '#0091C7',
  bufferTint: '#E7F4FB',
  spendable: '#30A46C',
  spendableInk: '#1F8A52',

  // 보조 악센트
  indigo: '#5B6CE0',
  indigoTint: '#EEF1FF',
  orange: '#E07A2B',
  orangeTint: '#FFF1E8',
  black: '#1A1A1A',
  white: '#FFFFFF',

  // AI 판정 표시 — AI가 판단한 지점에만 쓰는 보라 스킴 (다른 용도 금지)
  ai: '#7C5CBF',
  aiTint: '#F5F1FB',
  aiTint2: '#EEE8F8',
  aiLine: '#E2D8F3',
  aiBg: '#FAF9FC',

  // 주의·확인 필요 (앰버)
  amber: '#9A6B15',
  amberTint: '#FFF8ED',
  amberLine: '#F3E3C2',

  // 내비게이션 셰브런 기본색
  chev: '#C2C7CE',
} as const;

export type ColorName = keyof typeof colors;
