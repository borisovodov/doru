---
source-hash: 85c6a6b9acc6
---

# 테마

인터페이스는 전적으로 CSS 사용자 지정 속성으로 스타일링되며, 앱 수준에서 적용됩니다——프로젝트별로 적용되지 않습니다.

- **내장 테마** — `doru`. 앱의 `themes/` 디렉터리에 있는 단일 JSON 팔레트 파일입니다. 테마당 파일 하나, CSS 없음. 파일에는 `dark`와 `light` 팔레트가 모두 들어 있으며, 운영 체제 외관이 어느 것을 적용할지 결정합니다——OS를 라이트 모드로 전환하면 Dóru가 즉시 따라갑니다. 파일 이름이 테마 ID(`doru.json`)이고, 내부의 `name` 필드가 표시 이름입니다.
- `settings.json`([설정](settings.md) 참조)에서 단일 문자열로 선택하거나 앱 내 **설정** 페이지(테마 드롭다운)에서 선택합니다. 어느 쪽이든 선택은 `settings.json`에 저장됩니다.
- 활성 팔레트의 `colors`는 시작 시 `--doru-*` CSS 사용자 지정 속성으로 변환됩니다.

## 사용자 테마

`dark`와 `light` 팔레트가 포함된 `<id>.json` 파일을 앱 데이터 디렉터리 안의 `themes` 디렉터리(`settings.json`이 있는 같은 위치——[설정](settings.md) 참조)에 넣은 다음 `settings.json`에서 `"theme": "<id>"`로 선택하세요. 파일을 추가한 후에는 앱을 다시 시작해야 인식됩니다. 디렉터리는 첫 실행 시 생성됩니다. ID가 번들 테마와 일치하는 사용자 테마는 번들 테마를 덮어씁니다. 형식이 잘못되었거나 스키마와 일치하지 않는 테마 파일은 건너뛰고(경고가 기록됨), 없는 파일과 마찬가지로 테마 목록에 나타나지 않습니다. 번들 테마에는 `$schema` 참조(`https://doru.family/theme.json`)가 있습니다——JSON Schema를 이해하는 편집기에서 자동 완성과 유효성 검사를 받으려면 같은 줄을 자신의 파일에 추가하세요.

번들 테마. 각각 다크와 라이트 팔레트가 있습니다:

| 테마 ID | 표시 이름 |
|---|---|
| `doru`(기본값) | Dóru |
| `one-dark` | One Dark |
| `github` | GitHub |
| `solarized` | Solarized |
| `gruvbox` | Gruvbox |
| `catppuccin` | Catppuccin |
| `ayu` | Ayu |
| `rose-pine` | Rosé Pine |
| `everforest` | Everforest |

기본 Dóru 팔레트는 앱 아이콘을 따릅니다: 깊은 포레스트 그린과 따뜻한 종이 색조입니다. 다크 팔레트는 검은색에 가까운 녹색빛 캔버스에서 더 밝은 크롬과 팝오버로 표면을 겹칩니다. 라이트 팔레트는 따뜻한 종이와 크림색을 사용합니다.

사용 가능한 변수:

| 변수 | 의미 |
|---|---|
| `--doru-bg-canvas` | 편집기 배경과 탭 스트립 |
| `--doru-bg-chrome` | 활동 표시줄, 사이드바, 플로팅 패널 표면 |
| `--doru-bg-raised` | 카드, 칩, 채팅 입력란 |
| `--doru-bg-popover` | 메뉴와 선택기 |
| `--doru-bg-input` | 버튼, 입력란, 선택 상자 |
| `--doru-fg` / `--doru-fg-muted` / `--doru-fg-faint` | 기본, 흐린, 희미한 텍스트 |
| `--doru-border` / `--doru-border-strong` | 가는 선과 더 강한 테두리 |
| `--doru-accent` / `--doru-accent-hover` / `--doru-accent-active` | 강조 색(포레스트/세이지 그린) |
| `--doru-on-accent` | 강조 배경 위의 텍스트 |
| `--doru-accent-alpha` | 반투명 강조 색(칩, 채팅 말풍선) |
| `--doru-focus` | 포커스 링 색 |
| `--doru-overlay-hover` / `--doru-overlay-pressed` | 호버/눌림 오버레이 |
| `--doru-success` / `--doru-warning` / `--doru-danger` / `--doru-info` | 상태 색 |
| `--doru-radius-sm` / `--doru-radius-md` / `--doru-radius-lg` | 4 / 6 / 8 px 모서리 반경 |
| `--doru-control-height` | 컨트롤 높이(28px) |
| `--doru-panel-gutter` | 플로팅 패널과 창 가장자리 사이의 간격(4px) |
| `--doru-panel-radius` | 플로팅 패널 모서리 반경(8px) |
