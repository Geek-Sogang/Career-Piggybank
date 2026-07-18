import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { loadPersonalizationV2 } from '@/lib/personalization';

export default function RootLayout() {
  // 스킨 캐시를 앱 시작 시 미리 데워, 홈 첫 진입의 2D→3D 스왑까지 줄인다.
  useEffect(() => {
    void loadPersonalizationV2();
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F7F8FA' } }} />
    </SafeAreaProvider>
  );
}
