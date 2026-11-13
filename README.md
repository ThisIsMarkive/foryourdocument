# HWPX Bridge

AI 에이전트가 한글 문서(HWP·HWPX)를 다룰 수 있게 해 주는 **MCP 서버 하나**입니다.

- **[kordoc](https://github.com/chrisryugj/kordoc)의 모든 기능**: HWP·HWPX·PDF·DOCX·XLSX·이미지 읽기, 스캔 문서 OCR, Markdown → 새 HWPX 작성, 양식 채우기, 서식 유지 수정, HWP → HWPX, 렌더링, 공문서 검수 (22개 도구)
- **[Filee](https://github.com/KnifeLemon/Filee)의 문서 변환 기능만**: DOCX → HWPX를 글꼴·색·정렬·머리말·쪽번호·표 서식까지 유지해 변환, 그 밖의 문서 형식 간 변환 (`filee_convert`)

문서는 내 컴퓨터에서 처리되며 변환 서비스에 업로드되지 않습니다.

## 설치 — 한 줄

**먼저 Claude 앱·ChatGPT 앱을 트레이 아이콘(화면 오른쪽 아래 ^)에서 우클릭 → 종료하세요.** 켜진 채로 등록하면 Claude 앱이 종료하면서 설정을 덮어쓸 수 있습니다. 켜져 있으면 `setup`이 알려 줍니다.

```
npx -y hwpx-bridge setup
```

터미널(PowerShell 등)에 입력하든(PowerShell에서 "스크립트를 실행할 수 없습니다" 오류가 나면 `npx.cmd -y hwpx-bridge setup`), Codex·Claude Code에 "이 명령 실행해줘"라고 하든 결과는 같습니다. **이 PC에 설치된 AI 앱을 모두 찾아 한 번에 등록**합니다. 묻는 것은 없습니다.

| 찾는 앱 | 등록 위치 |
| --- | --- |
| Claude 앱 | `claude_desktop_config.json` |
| Claude Code | `claude mcp add --scope user` |
| Codex (ChatGPT 데스크톱 앱의 Codex·Work 모드, CLI, IDE 확장이 함께 쓰는 설정) | `~/.codex/config.toml` |
| Cursor, Gemini CLI, Windsurf | 각 앱의 MCP 설정 파일 |

등록한 앱을 한 번 완전히 종료했다가 다시 열면, 그 앱의 **모든 대화**에서 도구가 보입니다. 작업 폴더와 상관없이 PC 안의 어느 파일이든 경로로 다룰 수 있습니다. 나중에 새 AI 앱을 설치했다면 같은 명령을 한 번 더 실행하면 됩니다. 기존 설정은 백업(`.bak-…`)을 남기고 유지됩니다.

**Node.js가 없는 Windows PC**: `npx`가 없다는 오류가 나면 PowerShell에 아래 한 줄을 넣으세요. Node.js LTS를 설치한 뒤(winget이 있으면 winget, 없으면 nodejs.org 공식 파일을 SHA-256 확인 후 사용자 폴더에 설치 — 관리자 권한 불필요) 위 명령을 대신 실행합니다.

```
irm https://raw.githubusercontent.com/ThisIsMarkive/foryourdocument/main/install.ps1 | iex
```

일부 앱에만 등록하려면 `npx -y hwpx-bridge setup --client claude-desktop,codex` (값: `claude-desktop, claude-code, codex, cursor, gemini, windsurf`).

웹·모바일(claude.ai 웹, ChatGPT 웹, 휴대폰 앱)은 내 PC의 프로그램을 실행할 수 없어 지원되지 않습니다.

### setup 후에도 Claude 앱에 도구가 안 보일 때 (직접 등록)

Claude 앱 버전에 따라 설정 파일 위치가 다릅니다. `setup`은 Claude 폴더들에서 설정 파일을 찾아 모두 등록하지만, 그래도 **설정 → 개발자** 화면에 hwpx-bridge가 없다면 직접 넣습니다.

1. Claude 앱 **설정 → 개발자 → 구성 편집(Edit Config)** 을 누릅니다. 앱이 실제로 읽는 `claude_desktop_config.json`이 열립니다.
2. 파일 안에 `"mcpServers"`가 **없으면**, 맨 바깥 `{` 바로 다음 줄에 아래를 넣습니다(끝의 쉼표 포함).

   ```json
   "mcpServers": {
     "hwpx-bridge": { "command": "cmd", "args": ["/c", "npx", "-y", "hwpx-bridge@0.3.6", "mcp"] }
   },
   ```

   `"mcpServers": {` 가 **이미 있으면**, 그 줄 바로 다음에 아래 한 줄만 넣습니다(끝의 쉼표 포함).

   ```json
   "hwpx-bridge": { "command": "cmd", "args": ["/c", "npx", "-y", "hwpx-bridge@0.3.6", "mcp"] },
   ```

3. 저장하고 Claude 앱을 트레이 아이콘에서 **종료**한 뒤 다시 엽니다. (앱이 켜진 채로 고치면 앱이 종료하면서 덮어쓸 수 있습니다.)

Mac·Linux에서는 `"command": "npx", "args": ["-y", "hwpx-bridge@0.3.6", "mcp"]` 입니다. 다른 앱용 설정은 `npx -y hwpx-bridge config`가 출력합니다. 처음 실행할 때 엔진(약 100 MB)을 내려받으므로, 직접 넣은 경우에는 먼저 터미널에서 `npx.cmd -y hwpx-bridge@0.3.6 doctor`를 한 번 실행해 두면 앱 첫 실행이 빠릅니다.

### ChatGPT(Codex)에 도구가 안 보일 때 (직접 등록)

Codex는 Codex 앱·CLI·IDE 확장이 함께 쓰는 `사용자 폴더\.codex\config.toml` 한 곳에 설정을 둡니다(`CODEX_HOME`을 지정했다면 그 폴더). Claude 앱의 `claude_desktop_config.json`과 같은 역할입니다.

1. 터미널에서 `codex mcp list`로 hwpx-bridge가 있는지 봅니다. Codex CLI가 없으면 `config.toml`을 메모장으로 열어 `[mcp_servers.hwpx-bridge]`가 있는지 봅니다.
2. 없으면 `config.toml` 맨 끝에 아래를 붙여 넣습니다.

   ```toml
   [mcp_servers.hwpx-bridge]
   command = "cmd"
   args = ["/c", "npx", "-y", "hwpx-bridge@0.3.6", "mcp"]
   startup_timeout_sec = 180
   tool_timeout_sec = 1800
   ```

3. ChatGPT(Codex) 앱을 완전히 종료했다가 다시 엽니다.

Claude Code·Codex 플러그인 마켓플레이스(`ThisIsMarkive/foryourdocument`)로 설치해도 같은 서버(`npx -y hwpx-bridge@0.3.6 mcp`)와 사용 안내 스킬이 등록됩니다.

확인: `npx -y hwpx-bridge doctor`

## 도구

| 하고 싶은 일 | 도구 |
| --- | --- |
| 기존 DOCX → HWPX (서식 유지) | `filee_convert` |
| HWPX → PDF/DOCX, PDF → DOCX, PPTX·XLSX → PDF, 이미지 → PDF 등 | `filee_convert` (`to`) |
| 문서 읽기, 스캔 OCR | `parse_document` |
| 새 HWPX 작성 | `generate_document` |
| 양식 채우기, 기존 HWPX 수정 | `fill_form`, `patch_document` |
| HWP → HWPX | `convert_to_hwpx` |
| 미리보기 | `render_document` |
| 상태 확인 | `hwpx_bridge_status` |

그 밖의 kordoc 도구: `detect_format`, `parse_metadata`, `parse_pages`, `parse_table`, `parse_chunks`, `parse_form`, `compare_documents`, `place_seal`, `add_memo`, `redact_document`, `crop_regions`, `extract_tables`, `extract_profile`, `build_agency_pack`, `agency_pack_info`, `lint_document`.

`filee_convert`가 받는 입력: 문서(docx, doc, odt, rtf …), hwp/hwpx, pdf, pptx/xlsx 등 오피스, md/txt/html 등 텍스트, 이미지와 벡터 그림.
출력: `hwpx, hwp, docx, odt, rtf, pdf, pptx, xlsx, csv, md, txt, html, png, jpg, webp, tiff, svg`.
동영상·오디오·압축·전자책·CAD·3D·폰트 등 문서와 무관한 Filee 기능은 노출하지 않습니다. 같은 이름의 결과 파일이 있으면 덮어쓰지 않고 건너뜁니다.

## 지원 환경

| | kordoc 도구 | `filee_convert` |
| --- | --- | --- |
| Windows x64 | O | O |
| Linux x64 | O | O |
| macOS 등 | O | X (안내 메시지) |

OCR 모델은 kordoc이 처음 OCR할 때 자동으로 받습니다(약 18 MB부터). OCR 결과는 오인식이 있을 수 있습니다.

## 구조

```
npm/hwpx-bridge                 MCP 서버 (Node). kordoc npm 패키지를 그대로 실행하고 도구를 함께 노출
npm/filee-win32-x64             Filee 2.4.0 공식 릴리스의 CLI만 추린 것 (Windows)
npm/filee-linux-x64             〃 (Linux)
npm/scripts/prepare-filee.mjs   공식 릴리스를 SHA-256으로 확인하고 CLI에 필요한 파일만 복사
plugins/hwpx-bridge             Claude Code·Codex 플러그인 (MCP 등록 + 사용 안내 스킬)
```

Filee는 소스를 빌드하지 않고 **공식 릴리스의 파일을 그대로** 씁니다. 그중 `filee-cli`가 로드하는 파일(`filee-cli.deps.json` 기준)과 HWP 렌더링 엔진 rhwp만 남기고, 데스크톱 앱(GUI, Ctrl 단축키, 탐색기 메뉴), 7-Zip, 디버그 심볼, 번역 파일은 뺍니다. 변환 결과는 원본 Filee와 같습니다.

## 배포 (관리자용)

1. npm 계정을 만들고(2단계 인증 필수) Granular Access Token을 만듭니다: 권한 Read and write, 대상 All packages, **Bypass 2FA** 체크, 만료 최대 90일. GitHub 저장소 Secret `NPM_TOKEN`으로 등록합니다. 첫 배포 뒤에는 각 패키지 설정에서 Trusted Publishing(GitHub Actions)을 켜면 토큰 갱신이 필요 없습니다.
2. 세 `package.json`과 플러그인 매니페스트의 버전을 올리고 GitHub Releases에서 `vX.Y.Z` 태그로 릴리스를 만듭니다(태그만 푸시하면 배포되지 않습니다).
3. GitHub Actions가 Filee 준비 → 패키지 생성 → Windows·Linux에서 실제 설치·변환 테스트 → npm 배포를 순서대로 합니다.

로컬에서 확인하려면: `node npm/scripts/prepare-filee.mjs all` 후 각 폴더에서 `npm pack`.

이 프로젝트는 kordoc·Filee의 공식 제품이 아닌 독립적인 연결 도구입니다. 라이선스: MIT. [제3자 고지](npm/hwpx-bridge/THIRD_PARTY_NOTICES.md)
