import { LocalizationService } from '@doru/platform';

const detected =
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ru')
    ? 'ru'
    : 'en';

export const nls = new LocalizationService(detected);
