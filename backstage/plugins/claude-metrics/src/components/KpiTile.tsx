import { Card, CardBody, Text } from '@backstage/ui';

export function KpiTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card data-testid="kpi">
      <CardBody>
        <Text as="div" variant="body-small" color="secondary">
          {label}
        </Text>
        <Text
          as="div"
          variant="title-small"
          weight="bold"
          style={{ fontVariantNumeric: 'tabular-nums', marginTop: 4 }}
          data-testid="kpi-value"
        >
          {value}
        </Text>
        {hint && (
          <Text
            as="div"
            variant="body-x-small"
            color="secondary"
            style={{ marginTop: 4 }}
          >
            {hint}
          </Text>
        )}
      </CardBody>
    </Card>
  );
}
