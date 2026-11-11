# 클라이언트 호환성

이 프로젝트는 Windows x64에서 실행하는 stdio MCP 서버입니다. 외부에 포트를 열거나 HTTP 서버를 운영하지 않습니다.

- Codex: 표준 `plugin.json`/`mcp.json` 및 `.agents/plugins/marketplace.json`을 사용합니다. `.codex-plugin/plugin.json`도 포함합니다. 실제 Codex CLI에서 격리된 설정으로 마켓플레이스 추가·플러그인 설치·MCP 명령 경로 해석을 확인했습니다.
- Claude Code: `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, `.mcp.json`을 사용합니다. Windows 네이티브 Claude Code에서 사용하는 구조입니다.
- Claude Desktop: Git 마켓플레이스의 로컬 MCP 지원 여부는 앱 화면/정책/실행 위치에 따릅니다. 별도 `.mcpb`를 제공하여 Windows 호스트에서 같은 서버를 실행할 수 있게 합니다. 사용자 클라이언트의 로컬 도구 실행 허용은 필요합니다.
- WSL/Linux Cowork VM 안에서 Windows용 `powershell.exe`와 네이티브 엔진을 직접 실행하는 것은 지원하지 않습니다. 데스크톱 확장으로 Windows 호스트에 연결하세요.

Claude의 일반 플러그인 문서는 로컬 MCP를 Cowork/Claude Code에서 지원한다고 설명하고, 통합 경험 문서는 단계적 계정 배포를 설명합니다. 따라서 “모든 Claude 화면에서 GitHub 주소만 넣으면 반드시 같은 방식으로 작동한다”고 보장하지 않습니다. 설치 후 `hwpx_setup_status` 또는 `hwpx_runtime_status`가 실제로 보이는지 확인하세요.

자료:

- [OpenAI 플러그인 패키지 및 마켓플레이스](https://developers.openai.com/plugins/build/plugins)
- [Claude 플러그인 매니페스트](https://code.claude.com/docs/en/plugins-reference)
- [Claude 마켓플레이스](https://code.claude.com/docs/en/plugin-marketplaces)
- [Claude에서 플러그인 사용](https://support.claude.com/en/articles/13837440-use-plugins-in-claude)
- [Claude 통합 경험](https://support.claude.com/en/articles/16761823-claude-cowork-and-chat-are-one-claude)
- [Claude Desktop 로컬 MCP](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
- [MCPB 규격](https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md)
