import { Card, CardBody, CardHeader, Text } from '@backstage/ui';
import type { ReactNode } from 'react';

export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <Text as="h3" variant="title-x-small" weight="bold">
          {title}
        </Text>
        {subtitle && (
          <Text as="div" variant="body-small" color="secondary">
            {subtitle}
          </Text>
        )}
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}
