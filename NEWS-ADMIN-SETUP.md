# News editing setup

The site remains plain HTML, CSS and JavaScript. Only News is editable. Public pages read `articles` from Firestore. `/admin` checks Firebase Authentication and the `newsAdmin: true` account permission before showing the editor. Security rules enforce the same permission independently of the interface. Static admin HTML itself is publicly downloadable; it contains no private data or credentials.

## Before deployment

1. Use the intended Firebase project. Copy its **public web app configuration** into `js/firebase-config.js`. Do not add service account credentials to the site or repository. Leave `useEmulators` false for deployment.
2. Enable **Authentication → Email/Password**. Add the production domain and, if needed, the Vercel demo domain under Authentication's authorised domains. Create the client's account in the Firebase console; this site deliberately has no public registration.
3. Create the default Firestore database and a Storage bucket. Confirm the bucket name from Firebase rather than guessing its suffix. Cloud Storage requires the Blaze billing plan; verify project billing and set budget alerts before enabling it.
4. Install the development tools: `npm.cmd install`. These support deployment, import and tests; the website has no frontend build framework.
5. Sign in to the Firebase command line with `npx.cmd firebase login`. For the local administration scripts, use Google Application Default Credentials with access to this project, for example `gcloud auth application-default login`. Keep credentials outside this repository. Do not send or paste private keys into the website.
6. Grant the created account its News permission, using the UID shown in Authentication:

   `npm.cmd run admin:grant -- YOUR_PROJECT_ID CLIENT_USER_UID grant`

   To remove access, use `revoke` instead of `grant`. Existing access tokens can remain valid until expiry (normally up to an hour); refresh-token revocation prevents renewal. Ask the client to sign out and in after granting access.

7. Review existing remote rules before deploying: this checkout originally had no Firebase configuration. These rules deny all access outside News. Merge them with any separately managed application rules if the Firebase project is shared; do not blindly replace rules belonging to another app.
8. Deploy the rules and News query index first:

   `npx.cmd firebase deploy --only firestore,storage --project YOUR_PROJECT_ID`

9. Import the three existing articles and their images before publishing the new website:

   `npm.cmd run import:news -- YOUR_PROJECT_ID YOUR_STORAGE_BUCKET`

   The import keeps existing article IDs, text, headings, lists, summaries and calls to action. It uploads the two original images to Storage. Existing documents are skipped, never overwritten. `data/news.json` stays in the repository as the original source, but is not used by the new public pages. Wait for the index to finish building before testing News.

10. Deploy the website:

    `npx.cmd firebase deploy --only hosting --project YOUR_PROJECT_ID`

    A preparation step copies only HTML and the `assets`, `styles`, `js` and `admin` directories into `public/`. Local tools, tests and credentials are excluded. No `.firebaserc` project is assumed; commands explicitly select the project.

## Vercel demo and existing hosting

`vercel.json` retains existing routes and adds the admin routes. It prepares the same `public/` output. The demo must have valid Firebase settings and deployed Firebase rules to use editing. There is no fallback to stale hardcoded articles: without setup, News shows an availability message and admin explains that configuration is missing. Prefer a separate Firebase project for a demo that permits editing.

The existing `.github/workflows/static.yml` publishes the repository to GitHub Pages on `master`. It has not been changed. Review whether that separate hosting workflow is still needed before launch; it does not deploy Firebase rules or provide these clean admin routes.

## Article behaviour

- Documents use `title`, plain-text `content`, `publishedAt`, `status: "published"`, `image1`, `image2`, `createdAt` and `updatedAt`. The date and audit fields are Firebase timestamps. Images are nullable Storage paths, not arbitrary HTML or external links.
- Saves publish immediately. Future publication dates are rejected; this version has no drafts or scheduled publication. Dates display consistently in UTC and articles are sorted newest first.
- The two image inputs accept JPEG, PNG or WebP, up to 5 MB each. Browser decoding checks that selected files are readable images. Storage rules independently enforce declared type and size (they cannot inspect file contents).
- Each article can reference only two image slots. Uploads use unique versions so failed replacements leave published images intact. Failed saves clean staged uploads; successful saves remove replaced files. A closed tab, network loss or failed cleanup can leave unused Storage versions; the interface reports cleanup failures. Review unused versions in Storage if a save was interrupted. Rules limit article references to two, not the total historical objects an authorised editor can create through a custom script.
- Delete requires confirmation. The document is removed first, then its images. Simultaneous edits/deletes are rejected using a database transaction rather than silently overwriting another editor's changes.
- Migrated summaries persist until their body is edited; then a summary is generated from the new body. Existing article calls to action remain fixed. Headings (`##`, `###`) and list items (`- `) are rendered with safe text elements; arbitrary HTML cannot run.
- Article images are public website content. Do not upload private material. The editor cannot manage website files, account permissions or unrelated collections.

## Verification

Run `npm.cmd test` for access-rule tests using local Firebase simulators (emulators). They use the `demo-medicotech-news` project and never connect to production. Java 21+ and Node 22+ are recommended for the development tools. The first run downloads the emulator binaries.

For an interactive local walkthrough, temporarily set public config to a dummy API key, project ID `demo-medicotech-news`, matching auth domain, bucket `demo-medicotech-news.appspot.com`, and a dummy app ID; set `useEmulators = true`. Run `npm.cmd run emulators`, create a test user in the emulator UI, and assign the `newsAdmin: true` custom claim there. Open `http://127.0.0.1:5000/admin`. Restore real public configuration and `useEmulators = false` before deploying.

Before launch, verify with the actual project: anonymous admin redirect; rejected ordinary account; editor login; create with zero/one/two images; replace/remove both slots; cancel; invalid uploads; edit; delete confirmation; public ordering; existing article links; mobile layout; logout; and browser back after logout. Local rule checks do not prove production credentials, indexes, billing, hosting or live uploads are configured.

Firebase references: [web setup](https://firebase.google.com/docs/web/setup), [account permissions](https://firebase.google.com/docs/auth/admin/custom-claims), [Storage rules](https://firebase.google.com/docs/storage/security), [Storage billing changes](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
