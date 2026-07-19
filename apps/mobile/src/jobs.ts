import { colors } from '@/theme/colors';
import type { IconName } from '@/components/Icon';

export type JobKey = 'commerce' | 'studio' | 'platform' | 'personal';

export type JobNode = { icon: IconName; bg: string; title: string; match: string; ok: boolean; desc: string };
export type Job = {
  badge: string; badgeBg: string; badgeColor: string;
  name: string; role: string;
  amount: string; date: string; verified: boolean;
  nodes: JobNode[];
  resultText: string; mathNote: string;
};

const N_GITHUB = (desc: string, ok = true): JobNode => ({ icon: 'github', bg: ok ? colors.black : colors.faint2, title: 'GitHub 활동', match: ok ? '기간 일치' : '활동 확인', ok, desc });
const N_KOSA = (desc: string, ok = true): JobNode => ({ icon: 'shieldCheck', bg: ok ? colors.indigo : colors.faint2, title: 'KOSA 경력인증', match: ok ? '경력 일치' : '미인증', ok, desc });

export const JOBS: Record<JobKey, Job> = {
  commerce: {
    badge: '커', badgeBg: colors.indigoTint, badgeColor: colors.indigo,
    name: '○○커머스', role: '웹 프론트엔드 개발',
    amount: '₩500,000', date: '2025.05.31', verified: true,
    nodes: [
      N_GITHUB('React 커밋 142건 · PR 8건 (2025.04~05)'),
      { icon: 'docRow', bg: colors.buffer, title: '발주처 입금', match: '금액·거래처 일치', ok: true, desc: '○○커머스 → ₩500,000 입금 (05.31)' },
      { icon: 'houseSmall', bg: colors.green, title: '홈택스 신고', match: '소득구분 일치', ok: true, desc: '사업소득 3.3% 원천징수 ₩16,500 신고확인' },
      N_KOSA('SW산업협회 경력·기술등급 확인 — 개발 직무·기간 일치'),
    ],
    resultText: '검증 완료 · 1건 확정',
    mathNote: '입금 ₩500,000 = 신고소득 ₩500,000, 원천징수 ₩16,500(3.3%). 여러 출처의 금액·시점이 맞아떨어져 자동 검증됐어요.',
  },
  studio: {
    badge: '스', badgeBg: colors.orangeTint, badgeColor: colors.orange,
    name: '△△스튜디오', role: '랜딩 페이지 개발',
    amount: '₩1,200,000', date: '2025.03.28', verified: true,
    nodes: [
      N_GITHUB('랜딩 리포 커밋 64건 · PR 5건 (2025.02~03)'),
      { icon: 'docRow', bg: colors.buffer, title: '발주처 입금', match: '금액·거래처 일치', ok: true, desc: '△△스튜디오 → ₩1,200,000 입금 (03.28)' },
      { icon: 'houseSmall', bg: colors.green, title: '홈택스 신고', match: '소득구분 일치', ok: true, desc: '사업소득 3.3% 원천징수 ₩39,600 신고확인' },
      N_KOSA('SW산업협회 경력·기술등급 확인 — 개발 직무·기간 일치'),
    ],
    resultText: '검증 완료 · 1건 확정',
    mathNote: '입금 ₩1,200,000 = 신고소득 ₩1,200,000, 원천징수 ₩39,600(3.3%). 여러 출처가 일치해 자동 검증됐어요.',
  },
  platform: {
    badge: '플', badgeBg: colors.bufferTint, badgeColor: colors.buffer,
    name: '△△플랫폼', role: '플랫폼 정산',
    amount: '₩3,000,000', date: '2025.05.31', verified: false,
    nodes: [
      { icon: 'docRow', bg: colors.buffer, title: '발주처 입금', match: '입금 확인', ok: true, desc: '△△플랫폼 → ₩3,000,000 입금 (05.31)' },
      { icon: 'houseSmall', bg: colors.faint2, title: '홈택스 신고', match: '대기', ok: false, desc: '다음 신고 주기에 확인돼요' },
      N_GITHUB('연결된 작업 리포를 찾는 중이에요', false),
      N_KOSA('협회 경력 인증 미연결', false),
    ],
    resultText: '검증 대기 · 일감 증명에서 승인해 주세요',
    mathNote: '입금은 확인됐어요. 일감 증명에서 승인하면 검증 이력에 쌓이고, 신고·작업 데이터가 잡히면 교차검증이 완성돼요.',
  },
  personal: {
    badge: '개', badgeBg: colors.line, badgeColor: colors.sub2,
    name: '개인 프로젝트', role: '오픈소스 기여',
    amount: '미정산', date: '2024.11~ 진행중', verified: false,
    nodes: [
      N_GITHUB('오픈소스 커밋 88건 · 스타 120 (2024.11~)'),
      { icon: 'docRow', bg: colors.faint2, title: '발주처 입금', match: '미정산', ok: false, desc: '연결된 정산 입금 내역이 없어요' },
      { icon: 'houseSmall', bg: colors.faint2, title: '홈택스 신고', match: '미신고', ok: false, desc: '소득신고 내역이 없어요' },
      N_KOSA('협회 경력 인증 내역이 없어요', false),
    ],
    resultText: '자기보고 · 미검증',
    mathNote: '정산·세금 데이터가 없어 자기보고로 분류돼요. 발주처 정산이 잡히면 자동으로 검증된 일감으로 승격됩니다.',
  },
};
