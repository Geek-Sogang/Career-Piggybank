import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getGoals, type Goal } from '@/api';
import { GoalSection } from '@/components/GoalSection';
import { useApp } from '@/store';

// 목표 봉투 전용 화면 — 가계부 허브에서 진입. 여윳돈에서 목표로 나눠 담는 돈 층.
export function Goals() {
  const { actions, sheet } = useApp();
  const [goals, setGoals] = useState<Goal[]>([]);
  useEffect(() => {
    if (!sheet) getGoals().then(setGoals).catch(() => {});
  }, [sheet]);

  return (
    <View style={{ gap: 14 }}>
      <GoalSection
        goals={goals}
        onCreated={(g) => { setGoals((prev) => [...prev, g]); actions.refreshCareer(); }}
        onPace={() => actions.openSheet('pacing')}
      />
    </View>
  );
}
