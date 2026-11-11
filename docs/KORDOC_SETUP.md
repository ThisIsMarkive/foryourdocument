# kordoc 설치 코드와 적용 범위

2026-11-11에 GitHub main(4.24.63)의 실제 파일을 확인했다. 이 제품에 포함된 문서 엔진 소스는 기존 4.24.62를 유지한다.

| 원본 | 실제 동작 | HWPX Bridge 적용 |
| --- | --- | --- |
| [marketplace.json](https://github.com/chrisryugj/kordoc/blob/main/.claude-plugin/marketplace.json) | `plugins/kordoc` 스킬 패키지 배포 | 기존 GitHub 마켓플레이스로 스킬 배포 유지 |
| [플러그인 폴더](https://github.com/chrisryugj/kordoc/tree/main/plugins/kordoc) | manifest와 skills가 있으며 `.mcp.json`은 없음 | 마켓플레이스 스킬이 보이는 것을 MCP 등록 성공으로 판단하지 않음 |
| [SKILL.md](https://github.com/chrisryugj/kordoc/blob/main/plugins/kordoc/skills/kordoc/SKILL.md) | 에이전트가 `npx -y kordoc@버전 <command>` 실행. MCP는 사용자가 별도 `setup` 실행 | Windows MCP가 없을 때 독립 설치기로 연결. Linux VM에서 Windows 엔진 실행을 시도하지 않음 |
| [src/setup.ts](https://github.com/chrisryugj/kordoc/blob/main/src/setup.ts) | 클라이언트 선택 → 기존 JSON 읽기 → MCP 항목 추가. Codex는 `codex mcp add` | 같은 흐름의 `register-clients.mjs`와 `client-setup.ps1`. Node는 공통 설치기가 자동 준비 |

핵심은 MCP 서버에 연결하기 **전에** 실행할 수 있는 설정기다. 기존 `hwpx_setup` 도구는 이미 연결된 MCP를 전제로 했으므로, 서버가 등록되지 않은 상태를 해결할 수 없었다.

공통 설치기는 사용자마다 설정 경로를 계산한다. Claude의 일반 설치는 APPDATA/Claude, Microsoft Store 설치는 LOCALAPPDATA/Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/Claude를 사용한다. 원본 kordoc의 일반 경로에 Store 경로 감지와 백업을 보강했다. 다른 MCP와 사용자 설정을 보존하며 이 설치기가 관리하는 동일 서버만 업데이트한다.

설치 원본은 버전·전체 파일 해시별 경로에 보관한다. 임시 다운로드나 마켓플레이스 캐시가 없어져도 등록된 실행 경로를 유지한다. 최초 등록 자체에는 사전 Node 설치가 필요 없다. 이후 같은 설치기가 원래의 소스 빌드 및 OCR 설정을 실행한다.

## 배포와 검증의 경계

- 모든 PC에서 동일한 공개 설치기를 사용할 수 있다. 사용자 이름이나 이 개발 PC의 경로를 배포 설정에 넣지 않는다.
- PC마다 최초 설정 실행은 필요하다. 이는 kordoc MCP의 setup 흐름과 같으며, **마켓플레이스 추가만으로 모든 Claude Windows 통합 대화에서 자동 연결된다는 주장과는 다르다.**
- 이 설치기는 `.mcpb` 확장을 필수로 요구하지 않는다. 기존 `.mcpb` 배포는 유지한다.
- Codex의 마켓플레이스 MCP가 이미 작동한다면 별도 Codex 등록을 하지 않는다. 독립 등록 경로를 선택한 경우에는 공식 CLI를 사용한다.
- 자동 테스트는 가상 사용자 경로의 설정, 실제 Codex CLI, 생성된 설정으로 실행한 MCP 프로토콜을 검사한다. 실제 Claude 앱의 도구 표시와 대화에서 호출하는 검증은 별도이며, 설정 저장 성공만으로 앱 연결 성공이라고 표시하지 않는다.
- 오프라인 번들을 가져온 뒤 그 안의 `marketplace/Install-HwpxBridge.ps1 -Offline -BridgeHome <설치 경로>`로 등록할 수 있다. 이 경우 모델 다운로드와 재빌드는 하지 않는다.
