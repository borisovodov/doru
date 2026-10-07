export type ToolPermission = 'ask' | 'allow' | 'deny';

export interface PermissionPolicy {
  default: ToolPermission;
  overrides: Record<string, ToolPermission>;
}

export const DEFAULT_PERMISSION_POLICY: PermissionPolicy = {
  default: 'ask',
  overrides: {
    'tree.query': 'allow',
    'charts.render': 'allow',
  },
};

export function toolPermission(policy: PermissionPolicy, tool: string): ToolPermission {
  return policy.overrides[tool] ?? policy.default;
}
