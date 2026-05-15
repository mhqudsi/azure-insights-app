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

  rowData: EndpointDetails[] = [];
  summary: InsightsSummary | null = null;
  filterText = '';
  loading = false;
  loadError = false;
  appId: string | null = null;

  startDate: Date | null = null;
  endDate: Date | null = null;
  activePreset: InsightsDatePreset | null = null;

  /** Skips dateChange handlers while preset dates are applied programmatically. */
  private suppressDateChange = false;
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

  defaultColDef: ColDef<EndpointDetails> = {
    sortable: true,
    resizable: true,
    floatingFilter: true,
    headerStyle: { textAlign: 'center' },
    cellStyle: { textAlign: 'center' },
  };

  rowClassRules: RowClassRules<EndpointDetails> = {
    'ag-row-failures': (params) => (params.data?.failedRequests ?? 0) > 0,
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

            if (this.canFetch) {
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

    this.setPresetDates('today');
  }

  get canFetch(): boolean {
    return (
      this.startDate != null &&
      this.endDate != null &&
      startOfDay(this.startDate).getTime() <= startOfDay(this.endDate).getTime()
    );
  }

  get dateRangeQuery(): InsightsDateRange | undefined {
    if (!this.canFetch || this.startDate == null || this.endDate == null) {
      return undefined;
    }
    return toApiDateRange(this.startDate, this.endDate);
  }

  applyPreset(preset: InsightsDatePreset): void {
    this.activePreset = preset;
    this.setPresetDates(preset);
    this.onDateRangeChanged();
  }

  onPresetChange(preset: InsightsDatePreset | null): void {
    if (preset) {
      this.applyPreset(preset);
    }
  }

  onManualDateChange(): void {
    if (this.suppressDateChange) {
      return;
    }
    this.activePreset = null;
    this.onDateRangeChanged();
  }

  onDateRangeChanged(): void {
    if (!this.appId) {
      return;
    }

    if (!this.canFetch) {
      this.loading = false;
      this.rowData = [];
      this.summary = null;
      this.loadError = false;
      this.cdr.markForCheck();
      return;
    }

    this.fetchInsightsData(this.appId);
  }

  fetchInsightsData(id: string): void {
    const range = this.dateRangeQuery;
    if (!range) {
      this.loading = false;
      return;
    }

    const requestId = ++this.fetchRequestId;
    this.loading = true;
    this.loadError = false;
    this.summary = null;

    let endpointsFailed = false;
    let summaryFailed = false;

    forkJoin({
      endpoints: this.insightsService.getInsightsEndpointDetail(id, range).pipe(
        catchError(() => {
          endpointsFailed = true;
          return of([] as unknown);
        }),
      ),
      summary: this.insightsService.getInsightsSummaryDetail(id, range).pipe(
        catchError(() => {
          summaryFailed = true;
          return of(null);
        }),
      ),
    })
      .pipe(
        finalize(() => {
          if (requestId === this.fetchRequestId) {
            this.loading = false;
            this.cdr.markForCheck();
          }
        }),
      )
      .subscribe({
        next: ({ endpoints, summary }) => {
          if (requestId !== this.fetchRequestId) {
            return;
          }

          this.rowData = normalizeEndpointRows(endpoints);
          this.summary = this.normalizeSummary(summary);
          this.loadError = endpointsFailed && this.rowData.length === 0;

          if (summaryFailed && !this.summary) {
            this.summary = null;
          }

          this.cdr.markForCheck();
        },
        error: () => {
          if (requestId !== this.fetchRequestId) {
            return;
          }
          this.loadError = true;
          this.rowData = [];
          this.summary = null;
          this.cdr.markForCheck();
        },
      });
  }

  onFilterChange(value: string): void {
    this.filterText = value;
  }

  clearFilter(): void {
    this.onFilterChange('');
  }

  refresh(): void {
    if (this.appId && this.canFetch) {
      this.fetchInsightsData(this.appId);
    }
  }

  private setPresetDates(preset: InsightsDatePreset): void {
    const { start, end } = rangeForPreset(preset);
    this.suppressDateChange = true;
    this.startDate = start;
    this.endDate = end;
    this.suppressDateChange = false;
  }

  private resetData(): void {
    this.loading = false;
    this.loadError = false;
    this.rowData = [];
    this.summary = null;
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
