<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useData } from 'vitepress';

const { lang } = useData();

const LABELS: Record<string, { download: string; platforms: string }> = {
  'en-US': { download: 'Download for', platforms: 'All platforms' },
  ru: { download: 'Скачать для', platforms: 'Все платформы' },
  fr: { download: 'Télécharger pour', platforms: 'Toutes les plateformes' },
  de: { download: 'Herunterladen für', platforms: 'Alle Plattformen' },
  it: { download: 'Scarica per', platforms: 'Tutte le piattaforme' },
  es: { download: 'Descargar para', platforms: 'Todas las plataformas' },
  'pt-br': { download: 'Baixar para', platforms: 'Todas as plataformas' },
  cs: { download: 'Stáhnout pro', platforms: 'Všechny platformy' },
  pl: { download: 'Pobierz dla', platforms: 'Wszystkie platformy' },
  hu: { download: 'Letöltés:', platforms: 'Minden platform' },
  bg: { download: 'Изтегли за', platforms: 'Всички платформи' },
  el: { download: 'Λήψη για', platforms: 'Όλες οι πλατφόρμες' },
  tr: { download: 'İndir:', platforms: 'Tüm platformlar' },
  ja: { download: 'ダウンロード:', platforms: 'すべてのプラットフォーム' },
  ko: { download: '다운로드:', platforms: '모든 플랫폼' },
  'zh-cn': { download: '下载', platforms: '所有平台' },
  'zh-tw': { download: '下載', platforms: '所有平台' },
};

const BASE = 'https://github.com/borisovodov/doru/releases/latest/download';

interface Download {
  os: string;
  url: string;
}

function detect(): Download | null {
  const ua = navigator.userAgent;
  const arm = /arm64|aarch64|\barm\b/i.test(ua);
  if (/Macintosh|Mac OS X/.test(ua)) {
    return { os: 'macOS', url: `${BASE}/doru-mac-arm64.dmg` };
  }
  if (/Windows/.test(ua)) {
    return arm
      ? { os: 'Windows (arm64)', url: `${BASE}/doru-windows-arm64.exe` }
      : { os: 'Windows', url: `${BASE}/doru-windows-x64.exe` };
  }
  if (/Linux/.test(ua) && !/Android/.test(ua)) {
    return arm
      ? { os: 'Linux (arm64)', url: `${BASE}/doru-linux-arm64.AppImage` }
      : { os: 'Linux', url: `${BASE}/doru-linux-x86_64.AppImage` };
  }
  return null;
}

const download = ref<Download | null>(null);

onMounted(() => {
  download.value = detect();
});

function label(): { download: string; platforms: string } {
  return LABELS[lang.value] ?? LABELS['en-US']!;
}
</script>

<template>
  <div class="doru-download">
    <template v-if="download">
      <a class="doru-button brand" :href="download.url">
        {{ label().download }} {{ download.os }}
      </a>
      <a class="doru-button alt" href="/docs/#installation">{{ label().platforms }}</a>
    </template>
    <a v-else class="doru-button brand" href="/docs/#installation">{{ label().platforms }}</a>
  </div>
</template>

<style scoped>
.doru-download {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
}
.doru-button {
  display: inline-block;
  border: 1px solid transparent;
  text-align: center;
  font-weight: 600;
  white-space: nowrap;
  padding: 0 20px;
  line-height: 38px;
  font-size: 14px;
  border-radius: 20px;
  text-decoration: none;
  transition: color 0.25s, border-color 0.25s, background-color 0.25s;
}
.doru-button.brand {
  border-color: var(--vp-button-brand-border);
  background-color: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
}
.doru-button.brand:hover {
  background-color: var(--vp-button-brand-hover-bg);
  color: var(--vp-button-brand-text);
}
.doru-button.alt {
  border-color: var(--vp-button-alt-border);
  background-color: var(--vp-button-alt-bg);
  color: var(--vp-button-alt-text);
}
.doru-button.alt:hover {
  border-color: var(--vp-button-alt-hover-border);
  color: var(--vp-button-alt-hover-text);
}
</style>
