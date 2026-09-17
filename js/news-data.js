import { collection, doc, getDoc, getDocs, query, orderBy, where } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
// import { ref, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';
import { getFirebase } from './firebase-client.js';
export async function listArticles() {
  const result = await getDocs(query(collection(getFirebase().db, 'articles'), where('status', '==', 'published'), orderBy('publishedAt', 'desc')));
  return result.docs.map(record => ({ ...record.data(), id: record.id }));
}
export async function getArticle(id) {
  if (!id || id.includes('/')) return null;
  const result = await getDoc(doc(getFirebase().db, 'articles', id));
  return result.exists() ? { ...result.data(), id: result.id } : null;
}
export function formatDate(timestamp) {
  return new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(timestamp.toDate());
}
export function summary(article) {
  return article.excerpt || article.content.replace(/^#{1,3} |^- /gm, '').slice(0, 220) + (article.content.length > 220 ? '…' : '');
}
// Images are currently disabled because Firebase Storage is not configured.
// export async function appendImages(container, article) {
//   for (const path of [article.image1, article.image2].filter(Boolean)) {
//     try {
//       const img = document.createElement('img');
//       img.src = await getDownloadURL(ref(getFirebase().storage, path));
//       img.alt = article.title;
//       img.loading = 'lazy';
//       container.append(img);
//     } catch {
//       const note = document.createElement('p');
//       note.textContent = 'An article image is temporarily unavailable.';
//       container.append(note);
//     }
//   }
// }
// Only headings, lists and paragraphs; supplied HTML remains harmless text.
export function renderContent(container, content) {
  container.replaceChildren();
  for (const block of content.split(/\n\s*\n/).filter(Boolean)) {
    if (block.split('\n').every(line => line.startsWith('- '))) {
      const list = document.createElement('ul');
      for (const line of block.split('\n')) {
        const item = document.createElement('li');
        item.textContent = line.slice(2);
        list.append(item);
      }
      container.append(list);
    } else {
      const heading = block.match(/^(#{2,3}) (.+)$/);
      const element = document.createElement(heading ? (heading[1].length === 2 ? 'h2' : 'h3') : 'p');
      element.textContent = heading ? heading[2] : block;
      container.append(element);
    }
  }
}
