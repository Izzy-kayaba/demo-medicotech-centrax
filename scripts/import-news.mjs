import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
const [projectId, bucketArgument] = process.argv.slice(2);
const withoutImages = process.argv.includes('--without-images');
const storageBucket = bucketArgument?.startsWith('--') ? undefined : bucketArgument;
if (!projectId || (!storageBucket && !withoutImages)) throw new Error('Usage: npm run import:news -- PROJECT_ID STORAGE_BUCKET | PROJECT_ID --without-images');
initializeApp({ projectId, storageBucket, credential: applicationDefault() });
const db = getFirestore(), bucket = withoutImages ? null : getStorage().bucket();
const root = fileURLToPath(new URL('../', import.meta.url));
const { news } = JSON.parse(await readFile(resolve(root, 'data/news.json'), 'utf8'));
for (const article of news) {
  const reference = db.doc(`articles/${article.id}`);
  if ((await reference.get()).exists) { console.log(`Skipped existing article: ${article.id}`); continue; }
  let image1 = null;
  try {
    if (article.image?.src && bucket) {
      const path = `articles/${article.id}/image1/${randomUUID()}`;
      try {
        await bucket.upload(resolve(root, article.image.src), {
          destination: path,
          metadata: { contentType: 'image/jpeg', metadata: { firebaseStorageDownloadTokens: randomUUID() } },
        });
        image1 = path;
      } catch {
        console.warn(`Image skipped for ${article.id}. The article text will still be imported; add the image through admin later.`);
      }
    }
    const content = article.content.map(block => block.type === 'list' ? block.items.map(item => `- ${item}`).join('\n') : `${block.type === 'heading' ? '## ' : block.type === 'subheading' ? '### ' : ''}${block.text}`).join('\n\n');
    // Source dates use English month names; append UTC to avoid machine timezone drift.
    await reference.create({
      title: article.title, content, category: article.category, excerpt: article.excerpt,
      action: article.action, publishedAt: Timestamp.fromDate(new Date(`${article.date} 00:00:00 UTC`)),
      status: 'published', image1, image2: null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`Imported ${article.id}`);
  } catch (error) {
    if (image1) await bucket.file(image1).delete({ ignoreNotFound: true }).catch(() => console.error(`Unused image needs cleanup: ${image1}`));
    throw error;
  }
}
