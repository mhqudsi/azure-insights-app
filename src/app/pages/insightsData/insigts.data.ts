import {
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
import { forkJoin } from 'rxjs';
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
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  InsightsService,
  EndpointDetails,
  InsightsSummary,
} from '../../services/insights.service';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-insights-data',
  standalone: true,
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
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './insights.data.html',
  styleUrls: ['./insights.data.scss'],
})
export class InsightsData implements OnInit {
  private insightsService = inject(InsightsService);
  private route = inject(ActivatedRoute);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);

  /** AG Grid must not run during SSR DOM bootstrap. */
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  rowData: EndpointDetails[] = [];
  /** First row from `getInsightsSummaryDetail` for the current app and duration. */
  summary: InsightsSummary | null = null;
  filterText = '';
  loading = false;
  loadError = false;
  appId: string | null = null;

  durationAmount: number | null = null;
  durationUnit: 'm' | 'h' | 'd' | null = null;

  readonly durationNumbers = Array.from({ length: 60 }, (_, i) => i + 1);
  readonly durationUnits: { value: 'm' | 'h' | 'd'; label: string }[] = [
    { value: 'm', label: 'Minutes' },
    { value: 'h', label: 'Hours' },
    { value: 'd', label: 'Days' },
  ];

  readonly paginationPageSizes = [5, 10, 25, 50];

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
              this.loading = false;
              this.loadError = false;
              this.rowData = [];
              this.summary = null;
              return;
            }
            if (this.canFetch) {
              this.fetchInsightsData(insightId);
            } else {
              this.loading = false;
              this.loadError = false;
              this.rowData = [];
              this.summary = null;
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
      this.loading = false;
      this.loadError = false;
      this.rowData = [];
      this.summary = null;
    } else {
      this.loading = false;
    }
  }

  get canFetch(): boolean {
    return (
      this.durationAmount != null &&
      this.durationAmount > 0 &&
      this.durationUnit != null
    );
  }

  /** API `duration` query value, e.g. `1m`, `2h`, `3d`. */
  get durationQueryValue(): string | undefined {
    if (!this.canFetch) {
      return undefined;
    }
    return `${this.durationAmount}${this.durationUnit}`;
  }

  onDurationChanged(): void {
    if (!this.appId) {
      return;
    }
    if (!this.canFetch) {
      this.rowData = [];
      this.summary = null;
      return;
    }
    this.fetchInsightsData(this.appId);
  }

  fetchInsightsData(id: string): void {
    if (!this.canFetch) {
      return;
    }
    this.loading = true;
    this.loadError = false;
    this.summary = null;

    const duration = this.durationQueryValue;
    forkJoin({
      endpoints: this.insightsService.getInsightsEndpointDetail(id, duration),
      summaries: this.insightsService.getInsightsSummaryDetail(id, duration),
    }).subscribe({
      next: ({ endpoints, summaries }) => {
        this.rowData = Array.isArray(endpoints) ? endpoints : [];
        const list = Array.isArray(summaries) ? summaries : [];
        this.summary = list.length > 0 ? list[0] : null;
        this.loading = false;
      },
      error: () => {
        this.loadError = true;
        this.loading = false;
        this.rowData = [];
        this.summary = null;
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
}
