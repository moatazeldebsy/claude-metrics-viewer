import { Card, CardBody, CardHeader, Text } from '@backstage/ui';

/** Explains why a tab has nothing to show for the current data source. */
export const NotAvailable = ({
  title,
  reason,
}: {
  title: string;
  reason: string;
}) => (
  <Card data-testid="not-available">
    <CardHeader>
      <Text as="h3" variant="title-x-small" weight="bold">
        {title}
      </Text>
    </CardHeader>
    <CardBody>
      <Text as="p" variant="body-medium" color="secondary">
        {reason}
      </Text>
    </CardBody>
  </Card>
);
