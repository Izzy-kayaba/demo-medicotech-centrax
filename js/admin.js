import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

// Firebase Storage is currently disabled.
// import {
//   ref,
//   uploadBytes,
//   deleteObject,
//   getDownloadURL
// } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';

import { getFirebase } from './firebase-client.js';
import { listArticles, formatDate } from './news-data.js';

const $ = id => document.getElementById(id);
const page = document.body.dataset.adminPage;

let services;
let editing = null;
let busy = false;
let dirty = false;

function message(text) {
  $('message').textContent = text;
}

function errorMessage(error) {
  if (error.code === 'permission-denied') {
    return 'Your account does not have permission. Please sign in again or contact the site administrator.';
  }

  if (error.code?.startsWith('auth/')) {
    return 'Unable to log in. Check your email and password, or contact the site administrator.';
  }

  return error.message || 'The operation failed. Please try again.';
}

function setBusy(value) {
  busy = value;

  document
    .querySelectorAll('#dashboard button')
    .forEach(button => {
      button.disabled = value;
    });

  $('editor-fields').disabled = value;
}

function dateValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function discard() {
  return !dirty || confirm('Discard your unsaved article changes?');
}

function openEditor(article = null) {
  if (busy || !discard()) return;

  editing = article;
  dirty = false;

  $('article-form').reset();

  $('editor-heading').textContent = article
    ? 'Edit article'
    : 'New article';

  $('title').value = article?.title || '';
  $('content').value = article?.content || '';

  $('publishedAt').max = dateValue();

  $('publishedAt').value = article
    ? dateValue(article.publishedAt.toDate())
    : dateValue();

  $('editor').hidden = false;
  $('title').focus();
}

function closeEditor() {
  editing = null;
  dirty = false;
  $('editor').hidden = true;
}

async function refresh() {
  $('list-status').textContent = 'Loading articles…';

  const articles = await listArticles();

  $('articles').replaceChildren();

  for (const article of articles) {
    const row = document.createElement('article');
    row.className = 'admin-article';

    const title = document.createElement('h3');
    title.textContent = article.title;

    const meta = document.createElement('p');
    meta.textContent = `Published · ${formatDate(article.publishedAt)}`;

    // Images are currently disabled.
    // const images = document.createElement('div');
    // images.className = 'admin-thumbnails';

    const actions = document.createElement('div');
    actions.className = 'button-row';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.onclick = () => openEditor(article);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.onclick = () => deleteArticle(article);

    actions.append(edit, remove);

    // Images are currently disabled.
    // row.append(title, meta, images, actions);

    row.append(title, meta, actions);

    $('articles').append(row);

    // Images are currently disabled.
    // void appendImages(images, article);
  }

  $('list-status').textContent = articles.length
    ? ''
    : 'No articles yet. Select Add New Article to get started.';
}

async function refreshAfterWrite() {
  try {
    await refresh();
  } catch {
    $('list-status').textContent =
      'The change was saved, but the list could not refresh. Reload this page.';
  }
}

async function deleteArticle(article) {
  if (
    busy ||
    !discard() ||
    !confirm(`Delete “${article.title}”? This cannot be undone.`)
  ) {
    return;
  }

  setBusy(true);

  try {
    const reference = doc(services.db, 'articles', article.id);

    await runTransaction(services.db, async transaction => {
      const current = await transaction.get(reference);

      if (
        !current.exists() ||
        !current.data().updatedAt.isEqual(article.updatedAt)
      ) {
        throw new Error(
          'This article changed in another session. Reload before deleting.'
        );
      }

      transaction.delete(reference);
    });

    closeEditor();

    message('Article deleted successfully.');

    await refreshAfterWrite();
  } catch (error) {
    message(errorMessage(error));
  } finally {
    setBusy(false);
  }
}

async function save(event) {
  event.preventDefault();

  if (busy) return;

  setBusy(true);
  message('Saving article…');

  try {
    const title = $('title').value.trim();
    const content = $('content').value.trim();

    const date = new Date(
      `${$('publishedAt').value}T00:00:00Z`
    );

    if (!title || !content) {
      throw new Error('Title and content are required.');
    }

    if (!Number.isFinite(date.getTime()) || date > new Date()) {
      throw new Error(
        'Choose today or a past publication date.'
      );
    }

    const reference = editing
      ? doc(services.db, 'articles', editing.id)
      : doc(collection(services.db, 'articles'));

    const data = {
      title,
      content,
      status: 'published',
      publishedAt: Timestamp.fromDate(date),

      // Images are currently disabled.
      image1: null,
      image2: null,

      createdAt: editing?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    for (const key of ['category', 'action']) {
      if (editing?.[key]) {
        data[key] = editing[key];
      }
    }

    // Keep the original summary unless the body has changed.
    if (
      editing?.excerpt &&
      content === editing.content
    ) {
      data.excerpt = editing.excerpt;
    }

    await runTransaction(services.db, async transaction => {
      const current = await transaction.get(reference);

      if (
        editing &&
        (
          !current.exists() ||
          !current.data().updatedAt.isEqual(editing.updatedAt)
        )
      ) {
        throw new Error(
          'This article changed in another session. Copy your changes, then reload before saving.'
        );
      }

      if (!editing && current.exists()) {
        throw new Error(
          'This article already exists. Please reload.'
        );
      }

      transaction.set(reference, data);
    });

    closeEditor();

    message(
      'Article published successfully. It is now available on the News page.'
    );

    await refreshAfterWrite();
  } catch (error) {
    message(errorMessage(error));
  } finally {
    setBusy(false);
  }
}

function wireDashboard() {
  $('add-article').onclick = () => openEditor();

  $('cancel').onclick = () => {
    if (discard()) {
      closeEditor();
    }
  };

  $('logout').onclick = async () => {
    if (!discard()) return;

    try {
      dirty = false;
      await signOut(services.auth);
    } catch (error) {
      message(errorMessage(error));
    }
  };

  $('article-form').onsubmit = save;

  $('article-form').oninput = () => {
    dirty = true;
  };

  // Image event handlers are intentionally disabled.
  //
  // for (const slot of [1, 2]) {
  //   $(`image${slot}`).onchange = ...
  //   $(`remove${slot}`).onchange = ...
  // }

  window.addEventListener('beforeunload', event => {
    if (dirty || busy) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

try {
  services = getFirebase();

  await setPersistence(
    services.auth,
    browserSessionPersistence
  );

  if (page === 'dashboard') {
    wireDashboard();
  }

  if (page === 'login') {
    $('login-form').onsubmit = async event => {
      event.preventDefault();

      const button = event.currentTarget.querySelector('button');

      button.disabled = true;

      message('Signing in…');

      try {
        await signInWithEmailAndPassword(
          services.auth,
          $('email').value.trim(),
          $('password').value
        );
      } catch (error) {
        message(errorMessage(error));
      } finally {
        button.disabled = false;
      }
    };
  }

  onIdTokenChanged(services.auth, async user => {
    if (page === 'dashboard') {
      $('dashboard').hidden = true;
    }

    try {
      if (!user) {
        if (page !== 'login') {
          location.replace('/admin/login');
          return;
        }

        $('login-form').hidden = false;

        if (!$('message').textContent.includes('permission')) {
          message('');
        }

        return;
      }

      const token = await user.getIdTokenResult();

      if (token.claims.newsAdmin !== true) {
        message(
          'Your account does not have News editing permission. Contact the site administrator.'
        );

        await signOut(services.auth);
        return;
      }

      if (page !== 'dashboard') {
        location.replace('/admin/dashboard');
        return;
      }

      $('dashboard').hidden = false;
      $('account').textContent = user.email;

      message('');

      await refresh();
    } catch (error) {
      message(errorMessage(error));
    }
  });
} catch (error) {
  message(errorMessage(error));
}