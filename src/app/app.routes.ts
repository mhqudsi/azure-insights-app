import { Routes } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { Home } from './pages/home/home';
import { InsightsData } from './pages/insightsData/insigts.data';
import { EndpointLogs } from './pages/endpoint-logs/endpoint-logs';
import { LoginFailed } from './pages/login-failed/login-failed';

export const routes: Routes = [
  {
    path: '',
    component: Home,
    canActivate: [MsalGuard],
  },
  {
    path: 'InsightsData',
    component: InsightsData,
    canActivate: [MsalGuard],
  },
  {
    path: 'endpoint-logs',
    component: EndpointLogs,
    canActivate: [MsalGuard],
  },
  {
    path: 'InsightsData/logs',
    redirectTo: 'endpoint-logs',
    pathMatch: 'full',
  },
  {
    path: 'login-failed',
    component: LoginFailed,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
