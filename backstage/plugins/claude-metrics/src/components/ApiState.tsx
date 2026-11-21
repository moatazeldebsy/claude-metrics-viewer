import { ResponseError } from '@backstage/errors';
import { Alert, Flex, Skeleton } from '@backstage/ui';
import type { ReactNode } from 'react';

export interface AsyncState<T> {
  loading: boolean;
  error?: Error;
  value?: T;
}

/** The backend's own message (e.g. "from must be on or before to") rather than "Request failed with 400". */
export const errorMessage = (e: Error) =>
  e instanceof ResponseError ? e.body.error.message || e.message : e.message;

/** Loading skeleton, error alert, or the content for a loaded value. */
export function ApiState<T>({
  state,
  children,
}: {
  state: AsyncState<T>;
  children: (value: T) => ReactNode;
}) {
  if (state.error) {
    return (
      <Alert
        status="danger"
        icon
        title="Could not load data"
        description={errorMessage(state.error)}
      />
    );
  }
  if (state.loading || state.value === undefined) {
    return (
      <Flex direction="column" gap="3" role="progressbar" aria-label="Loading">
        <Skeleton width="100%" height={96} />
        <Skeleton width="100%" height={280} />
      </Flex>
    );
  }
  return <>{children(state.value)}</>;
}
