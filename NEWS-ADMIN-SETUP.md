# Firebase Setup Guide for the MedicoTech Website

This guide explains the News editing feature in this project, from a first-time setup through deployment. It is for the person maintaining the website. The separate **Website Content Editing Guide** is for the client who will write articles.

The existing project is `medicotech-website`. Its public connection settings are already in `js/firebase-config.js`, and the owner reports that email/password sign-in is working with an admin account. **Do not recreate that project or account to apply this update.** Follow the first-time steps only when setting up another environment. These instructions do not claim that the live project's rules or billing have been checked by the code changes.

## 1. Understand what each part does

The website still uses HTML, CSS and JavaScript. There is no WordPress installation or separate content management platform.

- **Firebase Hosting** puts the website files online and serves `/admin`, `/admin/login` and `/admin/dashboard`.
- **Firebase Authentication** checks an editor's email address and password.
- An extra permission attached to the account (**custom claim**) called `newsAdmin` decides whether that signed-in person may edit News. Creating an account alone does not grant editing access.
- **Cloud Firestore** stores the article title, text, date and image references. Think of an `articles` collection as a folder and each document as one article record.
- **Cloud Storage** stores the optional image files. It is independent of the article text. You can publish and edit text articles before Storage is enabled.
- **Security rules** are checks on Firebase's servers. They prevent visitors and ordinary signed-in accounts from changing articles or uploading images, even if they bypass the screen.

The public News page reads published articles from Firestore. Clicking an article opens the existing `news-article.html?id=...` page. Both pages use the existing public design. The admin interface is a separate workspace with the same branding.

## 2. Prepare your computer

Use a terminal opened in this project's folder, where `package.json` and `firebase.json` are located. On Windows, the examples below use PowerShell and `.cmd` to avoid script execution-policy issues.

Install a supported Node.js version (22 or later) if needed, then run:

```powershell
node --version
npm.cmd install
npx.cmd firebase login
```

The last command opens Google's sign-in process. Use a Google account allowed to manage the intended Firebase project. Installing these development tools does not change the site's HTML/CSS/JavaScript architecture.

For local tests only, install Java 21 or later and Google Chrome. The tests use local copies of Firebase services (**emulators**); they do not edit the live database.

## 3. Create or select a Firebase project

Open the [Firebase console](https://console.firebase.google.com/). Select the existing `medicotech-website` project for this site. For a separate new website, choose **Add project**, complete the prompts, and note its **Project ID**.

In the commands below, replace `YOUR_PROJECT_ID` with that exact ID. For the current site it is `medicotech-website`. Keep the same ID throughout; do not mix a demo project's database with the live website.

Inside **Project settings > General > Your apps**, add a web app if none exists. Copy its public configuration values into the existing `firebaseConfig` object in `js/firebase-config.js`. Use the configuration object only; do not paste a second set of initialization scripts into the HTML files. Keep `useEmulators = false` for the live website and Vercel demo.

These public settings identify the project. They are expected to be visible to the browser. A private service account key is different: never put one in this file, commit one, or upload one with the website.

## 4. Enable sign-in and create the client's account

1. Open **Build > Authentication** and select **Get started**, if shown.
2. Under **Sign-in method**, enable **Email/Password**. The application does not use email-link sign-in or social login.
3. Under **Settings > Authorised domains**, add the actual website domain. Add your Vercel demo domain only if it should use this project. For direct localhost testing against live Authentication, localhost may also need to be added; the automated tests use emulators instead.
4. Under **Users**, choose **Add user** and create the client's email/password account. If it already exists, use that account.
5. Copy the account's unique identifier (**UID**) from its user record. This is not its email address.

There is no self-registration or password-reset form in this admin interface. The website support person manages accounts and password assistance through Firebase.

## 5. Approve the account for News editing

The local approval script uses Google credentials for the maintainer, separate from the client's website login. Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) if needed, then sign in for local administration (**Application Default Credentials**):

```powershell
gcloud auth application-default login
npm.cmd run admin:grant -- YOUR_PROJECT_ID CLIENT_USER_UID grant
```

Replace both placeholders. The signed-in Google account needs permission to manage Firebase Authentication users in that project; a project owner can run this setup or arrange an appropriate role. `firebase login` alone does not supply the credentials used by this script.

The script sets `newsAdmin: true` while preserving other account permissions. Ask the client to sign out and back in. If the account can already open the dashboard, there is no need to grant it again.

To withdraw editing access:

```powershell
npm.cmd run admin:grant -- YOUR_PROJECT_ID CLIENT_USER_UID revoke
```

A previously issued sign-in token can remain valid until it expires, normally for up to an hour. The script prevents renewal of the existing session; it is not an instant invalidation of every already-issued token. [Firebase account permission documentation](https://firebase.google.com/docs/auth/admin/custom-claims).

## 6. Create the article database

In **Build > Firestore Database**, create the default database in production mode. Choose the location appropriate for your organisation. If it already exists, keep it.

This project's `firestore.rules` allows public reads of published articles and permits writes only with the News admin permission. Other collections are denied. If the Firebase project hosts another application, merge the rules carefully with that application's rules instead of replacing them blindly.

Deploy the article rules and the lookup configuration that supports newest-first ordering (**index**):

```powershell
npx.cmd firebase deploy --only firestore --project YOUR_PROJECT_ID
```

Wait for the index in the Firebase console to finish building. There is no need to create an article manually in the console. Publishing from `/admin` creates a document under `articles/{articleId}`.

Each article stores a title, plain-text content, publication date, `published` status, two nullable image references, and creation/update times. Existing imported articles may also have a category, summary and fixed call-to-action link.

## 7. Optionally enable image storage

**Skip this section if you only need text articles for now.** The admin remains usable without it. Failed image uploads produce a warning after the article saves.

1. Open **Build > Storage** and create a bucket if needed.
2. Firebase currently requires the **Blaze pay-as-you-go plan** to use Cloud Storage. Enable billing only if appropriate for the project, review pricing and set budget alerts. Alerts are not spending caps. [Firebase's Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
3. Copy the exact bucket name to `storageBucket` in `js/firebase-config.js`. The current configured name is `medicotech-website.firebasestorage.app`. Do not add `gs://` to this field or guess a different suffix.
4. Deploy the image access rules:

```powershell
npx.cmd firebase deploy --only storage --project YOUR_PROJECT_ID
```

Each article has two optional image slots. Accepted files are JPEG, PNG and WebP, up to 5 MB each. The browser checks whether the selected file can be read as an image; Storage rules check the declared type and size. SVG files are not accepted.

Images use paths such as `articles/ARTICLE_ID/image1/UNIQUE_VERSION`. A replacement uploads to a new version first. If it fails, the previous image reference stays unchanged. Successful replacements and removals trigger background cleanup of old files. Storage rules restrict articles to two referenced slots; they do not impose a total historical file quota on an approved editor.

Image requests have time limits. Missing settings, rejected uploads, unreadable files and network failures are handled per image. One failed image does not prevent another image from saving. On the public pages, unavailable images are omitted while the article text remains visible. The editor explains when an existing preview cannot be displayed.

## 8. Bring across the original three articles, if needed

Skip this if your articles are already in Firestore. The script reads the original `data/news.json`, preserves article IDs and text, and skips documents that already exist. It never overwrites a client's edited article.

Without image storage:

```powershell
npm.cmd run import:news -- YOUR_PROJECT_ID --without-images
```

With image storage:

```powershell
npm.cmd run import:news -- YOUR_PROJECT_ID YOUR_STORAGE_BUCKET
```

Use the same maintainer credentials prepared in step 5. The image-enabled import attempts to upload the original local images. An upload failure is reported, and the article text is still imported. You can add an image later through the editor. Re-running the import skips existing documents, so it does not attach missing images to already-imported articles.

The website reads Firestore, not `data/news.json`. Editing that old file does not update the website.

## 9. Check locally, then publish the website

Run the available checks:

```powershell
npm.cmd test
npm.cmd run test:browser
```

The first checks the Firebase access rules. The second prepares the website and opens hidden Chrome against local Firebase services. It covers editing and optional-image failures, using a dummy project named `demo-medicotech-news`. It replaces configuration only inside the test browser, leaving `js/firebase-config.js` unchanged. Screenshots are written to the ignored `test-artifacts/` folder.

If the first run needs emulator downloads, allow it to finish. Ports 5000, 8080, 9099 and 9199 must be available. If downloads encounter a certificate error on a managed computer, have the trusted certificate configured; do not disable certificate verification.

Deploy the website when ready:

```powershell
npx.cmd firebase deploy --only hosting --project YOUR_PROJECT_ID
```

The command first runs `scripts/prepare-hosting.mjs`. It creates a fresh `public/` folder containing only the website's HTML, styles, JavaScript, images and admin pages. Tests, local scripts and documentation are excluded. Do not edit `public/` directly; it is generated from the source files.

Use the Hosting URL printed by Firebase. To connect a custom domain, use **Hosting > Add custom domain** and follow Firebase's DNS instructions. Once it works, add that domain to Authentication's authorised domains too.

The Vercel demo uses the same prepared output and its existing routes. It also uses the settings in `js/firebase-config.js`: if those point to production, editing through the demo changes the same production articles. The existing GitHub Pages workflow is separate and does not deploy Firebase rules or support these configured clean admin routes.

## 10. Verify the actual website

Open a private browser window and visit `/admin`. Check that it goes to login. Sign in with the approved account, create a text article, edit it and check it on News. Try one image, two images, replacement and removal if Storage is enabled. Log out and confirm the dashboard is no longer accessible.

Saving publishes immediately; there are no drafts, automatic saving or scheduled publication. Today or past dates are allowed. Dates display in UTC and determine newest-first order.

The local tests do not verify the live project's credentials, rules, index readiness, billing, custom domain or deployment. Confirm these on the actual hosted site before handing it over.

## Troubleshooting and maintenance

- **Login works but editing permission is refused:** confirm the UID belongs to the intended project, grant `newsAdmin`, then sign out and in again.
- **News is unavailable:** check the configured project, deployed Firestore rules and finished index. An image problem should not cause this message.
- **Article saves with an image warning:** check Storage setup, billing, the bucket name and deployed Storage rules. The text is already saved; use Edit to retry the image later.
- **A preview is unavailable:** the image file may be missing or unreachable. Keeping that reference does not affect the article text. Replace or remove it if desired.
- **The article changed in another session:** copy unsaved text somewhere safe, reload, and edit the latest version. The app deliberately refuses to overwrite a newer edit.
- **Article save itself fails:** text is not guaranteed saved. Keep the form open, copy your work and check connection/Firestore access before retrying. Image fallbacks cannot overcome a database or authentication outage.
- **Unused Storage files remain:** cleanup runs separately from saving. A closed tab, lost connection or denied deletion can leave old/staged files. A maintainer can compare Storage paths against `image1`/`image2` references before removing confirmed unused files. Never delete an image just because its name is unfamiliar.

Key implementation files are `js/admin.js` (workflow), `js/article-images.js` (optional image handling), `js/firebase-client.js` and `js/firebase-config.js` (connection), `js/news-data.js` (article reads), `firestore.rules`, `storage.rules`, `firestore.indexes.json`, and `firebase.json` (hosting and services).
