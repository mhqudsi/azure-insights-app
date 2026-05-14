import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConst } from '../shared/app.const';
import { environment } from '../../environments/environment';

export interface Insight {
  name: string;
  resourceGroupName?: string;
  subscriptionId: string;
  location?: string;
  applicationId: string;
  azurePortalUrl: string;
  color: string;
}

export interface InsightsSummary{
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  averageResponseMs: number;
  minResponseMs: number;
  maxResponseMs: string;
}

export interface AzureSubscription {
  id?: string;
  displayName?: string;
  state?: string;
}

export interface EndpointDetails {
  endpointName: string;
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  averageDurationMs: number;
  maxDurationMs: number;
  lastCalled: string;
}

@Injectable({
  providedIn: 'root'
})

export class InsightsService {

  private http = inject(HttpClient);

  private apiBase(): string {
    return environment.apiBaseUrl.replace(/\/$/, '');
  }

  getAllInsights(subsId: string): Observable<Insight[]> {
  return this.http.get<Insight[]>(`${this.apiBase()}${AppConst.API.Insights.allinsights}`, {
    params: { subscriptionId: subsId }
  });
}

  getAllSubscriptions(): Observable<AzureSubscription[]> {
    return this.http.get<AzureSubscription[]>(`${this.apiBase()}${AppConst.API.Insights.allSubscription}`);
  }

  /**
   * @param duration e.g. `1m`, `2h`, `3d` — passed as the `duration` query parameter when provided.
   */
  getInsightsEndpointDetail(id: string, duration?: string): Observable<EndpointDetails[]> {
    let params = new HttpParams().set('appId', id);
    if (duration != null && duration !== '') {
      params = params.set('duration', duration);
    }
    return this.http.get<EndpointDetails[]>(
      `${this.apiBase()}${AppConst.API.Insights.endpoints}`,
      { params },
    );
  }

  getInsightsSummaryDetail(id: string, duration?: string): Observable<InsightsSummary[]> {
    let params = new HttpParams().set('appId', id);
    if (duration != null && duration !== '') {
      params = params.set('duration', duration);
    }
    return this.http.get<InsightsSummary[]>(
      `${this.apiBase()}${AppConst.API.Insights.summary}`,
      { params },
    );
  }


  getInsightById(id: number): Observable<Insight> {
    return this.http.get<Insight>(`${this.apiBase()}${AppConst.API.Insights.summary}/${id}`);
  }

}