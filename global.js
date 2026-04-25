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

let pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'contact/', title: 'Contact' },
  { url: 'cv/', title: 'CV' },
  { url: 'https://github.com/bigmacchung', title: 'GitHub' },
];

let nav = document.createElement('nav');
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  let title = p.title;

  // Prefix relative (internal) URLs with BASE_PATH.
  url = !url.startsWith('http') ? BASE_PATH + url : url;

  let a = document.createElement('a');
  a.href = url;
  a.textContent = title;

  // Highlight the link for the current page.
  a.classList.toggle(
    'current',
    a.host === location.host && a.pathname === location.pathname,
  );

  // External links (different host) open in a new tab.
  if (a.host !== location.host) {
    a.target = '_blank';
  }

  nav.append(a);
}

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
    const image = project.image ?? 'https://vis-society.github.io/labs/2/images/empty.svg';
    const description = project.description ?? '';
    const year = project.year ?? '';
    const link = project.link ?? '';

    // If the project has a link, resolve it against BASE_PATH when it's relative
    // (so it works both on localhost and under /portfolio/ on GitHub Pages),
    // and wrap the heading + image in an <a>.
    const resolvedLink = link
      ? link.startsWith('http')
        ? link
        : BASE_PATH + link
      : '';

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
