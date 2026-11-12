# HWPX Bridge

AI 에이전트가 한글 문서(HWP·HWPX)를 다룰 수 있게 해 주는 **MCP 서버 하나**입니다.

- **[kordoc](https://github.com/chrisryugj/kordoc)의 모든 기능**: HWP·HWPX·PDF·DOCX·XLSX·이미지 읽기, 스캔 문서 OCR, Markdown → 새 HWPX 작성, 양식 채우기, 서식 유지 수정, HWP → HWPX, 렌더링, 공문서 검수 (22개 도구)
- **[Filee](https://github.com/KnifeLemon/Filee)의 문서 변환 기능만**: DOCX → HWPX를 글꼴·색·정렬·머리말·쪽번호·표 서식까지 유지해 변환, 그 밖의 문서 형식 간 변환 (`filee_convert`)

문서는 내 컴퓨터에서 처리되며 변환 서비스에 업로드되지 않습니다.

## 설치 — 한 줄

[Node.js](https://nodejs.org) 20 이상이 있으면(kordoc과 같은 조건) 아무 터미널에서:

```
npx -y hwpx-bridge setup
```

등록할 앱을 고르면 끝입니다: Claude 앱, Claude Code, Codex, Cursor, Gemini CLI, Windsurf. 앱을 한 번 다시 시작하면 도구가 나타납니다.

번호를 고르지 않고 바로 등록하려면:

```
npx -y hwpx-bridge setup --client claude-desktop,claude-code,codex
```

직접 넣는 경우 (`npx -y hwpx-bridge config`가 출력하는 것과 같음):

```json
{ "mcpServers": { "hwpx-bridge": { "command": "npx", "args": ["-y", "hwpx-bridge@0.3.0", "mcp"] } } }
```

Windows의 Claude 앱은 `"command": "cmd", "args": ["/c", "npx", "-y", "hwpx-bridge@0.3.0", "mcp"]` 형식이 필요하며, `setup`이 자동으로 맞춥니다. 처음 실행할 때 엔진(약 100 MB)을 내려받으므로, `setup`을 먼저 실행해 두면 앱 첫 실행이 빠릅니다.

Claude Code·Codex 플러그인 마켓플레이스(`ThisIsMarkive/foryourdocument`)로 설치해도 같은 서버(`npx -y hwpx-bridge@0.3.0 mcp`)와 사용 안내 스킬이 등록됩니다.

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
2. 세 `package.json`과 플러그인 매니페스트의 버전을 올리고 `vX.Y.Z` 태그를 푸시합니다.
3. GitHub Actions가 Filee 준비 → 패키지 생성 → Windows·Linux에서 실제 설치·변환 테스트 → npm 배포를 순서대로 합니다.

로컬에서 확인하려면: `node npm/scripts/prepare-filee.mjs all` 후 각 폴더에서 `npm pack`.

이 프로젝트는 kordoc·Filee의 공식 제품이 아닌 독립적인 연결 도구입니다. 라이선스: MIT. [제3자 고지](npm/hwpx-bridge/THIRD_PARTY_NOTICES.md)
