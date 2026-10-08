<script setup lang="ts">
import { watch } from 'vue';
import { useData } from 'vitepress';

const { lang } = useData();

watch(
  lang,
  (value) => {
    try {
      localStorage.setItem('doru-lang', value === 'en-US' ? 'en' : value);
    } catch {
      /* localStorage unavailable — skip */
    }
  },
  { immediate: true },
);
</script>

<template>
  <div />
</template>
