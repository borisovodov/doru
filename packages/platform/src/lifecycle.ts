import { createServiceId } from './di';

export const ILifecycleService = createServiceId<ILifecycleService>('lifecycle');

export interface ILifecycleService {
  readonly phase: 'starting' | 'running' | 'stopped';
  start(): Promise<void>;
  stop(): Promise<void>;
}
