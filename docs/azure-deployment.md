# Deploy azure-insights-app to Azure App Service

This app uses **Angular SSR** with an **Express** server. Azure App Service runs it as a **Node.js** app (`npm start` → `dist/azure-insights-app/server/server.mjs`). The server already listens on `PORT` and binds to `0.0.0.0` when running on Azure.

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (optional, for CLI deploy)
- Azure subscription
- Microsoft Entra app registration updated with your production URL (see [Entra ID](#entra-id-msal))

Production URLs are configured in `src/environments/environment.ts`. If your Web App name differs from `azureinsightsmonitoringui03`, update `redirectUri`, `postLogoutRedirectUri`, and register the new URL in Entra before deploying.

---

## 1. Create the Web App in Azure Portal

1. Sign in to [Azure Portal](https://portal.azure.com).
2. **Create a resource** → search **Web App** → **Create**.

### Basics tab

| Field | Recommendation |
|--------|----------------|
| **Subscription** | Your subscription |
| **Resource group** | Create new, e.g. `rg-azure-insights-ui` |
| **Name** | Globally unique, e.g. `azureinsightsmonitoringui03` (becomes `https://<name>.azurewebsites.net`) |
| **Publish** | Code |
| **Runtime stack** | **Node 20 LTS** |
| **Operating system** | **Linux** (recommended for Node SSR) |
| **Region** | Same region as your API when possible |

### App Service Plan

- Create new plan or use existing (e.g. **Basic B1** for production; **Free F1** only for quick tests).

3. **Review + create** → **Create**.

### After creation — Configuration

1. Open the Web App → **Settings** → **Configuration** → **General settings**:

   | Setting | Value |
   |---------|--------|
   | **Stack** | Node |
   | **Major version** | Node 20 |
   | **Startup Command** | `npm start` |

2. **Application settings** (optional but useful):

   | Name | Value |
   |------|--------|
   | `WEBSITE_NODE_DEFAULT_VERSION` | `~20` |
   | `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` when using GitHub Actions or zip with pre-built `dist` |
   | `NODE_ENV` | `production` |

3. **Save** and restart the app if prompted.

---

## 2. Entra ID (MSAL)

In [Microsoft Entra admin center](https://entra.microsoft.com) → **App registrations** → your SPA app:

1. **Authentication** → **Single-page application** redirect URIs:
   - `https://<your-app-name>.azurewebsites.net`
2. Ensure the same URL is used in `src/environments/environment.ts` for `redirectUri` and `postLogoutRedirectUri`.
3. Rebuild and redeploy after changing environment files.

---

## 3. Deployment options

### Option A — GitHub Actions (recommended)

1. Push this repo to GitHub.
2. Azure Portal → your Web App → **Deployment Center** → **Download publish profile**.
3. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
   - Value: contents of the publish profile file
4. Edit `.github/workflows/azure-web-app.yml` if `AZURE_WEBAPP_NAME` differs from your app name.
5. Push to `main` or run the workflow manually (**Actions** → **Deploy to Azure Web App** → **Run workflow**).

The workflow runs `npm ci`, `npm run build`, prunes dev dependencies, and deploys the folder to App Service.

### Option B — Zip deploy from your machine

```powershell
.\scripts\package-for-azure.ps1
```

Then upload `deploy-package.zip`:

**Portal:** Web App → **Advanced Tools** → **Go** (Kudu) → **Zip Push Deploy**, or:

**Azure CLI:**

```bash
az login
az webapp deployment source config-zip \
  --resource-group rg-azure-insights-ui \
  --name azureinsightsmonitoringui03 \
  --src deploy-package.zip
```

### Option C — Deploy from Git (Azure builds on server)

1. Web App → **Deployment Center** → connect your repo.
2. This repo includes `oryx-build-commands.txt` so Azure runs `npm ci` and `npm run build` on deploy.
3. Set startup command to `npm start` and `SCM_DO_BUILD_DURING_DEPLOYMENT` to `true` if not already set.

---

## 4. Verify deployment

1. Browse `https://<your-app-name>.azurewebsites.net`.
2. **Log stream** (Portal → Web App → **Monitoring** → **Log stream**) should show:
   `Node Express server listening on http://0.0.0.0:<port>`
3. Sign in with Microsoft; if redirect fails, double-check Entra redirect URIs and `environment.ts`.

---

## 5. Troubleshooting

| Symptom | Check |
|---------|--------|
| Application Error / 503 | **Log stream** and **Diagnose and solve problems**; confirm startup command is `npm start` and `dist/` exists on the server |
| Wrong API or auth URL | Production build uses `environment.ts`, not `environment.development.ts` |
| MSAL redirect loop | Redirect URI in Entra must exactly match `environment.msal.redirectUri` (HTTPS, no trailing path unless configured) |
| Build timeout on App Service | Use GitHub Actions or zip deploy with a pre-built `dist` (`SCM_DO_BUILD_DURING_DEPLOYMENT=false`) |
| Node version mismatch | `.node-version` is `20`; set `WEBSITE_NODE_DEFAULT_VERSION` to `~20` |

---

## Quick reference — Azure CLI (create resources)

```bash
az group create --name rg-azure-insights-ui --location eastus

az appservice plan create \
  --name plan-azure-insights-ui \
  --resource-group rg-azure-insights-ui \
  --sku B1 \
  --is-linux

az webapp create \
  --name azureinsightsmonitoringui03 \
  --resource-group rg-azure-insights-ui \
  --plan plan-azure-insights-ui \
  --runtime "NODE:20-lts"

az webapp config set \
  --resource-group rg-azure-insights-ui \
  --name azureinsightsmonitoringui03 \
  --startup-file "npm start"
```

Replace names and region as needed.
