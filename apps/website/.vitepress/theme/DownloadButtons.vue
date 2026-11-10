<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useData } from 'vitepress';

const { lang } = useData();

// The hero button names the visitor's operating system and jumps straight to
// the matching section of the installation guide. The OS is detected in the
// browser, so the server-rendered fallback ("Install Dóru") renders first and
// is replaced after mount — no hydration mismatch.
type Os = 'mac' | 'linux' | 'windows';

const ANCHORS: Record<Os, string> = {
  mac: 'macos',
  linux: 'linux',
  windows: 'windows-experimental',
};

const LABELS: Record<Os, Record<string, string>> = {
  mac: {
    'en-US': 'Install on macOS',
    ru: 'Установить на macOS',
    fr: 'Installer sur macOS',
    de: 'Auf macOS installieren',
    it: 'Installa su macOS',
    es: 'Instalar en macOS',
    'pt-br': 'Instalar no macOS',
    cs: 'Nainstalovat na macOS',
    pl: 'Zainstaluj na macOS',
    hu: 'Telepítés macOS-re',
    bg: 'Инсталиране на macOS',
    el: 'Εγκατάσταση σε macOS',
    tr: "macOS'a yükle",
    ja: 'macOSにインストール',
    ko: 'macOS에 설치',
    'zh-cn': '在 macOS 上安装',
    'zh-tw': '在 macOS 上安裝',
  },
  linux: {
    'en-US': 'Install on Linux',
    ru: 'Установить на Linux',
    fr: 'Installer sur Linux',
    de: 'Auf Linux installieren',
    it: 'Installa su Linux',
    es: 'Instalar en Linux',
    'pt-br': 'Instalar no Linux',
    cs: 'Nainstalovat na Linux',
    pl: 'Zainstaluj na Linuksie',
    hu: 'Telepítés Linuxra',
    bg: 'Инсталиране на Linux',
    el: 'Εγκατάσταση σε Linux',
    tr: "Linux'a yükle",
    ja: 'Linuxにインストール',
    ko: 'Linux에 설치',
    'zh-cn': '在 Linux 上安装',
    'zh-tw': '在 Linux 上安裝',
  },
  windows: {
    'en-US': 'Install on Windows',
    ru: 'Установить на Windows',
    fr: 'Installer sur Windows',
    de: 'Auf Windows installieren',
    it: 'Installa su Windows',
    es: 'Instalar en Windows',
    'pt-br': 'Instalar no Windows',
    cs: 'Nainstalovat na Windows',
    pl: 'Zainstaluj na Windows',
    hu: 'Telepítés Windowsra',
    bg: 'Инсталиране на Windows',
    el: 'Εγκατάσταση σε Windows',
    tr: "Windows'a yükle",
    ja: 'Windowsにインストール',
    ko: 'Windows에 설치',
    'zh-cn': '在 Windows 上安装',
    'zh-tw': '在 Windows 上安裝',
  },
};

// Shown when the OS cannot be detected (e.g. crawlers, odd user agents).
const FALLBACK: Record<string, string> = {
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

const os = ref<Os | null>(null);

onMounted(() => {
  os.value = detectOS();
});

function detectOS(): Os | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  // Phones and Chromebooks report Android/Linux strings; they get the
  // generic fallback — Dóru is a desktop app.
  if (/Android|iPhone|iPad|iPod|CrOS/.test(ua)) return null;
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  if (/Linux/.test(ua)) return 'linux';
  return null;
}

function label(): string {
  const table = os.value ? LABELS[os.value] : null;
  return (table && table[lang.value]) ?? FALLBACK[lang.value] ?? FALLBACK['en-US']!;
}

function href(): string {
  return os.value ? `/docs/installation#${ANCHORS[os.value]}` : '/docs/installation';
}
</script>

<template>
  <div class="doru-download">
    <a class="doru-button brand" :href="href()">{{ label() }}</a>
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
