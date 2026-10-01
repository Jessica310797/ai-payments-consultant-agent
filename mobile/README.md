# Payments Consultant — mobile app

An Expo (React Native) app for in-store visits:

1. **New merchant check** → photograph each page of the merchant's card statement (or pick the PDF they were emailed),
   and tick that the merchant agreed to share it.
2. **Check the figures** → Claude's reading of the statement, with checks that flag likely misreads. Fix anything
   against the paper statement, **Re-check**, then **Confirm figures**.
3. **Results** → key metrics, payment mix, debit routing today, the 1 October reform impact (Today / 1 Oct /
   + routing) and the surcharge impact (adjustable surcharge %).
4. Completed checks are saved **on the phone only** and listed on the home screen (long-press to delete).

The app never holds the Anthropic API key. It sends the statement to the API in [`../api`](../api), which asks Claude
to read it and runs the same calculations as the website ([`../payments_core.py`](../payments_core.py)).

## Code

| Path | What it is |
| --- | --- |
| `src/app/index.tsx` | Home: new check, recent checks, settings |
| `src/app/capture.tsx` | Camera / photos / PDF, consent, upload |
| `src/app/check.tsx` | Check and edit the figures |
| `src/app/results.tsx` | Results |
| `src/app/settings.tsx` | Server address and access key override (for testing) |
| `src/lib/api.ts` | Calls to the API |
| `src/lib/storage.ts` | Saved checks and settings on the phone |

Run `npm install`, then `npm run typecheck`. `npx expo start` runs it in Expo Go on your phone for development.

## Getting it onto phones and into the stores

### 1. Put the API online (Render)

1. Create an account at [render.com](https://render.com) and connect GitHub.
2. **New → Blueprint** → pick this repository. Render reads [`render.yaml`](../render.yaml).
3. When asked, paste your **ANTHROPIC_API_KEY** (and ANTHROPIC_WORKSPACE_ID if your key needs one).
4. When it's live, note the address (e.g. `https://payments-consultant-api.onrender.com`) and, under
   **Environment**, the generated **APP_ACCESS_KEY**.

The blueprint uses Render's Starter plan (about US$7/month) because the free plan sleeps and takes about a minute to
wake up, which is too slow in front of a merchant.

### 2. Expo account and app settings

1. Create a free account at [expo.dev](https://expo.dev).
2. Before the first store build, choose your permanent app ID in `app.json` (`ios.bundleIdentifier` and
   `android.package`, currently `au.com.paymentsconsultant.app`). Use a domain you own if you have one. It can't be
   changed after the app is published.
3. On a computer with Node.js: `cd mobile && npm install && npx eas-cli@latest login && npx eas-cli@latest init`.
4. Add the server details as EAS environment variables for **preview** and **production**:
   `EXPO_PUBLIC_API_URL` (the Render address) and `EXPO_PUBLIC_APP_ACCESS_KEY` (the APP_ACCESS_KEY value), on
   expo.dev → your project → Environment variables.

### 3. Try it on your own phone

- **Android:** `npx eas-cli@latest build --profile preview --platform android` → open the link on your phone to
  install the APK.
- **iPhone:** needs an Apple Developer account (A$149/year). Build with
  `npx eas-cli@latest build --profile production --platform ios`, then
  `npx eas-cli@latest submit --platform ios` to send it to **TestFlight**, and install it from the TestFlight app.

### 4. Publish

- **App Store:** in App Store Connect, add screenshots, a description, a **privacy policy URL**, and the App Privacy
  answers (the app uploads photos/documents to your server for processing; it doesn't track users). Give the reviewer
  a sample statement to try. Then submit for review.
- **Google Play:** create a Play Console account (US$25 one-off). New personal accounts must run a **closed test with
  at least 12 testers for 14 days** before they can publish to everyone. Build with
  `npx eas-cli@latest build --profile production --platform android`, upload with `eas submit`, and fill in the Data
  safety form (same answers as Apple).

### Before going public

- A privacy policy page (both stores require one): what's collected (statement images/PDFs), that they're sent to
  Anthropic to be read and not stored on the server, and that saved checks stay on the device.
- The access key is built into the app, so it only stops casual misuse. Logins (per-consultant accounts) are the
  next step before wider use, and also let saved checks sync across devices.
