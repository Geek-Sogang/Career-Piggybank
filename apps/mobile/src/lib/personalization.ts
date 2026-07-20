import { useEffect, useState } from 'react';
import { getPersonalizationV2, type PersonalizationV2 } from '@/api';

// personalization v2(스킨·개인화 축)는 세션 중 거의 안 바뀐다.
// 예전엔 아바타·홈 배너·마이가 각자 fetch → 진입마다 2D 마스코트 → 3D 캐릭터로
// 스왑되며 깜빡였다. 세션 공유 캐시 하나로 합쳐, 첫 fetch 후엔 캐시값으로 즉시
// 초기화(스왑 없음)하고, override로 값이 바뀌면 구독자에 브로드캐스트한다.

let cache: PersonalizationV2 | null = null;
let inflight: Promise<PersonalizationV2 | null> | null = null;
const subscribers = new Set<(v: PersonalizationV2 | null) => void>();

function broadcast(v: PersonalizationV2 | null): void {
  cache = v;
  subscribers.forEach((cb) => cb(v));
}

/** 세션 공유 캐시로 v2를 한 번만 읽는다(동시 호출은 in-flight 하나로 합침). force로 재요청. */
export function loadPersonalizationV2(force = false): Promise<PersonalizationV2 | null> {
  if (cache && !force) return Promise.resolve(cache);
  if (!inflight) {
    inflight = getPersonalizationV2()
      .then((r) => {
        broadcast(r);
        return r;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** override·재판독 등으로 새 v2를 받았을 때 공유 캐시를 갱신 — 모든 아바타가 함께 바뀐다. */
export function updatePersonalizationV2(v: PersonalizationV2 | null): void {
  broadcast(v);
}

/** 캐시값으로 즉시 초기화하는 구독 훅 — 첫 fetch 이후엔 재마운트해도 깜빡임이 없다. */
export function usePersonalizationV2(): PersonalizationV2 | null {
  const [v2, setV2] = useState<PersonalizationV2 | null>(cache);
  useEffect(() => {
    subscribers.add(setV2);
    if (cache) setV2(cache);
    else void loadPersonalizationV2();
    return () => {
      subscribers.delete(setV2);
    };
  }, []);
  return v2;
}
