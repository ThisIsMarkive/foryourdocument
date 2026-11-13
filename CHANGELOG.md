# 변경 기록

## 0.3.4 — winget 없는 PC에서도 Node.js 자동 설치

- `install.ps1`이 winget이 없거나 실패하면 nodejs.org의 공식 LTS zip을 내려받아 nodejs.org SHA-256 목록과 대조한 뒤 `%LOCALAPPDATA%\Programs\nodejs-portable`에 설치하고 사용자 PATH에 추가합니다. 관리자 권한과 설치 창이 필요 없습니다.
- 설치 후 Windows에 PATH 변경을 알려, 재시작한 Claude·ChatGPT 앱이 새 Node.js를 찾습니다.
- CI가 Windows에서 이 경로(다운로드·해시 확인·PATH·등록)를 실제로 실행해 확인합니다.

## 0.3.3 — 묻지 않고 모든 앱에 등록

- `npx -y hwpx-bridge setup`이 더 이상 앱을 묻지 않습니다. PC에 설치된 AI 앱(Claude 앱, Claude Code, Codex, Cursor, Gemini CLI, Windsurf)을 모두 찾아 등록합니다. 터미널에서 실행하든 Codex·Claude Code가 실행하든 같습니다.
- Codex는 CLI 대신 `~/.codex/config.toml`에 직접 등록합니다. Codex CLI가 없어도 ChatGPT/Codex 데스크톱 앱과 IDE 확장이 같은 설정을 씁니다. 첫 실행 다운로드를 고려해 시작 대기 180초, 도구 실행 대기 1800초를 지정합니다.
- `--client`는 일부 앱만 등록할 때 씁니다.

## 0.3.2 — Windows 한 줄 설치기

- `irm https://raw.githubusercontent.com/ThisIsMarkive/foryourdocument/main/install.ps1 | iex`: Node.js 20 이상이 없으면 winget으로 Node.js LTS를 설치하고 `hwpx-bridge setup`을 실행합니다. `HWPX_BRIDGE_CLIENTS`로 앱을 미리 지정할 수 있습니다.
- Filee 패키지가 빠졌을 때의 안내를 고쳤습니다(지원 OS인데 설치가 빠진 경우 npx 캐시 정리 안내).

## 0.3.1 — 첫 npm 배포

- 배포 워크플로가 `packs/…tgz` 경로를 GitHub 저장소 이름으로 해석해 0.3.0 배포가 실패한 문제를 고쳤습니다. 0.3.0은 npm에 올라가지 않았고, 내용은 0.3.1과 같습니다.

## 0.3.0 — npm 한 줄 설치

- `npx -y hwpx-bridge setup` 한 줄로 Claude 앱·Claude Code·Codex·Cursor·Gemini CLI·Windsurf에 등록합니다. kordoc의 `setup`과 같은 방식입니다.
- kordoc은 npm 패키지(4.24.62)를 그대로 실행해 22개 도구를 모두 노출합니다. 소스 복사·빌드를 하지 않습니다. OCR은 kordoc OCR만 사용합니다(모델은 첫 사용 시 자동 다운로드).
- Filee는 공식 2.4.0 릴리스에서 명령줄 변환기만 추려 플랫폼 패키지(`hwpx-bridge-filee-win32-x64`, `-linux-x64`)로 배포합니다. GUI·Ctrl 단축키·탐색기 메뉴·7-Zip·Tesseract OCR은 포함하지 않습니다. 문서 관련 형식만 `filee_convert` 하나로 노출합니다.
- 제거: PowerShell 설치기, 사용자 PC의 .NET/Node 다운로드와 소스 빌드, `hwpx_setup` 도구, 앱 재시작이 두 번 필요하던 흐름, 오프라인 내보내기, `.mcpb`.
- 요구 사항: Node.js 20 이상.

## 0.2.3 — Windows standalone installer download fix

- Read GitHub SHA256SUMS release assets from a UTF-8 file. Windows PowerShell returns application/octet-stream Content as byte[]; direct string matching incorrectly rejected a valid archive.
- Verified the corrected downloader against the real public release archive before shipping. Removed an unverified enginesReady field from the registration-only result.
- Document engines, client registration logic and OCR definitions remain unchanged.

## 0.2.2 — independent client setup

- Adopt kordoc's independent setup → client MCP registration workflow. Setup no longer requires the missing MCP tool to be available first.
- Add a common Windows installer, automatic private Node preparation, stable source copy, Claude standard/Store configuration discovery, backups and preservation of other servers, and official Codex CLI registration.
- Correct installation instructions: kordoc's marketplace is a CLI skill; its Desktop MCP requires separate setup. This installer is a one-time per-computer step, not proof that marketplace-only loading works in every Claude conversation.
- Keep source-integrated Filee/kordoc, automatic builds, all 14 OCR assets and offline use. Engine source and conversion logic are unchanged.

## 0.2.1 — 2026-11-11

- Claude 앱의 마켓플레이스 동기화 규칙에 맞게 원본 소스의 배포 경로를 정리했습니다. 중첩된 kordoc 플러그인 매니페스트와 원본 스킬 3개를 `.upstream` 참고 파일로 보존합니다.
- Claude가 허용하지 않는 `@`가 포함된 Filee Linux 설치 자료의 폴더명만 변경했습니다. 변경 전 경로와 원본 내용의 해시는 소스 잠금 파일에 유지합니다.
- Claude 클라우드 패키지의 매니페스트 개수·경로 문자·파일 수·용량 제한 검사를 추가했습니다. Filee/kordoc 엔진 코드, OCR 모델, 자동 설치와 오프라인 내보내기 기능은 변경하지 않았습니다.

## 0.2.0 — 2026-11-11

- Filee·kordoc의 고정 소스를 포함해 직접 빌드하는 통합 구조로 변경했습니다. Filee 원본 배포물 다운로드와 kordoc npm 패키지/MCP 프록시를 제거했습니다.
- kordoc 도구는 같은 MCP 프로세스에 등록하고, Filee 변환 소스는 내부 `hwpx-converter.exe`로 컴파일합니다. 변환 알고리즘은 변경하지 않습니다.
- Node·.NET SDK·잠금 의존성 준비부터 소스 검증·빌드·OCR 설치까지 최초 설정에서 자동 처리합니다. 소스 커밋과 산출물 해시를 빌드 기록에 남깁니다.
- 한국어·영어·한자 OCR과 전체 OCR·수식 모델을 유지합니다. 오프라인 내보내기는 소스와 빌드 완료본을 포함하며 수신 PC에 개발 도구가 필요하지 않습니다.
- 원본 Filee와의 비교 테스트를 독립된 원본 실행 파일에 연결하도록 바꿨습니다.

## 0.1.1 — 2026-11-11

- OCR 언어를 한국어·영어·한자용 4개로 축소: `kor`, `eng`, `chi_tra`, `chi_sim`. 기본 조합은 `kor+eng+chi_tra`. 숫자는 별도 모델 없이 지원합니다.
- 언어 데이터 약 189 MB 절감. kordoc OCR·손글씨·수식 모델은 유지합니다.
- 로컬 원본 Filee CLI/kordoc MCP를 실행하는 구조와 에이전트의 도구 선택 방식을 문서에 명시했습니다. 엔진 소스를 복제·병합한 구현은 아닙니다.
- Windows PowerShell에서 Node 압축 해제 시 임시 경로가 너무 길어지는 문제를 수정했습니다.
- 실제 한자 OCR과 혼합 문자 HWPX 작성 검사를 추가하고 짧은 한국어 줄의 OCR 오인식도 기록했습니다.
