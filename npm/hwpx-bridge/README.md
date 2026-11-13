<div align="center">

# HWPX Bridge

**AI가 한글 문서(HWP·HWPX)를 읽고, 쓰고, 고치고, 변환하게 해 주는 MCP 서버**

[![npm](https://img.shields.io/npm/v/hwpx-bridge?color=1f6feb&label=npm)](https://www.npmjs.com/package/hwpx-bridge)
[![test](https://github.com/ThisIsMarkive/foryourdocument/actions/workflows/npm.yml/badge.svg)](https://github.com/ThisIsMarkive/foryourdocument/actions/workflows/npm.yml)
[![license](https://img.shields.io/badge/license-MIT-green)](https://github.com/ThisIsMarkive/foryourdocument/blob/main/LICENSE)
![Windows](https://img.shields.io/badge/Windows-x64-0078D4)

Claude · ChatGPT(Codex·Work) · Claude Code · Cursor · Gemini CLI · Windsurf

</div>

---

## 한눈에 보기

- **무엇을**: [kordoc](https://github.com/chrisryugj/kordoc)의 한글 문서 기능 전부 + [Filee](https://github.com/KnifeLemon/Filee)의 문서 변환 기능
- **강점**: 기존 DOCX를 글꼴·색·정렬·머리말·쪽번호·표 서식까지 살려 HWPX·HWP로 변환
- **설치**: 명령 한 줄. 이 PC의 AI 앱을 모두 찾아 자동 등록
- **보안**: 문서는 내 PC에서만 처리되고 외부 변환 서버로 올라가지 않음

---

## 빠른 시작

**1. AI 앱을 종료합니다.** Claude 앱·ChatGPT 앱을 트레이 아이콘(화면 오른쪽 아래 `^`)에서 우클릭 → **종료**합니다.

> 켜진 채로 등록하면 Claude 앱이 종료하면서 설정을 덮어쓸 수 있습니다. 켜져 있으면 `setup`이 알려 줍니다.

**2. 명령 한 줄을 실행합니다.** PowerShell에 입력하거나, Codex·Claude Code에 "이 명령 실행해줘"라고 맡겨도 됩니다.

```powershell
npx -y hwpx-bridge setup
```

| 이런 메시지가 나오면 | 대신 실행할 명령 |
| --- | --- |
| `npx`을(를) 찾을 수 없습니다 (Node.js 없음) | `irm https://raw.githubusercontent.com/ThisIsMarkive/foryourdocument/main/install.ps1 \| iex` |
| 이 시스템에서 스크립트를 실행할 수 없으므로… | `npx.cmd -y hwpx-bridge setup` |

> `install.ps1`은 Node.js LTS를 설치한 뒤 `setup`까지 이어서 실행합니다. winget이 있으면 winget으로, 없으면 nodejs.org 공식 파일을 SHA-256으로 확인해 사용자 폴더에 설치합니다. 관리자 권한은 필요 없습니다.

**3. 앱을 다시 엽니다.** 새 대화에서 이렇게 확인합니다.

```
hwpx_bridge_status 실행해줘
```

hwpx-bridge, kordoc, Filee 버전이 나오면 끝입니다. 이후 그 앱의 **모든 대화**에서 쓸 수 있고, PC 안의 어느 폴더 파일이든 경로로 다룰 수 있습니다.

> **웹·모바일은 지원하지 않습니다.** claude.ai 웹, ChatGPT 웹, 휴대폰 앱은 내 PC의 프로그램을 실행할 수 없습니다. PC에 설치된 데스크톱 앱에서 사용하세요.

---

## 이렇게 요청하면 됩니다

| 하고 싶은 일 | 요청 예시 |
| --- | --- |
| DOCX → HWPX | `C:\문서\보고서.docx 를 HWPX로 바꿔줘` |
| HWP로 저장 (한글 2014 등 구버전용) | `이 DOCX를 HWP로 바꿔줘` · `이 HWPX를 HWP로 저장해줘` |
| 다른 형식으로 변환 | `이 HWPX를 PDF로 바꿔줘` · `이 PDF를 DOCX로 바꿔줘` |
| 읽고 요약 | `이 HWP 파일 읽고 요약해줘` |
| 스캔 문서 OCR | `이 스캔 PDF 글자 인식해서 정리해줘` |
| 새 문서 작성 | `이 내용으로 HWPX 보고서 만들어줘` |
| 양식 채우기 · 일부 수정 | `이 신청서에 내 정보 채워줘` · `이 HWPX에서 날짜만 바꿔줘` |
| 미리보기 | `만든 문서 이미지로 보여줘` |

---

## 등록되는 앱

`setup`은 아무것도 묻지 않고, 이 PC에 설치된 앱을 모두 찾아 등록합니다. 새 AI 앱을 설치했다면 같은 명령을 한 번 더 실행하세요.

| 앱 | 등록 위치 |
| --- | --- |
| Claude 앱 | `claude_desktop_config.json` (PC에 있는 위치를 모두 찾아 등록) |
| Claude Code | `claude mcp add --scope user` |
| ChatGPT 데스크톱의 Codex·Work, Codex CLI·IDE | `~/.codex/config.toml` |
| Cursor · Gemini CLI · Windsurf | 각 앱의 MCP 설정 파일 |

- 기존 설정은 그대로 두고, 바꾸기 전 파일을 `.bak-…`으로 백업합니다.
- 앱이 처음 켜질 때 기다리지 않도록 엔진(약 100 MB)을 미리 내려받습니다.
- npx에 쌓인 hwpx-bridge **예전 버전은 정리**합니다. 사용 중인 버전과 다른 프로그램의 파일은 건드리지 않습니다.
- 일부 앱에만 등록하려면 `npx -y hwpx-bridge setup --client claude-desktop,codex`
  (값: `claude-desktop` `claude-code` `codex` `cursor` `gemini` `windsurf`)

---

## 문제 해결

<details>
<summary><b>Claude 앱에 도구가 안 보여요 (직접 등록)</b></summary>

<br>

Claude 앱은 버전에 따라 설정 파일 위치가 다릅니다. 그래도 **설정 → 개발자** 화면에 hwpx-bridge가 없다면 직접 넣습니다.

1. Claude 앱 **설정 → 개발자 → 구성 편집(Edit Config)** 을 눌러, 앱이 실제로 읽는 `claude_desktop_config.json`을 엽니다.
2. `"mcpServers"`가 **없으면**, 맨 바깥 `{` 바로 다음 줄에 넣습니다(끝의 쉼표 포함).

   ```json
   "mcpServers": {
     "hwpx-bridge": { "command": "cmd", "args": ["/c", "npx", "-y", "hwpx-bridge@0.3.6", "mcp"] }
   },
   ```

   `"mcpServers": {`가 **이미 있으면**, 그 줄 바로 다음에 한 줄만 넣습니다(끝의 쉼표 포함).

   ```json
   "hwpx-bridge": { "command": "cmd", "args": ["/c", "npx", "-y", "hwpx-bridge@0.3.6", "mcp"] },
   ```

3. 저장하고 Claude 앱을 트레이에서 **종료**한 뒤 다시 엽니다.

Mac·Linux에서는 `"command": "npx", "args": ["-y", "hwpx-bridge@0.3.6", "mcp"]`입니다.

</details>

<details>
<summary><b>ChatGPT(Codex·Work)에 도구가 안 보여요 (직접 등록)</b></summary>

<br>

Codex는 Codex 앱·Work 모드·CLI·IDE 확장이 함께 쓰는 `사용자 폴더\.codex\config.toml` 한 곳에 설정을 둡니다. Claude 앱의 `claude_desktop_config.json`과 같은 역할입니다.

1. 터미널에서 `codex mcp list`로 hwpx-bridge가 있는지 봅니다. Codex CLI가 없으면 `config.toml`을 메모장으로 열어 `[mcp_servers.hwpx-bridge]`를 찾습니다.
2. 없으면 파일 맨 끝에 붙여 넣습니다.

   ```toml
   [mcp_servers.hwpx-bridge]
   command = "cmd"
   args = ["/c", "npx", "-y", "hwpx-bridge@0.3.6", "mcp"]
   startup_timeout_sec = 180
   tool_timeout_sec = 1800
   ```

3. ChatGPT 앱을 완전히 종료했다가 다시 엽니다.

</details>

<details>
<summary><b>앱을 처음 켤 때 도구가 안 뜨거나 느려요</b></summary>

<br>

직접 등록한 경우, 앱이 처음 실행하면서 엔진(약 100 MB)을 내려받느라 시작 대기 시간을 넘길 수 있습니다. 터미널에서 한 번 미리 받아 두세요.

```powershell
npx.cmd -y hwpx-bridge@0.3.6 doctor
```

마지막에 `+ MCP: 24 tools`가 나오면 정상입니다. 그다음 앱을 다시 엽니다.

</details>

<details>
<summary><b>filee_convert를 쓸 수 없다고 나와요</b></summary>

<br>

Filee 패키지가 빠진 채 설치된 경우입니다(npm 배포 직후 검사 중일 때 설치하면 생길 수 있습니다). `%LOCALAPPDATA%\npm-cache\_npx` 폴더를 지우고 `setup`을 다시 실행하세요. macOS에서는 Filee 변환을 지원하지 않습니다.

</details>

<details>
<summary><b>WinError 10013이 나와요</b></summary>

<br>

프로그램의 인터넷 접속이 권한 때문에 막혔다는 뜻입니다. 와이파이 문제가 아닙니다. Codex의 실행 제한(네트워크 차단)이나 백신·방화벽이 원인인 경우가 많습니다. Codex에서 네트워크 접근을 허용하거나, 같은 요청을 Claude 앱에서 해 보세요.

</details>

상태 점검: `npx -y hwpx-bridge doctor` · 설정 내용 출력: `npx -y hwpx-bridge config`

---

## 도구 목록

<details>
<summary><b>주요 도구</b></summary>

<br>

| 도구 | 기능 | 엔진 |
| --- | --- | --- |
| `filee_convert` | 문서 형식 변환 (DOCX→HWPX·HWP 등, 서식 유지) | Filee |
| `parse_document` | 문서 읽기, 스캔·이미지 OCR | kordoc |
| `generate_document` | 내용으로 새 HWPX 작성 | kordoc |
| `fill_form` · `patch_document` | 양식 채우기, 서식 유지 수정 | kordoc |
| `convert_to_hwpx` | HWP → HWPX | kordoc |
| `render_document` | 문서를 이미지로 미리보기 | kordoc |
| `hwpx_bridge_status` | 설치 상태 확인 | — |

그 밖의 kordoc 도구: `detect_format` `parse_metadata` `parse_pages` `parse_table` `parse_chunks` `parse_form` `compare_documents` `place_seal` `add_memo` `redact_document` `crop_regions` `extract_tables` `extract_profile` `build_agency_pack` `agency_pack_info` `lint_document`

</details>

<details>
<summary><b>filee_convert 지원 형식</b></summary>

<br>

- **입력**: 문서(docx, doc, odt, rtf …), hwp·hwpx, pdf, pptx·xlsx 등 오피스, md·txt·html 등 텍스트, 이미지와 벡터 그림
- **출력**: `hwpx` `hwp` `docx` `odt` `rtf` `pdf` `pptx` `xlsx` `csv` `md` `txt` `html` `png` `jpg` `webp` `tiff` `svg`
- 동영상·오디오·압축·전자책·CAD·3D·폰트 등 문서와 무관한 Filee 기능은 노출하지 않습니다.
- 같은 이름의 결과 파일이 있으면 덮어쓰지 않고 건너뜁니다.

</details>

---

## 지원 환경

| | kordoc 도구 | `filee_convert` |
| --- | :---: | :---: |
| Windows x64 | ✅ | ✅ |
| Linux x64 | ✅ | ✅ |
| macOS | ✅ | — |

- Node.js 20 이상 (Windows는 `install.ps1`이 자동 설치)
- OCR 모델은 처음 OCR할 때 kordoc이 자동으로 받습니다(약 18 MB부터). OCR 결과는 오인식이 있을 수 있습니다.
- 미리보기는 근사치입니다. 최종 모양은 한글에서 확인하세요.

---

## 구조

```
npm/hwpx-bridge                 MCP 서버 (Node). kordoc npm 패키지를 그대로 실행하고 도구를 함께 노출
npm/filee-win32-x64             Filee 2.4.0 공식 릴리스의 명령줄 변환기만 추린 것 (Windows)
npm/filee-linux-x64             〃 (Linux)
npm/scripts/prepare-filee.mjs   공식 릴리스를 SHA-256으로 확인하고 필요한 파일만 복사
plugins/hwpx-bridge             Claude Code·Codex 플러그인 (MCP 등록 + 사용 안내 스킬)
install.ps1                     Windows 한 줄 설치기 (Node.js 설치 + setup)
```

Filee는 소스를 빌드하지 않고 **공식 릴리스 파일을 그대로** 씁니다. 명령줄 변환기가 쓰는 파일과 HWP 렌더링 엔진(rhwp)만 남기고, 데스크톱 앱(GUI·Ctrl 단축키·탐색기 메뉴), 7-Zip, 디버그 심볼은 뺐습니다. 변환 결과는 원본 Filee와 같습니다.

<details>
<summary><b>배포 방법 (관리자용)</b></summary>

<br>

1. npm 계정(2단계 인증 필수)에서 Granular Access Token을 만듭니다: Read and write → Publish and stage, All packages, **Bypass 2FA** 체크, 만료 최대 90일. GitHub 저장소 Secret `NPM_TOKEN`으로 등록합니다.
2. 세 `package.json`과 플러그인 매니페스트의 버전을 올리고, GitHub Releases에서 `vX.Y.Z` 태그로 릴리스를 만듭니다. 태그만 푸시하면 배포되지 않습니다.
3. GitHub Actions가 Filee 준비 → 패키지 생성 → Windows·Linux 설치·변환 테스트 → npm 배포를 진행합니다.
4. npm이 새 패키지를 자동 검사(Validating)하는 동안에는 받을 수 없습니다. 세 패키지가 모두 공개된 뒤 설치하세요.

로컬 확인: `node npm/scripts/prepare-filee.mjs all` 후 각 폴더에서 `npm pack`

</details>

---

<div align="center">

kordoc·Filee의 공식 제품이 아닌 독립적인 연결 도구입니다 · MIT License · [제3자 고지](https://github.com/ThisIsMarkive/foryourdocument/blob/main/npm/hwpx-bridge/THIRD_PARTY_NOTICES.md) · [변경 기록](https://github.com/ThisIsMarkive/foryourdocument/blob/main/CHANGELOG.md)

</div>
