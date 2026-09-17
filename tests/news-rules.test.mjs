import { readFile } from 'node:fs/promises';
import { before, after, beforeEach, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, collection, query, where, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, deleteObject, getBytes } from 'firebase/storage';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-medicotech-news',
    firestore: { rules: await readFile('firestore.rules', 'utf8') },
    storage: { rules: await readFile('storage.rules', 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await env.clearStorage(); });
const article = () => ({ title: 'News title', content: 'Article content', status: 'published', publishedAt: Timestamp.fromMillis(1000), image1: null, image2: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const editor = () => env.authenticatedContext('editor', { newsAdmin: true });
async function seed(id = 'sample', overrides = {}) {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'articles', id), { ...article(), ...overrides });
  });
}
test('anonymous visitors can read published articles and the ordered public query', async () => {
  await seed();
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, 'articles/sample')));
  await assertSucceeds(getDocs(query(collection(db, 'articles'), where('status', '==', 'published'), orderBy('publishedAt', 'desc'))));
});
test('anonymous visitors cannot read unpublished documents or an unrestricted collection', async () => {
  await seed('private', { status: 'draft' });
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'articles/private')));
  await assertFails(getDocs(collection(db, 'articles')));
});
for (const role of ['anonymous', 'ordinary', 'false-claim']) {
  test(`${role} cannot create, update or delete articles`, async () => {
    await seed();
    const context = role === 'anonymous' ? env.unauthenticatedContext() : env.authenticatedContext(role, role === 'false-claim' ? { newsAdmin: false } : {});
    const db = context.firestore();
    await assertFails(setDoc(doc(db, 'articles/new'), article()));
    await assertFails(updateDoc(doc(db, 'articles/sample'), { title: 'Changed', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, 'articles/sample')));
  });
}
test('approved editor can create, update and delete articles with zero, one or two images', async () => {
  const db = editor().firestore(), reference = doc(db, 'articles/sample');
  await assertSucceeds(setDoc(reference, article()));
  await assertSucceeds(updateDoc(reference, { image1: 'articles/sample/image1/version-1', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(reference, { image2: 'articles/sample/image2/version-2', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(reference, { image1: null, updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(reference));
});
for (const [name, overrides] of Object.entries({
  'empty title': { title: '' }, 'empty content': { content: '' },
  'blank title': { title: '   ' }, 'blank content': { content: ' \n\t ' },
  'oversized title': { title: 'a'.repeat(201) }, 'oversized body': { content: 'a'.repeat(100001) },
  'third image': { image3: 'articles/sample/image3/extra' },
  'foreign image': { image1: 'articles/another/image1/version' },
  'wrong slot': { image2: 'articles/sample/image1/version' },
  'external image': { image1: 'https://example.com/image.png' },
  'future date': { publishedAt: Timestamp.fromMillis(Date.now() + 86400000) },
  'string date': { publishedAt: '2026-01-01' }, 'draft status': { status: 'draft' },
  'forged timestamp': { updatedAt: Timestamp.fromMillis(1000) },
  'unknown field': { navigation: 'changed' }, 'unsafe link': { action: { url: 'javascript:alert(1)' } },
})) {
  test(`rules reject ${name}`, async () => {
    await assertFails(setDoc(doc(editor().firestore(), 'articles/sample'), { ...article(), ...overrides }));
  });
}
test('createdAt cannot be changed and no user can change unrelated collections or grant permissions', async () => {
  await seed();
  const db = editor().firestore();
  await assertFails(updateDoc(doc(db, 'articles/sample'), { createdAt: Timestamp.fromMillis(42), updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, 'pages/about'), { content: 'changed' }));
  await assertFails(setDoc(doc(db, 'users/editor'), { newsAdmin: true }));
});
const bytes = new Uint8Array([137, 80, 78, 71]);
test('approved editor can upload both slots; public visitors can read them; editor can delete', async () => {
  const storage = editor().storage();
  for (const slot of ['image1', 'image2']) {
    const path = `articles/sample/${slot}/version`;
    await assertSucceeds(uploadBytes(ref(storage, path), bytes, { contentType: 'image/png' }));
    await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), path)));
    await assertSucceeds(deleteObject(ref(storage, path)));
  }
});
for (const role of ['anonymous', 'ordinary']) {
  test(`${role} cannot upload or delete images`, async () => {
    const path = 'articles/sample/image1/version';
    await uploadBytes(ref(editor().storage(), path), bytes, { contentType: 'image/png' });
    const storage = (role === 'anonymous' ? env.unauthenticatedContext() : env.authenticatedContext(role)).storage();
    await assertFails(uploadBytes(ref(storage, 'articles/sample/image2/new'), bytes, { contentType: 'image/png' }));
    await assertFails(deleteObject(ref(storage, path)));
  });
}
test('Storage rejects third slots, unrelated uploads, SVG, incorrect types, empty and oversized files', async () => {
  const storage = editor().storage();
  for (const path of ['articles/sample/image3/version', 'website/logo']) {
    await assertFails(uploadBytes(ref(storage, path), bytes, { contentType: 'image/png' }));
  }
  for (const type of ['image/svg+xml', 'text/html', 'application/octet-stream']) {
    await assertFails(uploadBytes(ref(storage, 'articles/sample/image1/version'), bytes, { contentType: type }));
  }
  await assertFails(uploadBytes(ref(storage, 'articles/sample/image1/empty'), new Uint8Array(), { contentType: 'image/png' }));
  await assertFails(uploadBytes(ref(storage, 'articles/sample/image1/large'), new Uint8Array(5 * 1024 * 1024 + 1), { contentType: 'image/png' }));
});
test('existing image versions cannot be overwritten', async () => {
  const target = ref(editor().storage(), 'articles/sample/image1/version');
  await assertSucceeds(uploadBytes(target, bytes, { contentType: 'image/png' }));
  await assertFails(uploadBytes(target, bytes, { contentType: 'image/png' }));
});
