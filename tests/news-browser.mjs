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
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=', 'base64'),
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
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#image1').setInputFiles(image);
  await page.locator('#remove2').check();
  await page.locator('#title').fill('Updated browser article');
  await page.getByRole('button', { name: 'Save / Publish' }).click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  const updated = (await articleRef.get()).data();
  assert.notEqual(updated.image1, firstVersion);
  assert.equal(updated.image2, null);
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
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  assert.equal((await articleRef.get()).exists, true);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByText('Article deleted successfully.', { exact: true }).waitFor();
  assert.equal((await articleRef.get()).exists, false);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.waitForURL('**/admin/login');
  await page.goto(`${base}/admin/dashboard`);
  await page.waitForURL('**/admin/login');
  assert.deepEqual(errors, []);
  console.log('PASS: redirects, account permissions, create/read/update/delete, 0/1/2 images, replacement/removal, cleanup, safe text, stale edits, cancel, mobile width, logout.');
} finally {
  await browser.close();
}
