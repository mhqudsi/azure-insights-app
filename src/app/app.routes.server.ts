import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Prerendering waits for the app to stabilize. This app loads live data in
 * `ngOnInit`, so static prerender at build time hits HTTP timeouts. Use SSR
 * per request instead so `ng build` completes reliably.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
