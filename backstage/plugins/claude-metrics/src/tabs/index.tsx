import type { FC } from 'react';
import type { Route } from '../api';
import { ApiState } from '../components/ApiState';
import { useDashboard } from '../hooks/useDashboard';
import { CommitsTab } from './CommitsTab';
import { EnvironmentsTab } from './EnvironmentsTab';
import { ModelsTab } from './ModelsTab';
import { OverviewTab } from './OverviewTab';
import { ToolsTab } from './ToolsTab';

// Placeholder tab: loads its route and shows the loading/error state (real tabs land next).
const placeholder =
  (route: Route): FC =>
  () =>
    <ApiState state={useDashboard(route)}>{() => null}</ApiState>;

export const TABS: { id: string; label: string; Component: FC }[] = [
  { id: 'overview', label: 'Overview', Component: OverviewTab },
  {
    id: 'departments',
    label: 'Departments',
    Component: placeholder('departments'),
  },
  { id: 'tools', label: 'Tool acceptance', Component: ToolsTab },
  { id: 'environments', label: 'Environments', Component: EnvironmentsTab },
  { id: 'commits', label: 'Commits & PRs', Component: CommitsTab },
  { id: 'models', label: 'Models', Component: ModelsTab },
  { id: 'cost', label: 'Cost & usage', Component: placeholder('cost') },
  { id: 'users', label: 'Users', Component: placeholder('users') },
  { id: 'seats', label: 'Seats', Component: placeholder('seats') },
  { id: 'api', label: 'API response', Component: placeholder('raw') },
];
