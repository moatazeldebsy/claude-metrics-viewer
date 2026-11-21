import type { FC } from 'react';
import type { Route } from '../api';
import { ApiState } from '../components/ApiState';
import { useDashboard } from '../hooks/useDashboard';

// Placeholder tab: loads its route and shows the loading/error state (real tabs land next).
const placeholder =
  (route: Route): FC =>
  () =>
    <ApiState state={useDashboard(route)}>{() => null}</ApiState>;

export const TABS: { id: string; label: string; Component: FC }[] = [
  { id: 'overview', label: 'Overview', Component: placeholder('claude-code') },
  {
    id: 'departments',
    label: 'Departments',
    Component: placeholder('departments'),
  },
  {
    id: 'tools',
    label: 'Tool acceptance',
    Component: placeholder('claude-code'),
  },
  {
    id: 'environments',
    label: 'Environments',
    Component: placeholder('claude-code'),
  },
  {
    id: 'commits',
    label: 'Commits & PRs',
    Component: placeholder('claude-code'),
  },
  { id: 'models', label: 'Models', Component: placeholder('claude-code') },
  { id: 'cost', label: 'Cost & usage', Component: placeholder('cost') },
  { id: 'users', label: 'Users', Component: placeholder('users') },
  { id: 'seats', label: 'Seats', Component: placeholder('seats') },
  { id: 'api', label: 'API response', Component: placeholder('raw') },
];
