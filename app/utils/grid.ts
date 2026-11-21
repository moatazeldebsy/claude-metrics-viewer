/** Column for DataGrid: a raw value (used for sorting) and an optional display formatter. */
export interface GridColumn<R> {
  key: string;
  title: string;
  value: (row: R) => string | number | null;
  format?: (v: never) => string;
  numeric?: boolean;
}
