import { createContext, useContext, type ReactNode } from 'react';
import type { TargetData } from '../task/taskTargets';

const TargetDirectoryContext = createContext<TargetData | undefined>(undefined);

/** Makes the whole tree available to generic target pickers. */
export function TargetDirectoryProvider({ data, children }: { data: TargetData; children: ReactNode }) {
  return <TargetDirectoryContext.Provider value={data}>{children}</TargetDirectoryContext.Provider>;
}

/** The target directory of the current editor, or undefined outside a provider. */
export function useTargetDirectory(): TargetData | undefined {
  return useContext(TargetDirectoryContext);
}
