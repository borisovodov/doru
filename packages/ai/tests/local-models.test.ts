import { describe, expect, it } from 'vitest';
import { DORU_AI_MODEL, doruAiDownloadUrl } from '../src/local-models';

describe('local model registry', () => {
  it('ships the pinned Dóru AI model entry', () => {
    expect(DORU_AI_MODEL.id).toBe('doru-ai');
    expect(DORU_AI_MODEL.file).toMatch(/\.gguf$/);
    expect(DORU_AI_MODEL.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(DORU_AI_MODEL.minRamGb).toBeGreaterThan(0);
  });

  it('builds the Hugging Face download URL', () => {
    expect(doruAiDownloadUrl(DORU_AI_MODEL)).toBe(
      `https://huggingface.co/${DORU_AI_MODEL.repo}/resolve/main/${DORU_AI_MODEL.file}`,
    );
  });
});
