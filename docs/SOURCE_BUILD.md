# 소스 통합 구조 — 0.2.0

HWPX Bridge는 Filee와 kordoc 소스를 포함하고 자체 빌드하는 하나의 플러그인입니다. 두 언어를 서로 번역하지 않습니다. kordoc TypeScript 코드는 통합 MCP 안에서 직접 실행하고, Filee C# 코드는 내부 변환 실행 파일로 컴파일합니다.

```text
Codex / Claude
       │ stdio MCP 하나
       ▼
HWPX Bridge
  ├─ 작성·읽기·수정·렌더: 포함된 kordoc 소스 → kordoc-engine.mjs
  │                      같은 Node 프로세스 안의 22개 도구
  ├─ 변환·Filee OCR: 포함된 Filee 소스 → hwpx-converter.exe
  │                 내부 C# 실행 파일, 원본 변환 로직 유지
  └─ OCR 가중치·Tesseract·언어 데이터·네이티브 라이브러리
```

사용자가 설치하는 플러그인과 MCP 서버는 하나입니다. C 내부에서 모듈을 선택하는 것과 실행 파일 하나만 존재하는 것은 다른 개념입니다. 이 제품은 Node와 C# 구성요소를 함께 관리합니다.

## 포함한 소스

| 구성요소 | 고정 버전 | 원본 커밋 | 위치 |
| --- | --- | --- | --- |
| Filee | 2.4.0 | `9a593de37e388758600e878de134557dcb8fd7f4` | `plugins/hwpx-bridge/vendor/filee/` |
| kordoc | 4.24.62 | `13a2c31754ff2fd2b4e6ae10de49edd8db31849a` | `plugins/hwpx-bridge/vendor/kordoc/` |

소스·템플릿·테스트·라이선스가 포함됩니다. `runtime/source-lock.json`에 원본 주소, 커밋, 원본 ZIP 해시, 포함한 모든 파일의 SHA-256을 기록합니다. 원본 `.gitignore`와 `.gitattributes`는 내용 그대로 `.upstream` 접미사를 붙였습니다. 상위 저장소에 올릴 때 필요한 소스가 무시되거나 Windows 체크아웃으로 줄바꿈이 바뀌는 것을 방지하기 위한 파일명 변경입니다. 변경 경로도 잠금 파일에 기록합니다.

Filee의 변환 소스는 수정하지 않습니다. 빌드용 복사본의 `Filee.Cli.csproj`에서 출력 이름 `filee-cli`만 `hwpx-converter`로 바꿉니다. CLI의 입력 처리·변환 경로·문서 모델·출력기는 그대로 컴파일합니다. GUI 프로젝트는 빌드하지 않습니다.

kordoc의 별도 MCP 서버를 시작하거나 도구 호출을 전달하지 않습니다. `server/kordoc-entry.ts`가 원본 도구 등록 함수를 가져오고, esbuild가 필요한 소스를 `npm/dist/kordoc-engine.mjs`로 묶습니다. `server/index.mjs`가 이 모듈을 같은 MCP 서버에 등록합니다. npm으로 `kordoc` 배포 패키지를 받지 않습니다.

## 자동 빌드·설치

1. Windows PowerShell 초기 MCP가 `hwpx_setup`을 제공합니다. 시스템 Node나 .NET SDK는 필요하지 않습니다.
2. 고정 Node ZIP을 검증하고 전용 폴더에 풉니다. `npm ci --ignore-scripts`로 고정 라이브러리와 esbuild를 설치합니다.
3. 포함된 두 소스의 파일 목록과 해시를 검사합니다. 누락·변조가 있으면 중단합니다.
4. Microsoft .NET SDK 10.0.403 ZIP의 SHA-512를 검증해 사용자 전용 도구 폴더에 풉니다. 시스템 PATH·SDK 설치·레지스트리 등록은 하지 않습니다.
5. 별도 임시 빌드 폴더에서 `dotnet restore --locked-mode`, `dotnet publish --self-contained true`를 실행합니다. `.NET 10.0.14`로 고정해 비교 대상 Filee 배포물과 실행 환경을 맞춥니다.
6. kordoc 소스 모듈을 번들링하고 기본 템플릿·고지를 복사합니다.
7. Filee가 사용하던 rhwp 보조 엔진과 로컬 C++ 실행 라이브러리, Tesseract와 언어 데이터 4개, kordoc OCR·수식 자산 10개를 준비합니다. 7-Zip MSI는 CAB만 추출하며 설치 작업은 실행하지 않습니다.
8. 실행 파일·네이티브 모듈·모델을 확인하고 `build-receipt.json`, `ready.json`을 씁니다. 실패 시 원본 Filee/kordoc 배포물로 조용히 대체하지 않습니다.

`runtime/nuget-locks/`는 Filee의 직접·간접 NuGet 의존성을 고정합니다. npm 라이브러리는 `runtime/package-lock.json`에서 무결성을 확인합니다. .NET SDK와 NuGet/npm 캐시는 빌드 재현을 위해 설치 홈에 남으며, 오프라인 실행용 내보내기에는 SDK·빌드 캐시가 포함되지 않습니다.

소스/빌드 설정이 바뀌면 설치 정의 지문이 바뀌어 이전 완료 마커를 그대로 사용하지 않습니다. 라이선스 고지를 포함한 원본 스냅샷을 유지하고, 소스 변경은 잠금 파일 갱신과 검증을 함께 진행해야 합니다.

## 결과 보존 검증

`tests/download-reference.mjs`는 **시험 목적으로만** 공식 Filee 2.4.0 배포물을 별도 폴더에 받습니다. 이 경로는 설치기의 실행 경로와 분리됩니다.

`tests/integration.mjs`와 `tests/equivalence.mjs`는 `HWPX_BRIDGE_REFERENCE_FILEE`로 지정한 원본 실행 파일과 통합 엔진의 DOCX 변환을 비교합니다. ZIP 컨테이너 시각 정보 대신 HWPX 안의 XML·그림 등 모든 파일의 바이트 해시를 대조합니다. 같은 코드라는 이유만으로 결과 동일성을 가정하지 않습니다.

통합 검사는 작성·읽기·렌더·OCR·오류 처리도 포함합니다. 더 복잡한 실제 문서 전체의 완벽한 변환이나 모든 OCR 문자의 정확성을 보장하는 검사는 아닙니다. 실제 검사 결과와 한계는 [VALIDATION.md](VALIDATION.md)를 참고하세요.

## 오프라인 사용

온라인 PC에서 최초 빌드가 끝난 후 `Export-Offline.ps1`로 내보냅니다. 소스가 포함된 마켓플레이스와 빌드 완료한 엔진·실행 환경·OCR 모델을 함께 복사합니다. 수신 PC의 `Import-Offline.ps1`은 모든 파일을 해시 검증하고 설치하므로 재다운로드·재빌드·개발 도구 설치가 필요하지 않습니다.

이 경로는 **빌드 완료본의 오프라인 설치·실행**을 지원합니다. 아무 의존성 캐시도 없는 폐쇄망 PC에서 소스만으로 처음부터 빌드하는 패키지는 아닙니다. Codex/Claude 자체 모델의 인터넷 연결 여부는 문서 엔진의 오프라인 동작과 별개입니다.
