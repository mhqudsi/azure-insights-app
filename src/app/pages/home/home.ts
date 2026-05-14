import {
  afterNextRender,
  ChangeDetectorRef,
  Component,
  inject,
  Injector,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { InsightsService, Insight, AzureSubscription } from '../../services/insights.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class Home {
  private injector = inject(Injector);
  private platformId = inject(PLATFORM_ID);
  private insightsService = inject(InsightsService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    afterNextRender(
      () => {
        if (isPlatformBrowser(this.platformId)) {
          this.fetchSubscription();
        }
      },
      { injector: this.injector },
    );
  }

  insights: Insight[] = [];
  azureSubscription: AzureSubscription[] = [];
  subsFetched = false;
  subsLoadError = false;

  selectedSub: AzureSubscription | null = null;
  insightsLoading = false;
  insightsLoadError = false;

  subscriptionSearch = '';
  insightSearch = '';

  get filteredSubscriptions(): AzureSubscription[] {
    const q = this.subscriptionSearch.trim().toLowerCase();
    if (!q) {
      return this.azureSubscription;
    }
    return this.azureSubscription.filter((s) => {
      const id = (s.id ?? '').toLowerCase();
      const name = (s.displayName ?? '').toLowerCase();
      const st = (s.state ?? '').toLowerCase();
      return id.includes(q) || name.includes(q) || st.includes(q);
    });
  }

  get filteredInsights(): Insight[] {
    const q = this.insightSearch.trim().toLowerCase();
    if (!q) {
      return this.insights;
    }
    return this.insights.filter((i) => {
      const name = (i.name ?? '').toLowerCase();
      const rg = (i.resourceGroupName ?? '').toLowerCase();
      const loc = (i.location ?? '').toLowerCase();
      const appId = (i.applicationId ?? '').toLowerCase();
      return (
        name.includes(q) || rg.includes(q) || loc.includes(q) || appId.includes(q)
      );
    });
  }

  fetchInsightsData(subsId: string): void {
    this.insightsLoading = true;
    this.insightsLoadError = false;

    this.insightsService
      .getAllInsights(subsId)
      .pipe(
        finalize(() => {
          this.insightsLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (res) => {
          this.insights = Array.isArray(res) ? res : [];
          this.insightsLoadError = false;
        },
        error: () => {
          this.insightsLoadError = true;
          this.insights = [];
        },
      });
  }

  fetchSubscription(): void {
    this.subsLoadError = false;
    this.subsFetched = false;

    this.insightsService
      .getAllSubscriptions()
      .pipe(
        finalize(() => {
          this.subsFetched = true;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (res) => {
          this.azureSubscription = Array.isArray(res) ? res : [];
        },
        error: () => {
          this.subsLoadError = true;
          this.azureSubscription = [];
        },
      });
  }

  onInsightCardClick(insight: Insight): void {
    this.router.navigate(['/InsightsData'], { queryParams: { id: insight.applicationId } });
  }

  onSubsCardClick(subs: AzureSubscription): void {
    this.selectedSub = subs;
    this.insightSearch = '';
    this.fetchInsightsData(subs.id ?? '');
  }

  clearSubscriptionSelection(): void {
    this.selectedSub = null;
    this.insights = [];
    this.insightSearch = '';
    this.insightsLoadError = false;
  }

  trackSub(_: number, s: AzureSubscription): string {
    return s.id ?? `sub-${_}`;
  }

  trackInsight(_: number, i: Insight): string {
    return i.applicationId;
  }
}
