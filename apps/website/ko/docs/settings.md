---
source-hash: ecff58fa2a2c
---

# 설정

전역 설정은 앱의 데이터 디렉터리에 있는 `settings.json`에 저장됩니다:

| OS | 경로 |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**기본값은 앱에 있으며, 파일에는 명시적인 재정의만 기록됩니다.** 첫 실행 시 앱은 `$schema` 참조만 포함된 파일을 만듭니다——나머지는 모두 내장 기본값으로 대체되므로 새로운 기본값은 앱 업데이트와 함께 기존 사용자에게 적용됩니다. `$schema` 참조가 유일한 문서 소스입니다: JSON Schema를 지원하는 편집기(VS Code, Zed, JetBrains)는 여기서 자동 완성, 유효성 검사, 필드 설명을 제공합니다. 앱이 파일에 항목을 쓰는 것은 **설정**에서 항목을 변경할 때뿐이며, 나머지는 그대로 유지됩니다. 파일은 주석을 허용하는 일반 JSON이므로 아무 편집기로나 편집할 수 있고, 변경 사항은 앱이 실행되는 동안 실시간으로 반영됩니다. 앱은 로드 시 파일을 스키마에 대해 검증합니다. 구문 분석이 안 되거나 스키마와 일치하지 않으면 빈 템플릿으로 대체됩니다(경고가 기록됩니다). AI 제공자는 이 파일의 `ai` 섹션에서 구성합니다——[AI와 에이전트](agents.md)를 참조하세요.

전체 참조:

```jsonc
{
  "$schema": "https://doru.family/settings.json",

  // AI providers — set from Settings (gear icon) or here directly.
  "ai": {
    // The active provider: ollama | lmstudio | custom | acp
    // (cloud presets return one by one).
    "provider": "ollama",

    // Per-provider settings, keyed by provider id. Only the entry of the
    // active provider is used; the others keep their values and are
    // restored when you switch back.
    "providers": {
      "ollama": {
        "baseUrl": "", // optional override of the provider's default endpoint
        "model": ""
      }
      // For "acp" only: the agent binary to spawn. Add a comma after the
      // "ollama" object above when you enable it.
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // Theme: one palette file with a dark and a light section. The OS
  // appearance decides which palette applies.
  "theme": "doru"
}
```

## 로그

앱은 진단 정보를 데이터 디렉터리(`settings.json` 옆)의 `doru.log`에 추가합니다. 파일은 5 MB에서 순환하며 이전 파일은 `doru.old.log`로 유지됩니다. 기본 상세 수준은 `warn`이며(개발 빌드는 `debug`로 기록), `DORU_LOG_LEVEL=trace|debug|info|warn|error`로 재정의할 수 있습니다. 스키마 유효성 검사 경고(스키마와 일치하지 않는 설정 또는 테마 파일)가 여기에 기록됩니다. 설정의 **로그 파일 열기** 버튼은 아직 기록된 내용이 없으면 필요할 때 파일을 만듭니다.
