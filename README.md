# Career-Piggybank 🐷

긱워커(개발자·디자이너·크리에이터) 전용 **생활금융 플랫폼**.
무형의 커리어(일)를 데이터로 쌓아 평생 자산으로 키운다 — *“당신이 ‘한 일’이, 당신의 자산이 됩니다.”*

> 하나금융 청년 금융인재 공모전 AI·블록체인 트랙 결선작. 기획서는 Notion v5 참고.

## 모노레포 구조

```
Career-Piggybank/
├─ apps/
│  ├─ mobile/      Expo (React Native + TypeScript) — 메인 산출물
│  └─ api/         FastAPI (Python) — 세금봉투 결정론 엔진 등
├─ packages/
│  └─ shared/      (예정) 공용 타입·상수
└─ .github/workflows/ci.yml
```

## 빠른 시작

### 모바일 (apps/mobile)
```bash
cd apps/mobile
npm install
npm start          # Expo Dev Server (i: iOS / a: Android / w: Web)
npm run lint       # 타입체크 (tsc --noEmit)
```
데모 1막 **세금봉투** 화면은 백엔드 없이 온디바이스로 동작합니다.

### 백엔드 (apps/api)
```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload   # http://localhost:8000/docs
pytest                          # 세금봉투 엔진 테스트
```

### Makefile (루트에서)
```bash
make api        # 백엔드 실행
make api-test   # 백엔드 테스트
make mobile     # Expo 실행
```

## 핵심: 세금봉투 결정론 엔진
3.3% 원천징수 사업소득자의 입금 1건을 **세금/경비/여윳돈/즉시가용** 4봉투로 결정론 분류하고,
5월 종합소득세 추가납부 예상액을 미리 적립해 ‘종소세 쇼크’를 제거한다.
모든 가정(경비율·세율구간·버퍼비율)을 출력에 노출 — 숨은 계산이 아니라 검증 가능한 산수.
- 백엔드: `apps/api/app/services/tax_envelope.py` (+ `/v1/tax-envelope/*`)
- 온디바이스 미러: `apps/mobile/src/lib/taxEnvelope.ts` (두 구현 동시 수정)

## 보안
- 비밀값은 `.env`(gitignore)로만. 마이데이터/홈택스/OAuth 키는 절대 커밋 금지.
- 예시는 각 앱의 `.env.example` 참고.
