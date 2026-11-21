import { useDashboard } from '../hooks/useDashboard';
import type { ClaudeCodeSummary, UserRow } from '../lib';

export type ClaudeCodeResponse = Omit<ClaudeCodeSummary, 'users'> & {
  topContributors: UserRow[];
};

export const useClaudeCode = () =>
  useDashboard<ClaudeCodeResponse>('claude-code');
