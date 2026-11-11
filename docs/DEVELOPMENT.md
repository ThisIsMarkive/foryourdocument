# 개발·검증·배포

## 구조

```text
.agents/plugins/marketplace.json       Codex 목록
.claude-plugin/marketplace.json        Claude 목록
plugins/hwpx-bridge/
  plugin.json / mcp.json               표준 플러그인
  .codex-plugin/ / .claude-plugin/     호스트 호환 설정
  .mcp.json / codex.mcp.json           호환 MCP 설정
  scripts/                            Node 없는 최초 설정·실행
  server/                             Filee 어댑터 + kordoc 소스 모듈 통합
  runtime/assets.json                 런타임·SDK·모델 URL 및 해시
  runtime/package-lock.json           npm 의존성 고정
  vendor/filee/                       고정 Filee 소스
  vendor/kordoc/                      고정 kordoc 소스
  runtime/source-lock.json            원본 커밋·파일별 해시
  runtime/nuget-locks/                Filee 빌드 의존성 잠금
  skills/                             설정·문서 작업 안내
packaging/                            Claude Desktop MCPB 시작 프로그램
scripts/                              패키징·오프라인 이동
Install-HwpxBridge.ps1 / Setup.cmd    MCP 연결 전에 실행하는 공통 클라이언트 설정
tests/                                실제 프로토콜·변환·OCR 검증
```

## 설치 및 테스트

0.2.3의 클라이언트 등록 검사는 `node --test tests/registration.test.mjs`입니다. `HWPX_BRIDGE_TEST_CODEX`를 실제 codex.exe 절대 경로로 지정하면 격리된 CODEX_HOME에서 공식 CLI를 검사합니다. `HWPX_BRIDGE_TEST_SDK`를 설치된 런타임의 npm 폴더로 지정하면 복사된 독립 설치 경로의 초기 MCP 프로토콜도 검사합니다. 테스트는 실제 사용자 Claude/Codex 설정을 수정하지 않습니다.

전체 공통 설치기는 별도 APPDATA/LOCALAPPDATA와 `-BridgeHome`을 지정한 자식 프로세스에서 검사합니다. 완료 후 `tests/registered-runtime.mjs <테스트 Claude 설정 절대 경로>`가 저장된 명령 그대로 실행해 25개 도구 및 HWPX 생성·읽기를 확인합니다. 실제 Claude 앱 UI 검증으로 표시하지 않습니다.

시스템 Node.js 없이도 아래 설치가 됩니다. 테스트용 경로는 빈 폴더를 지정하세요.

```powershell
$env:HWPX_BRIDGE_HOME = Join-Path (Get-Location) '.test-runtime'
powershell -NoProfile -ExecutionPolicy Bypass -File .\plugins\hwpx-bridge\scripts\setup.ps1
$bridgeNode = Join-Path $env:HWPX_BRIDGE_HOME 'versions\0.2.3-win-x64\node\node.exe'
& $bridgeNode .\tests\validate.mjs
& $bridgeNode .\tests\claude-package.mjs
& $bridgeNode --test .\tests\paths.test.mjs
& $bridgeNode --test .\tests\process.test.mjs
& $bridgeNode .\tests\bootstrap.mjs
$env:HWPX_BRIDGE_REFERENCE_FILEE = & $bridgeNode .\tests\download-reference.mjs
& $bridgeNode .\tests\integration.mjs
& $bridgeNode .\tests\models.mjs
```

`integration.mjs`는 전역 PATH에서 Node를 제거한 상태로 PowerShell 진입점을 실행하고 MCP initialize/list/call을 확인합니다. 새 보고서 생성·읽기·PNG 렌더, Filee 직접 실행과 모든 HWPX ZIP 멤버 해시 비교, 덮어쓰기 방지, 두 엔진의 실제 한국어 OCR, 기본 언어 조합의 한자·영어·숫자 OCR을 검사합니다. `models.mjs`는 14개 파일 해시와 8개 ONNX 세션의 CPU 로딩을 검사합니다.

`claude-package.mjs`는 Claude Code의 로컬 검사와 별도로, Claude 앱의 클라우드 패키지 제한을 검사합니다. 중첩 매니페스트, 허용되지 않는 경로 문자, 잘못 노출된 원본 스킬, 파일 수·용량·경로 길이 제한을 확인합니다. 로컬 검사 통과만으로 실제 계정의 마켓플레이스 동기화 성공을 대신 판정하지 않습니다.

`inspect-tools.mjs`는 현재 도구 스키마를 테스트 런타임 폴더에 기록합니다. `ocr-diagnose.mjs`는 마지막 통합 테스트의 입력을 이용한 추가 진단용입니다. PDF용 Chromium은 설치하지 않으므로 렌더 검증은 PNG를 사용합니다.

PowerShell 스크립트는 Windows PowerShell 5.1 기준입니다. 설치용 stdout은 MCP stdout과 분리됩니다. 최초 설정 MCP는 다운로드 동안 응답을 유지하고, 완료 후 연결 재시작 시 본 서버로 바뀝니다. 모델 설치 완료 마커는 모든 검사가 끝난 뒤에만 씁니다.

## 패키지 만들기

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Build-Packages.ps1
```

`dist/`에 GitHub 업로드용 소스 ZIP, Claude Desktop `.mcpb`, SHA256SUMS가 생성됩니다. 숨김 매니페스트를 포함하고 `node_modules`, 런타임, 로그는 제외합니다. 패키징 결과는 ZIP CRC를 다시 읽어 검사합니다. `.mcpb`에도 두 프로젝트의 소스와 빌드 설정, 자동 설치용 시작 프로그램이 들어 있습니다. 큰 실행 환경과 OCR 가중치는 최초 설정 시 준비합니다.

만들어진 확장의 시작 동작도 확인할 수 있습니다.

```powershell
& $bridgeNode .\tests\desktop.mjs .\dist\hwpx-bridge-0.2.3-windows.mcpb
```

## 의존성 업데이트

통합 구조와 빌드 절차는 [SOURCE_BUILD.md](SOURCE_BUILD.md)에 있습니다. 소스 커밋·파일 해시는 `runtime/source-lock.json`, 실행 환경·모델은 `runtime/assets.json`, npm은 `runtime/package-lock.json`, NuGet은 `runtime/nuget-locks/`에서 고정합니다. 모델 URL의 상위 프로젝트가 파일을 바꾸면 해시 검증이 실패하도록 되어 있습니다. 해시 불일치를 무시하는 옵션은 없습니다.

업데이트할 때는 새 버전의 파일과 공식 체크섬을 확인하고 `bundleVersion` 및 모든 플러그인 버전을 함께 올린 뒤 다시 테스트하세요. npm 잠금 파일은 `npm install --package-lock-only --ignore-scripts`로 갱신하고, 실제 설치는 `npm ci --ignore-scripts --omit=dev`로 재현합니다. Filee는 `dotnet restore --locked-mode` 후 포함된 소스를 컴파일합니다. 원본 배포물로 대체하는 fallback은 없습니다. CPU OCR만 사용하며 선택적 CUDA 설치 스크립트를 실행하지 않습니다.

## 문제 진단

- `setup-status.json`: 현재 설치 상태와 마지막 오류
- `setup-stderr.log`, `setup-stdout.log`: MCP 도구에서 시작한 설치 로그
- `npm-install.log`: npm 의존성 설치 로그
- `<런타임>/ready.json`: 완료된 엔진 버전 및 설치 정의 지문
- `<런타임>/build-receipt.json`: 소스 커밋, 빌드 도구 버전, 산출물 해시
- `filee-restore.log`, `filee-build.log`: 소스 빌드 로그
- `-Repair`: 완료 마커를 다시 만들며 설치·무결성 검사를 재실행하는 설정기 옵션

`HWPX_BRIDGE_DOCUMENT_ROOT`를 지정하면 Filee 도구의 파일 접근을 그 디렉터리 아래로 제한하고, 같은 MCP 프로세스의 kordoc 모듈에도 `KORDOC_ROOT`로 같은 값을 설정합니다. 기본값은 호출한 사용자의 로컬 파일 접근 권한입니다. MCP 설정 자체가 OS 보안 샌드박스인 것은 아닙니다.

`filee_convert_to_hwpx`는 입력 파일 하나와 출력 폴더만 받고, 셸 문자열을 조합하지 않고 인수 배열로 실행합니다. Filee GUI의 사용자 설정은 수정하지 않으며, 호출마다 별도 설정 폴더를 사용합니다. 파일 경로를 네트워크 변환 서비스에 보내는 코드는 없습니다.

## GitHub 게시

빈 저장소를 만든 후 이 디렉터리에서 일반 Git 절차로 게시할 수 있습니다.

```powershell
git init
git add .
git commit -m "Add HWPX Bridge marketplace plugin"
git branch -M main
git remote add origin https://github.com/ThisIsMarkive/foryourdocument.git
git push -u origin main
```

이 명령은 이 프로젝트의 배포 저장소를 기준으로 한 예시입니다. 다른 계정에서 포크해 배포할 때는 원격 주소와 README의 설치 예시를 변경하세요. GitHub Release에 생성된 `.mcpb`를 첨부하면 데스크톱 앱 사용자도 설치할 수 있습니다. 공식 플러그인 디렉터리 심사에 제출하는 절차는 자체 Git 마켓플레이스 게시와 별개입니다.
