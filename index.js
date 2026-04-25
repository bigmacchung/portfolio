import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

// ---------- Latest projects ----------

const projects = await fetchJSON('./lib/projects.json');
const latestProjects = Array.isArray(projects) ? projects.slice(0, 3) : [];

const projectsContainer = document.querySelector('.projects');
renderProjects(latestProjects, projectsContainer, 'h2');

// ---------- GitHub profile stats ----------

const githubData = await fetchGitHubData('bigmacchung');

const profileStats = document.querySelector('#profile-stats');

if (profileStats && githubData) {
  profileStats.innerHTML = `
    <h2>My GitHub Stats</h2>
    <dl>
      <dt>Public Repos:</dt><dd>${githubData.public_repos ?? '—'}</dd>
      <dt>Public Gists:</dt><dd>${githubData.public_gists ?? '—'}</dd>
      <dt>Followers:</dt><dd>${githubData.followers ?? '—'}</dd>
      <dt>Following:</dt><dd>${githubData.following ?? '—'}</dd>
    </dl>
  `;
}
