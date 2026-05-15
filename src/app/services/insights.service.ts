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
  maxResponseMs: number;
}

export interface AzureSubscription {
  id?: string;
  displayName?: string;
  state?: string;
}

export interface InsightsDateRange {
  fromDate: string;
  toDate: string;
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

  getInsightsEndpointDetail(
    id: string,
    range: InsightsDateRange,
  ): Observable<EndpointDetails[]> {
    const params = new HttpParams()
      .set('appId', id)
      .set('fromDate', range.fromDate)
      .set('toDate', range.toDate);
    return this.http.get<EndpointDetails[]>(
      `${this.apiBase()}${AppConst.API.Insights.endpoints}`,
      { params },
    );
  }

  getInsightsSummaryDetail(
    id: string,
    range: InsightsDateRange,
  ): Observable<InsightsSummary> {
    const params = new HttpParams()
      .set('appId', id)
      .set('fromDate', range.fromDate)
      .set('toDate', range.toDate);
    return this.http.get<InsightsSummary>(
      `${this.apiBase()}${AppConst.API.Insights.summary}`,
      { params },
    );
  }


  getInsightById(id: number): Observable<Insight> {
    return this.http.get<Insight>(`${this.apiBase()}${AppConst.API.Insights.summary}/${id}`);
  }

}