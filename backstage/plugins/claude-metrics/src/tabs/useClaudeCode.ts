import { useDashboard } from '../hooks/useDashboard';
import type { ClaudeCodeSummary, UserRow } from '@moatazeldebsy/claude-metrics-lib';

export type ClaudeCodeResponse = Omit<ClaudeCodeSummary, 'users'> & {
  topContributors: UserRow[];
};

export const useClaudeCode = () =>
  useDashboard<ClaudeCodeResponse>('claude-code');
