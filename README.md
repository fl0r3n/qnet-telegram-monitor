# Q-Net 빈자리 텔레그램 알림

2026년 정기 기사 3회 필기에서 **정보처리기사 · 충청남도 · 아산시 · 일반응시자**의 접수 가능한 시험장을 확인합니다. 빈자리가 새로 생기면 시험장 정보와 Q-Net 원서접수 URL을 텔레그램으로 전송합니다.

## 동작 방식

- GitHub Actions가 5분마다 실행되므로 개인 PC를 켜 둘 필요가 없습니다.
- Q-Net 공식 원서접수 현황 페이지를 브라우저로 조회합니다.
- 같은 빈자리 상태는 한 번만 알립니다.
- 빈자리가 사라졌다가 다시 생기면 새 알림을 보냅니다.
- 현재 설정은 `2026-07-23 18:00 (한국 시간)` 이후 자동으로 조회를 건너뜁니다.

## 텔레그램 준비

1. 텔레그램에서 `@BotFather`를 열고 `/newbot`으로 봇을 만듭니다.
2. 생성된 봇에게 메시지를 한 번 보냅니다.
3. 브라우저에서 `https://api.telegram.org/bot<봇토큰>/getUpdates`를 열어 `chat.id`를 확인합니다.
4. GitHub 저장소의 **Settings → Secrets and variables → Actions**에 다음 두 값을 등록합니다.
   - `TELEGRAM_BOT_TOKEN`: BotFather가 발급한 토큰
   - `TELEGRAM_CHAT_ID`: `getUpdates`에서 확인한 숫자

토큰은 채팅이나 코드에 붙여 넣지 말고 GitHub Secret에만 저장하세요.

## GitHub에 올린 뒤 시험하기

1. 이 폴더를 새 비공개 GitHub 저장소에 올립니다.
2. 위의 Secret 두 개를 등록합니다.
3. **Actions → Q-Net vacancy monitor → Run workflow**를 누릅니다.
4. 실행 기록에서 `Check Q-Net and notify Telegram` 단계가 성공했는지 확인합니다.

현재 빈자리가 없으면 텔레그램을 보내지 않는 것이 정상입니다.

## 로컬 시험

```powershell
npm install
npx playwright install chromium
$env:DRY_RUN="1"
npm run check
```

`DRY_RUN=1`에서는 실제 텔레그램 메시지를 보내지 않습니다.

## 설정 변경

환경 변수로 시험 회차와 지역 등을 바꿀 수 있습니다.

| 변수 | 기본값 |
|---|---|
| `EXAM_NAME` | `2026년 정기 기사 3회 필기` |
| `SUBJECT_VALUE` | `114` |
| `SUBJECT_NAME` | `정보처리기사` |
| `PROVINCE` | `충청남도` |
| `CITY` | `아산시` |
| `APPLICANT_TYPE_VALUE` | `01` |
| `MONITOR_UNTIL` | `2026-07-23T18:00:00+09:00` |

## 주의사항

GitHub의 예약 실행은 정확히 5분마다 시작된다고 보장되지는 않으며 혼잡할 때 지연될 수 있습니다. Q-Net이 자동 접속을 제한하거나 화면 구조를 바꾸면 실행이 실패할 수 있으므로 첫 실행 기록을 반드시 확인하세요.
