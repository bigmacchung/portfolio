import { fetchJSON, renderProjects } from '../global.js';

// Load the project data from our JSON file.
const projects = await fetchJSON('../lib/projects.json');

// Find the container that should hold the project articles.
const projectsContainer = document.querySelector('.projects');

// Render every project, using <h2> for each project's title.
renderProjects(projects, projectsContainer, 'h2');

// Step 1.6: Update the projects-title heading with the count of projects.
const projectsTitle = document.querySelector('.projects-title');
if (projectsTitle) {
  const count = Array.isArray(projects) ? projects.length : 0;
  projectsTitle.textContent = `Projects (${count})`;
}

{
  "title": "Landing Page A/B Testing Lab",
  "description": "An experimental sandbox for testing landing page layouts, UI variants, and user interaction designs. Used for iterative A/B testing and portfolio UX experiments.",
  "link": "#",
  "tags": ["A/B testing", "UX", "experiment", "landing-page"],
  "status": "experimental"
}
