import { app } from 'electron';
import { LocalizationService } from '@doru/platform';

/**
 * Main-process localization: the UI locale follows the operating system
 * (see docs/decisions.md). Chat and settings error texts are produced here
 * so the renderer receives ready-to-display strings.
 */
export const nls = new LocalizationService(app.getLocale());
