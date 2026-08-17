// Cache the article elements once so rendering functions do not repeatedly search the document.
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

/**
 * Convert a structured content record into an allowed HTML element.
 * Using textContent keeps article data as plain text instead of executing markup from the data file.
 */
const createContentBlock = (block) => {
  // This allow-list limits dynamic headings and paragraphs to the elements supported by the template.
  const supportedElements = {
    paragraph: "p",
    heading: "h2",
    subheading: "h3",
  };

  // Lists contain multiple values, so each item needs its own safely created list element.
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
  // Ignore unsupported or incomplete records instead of allowing them to break the article.
  if (!elementName || !block.text) return null;

  const element = document.createElement(elementName);
  element.textContent = block.text;
  return element;
};

/**
 * Populate the reusable template with one article record from the shared news data.
 */
const showArticle = (article) => {
  // Remove empty metadata values so the separator appears only when both values are available.
  const metaParts = [article.category, article.date || article.year].filter(Boolean);
  articleElements.meta.textContent = metaParts.join(" · ");
  articleElements.title.textContent = article.title;
  articleElements.excerpt.textContent = article.excerpt;
  document.title = `${article.title} | MedicoTech`;
  // Match the page description to the selected article for search results and shared links.
  document.querySelector('meta[name="description"]').content = article.excerpt;

  // Clear loading content before adding the structured blocks for the selected article.
  articleElements.content.replaceChildren();
  (article.content || []).forEach((block) => {
    const element = createContentBlock(block);
    if (element) articleElements.content.append(element);
  });

  // Use the excerpt as useful body content when an article has no detailed content blocks yet.
  if (!articleElements.content.children.length) {
    const paragraph = document.createElement("p");
    paragraph.textContent = article.excerpt;
    articleElements.content.append(paragraph);
  }

  // Keep the image area removed from the layout when the article does not provide an image.
  if (article.image?.src) {
    articleElements.imageElement.src = article.image.src;
    articleElements.imageElement.alt = article.image.alt || "";
    articleElements.image.hidden = false;
  }

  // Display the action section only when both a destination and visible link label are provided.
  if (article.action?.url && article.action?.text) {
    articleElements.actionLabel.textContent = article.action.label || "Next step";
    articleElements.actionTitle.textContent = article.action.title || "Find out more";
    articleElements.actionText.textContent = article.action.description || "Continue exploring MedicoTech.";
    articleElements.actionLink.href = article.action.url;
    articleElements.actionLink.textContent = article.action.text;
    articleElements.action.hidden = false;
  }

  // Tell assistive technology that all dynamic article content has finished loading.
  articleElements.article.setAttribute("aria-busy", "false");
};

/**
 * Replace the loading state with a clear recovery message when an article cannot be displayed.
 */
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

/**
 * Read the requested article ID, load the shared news data, and render the matching record.
 */
const loadArticle = async () => {
  // The query parameter lets every news card reuse this page with a different article record.
  const articleId = new URLSearchParams(window.location.search).get("id");
  if (!articleId) {
    showArticleError();
    return;
  }

  try {
    // Fetching one shared data file keeps article content separate from the reusable page design.
    const response = await fetch("data/news.json");
    if (!response.ok) throw new Error("News data could not be loaded.");
    const data = await response.json();
    const article = data.news.find((item) => item.id === articleId);
    if (!article) throw new Error("Article not found.");
    showArticle(article);
  } catch (error) {
    // Network failures, invalid JSON, and unknown IDs all lead to the same user-friendly state.
    showArticleError();
  }
};

loadArticle();
