import type { FC } from 'react';
import { CommitsTab } from './CommitsTab';
import { CostTab } from './CostTab';
import { DepartmentsTab } from './DepartmentsTab';
import { EnvironmentsTab } from './EnvironmentsTab';
import { ModelsTab } from './ModelsTab';
import { OverviewTab } from './OverviewTab';
import { RawTab } from './RawTab';
import { SeatsTab } from './SeatsTab';
import { ToolsTab } from './ToolsTab';
import { UsersTab } from './UsersTab';

export const TABS: { id: string; label: string; Component: FC }[] = [
  { id: 'overview', label: 'Overview', Component: OverviewTab },
  { id: 'departments', label: 'Departments', Component: DepartmentsTab },
  { id: 'tools', label: 'Tool acceptance', Component: ToolsTab },
  { id: 'environments', label: 'Environments', Component: EnvironmentsTab },
  { id: 'commits', label: 'Commits & PRs', Component: CommitsTab },
  { id: 'models', label: 'Models', Component: ModelsTab },
  { id: 'cost', label: 'Cost & usage', Component: CostTab },
  { id: 'users', label: 'Users', Component: UsersTab },
  { id: 'seats', label: 'Seats', Component: SeatsTab },
  { id: 'api', label: 'API response', Component: RawTab },
];
