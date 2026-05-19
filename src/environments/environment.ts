import { AppEnvironment } from './environment.model';

const tenantId = 'a9db5b93-af96-4472-a4d7-3a86344a2537';
/** App registration (SPA) — must match Entra app used by the API JWT validation. */
const clientId = '804e0d8b-eb59-46a6-916e-118c2d61ed7d';

/**
 * Production settings. Register redirect URI in Entra:
 * https://azureinsightsmonitoringui.azurewebsites.net
 */
export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: 'https://azureinsightsmonitoringapi.azurewebsites.net',
  msal: {
    clientId,
    tenantId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: 'https://azureinsightsmonitoringui03.azurewebsites.net',
    postLogoutRedirectUri: 'https://azureinsightsmonitoringui03.azurewebsites.net',
  },
  loginScopes: ['openid', 'profile', 'offline_access'],
  apiScopes: [`api://${clientId}/.default`],
};
