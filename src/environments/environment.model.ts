export interface EnvironmentMsalConfig {
  clientId: string;
  tenantId: string;
  /** e.g. https://login.microsoftonline.com/{tenantId} */
  authority: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
}

export interface AppEnvironment {
  production: boolean;
  apiBaseUrl: string;
  msal: EnvironmentMsalConfig;
  /** Scopes for sign-in (openid, profile, offline_access). */
  loginScopes: string[];
  /** Scopes sent to the Insights API (Bearer token). */
  apiScopes: string[];
}
