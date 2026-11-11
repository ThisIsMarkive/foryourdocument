# HWPX Bridge

Codex와 Claude에서 **한글 문서를 읽고, DOCX를 HWPX로 바꾸고, 새 HWPX 보고서를 작성**하는 Windows x64용 로컬 MCP 플러그인입니다.

- 기존 DOCX → HWPX: 포함된 **Filee 2.4.0 소스**로 직접 빌드한 내부 변환 엔진을 사용합니다.
- 새 HWPX 작성·읽기·수정·렌더링: 포함된 **kordoc 4.24.62 소스**를 빌드해 같은 MCP 프로세스에 22개 도구를 등록합니다.
- OCR: **Tesseract + Filee의 한국어·영어·한자용 언어 데이터 4개**, **kordoc의 인쇄체·손글씨·수식 인식 모델 10개**를 준비합니다.
- 사용자가 Node.js·.NET SDK·npm·Python·한컴오피스를 따로 설치할 필요가 없습니다. 최초 설정기가 전용 실행 환경과 빌드 도구를 준비하고 소스를 컴파일합니다.

**0.2.3은 소스 통합 제품입니다.** `plugins/hwpx-bridge/vendor/`에 두 프로젝트의 고정 소스를 포함하고 직접 빌드합니다. kordoc 원본 npm 배포물이나 Filee 원본 프로그램을 설치하여 연결하는 방식에서 변경됐습니다. C# 변환 엔진은 내부 실행 파일 `hwpx-converter.exe`로, kordoc 기능은 같은 Node MCP 프로세스 안의 모듈로 동작합니다. 사용자는 하나의 플러그인을 설치하며 문서를 변환 서버에 업로드하지 않습니다. “HWPX로 만들어줘”라는 요청을 받으면 에이전트가 스킬 안내에 따라 새 작성에는 kordoc, 기존 DOCX 변환에는 Filee 도구를 선택합니다. 모든 자연어 문장을 강제 분기하는 고정 규칙은 아닙니다.

GitHub 저장소 하나로 두 클라이언트의 마켓플레이스를 배포합니다. npm 게시, MCP 레지스트리 등록, 도메인, 상시 서버 운영은 필요하지 않습니다. 여기서 마켓플레이스는 **이 저장소의 플러그인 목록**이며, GitHub Actions/Apps 상품을 판매하는 GitHub Marketplace와는 별개입니다.

## 지원 환경

| 환경 | 설치 경로 |
| --- | --- |
| Windows x64 Codex 데스크톱/CLI | GitHub 마켓플레이스 |
| Windows x64 Claude Code | 같은 GitHub 저장소의 Claude 마켓플레이스 |
| Windows x64 Claude Desktop | 마켓플레이스 스킬 + 아래 공통 설치기의 최초 MCP 등록 1회 |
| Claude 웹·모바일만 사용하는 환경 | 로컬 실행 불가 |
| Linux VM/WSL/macOS/ARM64 | 이 버전의 Windows 엔진 실행 대상 아님 |

Claude의 통합 대화 화면은 계정별로 배포 중입니다. **화면 통합과 로컬 프로그램 실행 지원은 같은 조건이 아닙니다.** 마켓플레이스에서 스킬만 보이고 MCP가 실행되지 않는 경우 아래 공통 설치기로 최초 MCP 등록을 진행하세요. 공용 URL을 입력하는 ‘커스텀 커넥터’에 이 로컬 MCP를 등록하지 않습니다. 파일은 Windows PC에 있어야 합니다. [호환성 설명](docs/COMPATIBILITY.md)

## 설치

저장소 주소는 **[ThisIsMarkive/foryourdocument](https://github.com/ThisIsMarkive/foryourdocument)**입니다. 플러그인 이름은 `hwpx-bridge`, 마켓플레이스 이름은 `hwpx-tools`입니다. CLI 방식은 해당 앱의 CLI가 있어야 합니다.

### Codex

```powershell
codex plugin marketplace add ThisIsMarkive/foryourdocument
codex plugin add hwpx-bridge@hwpx-tools
```

Codex 데스크톱에서 플러그인을 켜고 새 대화를 시작합니다. 설치 화면의 설정 실행 또는 다음 요청으로 최초 설정을 진행합니다.

> HWPX Bridge 최초 설정을 진행해줘.

### Claude Code

```powershell
claude plugin marketplace add ThisIsMarkive/foryourdocument
claude plugin install hwpx-bridge@hwpx-tools
```

새 세션에서 `/hwpx-bridge:setup` 또는 “HWPX Bridge 최초 설정을 진행해줘”를 사용합니다. Claude 세션 안에서는 `/plugin marketplace add ThisIsMarkive/foryourdocument`로도 마켓플레이스를 추가할 수 있습니다.

### Claude Windows 앱 — kordoc의 최초 설정 흐름 적용

마켓플레이스 주소 `ThisIsMarkive/foryourdocument`는 스킬을 배포합니다. **스킬이 보이는 것과 Windows 앱의 MCP 등록은 별개**입니다. kordoc 역시 마켓플레이스 스킬은 CLI를 실행하고, `npx kordoc setup`이 선택한 앱의 MCP 설정을 등록합니다. 이 프로젝트의 공통 설치기도 그 등록 흐름을 적용합니다. **다른 PC에서도 최초 설정을 한 번 실행해야 하며, 마켓플레이스 추가만으로 끝난다고 보장하지 않습니다.**

1. 마켓플레이스에서 HWPX Bridge를 설치합니다.
2. [소스 설치 ZIP](https://github.com/ThisIsMarkive/foryourdocument/releases/download/v0.2.3/hwpx-bridge-0.2.3-github.zip)을 풀고 `Setup.cmd`를 실행한 뒤 **1 — Claude Windows app**을 선택합니다. 설치기는 독립 실행되므로 Claude에 MCP 도구가 없어도 시작할 수 있습니다.
3. 설치기가 Node·엔진·OCR 준비와 MCP 등록을 마치면 Claude를 한 번 다시 엽니다. `hwpx_runtime_status`와 문서 도구가 실제로 보이는지 확인합니다. 등록 파일 작성 성공과 앱 연결 성공은 구분합니다.

ZIP을 직접 관리하지 않으려면 Windows PowerShell에서 아래 명령으로 같은 [공통 설치기](https://github.com/ThisIsMarkive/foryourdocument/releases/download/v0.2.3/Install-HwpxBridge.ps1)를 실행할 수 있습니다. 관리자 권한이나 미리 설치한 Node.js는 필요하지 않습니다.

```powershell
$bridgeInstaller = Join-Path $env:TEMP 'Install-HwpxBridge.ps1'
Invoke-WebRequest -UseBasicParsing 'https://github.com/ThisIsMarkive/foryourdocument/releases/download/v0.2.3/Install-HwpxBridge.ps1' -OutFile $bridgeInstaller
powershell -NoProfile -ExecutionPolicy Bypass -File $bridgeInstaller -Clients ClaudeDesktop
```

설치기는 원본 소스를 `%LOCALAPPDATA%\HwpxBridge\sources`에 검증해 복사한 뒤 그 고정 경로를 등록합니다. 다운로드 폴더나 마켓플레이스 캐시를 지워도 이 경로는 유지됩니다. 일반 Claude와 Microsoft Store Claude의 설정 위치를 구분하며, 기존 설정·다른 MCP 서버를 보존하고 변경 전 백업을 남깁니다. 이미 이 설치기가 등록한 항목은 업데이트할 수 있지만, 같은 이름의 별도 설정은 덮어쓰지 않습니다.

Codex는 앞의 마켓플레이스 설치를 그대로 사용합니다. 별도 MCP 등록이 필요할 때는 같은 설치기의 `-Clients Codex`를 사용할 수 있으며, kordoc처럼 공식 `codex mcp add` 명령을 사용합니다. 이 경로에는 `codex.exe`가 필요합니다. 마켓플레이스 MCP가 이미 작동하는 Codex에 중복 등록할 필요는 없습니다.

설치기 옵션: `-BridgeHome D:\HwpxBridge`로 설치 위치 지정, `-RegisterOnly`로 MCP 등록 후 엔진 준비를 연결된 설정 도구에 맡기기, `-Offline`으로 같은 버전의 오프라인 런타임을 가져온 뒤 다운로드 없이 등록하기. 설정 파일을 쓰거나 런타임 검사를 통과한 사실만으로 실제 Claude 앱에서 연결됐다고 표시하지 않습니다.

기존 `.mcpb` 배포물도 유지하지만 이 절차의 필수 설치물이 아닙니다. 같은 서버를 여러 경로로 등록해 중복 도구가 나오면 하나의 연결만 사용하세요.

### 최초 설정에서 일어나는 일

1. 처음 연결하면 `hwpx_setup`, `hwpx_setup_status` 두 도구가 열립니다.
2. `hwpx_setup`이 전용 Node.js·.NET SDK, 고정 라이브러리와 OCR 모델을 준비합니다. 포함된 Filee·kordoc 소스를 직접 빌드하므로 첫 설정에는 몇 분 이상 걸릴 수 있습니다. 진행 상태와 빌드 로그를 확인할 수 있습니다.
3. 포함된 소스의 파일별 SHA-256, 다운로드의 SHA-256/SHA-512, npm·NuGet 잠금 파일을 검사합니다. `build-receipt.json`에 소스 커밋과 빌드 산출물 해시를 기록합니다. 실패한 설치를 완료로 표시하지 않습니다.
4. 완료 후 **MCP 연결을 새로고침하거나 앱을 한 번 다시 시작**합니다.
5. 이후 HWPX 작업을 요청하면 Filee 도구 2개, 상태 도구 1개, kordoc 도구 22개가 사용됩니다.

관리자 권한이나 시스템 PATH 변경은 없습니다. 기본 위치는 `%LOCALAPPDATA%\HwpxBridge`입니다. 실행 환경·엔진·모델 외에 최초 빌드용 SDK와 의존성 캐시가 필요하므로 **8 GB 이상의 여유 공간**을 권장합니다. 이전 버전·캐시는 별도로 남을 수 있습니다. GitHub에는 두 프로젝트의 소스와 빌드 설정을 올리고, 큰 실행 환경·OCR 가중치·SDK는 올리지 않습니다. 실제 측정값은 [검증 기록](docs/VALIDATION.md)을 참고하세요.

설치가 완료되면 같은 버전은 다시 다운로드하지 않습니다. 별도 경로를 원하면 앱 실행 전에 `HWPX_BRIDGE_HOME`을 절대 경로로 지정하세요. 프록시가 있는 환경은 Windows/Node/npm의 프록시 설정이 필요할 수 있습니다. 인증서 검증이나 파일 해시 검증은 해제하지 않습니다.

## 사용 예

> C:\문서\업무보고.docx를 같은 폴더의 결과 폴더에 HWPX로 변환해줘.

> 이 내용으로 표와 쪽번호가 있는 HWPX 보고서를 만들어줘.

> 이 HWPX를 읽고 주요 내용과 표를 정리해줘.

> 스캔 PDF에서 한국어와 영어를 인식해서 편집 가능한 HWPX로 만들어줘.

| 도구 | 용도 |
| --- | --- |
| `filee_convert_to_hwpx` | DOCX/HWP/텍스트 PDF/MD/TXT → HWPX |
| `filee_ocr` | 스캔 PDF·이미지 → HWPX/DOCX/TXT/MD/검색 가능한 PDF |
| `generate_document` | Markdown → 새 HWPX |
| `parse_document` | HWP/HWPX/DOCX/PDF/이미지 등 읽기, kordoc OCR 옵션 |
| `patch_document`, `fill_form` | 기존 문서 수정·서식 채우기 |
| `render_document` | PNG/JPEG/SVG/HTML 미리보기 |
| `hwpx_runtime_status` | 버전·설치 경로·언어 코드 확인 |

Filee 변환은 기존 출력 파일을 덮어쓰지 않고 건너뜁니다. 같은 이름의 결과가 있으면 새 출력 폴더를 지정하세요. kordoc 수정 도구는 원본과 다른 출력 경로를 사용하도록 스킬에서 안내합니다.

**보존 범위:** Filee 변환 알고리즘은 원본 소스를 유지하고 빌드 복사본에서 실행 파일 이름만 변경합니다. MCP가 DOCX 변환 결과를 다시 작성하지 않습니다. 테스트 문서에서는 직접 실행한 Filee와 HWPX 내부 모든 파일이 일치했습니다. 모든 원본 문서의 완벽한 서식 보존이나, 서로 다른 PC에서 글꼴까지 같은 화면을 보장한다는 뜻은 아닙니다. 같은 엔진·옵션·입력과 같은 글꼴 환경을 유지해야 합니다.

**OCR 범위:** Filee용 `kor`·`eng`·`chi_tra`·`chi_sim` 4개 데이터와 kordoc의 OCR 모델 전체를 준비합니다. 기본 OCR 조합은 `kor+eng+chi_tra`이며, 간체자는 `chi_sim`을 선택하거나 추가합니다. 숫자는 별도 모델이 필요 없습니다. 이 설정은 스캔 이미지 인식용이며 일반 문서의 작성·변환 문자 범위를 제한하지 않습니다. Apple Vision은 macOS 전용이므로 포함하지 않습니다. GPU/CUDA, Whisper 음성인식, 번역 LLM, LibreOffice, 브라우저/Chromium은 이 문서용 번들에 포함하지 않습니다. `render_document`의 PDF 인쇄 기능은 별도 Chromium이 필요하므로 기본 검증 대상은 PNG/SVG입니다.

Filee 2.4.0의 작은 이미지 OCR 후 편집 문서 변환에서 텍스트가 빠지는 경로를 피하기 위해, 이미지 → 편집 문서 OCR은 Filee로 중간 PDF를 만든 뒤 OCR합니다. 결과에 사용한 경로를 표시합니다. **DOCX → HWPX 경로에는 이 처리가 적용되지 않습니다.** OCR은 글자·표·수식을 잘못 인식할 수 있으므로 결과를 확인해야 합니다.

## 오프라인 PC로 옮기기

인터넷이 되는 Windows PC에서 최초 설정을 끝낸 뒤 다음 명령으로 이동용 폴더를 만듭니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Export-Offline.ps1 -Destination D:\hwpx-offline
```

폴더 전체를 다른 Windows x64 PC로 복사한 뒤 그 안에서 실행합니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Import-Offline.ps1
```

모든 파일의 해시를 확인하고 빌드가 끝난 전용 런타임과 소스를 포함한 로컬 마켓플레이스를 복사합니다. 오프라인 PC에서 .NET SDK 설치나 재빌드는 필요하지 않습니다. 출력되는 **로컬 경로**로 마켓플레이스를 추가하면 GitHub나 npm에 접속할 필요가 없습니다. 필요하면 일반 ZIP 프로그램으로 이동용 폴더를 압축할 수 있습니다. 이 전체 런타임은 200 MB 미만 패키지가 아닙니다.

문서 변환·OCR 엔진의 오프라인 작동과 Codex/Claude 모델의 인터넷 사용은 별개입니다. 이 플러그인이 클라우드 AI 모델을 오프라인 모델로 바꾸지는 않습니다. 문서 파일을 변환 서비스에 업로드하지 않지만, MCP가 반환한 텍스트는 사용하는 AI 앱에 전달됩니다.

## GitHub에 올리기

1. 이 폴더의 내용을 GitHub 저장소 루트에 올립니다. `.agents`, `.claude-plugin`, `.github` 같은 숨김 폴더도 포함해야 합니다.
2. 사용자에게 `ThisIsMarkive/foryourdocument` 주소를 알려줍니다. 별도 저장소에 포크해 배포한다면 설치 안내의 소유자/저장소 이름을 바꾸세요. npm 계정이나 별도 MCP 서버 URL은 필요 없습니다.
3. Desktop 확장을 제공하려면 [패키지 만들기](docs/DEVELOPMENT.md)에 따라 `.mcpb`를 빌드하고 GitHub Release에 첨부합니다.

실행 파일과 모델을 Git 저장소에 직접 올리지 마세요. [소스 통합 구조](docs/SOURCE_BUILD.md), [개발·검증·배포](docs/DEVELOPMENT.md), [검증 결과](docs/VALIDATION.md), [오픈소스 고지](THIRD_PARTY_NOTICES.md)를 참고하세요.

이 프로젝트는 Filee·kordoc·OpenAI·Anthropic의 공식 제품이 아닌 독립적인 연결 도구입니다.
