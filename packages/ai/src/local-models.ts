// The "Dóru AI" offline model manifest. One curated product for now: a
// single GGUF file with a pinned SHA-256, refreshed with app releases like
// the models.dev catalog snapshot. The user never sees model names — the
// product is "Dóru AI"; the details below are developer-facing and surface
// in docs and notices. The choice is gated by the eval suite in scripts/
// (Qwen3.5-4B Q4_K_M, non-thinking mode, see docs/decisions.md).
import type { ModelDownloadErrorCode } from './model-download';

/** Download failure codes; the UI localizes them ('network' = anything else). */
export type DoruModelError = ModelDownloadErrorCode | 'network';

/** The UI-facing state of the offline model (installed / downloading / error). */
export interface DoruModelState {
  installed: boolean;
  downloading: boolean;
  /**
   * A model file exists but does not match the current manifest — an older
   * release's model that keeps working offline until the user updates it.
   */
  outdated: boolean;
  /** Bytes downloaded so far (present while downloading). */
  bytes?: number;
  totalBytes: number;
  /** Machine-readable error code; the UI picks the localized message. */
  error?: DoruModelError;
  /** Machine RAM in GB (rounded); the UI compares it with minRamGb. */
  ramGb: number;
  minRamGb: number;
  /** Weights license, shown before the download starts. */
  license: string;
  licenseUrl: string;
}

export interface DoruAiModelEntry {
  /** Machine id of the product (stable; settings and IPC key on it). */
  id: string;
  /** Developer-facing model description (docs/notices, not UI). */
  description: string;
  /** Hugging Face repository holding the file. */
  repo: string;
  /** File name inside the repository. */
  file: string;
  /** Expected size in bytes (checked before the download and after it). */
  sizeBytes: number;
  /** SHA-256 of the file; verified after download, pinned in this manifest. */
  sha256: string;
  /** Weights license, shown in the download UI before starting. */
  license: string;
  /** Link to the model card carrying the license text. */
  licenseUrl: string;
  /** Machines with less RAM than this (GB) are told the model will not fit. */
  minRamGb: number;
  /** The llama.cpp engine build the file was verified against. */
  engineBuild: string;
}

export const DORU_AI_MODEL: DoruAiModelEntry = {
  id: 'doru-ai',
  description: 'Qwen3.5-4B instruct, Q4_K_M GGUF, non-thinking mode',
  repo: 'bartowski/Qwen_Qwen3.5-4B-GGUF',
  file: 'Qwen_Qwen3.5-4B-Q4_K_M.gguf',
  sizeBytes: 3013027808,
  sha256: '13c16f426047e2de38cd075bdade4a7bcbc8c774384876f677740cda65f8a983',
  license: 'Apache-2.0',
  licenseUrl: 'https://huggingface.co/Qwen/Qwen3.5-4B',
  minRamGb: 8,
  engineBuild: 'b11960',
};

/** The Hugging Face download URL for the pinned file. */
export function doruAiDownloadUrl(entry: DoruAiModelEntry): string {
  return `https://huggingface.co/${entry.repo}/resolve/main/${entry.file}`;
}
