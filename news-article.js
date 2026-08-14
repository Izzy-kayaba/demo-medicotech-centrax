const articleElements = {
  article: document.querySelector("#article"),
  meta: document.querySelector("#article-meta"),
  title: document.querySelector("#article-title"),
  excerpt: document.querySelector("#article-excerpt"),
  content: document.querySelector("#article-content"),
  image: document.querySelector("#article-image"),
  imageElement: document.querySelector("#article-image-element"),
  action: document.querySelector("#article-action"),
  actionLabel: document.querySelector("#article-action-label"),
  actionTitle: document.querySelector("#article-action-title"),
  actionText: document.querySelector("#article-action-text"),
  actionLink: document.querySelector("#article-action-link"),
};

const createContentBlock = (block) => {
  const supportedElements = {
    paragraph: "p",
    heading: "h2",
    subheading: "h3",
  };

  if (block.type === "list" && Array.isArray(block.items)) {
    const list = document.createElement("ul");
    block.items.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      list.append(listItem);
    });
    return list;
  }

  const elementName = supportedElements[block.type];
  if (!elementName || !block.text) return null;

  const element = document.createElement(elementName);
  element.textContent = block.text;
  return element;
};

const showArticle = (article) => {
  const metaParts = [article.category, article.date || article.year].filter(Boolean);
  articleElements.meta.textContent = metaParts.join(" · ");
  articleElements.title.textContent = article.title;
  articleElements.excerpt.textContent = article.excerpt;
  document.title = `${article.title} | MedicoTech`;
  document.querySelector('meta[name="description"]').content = article.excerpt;

  articleElements.content.replaceChildren();
  (article.content || []).forEach((block) => {
    const element = createContentBlock(block);
    if (element) articleElements.content.append(element);
  });

  if (!articleElements.content.children.length) {
    const paragraph = document.createElement("p");
    paragraph.textContent = article.excerpt;
    articleElements.content.append(paragraph);
  }

  if (article.image?.src) {
    articleElements.imageElement.src = article.image.src;
    articleElements.imageElement.alt = article.image.alt || "";
    articleElements.image.hidden = false;
  }

  if (article.action?.url && article.action?.text) {
    articleElements.actionLabel.textContent = article.action.label || "Next step";
    articleElements.actionTitle.textContent = article.action.title || "Find out more";
    articleElements.actionText.textContent = article.action.description || "Continue exploring MedicoTech.";
    articleElements.actionLink.href = article.action.url;
    articleElements.actionLink.textContent = article.action.text;
    articleElements.action.hidden = false;
  }

  articleElements.article.setAttribute("aria-busy", "false");
};

const showArticleError = () => {
  articleElements.meta.textContent = "News";
  articleElements.title.textContent = "Article not found";
  articleElements.excerpt.textContent = "The article may have moved or is no longer available.";
  articleElements.content.innerHTML = "";
  const message = document.createElement("p");
  message.className = "article-error";
  message.textContent = "Return to the News page to browse the latest MedicoTech updates.";
  articleElements.content.append(message);
  document.title = "Article not found | MedicoTech";
  articleElements.article.setAttribute("aria-busy", "false");
};

const loadArticle = async () => {
  const articleId = new URLSearchParams(window.location.search).get("id");
  if (!articleId) {
    showArticleError();
    return;
  }

  try {
    const response = await fetch("news.json");
    if (!response.ok) throw new Error("News data could not be loaded.");
    const data = await response.json();
    const article = data.news.find((item) => item.id === articleId);
    if (!article) throw new Error("Article not found.");
    showArticle(article);
  } catch (error) {
    showArticleError();
  }
};

loadArticle();
