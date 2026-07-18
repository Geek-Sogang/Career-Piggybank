import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { loadPersonalizationV2 } from '@/lib/personalization';

// 개발 웹 서버(expo start --web)에도 아이폰 프레임을 입힌다. output:"single"에선
// +html.tsx가 무시되고 프레임 CSS는 export 후 scripts/inject-phone-frame.mjs가 주입하므로,
// dev에선 같은 id로 런타임 주입한다. 프로덕션 export는 이미 id="phone-frame"이 있어 건너뛴다.
function injectPhoneFrame() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('phone-frame')) return;
  const style = document.createElement('style');
  style.id = 'phone-frame';
  style.textContent = `
    html, body { height: 100%; margin: 0; }
    body { background:#0e1013; display:flex; align-items:center; justify-content:center; overflow:hidden; }
    #root {
      flex: none !important;
      width: auto;
      height: min(860px, calc(100dvh - 24px));
      aspect-ratio: 390 / 844;
      max-width: calc(100vw - 24px);
      background:#F7F8FA;
      border-radius: 46px;
      overflow: hidden;
      box-shadow: 0 0 0 10px #111318, 0 0 0 12px #2b2e35, 0 26px 80px rgba(0,0,0,.6);
    }
    @media (max-width: 520px) {
      body { background:#F7F8FA; }
      #root { width:100%; height:100dvh; aspect-ratio:auto; max-width:none; border-radius:0; box-shadow:none; }
    }`;
  document.head.appendChild(style);
}

export default function RootLayout() {
  // 스킨 캐시를 앱 시작 시 미리 데워, 홈 첫 진입의 2D→3D 스왑까지 줄인다.
  useEffect(() => {
    injectPhoneFrame();
    void loadPersonalizationV2();
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F7F8FA' } }} />
    </SafeAreaProvider>
  );
}
