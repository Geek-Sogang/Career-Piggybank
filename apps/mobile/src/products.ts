import { colors } from '@/theme/colors';

export type ProductKey = 'account' | 'emergency' | 'youth' | 'isa' | 'irp' | 'pensionFund' | 'parking';

export type Product = {
  badge: string; badgeBg: string; badgeColor: string;
  name: string; tagline: string;
  highlight?: string; // 큰 숫자 강조 (한도/공제 등)
  highlightLabel?: string;
  terms: string[];
  desc: string;
  cta: string;
};

export const PRODUCTS: Record<ProductKey, Product> = {
  account: {
    badge: '통', badgeBg: colors.bufferTint, badgeColor: colors.buffer,
    name: '하나 긱워커 통장 + 체크카드', tagline: '하나은행 · 씬파일러 첫 통장',
    terms: ['ATM 수수료 면제', '정산입금 급여성 우대', '최대 +1.90%p'],
    desc: '정산입금을 급여성으로 자동 태깅해 우대 조건을 채워요. 검증된 매출이 쌓일수록 혜택이 깊어집니다.',
    cta: '통장 만들기',
  },
  emergency: {
    badge: '비', badgeBg: colors.greenTint, badgeColor: colors.green,
    name: '하나 긱워커 비상금대출', tagline: '하나은행 · 검증 활동 기반 첫 신용한도',
    highlight: '2,000,000원', highlightLabel: '한도',
    terms: ['연 5.9%~', 'SGI 보증', '중도상환 수수료 면제'],
    desc: '소득증빙이 어려운 긱워커도 검증된 커리어 데이터를 보조지표로 첫 신용한도를 받아요.',
    cta: '자세히 보고 신청',
  },
  youth: {
    badge: '햇', badgeBg: colors.pinkTint, badgeColor: colors.pinkStrong,
    name: '하나원큐 햇살론유스', tagline: '하나은행 · 청년 정책금융',
    highlight: '1,200만원', highlightLabel: '최대',
    terms: ['고정 4.0%', '만 34세 이하', '저소득 청년사업자'],
    desc: "3.3% 신고 긱워커가 '저소득 청년사업자' 요건을 검증서(VC)로 입증해 정책자금을 받아요.",
    cta: '자격 확인하기',
  },
  isa: {
    badge: 'I', badgeBg: colors.indigoTint, badgeColor: colors.indigo,
    name: '하나은행 ISA', tagline: '하나은행 · 여윳돈 투자 라우팅',
    terms: ['손익통산 비과세', '소득 변동에 유리', '버퍼 초과분만'],
    desc: '여윳돈 봉투의 버퍼 초과분을 비과세 계좌로 보수적으로 굴려요. 즉시가용·세금봉투는 건드리지 않아요.',
    cta: '가입하기',
  },
  irp: {
    badge: '연', badgeBg: colors.greenTint, badgeColor: colors.green,
    name: '하나은행 IRP 개인형 퇴직연금', tagline: '하나은행 · 노후봉투 1차 도착지',
    highlight: '148.5만원', highlightLabel: '연 최대 세액공제',
    terms: ['13.2~16.5% 공제', '자영업자 가입 가능', '자유 적립'],
    desc: '연 납입액의 13.2~16.5%를 세액공제 받아요. 가뭄 달은 건너뛸 수 있어 변동소득에 잘 맞아요.',
    cta: '가입하기',
  },
  pensionFund: {
    badge: '펀', badgeBg: colors.orangeTint, badgeColor: colors.orange,
    name: '하나 연금저축펀드', tagline: '하나금융 · 소수점 적립 · 보수적',
    terms: ['소수점 적립', '보수적 포트폴리오', '연금저축 합산 공제'],
    desc: '유휴금을 소수점으로 꾸준히 적립해 노후를 준비해요. IRP와 합산해 연 900만원까지 세액공제.',
    cta: '가입하기',
  },
  parking: {
    badge: '파', badgeBg: colors.bufferTint, badgeColor: colors.buffer,
    name: '하나 긱워커 파킹통장', tagline: '하나은행 · 세금·여윳돈 안전 보관',
    highlight: '연 3.0%', highlightLabel: '우대금리',
    terms: ['입출금 자유', '5월 종소세 대비 금고', '커리어 점수 우대'],
    desc: '자동 봉투에 쌓이는 세금·여윳돈을 안전하게 보관하며 이자를 받아요. 언제든 인출할 수 있어 강제성이 없고, 5월 종소세 때 바로 꺼내 쓸 수 있어요. 커리어 점수가 높을수록 우대금리를 더 드려요.',
    cta: '파킹통장 만들기',
  },
};
