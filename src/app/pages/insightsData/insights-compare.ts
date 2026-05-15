import { ColDef, ColGroupDef } from 'ag-grid-community';
import { EndpointDetails, InsightsSummary } from '../../services/insights.service';

export interface EndpointCompareRow {
  endpointName: string;
  totalRequestsA: number;
  totalRequestsB: number;
  successRequestsA: number;
  successRequestsB: number;
  failedRequestsA: number;
  failedRequestsB: number;
  averageDurationMsA: number;
  averageDurationMsB: number;
  maxDurationMsA: number;
  maxDurationMsB: number;
  lastCalledA: string;
  lastCalledB: string;
}

export interface SummaryCompareMetric {
  label: string;
  valueA: number;
  valueB: number;
  delta: number;
  deltaPct: number | null;
  /** When true, a decrease is shown as positive (green). */
  lowerIsBetter?: boolean;
  unit?: string;
}

export function calcDelta(a: number, b: number): { delta: number; deltaPct: number | null } {
  const delta = b - a;
  if (a === 0) {
    return { delta, deltaPct: b === 0 ? 0 : null };
  }
  return { delta, deltaPct: (delta / a) * 100 };
}

export function formatCompareDelta(delta: number, deltaPct: number | null): string {
  const sign = delta > 0 ? '+' : '';
  const abs = Math.abs(delta).toLocaleString();
  if (deltaPct == null) {
    return delta === 0 ? '0' : `${sign}${abs}`;
  }
  const pctSign = deltaPct > 0 ? '+' : '';
  return `${sign}${abs} (${pctSign}${deltaPct.toFixed(1)}%)`;
}

export function deltaTrendClass(
  delta: number,
  lowerIsBetter = false,
): 'compare-up' | 'compare-down' | 'compare-flat' {
  if (delta === 0) {
    return 'compare-flat';
  }
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return improved ? 'compare-up' : 'compare-down';
}

export function buildSummaryCompareMetrics(
  a: InsightsSummary | null,
  b: InsightsSummary | null,
): SummaryCompareMetric[] {
  const sa = a ?? emptySummary();
  const sb = b ?? emptySummary();

  const defs: {
    label: string;
    va: number;
    vb: number;
    lowerIsBetter?: boolean;
    unit?: string;
  }[] = [
    { label: 'Total requests', va: sa.totalRequests, vb: sb.totalRequests },
    { label: 'Success', va: sa.successRequests, vb: sb.successRequests },
    { label: 'Failed', va: sa.failedRequests, vb: sb.failedRequests, lowerIsBetter: true },
    {
      label: 'Avg response',
      va: sa.averageResponseMs,
      vb: sb.averageResponseMs,
      lowerIsBetter: true,
      unit: 'ms',
    },
    {
      label: 'Min response',
      va: sa.minResponseMs,
      vb: sb.minResponseMs,
      lowerIsBetter: true,
      unit: 'ms',
    },
    {
      label: 'Max response',
      va: sa.maxResponseMs,
      vb: sb.maxResponseMs,
      lowerIsBetter: true,
      unit: 'ms',
    },
  ];

  return defs.map(({ label, va, vb, lowerIsBetter, unit }) => {
    const { delta, deltaPct } = calcDelta(va, vb);
    return { label, valueA: va, valueB: vb, delta, deltaPct, lowerIsBetter, unit };
  });
}

export function mergeEndpointsForCompare(
  periodA: EndpointDetails[],
  periodB: EndpointDetails[],
): EndpointCompareRow[] {
  const map = new Map<string, EndpointCompareRow>();

  const emptySide = (): Omit<EndpointCompareRow, 'endpointName'> => ({
    totalRequestsA: 0,
    totalRequestsB: 0,
    successRequestsA: 0,
    successRequestsB: 0,
    failedRequestsA: 0,
    failedRequestsB: 0,
    averageDurationMsA: 0,
    averageDurationMsB: 0,
    maxDurationMsA: 0,
    maxDurationMsB: 0,
    lastCalledA: '',
    lastCalledB: '',
  });

  const ensure = (name: string): EndpointCompareRow => {
    let row = map.get(name);
    if (!row) {
      row = { endpointName: name, ...emptySide() };
      map.set(name, row);
    }
    return row;
  };

  for (const e of periodA) {
    const row = ensure(e.endpointName);
    row.totalRequestsA = e.totalRequests;
    row.successRequestsA = e.successRequests;
    row.failedRequestsA = e.failedRequests;
    row.averageDurationMsA = e.averageDurationMs;
    row.maxDurationMsA = e.maxDurationMs;
    row.lastCalledA = e.lastCalled;
  }

  for (const e of periodB) {
    const row = ensure(e.endpointName);
    row.totalRequestsB = e.totalRequests;
    row.successRequestsB = e.successRequests;
    row.failedRequestsB = e.failedRequests;
    row.averageDurationMsB = e.averageDurationMs;
    row.maxDurationMsB = e.maxDurationMs;
    row.lastCalledB = e.lastCalled;
  }

  return [...map.values()].sort(
    (x, y) => y.totalRequestsA + y.totalRequestsB - (x.totalRequestsA + x.totalRequestsB),
  );
}

function emptySummary(): InsightsSummary {
  return {
    totalRequests: 0,
    successRequests: 0,
    failedRequests: 0,
    averageResponseMs: 0,
    minResponseMs: 0,
    maxResponseMs: 0,
  };
}

function compareDeltaCol(
  headerName: string,
  fieldA: keyof EndpointCompareRow,
  fieldB: keyof EndpointCompareRow,
  lowerIsBetter = false,
): ColDef<EndpointCompareRow> {
  return {
    headerName,
    maxWidth: 140,
    valueGetter: (p) => {
      const a = Number(p.data?.[fieldA] ?? 0);
      const b = Number(p.data?.[fieldB] ?? 0);
      return calcDelta(a, b);
    },
    valueFormatter: (p) => {
      const v = p.value as { delta: number; deltaPct: number | null } | undefined;
      if (!v) {
        return '';
      }
      return formatCompareDelta(v.delta, v.deltaPct);
    },
    cellClassRules: {
      'compare-up': (p) => {
        const v = p.value as { delta: number } | undefined;
        return v != null && deltaTrendClass(v.delta, lowerIsBetter) === 'compare-up';
      },
      'compare-down': (p) => {
        const v = p.value as { delta: number } | undefined;
        return v != null && deltaTrendClass(v.delta, lowerIsBetter) === 'compare-down';
      },
      'compare-flat': (p) => {
        const v = p.value as { delta: number } | undefined;
        return v != null && deltaTrendClass(v.delta, lowerIsBetter) === 'compare-flat';
      },
    },
  };
}

function metricCol(
  header: string,
  field: keyof EndpointCompareRow,
): ColDef<EndpointCompareRow> {
  return {
    field,
    headerName: header,
    type: 'numericColumn',
    maxWidth: 110,
    valueFormatter: (p) => (p.value == null ? '—' : Number(p.value).toLocaleString()),
  };
}

export function buildCompareColumnDefs(
  periodALabel: string,
  periodBLabel: string,
): (ColDef<EndpointCompareRow> | ColGroupDef<EndpointCompareRow>)[] {
  return [
    {
      field: 'endpointName',
      headerName: 'Endpoint',
      flex: 2,
      minWidth: 180,
      pinned: 'left',
      filter: 'agTextColumnFilter',
    },
    {
      headerName: periodALabel,
      children: [
        metricCol('Total', 'totalRequestsA'),
        metricCol('Success', 'successRequestsA'),
        metricCol('Failed', 'failedRequestsA'),
        metricCol('Avg ms', 'averageDurationMsA'),
      ],
    },
    {
      headerName: periodBLabel,
      children: [
        metricCol('Total', 'totalRequestsB'),
        metricCol('Success', 'successRequestsB'),
        metricCol('Failed', 'failedRequestsB'),
        metricCol('Avg ms', 'averageDurationMsB'),
      ],
    },
    {
      headerName: 'Change (B − A)',
      children: [
        compareDeltaCol('Total Δ', 'totalRequestsA', 'totalRequestsB'),
        compareDeltaCol('Success Δ', 'successRequestsA', 'successRequestsB'),
        compareDeltaCol('Failed Δ', 'failedRequestsA', 'failedRequestsB', true),
        compareDeltaCol('Avg Δ', 'averageDurationMsA', 'averageDurationMsB', true),
      ],
    },
  ];
}

export function formatPeriodLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const a = start.toLocaleDateString(undefined, opts);
  const b = end.toLocaleDateString(undefined, opts);
  return a === b ? a : `${a} – ${b}`;
}
