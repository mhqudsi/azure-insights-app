import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { InsightsData } from './pages/insightsData/insigts.data';

export const routes: Routes = [
  {
    path: '',
    component: Home,
  },
  {
    path: 'InsightsData',
    component: InsightsData,
  },
];
