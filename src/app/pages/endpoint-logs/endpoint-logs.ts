import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, of } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { provideNativeDateAdapter } from '@angular/material/core';
import {
  InsightsDateRange,
  InsightsService,
  TelemetryLogEntry,
} from '../../services/insights.service';
import { normalizeTelemetryLogs } from '../insightsData/insights-log.mapper';
import {
  InsightsDatePreset,
  rangeForPreset,
  startOfDay,
  toApiDateRange,
} from '../insightsData/insights-date-range';
import { formatPeriodLabel } from '../insightsData/insights-compare';

@Component({
  selector: 'app-endpoint-logs',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonToggleModule,
  ],
  templateUrl: './endpoint-logs.html',
  styleUrl: './endpoint-logs.scss',
})
export class EndpointLogs implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly insightsService = inject(InsightsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  appId: string | null = null;
  endpointName = '';
  filterText = '';

  startDate: Date | null = null;
  endDate: Date | null = null;
  activePreset: InsightsDatePreset | null = null;

  logs: TelemetryLogEntry[] = [];
  loading = false;
  loadError = false;

  readonly datePresets: { value: InsightsDatePreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'Week' },
  ];

  readonly maxSelectableDate = new Date();

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.appId = params.get('id');
        this.endpointName = params.get('endpoint') ?? '';

        const from = params.get('fromDate');
        const to = params.get('toDate');
        if (from && to) {
          const start = new Date(from);
          const end = new Date(to);
          if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
            this.startDate = start;
            this.endDate = end;
            this.activePreset = null;
          }
        }

        if (!this.startDate || !this.endDate) {
          this.applyPreset('today');
        }

        this.loadLogs();
      });
  }

  get canLoad(): boolean {
    return !!(
      this.appId &&
      this.endpointName.trim() &&
      this.startDate &&
      this.endDate &&
      this.isValidRange()
    );
  }

  get periodLabel(): string {
    if (!this.startDate || !this.endDate) {
      return '';
    }
    return formatPeriodLabel(this.startDate, this.endDate);
  }

  get backQueryParams(): Record<string, string> {
    const q: Record<string, string> = {};
    if (this.appId) {
      q['id'] = this.appId;
    }
    return q;
  }

  get filteredLogs(): TelemetryLogEntry[] {
    const q = this.filterText.trim().toLowerCase();
    if (!q) {
      return this.logs;
    }
    return this.logs.filter(
      (log) =>
        log.message.toLowerCase().includes(q) ||
        log.name.toLowerCase().includes(q) ||
        log.telemetryType.toLowerCase().includes(q) ||
        (log.resultCode ?? '').toLowerCase().includes(q),
    );
  }

  applyPreset(preset: InsightsDatePreset): void {
    this.activePreset = preset;
    const { start, end } = rangeForPreset(preset);
    this.startDate = start;
    this.endDate = end;
    this.onDateRangeChanged();
  }

  onPresetChange(preset: InsightsDatePreset | null): void {
    if (preset) {
      this.applyPreset(preset);
    }
  }

  onManualDateChange(): void {
    this.activePreset = null;
    this.onDateRangeChanged();
  }

  refresh(): void {
    this.loadLogs();
  }

  trackLog(_index: number, log: TelemetryLogEntry): string {
    return `${log.timestamp}-${log.telemetryType}-${log.operationId ?? log.message}`;
  }

  typeIcon(type: string): string {
    switch (type?.toLowerCase()) {
      case 'exception':
        return 'error';
      case 'trace':
        return 'notes';
      default:
        return 'http';
    }
  }

  typeChipClass(type: string): string {
    switch (type?.toLowerCase()) {
      case 'exception':
        return 'log-chip-exception';
      case 'trace':
        return 'log-chip-trace';
      default:
        return 'log-chip-request';
    }
  }

  formatTimestamp(value: string): string {
    if (!value) {
      return '—';
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  }

  formatDuration(ms: number | null | undefined): string {
    if (ms == null || !Number.isFinite(ms)) {
      return '—';
    }
    return `${ms.toLocaleString(undefined, { maximumFractionDigits: 2 })} ms`;
  }

  successLabel(success: boolean | null | undefined): string {
    if (success == null) {
      return '—';
    }
    return success ? 'Success' : 'Failed';
  }

  private onDateRangeChanged(): void {
    this.syncUrlQueryParams();
    this.loadLogs();
  }

  private syncUrlQueryParams(): void {
    const range = this.toQuery();
    if (!this.appId || !this.endpointName || !range) {
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        id: this.appId,
        endpoint: this.endpointName,
        fromDate: range.fromDate,
        toDate: range.toDate,
      },
      replaceUrl: true,
    });
  }

  private loadLogs(): void {
    if (!this.canLoad || !this.appId) {
      this.logs = [];
      this.loading = false;
      this.loadError = false;
      this.cdr.markForCheck();
      return;
    }

    const range = this.toQuery()!;
    this.loading = true;
    this.loadError = false;

    this.insightsService
      .getEndpointLogs(this.appId, this.endpointName, range)
      .pipe(
        catchError(() => {
          this.loadError = true;
          return of([] as TelemetryLogEntry[]);
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe((raw) => {
        this.logs = normalizeTelemetryLogs(raw);
        this.cdr.markForCheck();
      });
  }

  private isValidRange(): boolean {
    if (!this.startDate || !this.endDate) {
      return false;
    }
    return startOfDay(this.startDate).getTime() <= startOfDay(this.endDate).getTime();
  }

  private toQuery(): InsightsDateRange | undefined {
    if (!this.isValidRange() || !this.startDate || !this.endDate) {
      return undefined;
    }
    return toApiDateRange(this.startDate, this.endDate);
  }
}
