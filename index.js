import {
  fetchJSON,
  renderProjects,
  fetchGitHubData,
  fetchHomeViews,
} from './global.js';

// ---------- Latest projects ----------

const projects = await fetchJSON('./lib/projects.json');
const latestProjects = Array.isArray(projects) ? projects.slice(0, 3) : [];

const projectsContainer = document.querySelector('.projects');
// Use h3 for project titles since the section already has an h2 heading.
renderProjects(latestProjects, projectsContainer, 'h3');

// ---------- GitHub profile stats + site traffic ----------

// Fire both requests in parallel — they're independent, no need to wait sequentially.
const [githubData, homeViews] = await Promise.all([
  fetchGitHubData('bigmacchung'),
  fetchHomeViews(),
]);

const profileStats = document.querySelector('#profile-stats');

if (profileStats && githubData) {
  profileStats.innerHTML = `
    <dl>
      <dt>Public Repos:</dt><dd>${githubData.public_repos ?? '—'}</dd>
      <dt>Followers:</dt><dd>${githubData.followers ?? '—'}</dd>
      <dt>Following:</dt><dd>${githubData.following ?? '—'}</dd>
      <dt>Home Page Views:</dt><dd>${homeViews ?? '—'}</dd>
    </dl>
  `;
}
