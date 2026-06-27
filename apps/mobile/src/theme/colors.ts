/** Career-Piggybank 브랜드 팔레트 (하나 그린 × 피기 핑크). */
export const colors = {
  hanaGreen: '#008485', // 하나금융 코어 그린
  hanaGreenDark: '#00666B',
  piggyPink: '#FF8FB1', // 마스코트 돼지 핑크
  ink: '#1A1A1A',
  sub: '#6B7280',
  line: '#E5E7EB',
  bg: '#F7F8FA',
  card: '#FFFFFF',
  // 4봉투 색
  tax: '#E5484D', // 세금봉투
  expense: '#F2A516', // 경비봉투
  buffer: '#0091C7', // 여윳돈
  spendable: '#30A46C', // 즉시가용
} as const;

export type ColorName = keyof typeof colors;
