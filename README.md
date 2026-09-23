# Finance

A personal budget and money tracker for Android, built as an installable web app (PWA).
It works fully offline, keeps all data on the phone, and uses USD only.

**Live app:** https://kue28.github.io/finance/

## Features

- **Accounts**: EcoCash, InnBucks, Cash and Bank to start with. You can add, rename, archive and reorder accounts and choose a default one. Balances are always worked out from the opening balance plus every transaction.
- **Quick entry**: log a spend in 3–4 taps using the keypad and your most-used category chips. Income, transfers (with optional fees) and lending are on the same screen.
- **Budgets**: monthly limits on main categories. The bar turns amber at 80% and red when you go over. There are no rollovers, and you can copy last month's limits.
- **Recurring items**: rent, salary, subscriptions and so on. They're never recorded automatically: you confirm, edit, skip or snooze each one when it's due.
- **Savings goals**: a target, an optional deadline and the monthly amount needed. Contributing is a transfer into the goal's account.
- **Money lent**: loans per person, partial repayments, overdue loans and write-offs (Other › Bad debts).
- **Reports**: spending by category with subcategory drill-down, income vs expenses, budget vs actual, one category over time, and a monthly summary.
- **Backup**: JSON export and restore, CSV export, and a reminder after 7 days without a backup.
- **Fingerprint lock** (More → Security): asks for your fingerprint or phone PIN when the app opens. A recovery code gets you in if fingerprint unlock fails. The lock is per phone and isn't included in backups. It's a gate against someone opening the app, not encryption.

### What counts where

| Kind | Account balance | Budgets & spending | Income |
|---|---|---|---|
| Expense (including transfer fees) | − | ✅ | |
| Income | + | | ✅ |
| Transfer (including savings goal contributions and withdrawals) | − from, + to | ❌ | ❌ |
| Lend | − | ❌ | |
| Repayment | + | | ❌ |
| Write-off | no change | ✅ | |

The single source of truth for these rules is [`src/lib/rules.ts`](src/lib/rules.ts).

## Using it on your phone

1. Open **https://kue28.github.io/finance/** in **Chrome** on Android.
2. Tap **⋮ → Add to Home screen** (or **Install app**).
3. Open it from the home-screen icon. After the first load it works with no internet.
4. Long-press the icon for a shortcut straight to **Add expense**.

**Updates:** when a new version is deployed, a banner says "A new version is available". Tap **Update**.

**Back up regularly:** your data lives only on the phone. Go to **More → Backup & restore → Export backup** and save the file to Google Drive or send it to yourself on WhatsApp. To move to a new phone, install the app there and use **Restore**.

## Development

Requires Node.js 20 or later.

```bash
npm install        # once
npm run dev        # local dev server at http://localhost:5173
npm test           # run the test suite
npm run build      # type-check and build into dist/
npm run preview    # serve the built app locally
```

To try the dev server on a phone on the same Wi-Fi, run `npm run dev -- --host` and open the "Network" address it prints. Offline mode and installing only work over HTTPS, so use the deployed site for those.

### Project layout

```
src/
  db/          database schema (Dexie/IndexedDB), types, operations, live-query hooks
  lib/         pure logic: money, dates, rules, budgets, recurring, goals, loans, reports, backup, CSV
  screens/     one file (or folder) per screen
  components/  shared UI: keypad, transaction rows, charts, progress bars…
```

- Money is stored as **integer cents**, and dates as local `YYYY-MM-DD` strings.
- New tables need a new `this.version(n)` in `src/db/db.ts`. Dexie upgrades the phone's database in place and keeps existing data.

## Deployment

The app is a static site. It's deployed to **GitHub Pages** by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on every push to `main`:

```bash
git add .
git commit -m "Describe the change"
git push
```

Then watch the **Actions** tab on GitHub. It takes about a minute.

First-time setup for a new copy of the repo:

1. Create a **public** GitHub repository and push this code to `main`.
2. In the repository, go to **Settings → Pages → Source** and choose **GitHub Actions**.
3. Re-run the workflow from the **Actions** tab. The site will be at `https://<username>.github.io/<repo>/`.

The workflow sets `BASE_PATH=/<repo>/` so the app works from that sub-folder.

**Other hosts:** Netlify or Vercel also work. Set the build command to `npm run build` and the publish directory to `dist`. `BASE_PATH` isn't needed there.
