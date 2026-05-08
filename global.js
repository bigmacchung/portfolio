console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// ---------- Step 3: Automatic navigation menu ----------

// Detect whether we're running locally or on GitHub Pages so internal links work in both.
const BASE_PATH =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? '/' // Local server
    : '/portfolio/'; // GitHub Pages repo name

// Primary navigation: simplified to just Home — the rest of the site is reachable
// from the homepage's "On this page" / "Other links" / "Learning resources" pills
// and from the in-section links (e.g. clickable "Latest Projects" heading).
const primaryPages = [
  { url: '', title: 'Home' },
  { url: 'meta/', title: 'Meta' },
];

// Secondary "other links": personal documents and external profiles.
const otherLinks = [
  { url: 'cv/', title: 'CV' },
  { url: 'https://github.com/bigmacchung', title: 'GitHub' },
  { url: 'https://www.linkedin.com/in/maximechung', title: 'LinkedIn' },
];

const nav = document.createElement('nav');
document.body.prepend(nav);

// Helper that turns a {url, title} entry into a fully wired-up <a>.
function makeNavLink({ url, title }) {
  // Prefix relative (internal) URLs with BASE_PATH so they work both locally
  // and under /portfolio/ on GitHub Pages.
  const href = !url.startsWith('http') ? BASE_PATH + url : url;

  const a = document.createElement('a');
  a.href = href;
  a.textContent = title;

  // Highlight the link for the current page.
  a.classList.toggle(
    'current',
    a.host === location.host && a.pathname === location.pathname,
  );

  // External links (different host) open in a new tab.
  // rel="noopener noreferrer" prevents the new tab from accessing window.opener
  // (security best practice for any target="_blank" link to a third-party site).
  if (a.host !== location.host) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }

  return a;
}

// Top row — primary tabs.
const primaryRow = document.createElement('div');
primaryRow.className = 'nav-primary';
for (const page of primaryPages) {
  primaryRow.append(makeNavLink(page));
}
nav.append(primaryRow);

// ---------- Step 4: Dark-mode switch ----------

document.body.insertAdjacentHTML(
  'afterbegin',
  `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>`,
);

let select = document.querySelector('.color-scheme select');

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty('color-scheme', colorScheme);
  select.value = colorScheme;
}

// Restore the user's saved preference if any.
if ('colorScheme' in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

select.addEventListener('input', (event) => {
  setColorScheme(event.target.value);
  localStorage.colorScheme = event.target.value;
});

// ---------- Step 5: Better contact form ----------

let form = document.querySelector('form[action^="mailto:"]');

form?.addEventListener('submit', (event) => {
  event.preventDefault();

  let data = new FormData(form);
  let params = [];

  for (let [name, value] of data) {
    params.push(`${name}=${encodeURIComponent(value)}`);
  }

  let url = `${form.action}?${params.join('&')}`;
  location.href = url;
});

// ---------- Lab 4 Step 1.2: Fetching JSON data ----------

export async function fetchJSON(url) {
  try {
    // Fetch the JSON file from the given URL.
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

// ---------- Lab 4 Step 1.4: Rendering project articles ----------

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  // Defensive checks so the function is robust against bad input.
  if (!containerElement || !(containerElement instanceof HTMLElement)) {
    console.error('renderProjects: containerElement is not a valid DOM element.');
    return;
  }

  // Clear out anything that's already in the container so we don't duplicate.
  containerElement.innerHTML = '';

  // Validate the heading level — fall back to h2 if someone passes garbage.
  const validHeadings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  const heading = validHeadings.includes(headingLevel) ? headingLevel : 'h2';

  // Handle the empty case with a friendly placeholder.
  if (!Array.isArray(projects) || projects.length === 0) {
    containerElement.innerHTML = '<p>No projects to display yet — check back soon!</p>';
    return;
  }

  for (const project of projects) {
    const article = document.createElement('article');

    // Pull each field with a fallback so missing data doesn't render "undefined".
    const title = project.title ?? 'Untitled project';
    const rawImage = project.image ?? 'https://vis-society.github.io/labs/2/images/empty.svg';
    const description = project.description ?? '';
    const year = project.year ?? '';
    const link = project.link ?? '';

    // Resolve relative paths (image and link) against BASE_PATH so they work both
    // on localhost and under /portfolio/ on GitHub Pages, regardless of which page
    // we're rendering from.
    const resolvePath = (path) =>
      path && !path.startsWith('http') && !path.startsWith('/')
        ? BASE_PATH + path
        : path;

    const image = resolvePath(rawImage);
    const resolvedLink = link ? resolvePath(link) : '';

    const headingHTML = resolvedLink
      ? `<${heading}><a href="${resolvedLink}" target="_blank" rel="noopener noreferrer">${title}</a></${heading}>`
      : `<${heading}>${title}</${heading}>`;

    const imageHTML = resolvedLink
      ? `<a href="${resolvedLink}" target="_blank" rel="noopener noreferrer"><img src="${image}" alt="${title}"></a>`
      : `<img src="${image}" alt="${title}">`;

    article.innerHTML = `
      ${headingHTML}
      ${imageHTML}
      <div class="project-text">
        <p>${description}</p>
        ${year ? `<p class="project-year">c. ${year}</p>` : ''}
      </div>
    `;

    containerElement.appendChild(article);
  }
}

// ---------- Lab 4 Step 3.2: Fetching GitHub profile data ----------

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}

// ---------- Site traffic: home-page view counter ----------
// counterapi.dev is a free, no-auth public counter service. Each call increments
// the counter and returns the new total. Failures are logged but never break the
// page — we just show a dash for the count.
export async function fetchHomeViews() {
  try {
    const response = await fetch(
      'https://api.counterapi.dev/v1/bigmacchung-portfolio/home-views/up',
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.count ?? null;
  } catch (error) {
    console.error('Could not update view counter:', error);
    return null;
  }
}
