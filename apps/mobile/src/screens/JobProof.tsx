import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { approveJob, getPendingJobs, type PendingJob } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, Mascot, T } from '@/components/ui';
import { useApp } from '@/store';

// 일감 증명 — 검증 대기 입금을 사람이 승인하는 큐. 연결(1회성)은 마이 > 데이터 주권이 담당.
// 승인만 career_job_verified 사건을 만들고(백엔드 HITL 게이트), 검증 건수·XP·점수에 반영된다.
export function JobProof() {
  const { actions } = useApp();
  const [jobs, setJobs] = useState<PendingJob[] | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [approvedCount, setApprovedCount] = useState(0);
  useEffect(() => {
    getPendingJobs().then((r) => setJobs(r.jobs)).catch(() => setJobs([]));
  }, []);

  const approve = async (job: PendingJob) => {
    if (approving) return;
    setApproving(job.id);
    try {
      await approveJob(job.id);
      setJobs((current) => (current ?? []).filter((row) => row.id !== job.id));
      setApprovedCount((n) => n + 1);
      await actions.refreshCareer();
    } catch {} finally {
      setApproving(null);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.greenTint, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 16, padding: 14, paddingHorizontal: 16 }}>
        <Mascot head size={40} radius={12} style={{ backgroundColor: '#fff' }} />
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.greenInk, lineHeight: 19 }}>
          검증되지 않은 정산 입금이에요.{'\n'}내 일감이 맞다면 승인해 주세요 — 검증 이력과 XP에 쌓여요.
        </Text>
      </View>

      {approvedCount > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.greenTint2, borderRadius: 12, padding: 12 }}>
          <Icon name="check" size={16} color={colors.green} sw={2.4} />
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.greenInk }}>
            {approvedCount}건 승인 완료 — 검증 일감 +30 XP씩 반영됐어요
          </Text>
        </View>
      )}

      {jobs === null ? (
        <Card><Text style={{ fontSize: 13, fontWeight: '600', color: colors.sub2 }}>검증 대기 입금을 확인하고 있어요…</Text></Card>
      ) : jobs.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 26 }}>
          <Mascot head size={52} radius={16} />
          <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.ink }}>검증 대기 일감이 없어요</Text>
          <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, textAlign: 'center', lineHeight: 17 }}>
            모든 정산 입금이 검증됐어요.{'\n'}새 정산이 들어오면 여기에 모여요.
          </Text>
        </Card>
      ) : (
        jobs.map((job) => (
          <Card key={job.id} p={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.bufferTint, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.buffer }}>
                {job.counterparty.replace(/[△○㈜]/g, '').slice(0, 1) || '일'}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>
                {job.counterparty}{job.memo ? ` · ${job.memo}` : ''}
              </Text>
              <Text style={{ fontSize: 11.5, fontWeight: '500', color: colors.sub2, marginTop: 2, ...T.num }}>
                {job.date.slice(0, 10).replace(/-/g, '.')} · ₩{Math.round(job.amount).toLocaleString('en-US')}
              </Text>
            </View>
            <Pressable
              disabled={approving === job.id}
              onPress={() => approve(job)}
              style={{ backgroundColor: colors.green, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 14, opacity: approving === job.id ? 0.6 : 1 }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#fff' }}>
                {approving === job.id ? '승인 중…' : '내 일감 승인'}
              </Text>
            </Pressable>
          </Card>
        ))
      )}

      <Text style={{ fontSize: 11.5, fontWeight: '500', color: colors.sub3, lineHeight: 17, marginHorizontal: 4 }}>
        승인은 되돌릴 수 없는 검증 사건으로 기록돼요. 홈택스·KOSA 같은 자료 연결은 마이 › 데이터 주권 · 관리에서 해요.
      </Text>
    </View>
  );
}
