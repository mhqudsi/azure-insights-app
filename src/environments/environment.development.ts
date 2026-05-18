import { AppEnvironment } from './environment.model';

const tenantId = 'a9db5b93-af96-4472-a4d7-3a86344a2537';
const clientId = '804e0d8b-eb59-46a6-916e-118c2d61ed7d';

/**
 * Local dev — register http://localhost:4200 in Entra SPA redirect URIs.
 */
export const environment: AppEnvironment = {
  production: false,
  apiBaseUrl: 'http://localhost:5007',
  msal: {
    clientId,
    tenantId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: 'http://localhost:4200',
    postLogoutRedirectUri: 'http://localhost:4200',
  },
  loginScopes: ['openid', 'profile', 'offline_access'],
  apiScopes: [`api://${clientId}/.default`],
};
