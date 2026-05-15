import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  afterNextRender,
  inject,
  Injector,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ColDef,
  ColGroupDef,
  ModuleRegistry,
  RowClassRules,
} from 'ag-grid-community';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { provideNativeDateAdapter } from '@angular/material/core';
import {
  InsightsService,
  EndpointDetails,
  InsightsSummary,
  InsightsDateRange,
} from '../../services/insights.service';
import {
  InsightsDatePreset,
  rangeForPreset,
  startOfDay,
  toApiDateRange,
} from './insights-date-range';
import { normalizeEndpointRows } from './insights-endpoint.mapper';
import {
  EndpointCompareRow,
  SummaryCompareMetric,
  buildCompareColumnDefs,
  buildSummaryCompareMetrics,
  deltaTrendClass,
  formatCompareDelta,
  formatPeriodLabel,
  mergeEndpointsForCompare,
} from './insights-compare';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-insights-data',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AgGridAngular,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatButtonToggleModule,
    MatSlideToggleModule,
  ],
  templateUrl: './insights.data.html',
  styleUrls: ['./insights.data.scss'],
})
export class InsightsData implements OnInit {
  private insightsService = inject(InsightsService);
  private route = inject(ActivatedRoute);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  compareMode = false;

  rowData: EndpointDetails[] = [];
  summary: InsightsSummary | null = null;

  compareRowData: EndpointCompareRow[] = [];
  compareSummaryA: InsightsSummary | null = null;
  compareSummaryB: InsightsSummary | null = null;
  summaryCompareMetrics: SummaryCompareMetric[] = [];

  filterText = '';
  loading = false;
  loadError = false;
  appId: string | null = null;

  startDate: Date | null = null;
  endDate: Date | null = null;
  activePreset: InsightsDatePreset | null = null;

  compareStartDate: Date | null = null;
  compareEndDate: Date | null = null;
  compareActivePreset: InsightsDatePreset | null = null;

  private suppressDateChange = false;
  private suppressCompareDateChange = false;
  private fetchRequestId = 0;

  readonly datePresets: { value: InsightsDatePreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'Week' },
  ];

  readonly paginationPageSizes = [5, 10, 25, 50];
  readonly maxSelectableDate = new Date();

  columnDefs: ColDef<EndpointDetails>[] = [
    {
      field: 'endpointName',
      headerName: 'Endpoint',
      flex: 2,
      minWidth: 180,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'totalRequests',
      headerName: 'Total',
      type: 'numericColumn',
      maxWidth: 130,
      filter: 'agNumberColumnFilter',
      valueFormatter: (p) => (p.value == null ? '' : Number(p.value).toLocaleString()),
    },
    {
      field: 'successRequests',
      headerName: 'Success',
      type: 'numericColumn',
      maxWidth: 130,
      filter: 'agNumberColumnFilter',
      valueFormatter: (p) => (p.value == null ? '' : Number(p.value).toLocaleString()),
      cellClass: 'text-success',
    },
    {
      field: 'failedRequests',
      headerName: 'Failed',
      type: 'numericColumn',
      maxWidth: 120,
      filter: 'agNumberColumnFilter',
      valueFormatter: (p) => (p.value == null ? '' : Number(p.value).toLocaleString()),
      cellClassRules: {
        'fw-semibold text-danger': (p) => Number(p.value) > 0,
      },
    },
    {
      field: 'averageDurationMs',
      headerName: 'Avg ms',
      type: 'numericColumn',
      maxWidth: 130,
      filter: 'agNumberColumnFilter',
      valueFormatter: (p) => (p.value == null ? '' : Number(p.value).toLocaleString()),
    },
    {
      field: 'maxDurationMs',
      headerName: 'Max ms',
      type: 'numericColumn',
      maxWidth: 130,
      filter: 'agNumberColumnFilter',
      valueFormatter: (p) => (p.value == null ? '' : Number(p.value).toLocaleString()),
    },
    {
      field: 'lastCalled',
      headerName: 'Last called',
      minWidth: 160,
      filter: 'agTextColumnFilter',
    },
  ];

  compareColumnDefs: (ColDef<EndpointCompareRow> | ColGroupDef<EndpointCompareRow>)[] = [];

  defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    floatingFilter: true,
    headerStyle: { textAlign: 'center' },
    cellStyle: { textAlign: 'center' },
  };

  rowClassRules: RowClassRules<EndpointDetails> = {
    'ag-row-failures': (params) => (params.data?.failedRequests ?? 0) > 0,
  };

  compareRowClassRules: RowClassRules<EndpointCompareRow> = {
    'ag-row-failures': (params) =>
      (params.data?.failedRequestsA ?? 0) > 0 ||
      (params.data?.failedRequestsB ?? 0) > 0,
  };

  constructor() {
    afterNextRender(
      () => {
        this.route.queryParamMap
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((params) => {
            const insightId = params.get('id');
            this.appId = insightId;
            this.filterText = '';

            if (!insightId) {
              this.resetData();
              return;
            }

            if (this.canLoad) {
              this.fetchInsightsData(insightId);
            } else {
              this.resetData();
            }
          });
      },
      { injector: this.injector },
    );
  }

  ngOnInit(): void {
    const insightId = this.route.snapshot.queryParamMap.get('id');
    this.appId = insightId;

    if (!insightId) {
      this.resetData();
      return;
    }

    this.setPresetDates('today', 'primary');
    this.setPresetDates('yesterday', 'compare');
  }

  get canFetch(): boolean {
    return this.isValidRange(this.startDate, this.endDate);
  }

  get canFetchCompare(): boolean {
    return this.isValidRange(this.compareStartDate, this.compareEndDate);
  }

  get canLoad(): boolean {
    return this.canFetch && (!this.compareMode || this.canFetchCompare);
  }

  get dateRangeQuery(): InsightsDateRange | undefined {
    return this.toQuery(this.startDate, this.endDate);
  }

  get compareDateRangeQuery(): InsightsDateRange | undefined {
    return this.toQuery(this.compareStartDate, this.compareEndDate);
  }

  get periodALabel(): string {
    if (!this.startDate || !this.endDate) {
      return 'Period A';
    }
    return formatPeriodLabel(this.startDate, this.endDate);
  }

  get periodBLabel(): string {
    if (!this.compareStartDate || !this.compareEndDate) {
      return 'Period B';
    }
    return formatPeriodLabel(this.compareStartDate, this.compareEndDate);
  }

  get hasGridData(): boolean {
    return this.compareMode
      ? this.compareRowData.length > 0
      : this.rowData.length > 0;
  }

  onCompareModeChange(enabled: boolean): void {
    this.compareMode = enabled;
    if (enabled) {
      if (!this.canFetchCompare) {
        this.setPresetDates('yesterday', 'compare');
      }
      this.updateCompareColumnDefs();
    } else {
      this.compareRowData = [];
      this.compareSummaryA = null;
      this.compareSummaryB = null;
      this.summaryCompareMetrics = [];
    }
    this.onDateRangeChanged();
  }

  applyPreset(preset: InsightsDatePreset, target: 'primary' | 'compare' = 'primary'): void {
    if (target === 'primary') {
      this.activePreset = preset;
    } else {
      this.compareActivePreset = preset;
    }
    this.setPresetDates(preset, target);
    this.onDateRangeChanged();
  }

  onPresetChange(preset: InsightsDatePreset | null): void {
    if (preset) {
      this.applyPreset(preset, 'primary');
    }
  }

  onComparePresetChange(preset: InsightsDatePreset | null): void {
    if (preset) {
      this.applyPreset(preset, 'compare');
    }
  }

  onManualDateChange(): void {
    if (this.suppressDateChange) {
      return;
    }
    this.activePreset = null;
    this.onDateRangeChanged();
  }

  onCompareManualDateChange(): void {
    if (this.suppressCompareDateChange) {
      return;
    }
    this.compareActivePreset = null;
    this.onDateRangeChanged();
  }

  onDateRangeChanged(): void {
    if (!this.appId) {
      return;
    }

    if (!this.canLoad) {
      this.loading = false;
      this.rowData = [];
      this.summary = null;
      this.compareRowData = [];
      this.compareSummaryA = null;
      this.compareSummaryB = null;
      this.summaryCompareMetrics = [];
      this.loadError = false;
      this.cdr.markForCheck();
      return;
    }

    if (this.compareMode) {
      this.updateCompareColumnDefs();
    }

    this.fetchInsightsData(this.appId);
  }

  fetchInsightsData(id: string): void {
    const rangeA = this.dateRangeQuery;
    if (!rangeA) {
      this.loading = false;
      return;
    }

    const requestId = ++this.fetchRequestId;
    this.loading = true;
    this.loadError = false;
    this.summary = null;
    this.compareSummaryA = null;
    this.compareSummaryB = null;
    this.summaryCompareMetrics = [];

    if (!this.compareMode) {
      this.fetchSinglePeriod(id, rangeA, requestId);
      return;
    }

    const rangeB = this.compareDateRangeQuery;
    if (!rangeB) {
      this.loading = false;
      return;
    }

    this.fetchComparePeriods(id, rangeA, rangeB, requestId);
  }

  onFilterChange(value: string): void {
    this.filterText = value;
  }

  clearFilter(): void {
    this.onFilterChange('');
  }

  refresh(): void {
    if (this.appId && this.canLoad) {
      this.fetchInsightsData(this.appId);
    }
  }

  formatDelta(metric: SummaryCompareMetric): string {
    return formatCompareDelta(metric.delta, metric.deltaPct);
  }

  deltaClass(metric: SummaryCompareMetric): string {
    return deltaTrendClass(metric.delta, metric.lowerIsBetter);
  }

  private fetchSinglePeriod(
    id: string,
    range: InsightsDateRange,
    requestId: number,
  ): void {
    let endpointsFailed = false;

    forkJoin({
      endpoints: this.insightsService.getInsightsEndpointDetail(id, range).pipe(
        catchError(() => {
          endpointsFailed = true;
          return of([] as unknown);
        }),
      ),
      summary: this.insightsService.getInsightsSummaryDetail(id, range).pipe(
        catchError(() => of(null)),
      ),
    })
      .pipe(finalize(() => this.finishRequest(requestId)))
      .subscribe({
        next: ({ endpoints, summary }) => {
          if (requestId !== this.fetchRequestId) {
            return;
          }
          this.rowData = normalizeEndpointRows(endpoints);
          this.summary = this.normalizeSummary(summary);
          this.compareRowData = [];
          this.loadError = endpointsFailed && this.rowData.length === 0;
          this.cdr.markForCheck();
        },
        error: () => this.handleFetchError(requestId),
      });
  }

  private fetchComparePeriods(
    id: string,
    rangeA: InsightsDateRange,
    rangeB: InsightsDateRange,
    requestId: number,
  ): void {
    let endpointsAFailed = false;
    let endpointsBFailed = false;

    forkJoin({
      endpointsA: this.insightsService.getInsightsEndpointDetail(id, rangeA).pipe(
        catchError(() => {
          endpointsAFailed = true;
          return of([] as unknown);
        }),
      ),
      summaryA: this.insightsService.getInsightsSummaryDetail(id, rangeA).pipe(
        catchError(() => of(null)),
      ),
      endpointsB: this.insightsService.getInsightsEndpointDetail(id, rangeB).pipe(
        catchError(() => {
          endpointsBFailed = true;
          return of([] as unknown);
        }),
      ),
      summaryB: this.insightsService.getInsightsSummaryDetail(id, rangeB).pipe(
        catchError(() => of(null)),
      ),
    })
      .pipe(finalize(() => this.finishRequest(requestId)))
      .subscribe({
        next: ({ endpointsA, summaryA, endpointsB, summaryB }) => {
          if (requestId !== this.fetchRequestId) {
            return;
          }

          const rowsA = normalizeEndpointRows(endpointsA);
          const rowsB = normalizeEndpointRows(endpointsB);
          this.rowData = [];
          this.summary = null;
          this.compareSummaryA = this.normalizeSummary(summaryA);
          this.compareSummaryB = this.normalizeSummary(summaryB);
          this.summaryCompareMetrics = buildSummaryCompareMetrics(
            this.compareSummaryA,
            this.compareSummaryB,
          );
          this.compareRowData = mergeEndpointsForCompare(rowsA, rowsB);
          this.loadError =
            (endpointsAFailed || endpointsBFailed) && this.compareRowData.length === 0;
          this.cdr.markForCheck();
        },
        error: () => this.handleFetchError(requestId),
      });
  }

  private finishRequest(requestId: number): void {
    if (requestId === this.fetchRequestId) {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private handleFetchError(requestId: number): void {
    if (requestId !== this.fetchRequestId) {
      return;
    }
    this.loadError = true;
    this.rowData = [];
    this.summary = null;
    this.compareRowData = [];
    this.compareSummaryA = null;
    this.compareSummaryB = null;
    this.summaryCompareMetrics = [];
    this.cdr.markForCheck();
  }

  private updateCompareColumnDefs(): void {
    this.compareColumnDefs = buildCompareColumnDefs(this.periodALabel, this.periodBLabel);
  }

  private isValidRange(start: Date | null, end: Date | null): boolean {
    return (
      start != null &&
      end != null &&
      startOfDay(start).getTime() <= startOfDay(end).getTime()
    );
  }

  private toQuery(start: Date | null, end: Date | null): InsightsDateRange | undefined {
    if (!this.isValidRange(start, end) || start == null || end == null) {
      return undefined;
    }
    return toApiDateRange(start, end);
  }

  private setPresetDates(preset: InsightsDatePreset, target: 'primary' | 'compare'): void {
    const { start, end } = rangeForPreset(preset);
    if (target === 'primary') {
      this.suppressDateChange = true;
      this.startDate = start;
      this.endDate = end;
      this.suppressDateChange = false;
    } else {
      this.suppressCompareDateChange = true;
      this.compareStartDate = start;
      this.compareEndDate = end;
      this.suppressCompareDateChange = false;
    }
  }

  private resetData(): void {
    this.loading = false;
    this.loadError = false;
    this.rowData = [];
    this.summary = null;
    this.compareRowData = [];
    this.compareSummaryA = null;
    this.compareSummaryB = null;
    this.summaryCompareMetrics = [];
  }

  private normalizeSummary(
    raw: InsightsSummary | InsightsSummary[] | null | undefined,
  ): InsightsSummary | null {
    if (raw == null) {
      return null;
    }
    if (Array.isArray(raw)) {
      return raw.length > 0 ? raw[0] : null;
    }
    const row = raw as unknown as Record<string, unknown>;
    if (row['totalRequests'] != null || row['TotalRequests'] != null) {
      return {
        totalRequests: Number(row['totalRequests'] ?? row['TotalRequests'] ?? 0),
        successRequests: Number(row['successRequests'] ?? row['SuccessRequests'] ?? 0),
        failedRequests: Number(row['failedRequests'] ?? row['FailedRequests'] ?? 0),
        averageResponseMs: Number(
          row['averageResponseMs'] ?? row['AverageResponseMs'] ?? 0,
        ),
        minResponseMs: Number(row['minResponseMs'] ?? row['MinResponseMs'] ?? 0),
        maxResponseMs: Number(row['maxResponseMs'] ?? row['MaxResponseMs'] ?? 0),
      };
    }
    return raw;
  }
}
