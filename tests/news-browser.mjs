// Run through `npm run test:browser`; all Firebase traffic stays in local emulators.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const projectId = 'demo-medicotech-news';
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  throw new Error('This test requires all three Firebase emulators. Never run against production.');
}
initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
const auth = getAuth(), db = getFirestore();
const password = 'Local-test-only-123!';
for (const [uid, email, claims] of [
  ['browser-editor', 'editor@example.test', { newsAdmin: true }],
  ['browser-reader', 'reader@example.test', {}],
]) {
  await auth.deleteUser(uid).catch(() => {});
  await auth.createUser({ uid, email, password });
  await auth.setCustomUserClaims(uid, claims);
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext();
await context.route('**/js/firebase-config.js', route => route.fulfill({
  contentType: 'text/javascript',
  body: `export const firebaseConfig = { apiKey: 'demo-only', projectId: '${projectId}', authDomain: '${projectId}.firebaseapp.com', storageBucket: '${projectId}.appspot.com', appId: 'demo-only' }; export const useEmulators = true;`,
}));
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = 'http://127.0.0.1:5000';
async function login(email) {
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}
const image = {
  name: 'test.png', mimeType: 'image/png',
  buffer: await page.screenshot({ clip: { x: 0, y: 0, width: 2, height: 2 } }),
};
try {
  await page.goto(`${base}/admin`);
  await page.waitForURL('**/admin/login');
  await login('reader@example.test');
  await page.getByText('Your account does not have News editing permission.', { exact: false }).waitFor();
  await login('editor@example.test');
  await page.waitForURL('**/admin/dashboard');
  await page.getByRole('button', { name: 'Add New Article', exact: true }).click();
  await page.locator('#title').fill('Browser verified article');
  await page.locator('#content').fill('First paragraph.\n\n## A heading\n\n- One\n- Two\n\n<script>window.articleInjected = true</script>');
  await page.getByRole('button', { name: 'Save / Publish' }).click();
  await page.getByText('Article published successfully.', { exact: false }).waitFor();
  const records = await db.collection('articles').where('title', '==', 'Browser verified article').get();
  assert.equal(records.size, 1);
  const articleRef = records.docs[0].ref;
  assert.equal(records.docs[0].data().image1, null);
  const publicPage = await context.newPage();
  await publicPage.goto(`${base}/news.html`);
  await publicPage.getByRole('heading', { name: 'Browser verified article' }).waitFor();
  await publicPage.locator('.card').filter({ hasText: 'Browser verified article' }).getByRole('link').click();
  await publicPage.getByRole('heading', { name: 'A heading', exact: true }).waitFor();
  assert.equal(await publicPage.evaluate(() => window.articleInjected), undefined);
  assert.equal(await publicPage.locator('#article-image').isVisible(), false);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#image1').setInputFiles(image);
  await page.getByRole('button', { name: 'Save / Publish' }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  assert.ok((await articleRef.get()).data().image1, await page.locator('#message').textContent());
  await publicPage.reload();
  await publicPage.locator('#article-image img').waitFor();
  assert.equal(await publicPage.locator('#article-image img').count(), 1);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#image2').setInputFiles(image);
  await page.getByRole('button', { name: 'Save / Publish' }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  const firstVersion = (await articleRef.get()).data().image1;
  await publicPage.reload();
  await publicPage.waitForFunction(() => document.querySelectorAll('#article-image img').length === 2);
  // Reject only image 1 uploads: text and image 2 must still save.
  const beforePartial = (await articleRef.get()).data();
  await context.route('http://127.0.0.1:9199/**', route => {
    if (route.request().method() === 'POST' && decodeURIComponent(route.request().url()).includes('/image1/')) {
      return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 403, message: 'Permission denied for simulated upload failure' } }) });
    }
    return route.continue();
  });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#title').fill('Partial image failure');
  await page.locator('#image1').setInputFiles(image);
  await page.locator('#image2').setInputFiles(image);
  await page.getByRole('button', { name: 'Save / Publish' }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  await page.getByText('Image 1 was not uploaded.', { exact: false }).waitFor();
  const afterPartial = (await articleRef.get()).data();
  assert.equal(afterPartial.title, 'Partial image failure');
  assert.equal(afterPartial.image1, beforePartial.image1);
  assert.notEqual(afterPartial.image2, beforePartial.image2);
  await context.unroute('http://127.0.0.1:9199/**');
  // A valid download URL can still fail when the browser requests its pixels.
  await context.route('http://127.0.0.1:9199/**', route => {
    if (new URL(route.request().url()).searchParams.get('alt') === 'media') return route.fulfill({ status: 404, body: '' });
    return route.continue();
  });
  await publicPage.reload();
  await publicPage.getByRole('heading', { name: 'Partial image failure' }).waitFor();
  await publicPage.getByRole('heading', { name: 'A heading', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#preview1').getByText('Image preview unavailable.', { exact: false }).waitFor();
  assert.equal(await publicPage.locator('#article-image').isVisible(), false);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await context.unroute('http://127.0.0.1:9199/**');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#image1').setInputFiles(image);
  await page.locator('#remove2').check();
  await page.locator('#title').fill('Updated browser article');
  await page.getByRole('button', { name: 'Save / Publish' }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  const updated = (await articleRef.get()).data();
  assert.notEqual(updated.image1, firstVersion);
  assert.equal(updated.image2, null);
  for (let attempt = 0; attempt < 50 && (await getStorage().bucket().file(firstVersion).exists())[0]; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal((await getStorage().bucket().file(firstVersion).exists())[0], false);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#remove1').check();
  await page.getByRole('button', { name: 'Save / Publish' }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  assert.equal((await articleRef.get()).data().image1, null);
  // An independent edit must not be silently overwritten by an old form.
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await articleRef.update({ title: 'Changed elsewhere', updatedAt: new Date() });
  await page.locator('#title').fill('Stale edit');
  await page.getByRole('button', { name: 'Save / Publish' }).click();
  await page.getByText('This article changed in another session.', { exact: false }).waitFor();
  assert.equal((await articleRef.get()).data().title, 'Changed elsewhere');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  await page.getByRole('heading', { name: 'Changed elsewhere' }).waitFor();
  await page.screenshot({ path: 'test-artifacts/admin-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'test-artifacts/admin-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'test-artifacts/editor-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.screenshot({ path: 'test-artifacts/editor-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  assert.equal((await articleRef.get()).exists, true);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByText('Article deleted successfully.', { exact: true }).waitFor();
  assert.equal((await articleRef.get()).exists, false);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.waitForURL('**/admin/login');
  await page.screenshot({ path: 'test-artifacts/login-desktop.png', fullPage: true });
  await page.goto(`${base}/admin/dashboard`);
  await page.waitForURL('**/admin/login');
  assert.deepEqual(errors, []);
  // No bucket configuration: Authentication and article writes still work.
  await context.route('**/js/firebase-config.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const firebaseConfig = { apiKey: 'demo-only', projectId: '${projectId}', authDomain: '${projectId}.firebaseapp.com', appId: 'demo-only' }; export const useEmulators = true;` }));
  await page.reload();
  await login('editor@example.test');
  await page.waitForURL('**/admin/dashboard');
  await page.getByRole('button', { name: 'Add New Article', exact: true }).click();
  await page.locator('#title').fill('No Storage configured');
  await page.locator('#content').fill('This article must publish even without image storage.');
  await page.locator('#image1').setInputFiles(image);
  await page.getByRole('button', { name: 'Save / Publish' }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  await page.getByText('Image 1 was not uploaded.', { exact: false }).waitFor();
  const noStorage = await db.collection('articles').where('title', '==', 'No Storage configured').get();
  assert.equal(noStorage.size, 1);
  assert.equal(noStorage.docs[0].data().image1, null);
  await publicPage.goto(`${base}/news.html`);
  await publicPage.getByRole('heading', { name: 'No Storage configured' }).waitFor();
  // Invalid optional files are reported, but do not discard the article text.
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#title').fill('Invalid image safely skipped');
  await page.locator('#image1').setInputFiles({ name: 'invalid.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg></svg>') });
  await page.getByRole('button', { name: 'Save / Publish' }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  assert.equal((await noStorage.docs[0].ref.get()).data().title, 'Invalid image safely skipped');
  console.log('PASS: redirects, account permissions, CRUD, 0/1/2 images, replacements, removals, cleanup, partial upload failure, broken image responses, missing Storage, invalid files, safe text, stale edits, cancel, responsive screens, logout.');
} catch (error) {
  console.error('Browser message:', await page.locator('#message').textContent().catch(() => 'No message'));
  await page.screenshot({ path: 'test-artifacts/failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
