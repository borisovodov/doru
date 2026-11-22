---
source-hash: b3dd07f80d43
---

# AI와 에이전트

## 앱 내 채팅

채팅 패널은 창 하단에 있습니다. 질문을 입력하면 에이전트가 내장 도구를 사용해 가계도를 읽고 편집할 수 있습니다: `tree_query`, `tree_get`, `tree_stats`, `tree_edit`, `tree_add_relative`, `sources_add`, `notes_write`.

대화는 **채팅 세션**으로 저장됩니다. 채팅 패널 헤더에 세션이 나열되며, 전환하거나 새 채팅을 시작하거나 삭제할 수 있습니다. 세션은 프로젝트별로 앱 데이터 디렉터리에 저장되고(`.doru` 파일 안이 아님), 제목은 첫 메시지에서 만들어지며, 모든 것이 앱을 다시 시작해도 유지됩니다. 모든 답변에는 원본 마크다운을 시스템 클립보드에 복사하는 복사 버튼이 있습니다.

제공자는 `settings.json`의 `ai` 섹션에서 구성합니다([설정](settings.md) 참조):

- **제공자 프리셋**: Ollama, LM Studio, 사용자 지정 OpenAI 호환 엔드포인트 또는 ACP 에이전트. 클라우드 프리셋은 통합이 재구축되면서 하나씩 돌아옵니다. ID를 `"provider"`에 설정하세요. 각 프리셋은 기본 URL을 제공하며, 모델은 설정 마법사에서 선택합니다——로컬 엔드포인트의 경우 제공자에서 가져오고, 클라우드 프리셋의 경우 함께 제공되는 카탈로그에서 선택합니다. 각 제공자는 자체 구성(모델, 기본 URL, 추론, 키)을 `"providers"` 아래에 유지하며, 제공자를 전환하면 각각의 저장된 설정이 복원됩니다.
- **API 키**는 앱 데이터 디렉터리의 `secrets.json`(모드 0600)에 제공자 ID를 키로 저장됩니다. 키는 설정 파일에 나타나지 않습니다.

## Dóru AI(오프라인 어시스턴트)

기본 제공자는 **Dóru AI**입니다. 완전히 여러분의 컴퓨터에서 실행되는 로컬 어시스턴트입니다. AI 설정에서 한 번 다운로드하세요(단일 파일, 약 3GB). 그 후에는 계정도 인터넷 연결도 없이 채팅이 작동합니다. 새로 설치하면 기본으로 선택되며 최소 8GB의 RAM이 필요합니다.

다운로드되는 모델은 Qwen3.5-4B(Q4_K_M 양자화 GGUF, Apache-2.0 라이선스——[모델 카드](https://huggingface.co/Qwen/Qwen3.5-4B) 참조)입니다. 가중치는 앱 매니페스트에 SHA-256으로 고정되며 다운로드할 때마다 검증됩니다.

## ACP 에이전트

Agent Client Protocol을 사용하는 에이전트(Zed 스타일 에이전트)와 대화하려면 `"ai": { "provider": "acp", "providers": { "acp": { "command": "…", "args": [] } } }`를 설정하세요. Dóru는 프로젝트를 MCP 서버로 에이전트에 전달하므로, 에이전트는 내장 채팅과 똑같이 가계도를 조회하고 편집할 수 있습니다.

## MCP 서버로서의 Dóru

모든 MCP 클라이언트——Claude Desktop, Cursor, 코딩 에이전트——가 가계도로 작업할 수 있습니다. Dóru를 서버 모드로 실행하고 `.doru` 파일을 지정하세요:

```sh
doru --mcp-server /absolute/path/to/family.doru
```

Claude Desktop 구성 예(`Claude → Settings → Developer → Edit Config`):

```json
{
  "mcpServers": {
    "doru": {
      "command": "/Applications/Doru.app/Contents/MacOS/doru",
      "args": ["--mcp-server", "/Users/you/FamilyHistory/family.doru"]
    }
  }
}
```

Linux AppImage: AppImage 파일 경로. Windows: `"command": "C:\\Program Files\\Doru\\doru.exe"`. 도구 이름은 UI 언어와 관계없이 영어로 유지됩니다.

서버는 **헤드리스이고 상태를 저장하지 않습니다**: 창도, Dock 아이콘도, 채팅 세션도 없이 가계도 파일을 직접 읽고 편집하며 클라이언트가 연결을 끊으면 종료됩니다. 여러 클라이언트가 동시에 같은 파일을 지정할 수 있으며(Claude Desktop, Cursor, 여러 코딩 에이전트), 동시 쓰기는 안전하게 대기열에 들어갑니다. 클라이언트가 서버를 시작할 수 없으면 터미널에서 명령을 실행하세요——도우미가 문제를 stderr에 기록하고 임시 프로필은 종료 시 폐기됩니다.

## 예시 프롬프트

- *"1850년 이전에 태어난 모든 사람을 찾아 출처를 나열해 줘."*
- *"1923년경에 태어난 Ivan Ivanov를 Petr와 Maria의 자녀로 추가해 줘."*
- *"Anna에 대해 1901년 인구 조사에 관한 연구 메모를 작성해 줘."*
- *"부모가 사망한 후에 태어난 사람이 있는지 가계도를 확인해 줘."*
