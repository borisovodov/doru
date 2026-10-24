<script setup lang="ts">
import { useData } from 'vitepress';

const { lang } = useData();

// Dóru is distributed through the app stores and package managers, so the
// hero button points at the installation guide instead of direct downloads.
const LABELS: Record<string, string> = {
  'en-US': 'Install Dóru',
  ru: 'Установить Dóru',
  fr: 'Installer Dóru',
  de: 'Dóru installieren',
  it: 'Installa Dóru',
  es: 'Instalar Dóru',
  'pt-br': 'Instalar o Dóru',
  cs: 'Nainstalovat Dóru',
  pl: 'Zainstaluj Dóru',
  hu: 'Dóru telepítése',
  bg: 'Инсталирайте Dóru',
  el: 'Εγκατάσταση Dóru',
  tr: 'Dóru yükle',
  ja: 'Dóru をインストール',
  ko: 'Dóru 설치',
  'zh-cn': '安装 Dóru',
  'zh-tw': '安裝 Dóru',
};

function label(): string {
  return LABELS[lang.value] ?? LABELS['en-US']!;
}
</script>

<template>
  <div class="doru-download">
    <a class="doru-button brand" href="/docs/installation">{{ label() }}</a>
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
</style>
