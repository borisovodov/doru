import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: '한국어',
  lang: 'ko',
  description:
    '가계도를 위한 데스크톱 앱. 가계도는 디스크의 평범한 폴더에 살아 있고, 완전히 오프라인으로 작동하며, 내장 채팅이나 모든 MCP/ACP 클라이언트를 통해 AI 에이전트가 조작합니다.',
  footer: '이름은 인도유럽조어 <em>*dóru</em> — “나무”에서 유래했습니다.',
  nav: {
    docs: '문서',
    releases: '릴리스 노트',
  },
  sidebar: {
    intro: '소개',
    getStarted: '시작하기',
    installation: '설치 및 업데이트',
    quickStart: '빠른 시작',
    guide: '가이드',
    tree: '가계도 작업',
    shortcuts: '키보드 단축키',
    settings: '설정',
    agents: 'AI 및 에이전트',
    themes: '테마',
    reference: '참고 자료',
    dataBackups: '데이터 및 백업',
    troubleshooting: '문제 해결',
  },
  ui: {
    outline: '이 페이지에서',
    prev: '이전 페이지',
    next: '다음 페이지',
    returnToTop: '맨 위로',
    skipToContent: '콘텐츠로 건너뛰기',
    menu: '메뉴',
    appearance: '모양',
    lightTheme: '밝은 테마로 전환',
    darkTheme: '어두운 테마로 전환',
    langMenu: '언어 변경',
    mainNavigation: '주 내비게이션',
    mobileMenu: '메뉴',
    moreOptions: '더 많은 옵션',
  },
  notFound: {
    title: '페이지를 찾을 수 없습니다',
    quote: '하지만 방향을 바꾸지 않고 계속 찾는다면, 가고 있던 곳에 도착할지도 모릅니다.',
    linkLabel: '홈으로 이동',
    linkText: '홈으로 돌아가기',
  },
  search: SEARCH_TEXT['ko'],
  markdown: {
    codeCopyButton: {
      tooltipText: '코드 복사',
      copiedText: '복사됨',
    },
  },
};

export default locale;
