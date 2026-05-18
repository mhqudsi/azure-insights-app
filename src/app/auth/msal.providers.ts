import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withFetch,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  MSAL_GUARD_CONFIG,
  MSAL_INSTANCE,
  MSAL_INTERCEPTOR_CONFIG,
  MsalBroadcastService,
  MsalGuard,
  MsalInterceptor,
  MsalService,
} from '@azure/msal-angular';
import {
  BrowserCacheLocation,
  InteractionType,
  IPublicClientApplication,
  PublicClientApplication,
} from '@azure/msal-browser';
import { APP_INITIALIZER, EnvironmentProviders, Provider } from '@angular/core';
import { environment } from '../../environments/environment';

function msalInitializerFactory(msal: MsalService): () => Promise<void> {
  return () =>
    msal.instance
      .initialize()
      .then(() => msal.instance.handleRedirectPromise())
      .then(() => undefined);
}

function msalInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: environment.msal.clientId,
      authority: environment.msal.authority,
      redirectUri: environment.msal.redirectUri,
      postLogoutRedirectUri: environment.msal.postLogoutRedirectUri,
    },
    cache: {
      cacheLocation: BrowserCacheLocation.LocalStorage,
    },
  });
}

function msalGuardConfigFactory() {
  return {
    interactionType: InteractionType.Redirect,
    authRequest: {
      scopes: ['api://804e0d8b-eb59-46a6-916e-118c2d61ed7d/access_as_user']
    },
  };
}

function msalInterceptorConfigFactory() {
  const base = environment.apiBaseUrl.replace(/\/$/, '');
  const protectedResourceMap = new Map<string, string[]>();
  protectedResourceMap.set(`${base}/api/`, environment.apiScopes);
  protectedResourceMap.set(`${base}/api`, environment.apiScopes);

  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap,
  };
}

/** MSAL + HTTP interceptor for API Bearer tokens. */
export function provideMsalAuth(): (Provider | EnvironmentProviders)[] {
  return [
    {
      provide: MSAL_INSTANCE,
      useFactory: msalInstanceFactory,
    },
    {
      provide: MSAL_GUARD_CONFIG,
      useFactory: msalGuardConfigFactory,
    },
    {
      provide: MSAL_INTERCEPTOR_CONFIG,
      useFactory: msalInterceptorConfigFactory,
    },
    MsalService,
    MsalGuard,
    MsalBroadcastService,
    {
      provide: APP_INITIALIZER,
      useFactory: msalInitializerFactory,
      deps: [MsalService],
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: MsalInterceptor,
      multi: true,
    },
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
  ];
}
