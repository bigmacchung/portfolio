import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// ---------- Load data ----------
const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');

// Initial render of all projects
renderProjects(projects, projectsContainer, 'h2');

// Update the heading with the project count
const projectsTitle = document.querySelector('.projects-title');
if (projectsTitle) {
  const count = Array.isArray(projects) ? projects.length : 0;
  projectsTitle.textContent = `Projects (${count})`;
}

// ---------- D3 pie chart ----------
const colors = d3.scaleOrdinal(d3.schemeTableau10);
const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
const sliceGenerator = d3.pie().value((d) => d.value);

let selectedIndex = -1;
let query = '';

function renderPieChart(projectsGiven) {
  // Group projects by year and count
  const rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );

  // Shape the data for d3.pie()
  const data = rolledData.map(([year, count]) => ({
    value: count,
    label: year,
  }));

  // Generate slice geometry
  const arcData = sliceGenerator(data);
  const arcs = arcData.map((d) => arcGenerator(d));

  // Clear previous pie + legend
  const svg = d3.select('#projects-pie-plot');
  svg.selectAll('path').remove();

  const legend = d3.select('.legend');
  legend.selectAll('li').remove();

  // Reset selectedIndex if it points beyond the new data
  if (selectedIndex >= data.length) {
    selectedIndex = -1;
  }

  // Draw wedges
  arcs.forEach((arc, i) => {
    svg
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(i))
      .on('click', () => {
        selectedIndex = selectedIndex === i ? -1 : i;

        svg
          .selectAll('path')
          .attr('class', (_, idx) => (idx === selectedIndex ? 'selected' : ''));

        legend
          .selectAll('li')
          .attr('class', (_, idx) =>
            idx === selectedIndex ? 'legend-item selected' : 'legend-item',
          );

        applyFilters(data);
      });
  });

  // Draw legend
  data.forEach((d, idx) => {
    legend
      .append('li')
      .attr('class', 'legend-item')
      .attr('style', `--color:${colors(idx)}`)
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });

  // Reapply selected class if a wedge was already selected
  if (selectedIndex !== -1) {
    svg
      .selectAll('path')
      .attr('class', (_, idx) => (idx === selectedIndex ? 'selected' : ''));
    legend
      .selectAll('li')
      .attr('class', (_, idx) =>
        idx === selectedIndex ? 'legend-item selected' : 'legend-item',
      );
  }
}

// ---------- Filtering ----------
// Centralized filter that applies BOTH the search query and the selected
// pie wedge. Note: when called from the click handler we pass `data` derived
// from `projectsGiven` inside renderPieChart, but for consistency we always
// recompute against the global `projects` so that the year label lookup is
// stable.
function applyFilters() {
  // Step 1: filter by search query across all metadata
  const queryFiltered = projects.filter((project) => {
    const values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });

  // Step 2: if a wedge is selected, narrow further by its year label.
  // We resolve the selected year from the pie data of the *queryFiltered*
  // set so the index stays consistent with what the user sees.
  let finalProjects = queryFiltered;

  if (selectedIndex !== -1) {
    const rolled = d3.rollups(
      queryFiltered,
      (v) => v.length,
      (d) => d.year,
    );
    const pieData = rolled.map(([year, count]) => ({
      value: count,
      label: year,
    }));
    const selected = pieData[selectedIndex];
    if (selected) {
      finalProjects = queryFiltered.filter(
        (p) => String(p.year) === String(selected.label),
      );
    }
  }

  renderProjects(finalProjects, projectsContainer, 'h2');
}

// ---------- Search bar ----------
const searchInput = document.querySelector('.searchBar');
searchInput.addEventListener('input', (event) => {
  query = event.target.value;

  // When the search query changes, the year-bucketed pie slices may shift,
  // so any prior wedge selection no longer maps to the same year. Clear it.
  selectedIndex = -1;

  // Filter projects by search and re-render both list + pie
  const filteredProjects = projects.filter((project) => {
    const values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });

  renderProjects(filteredProjects, projectsContainer, 'h2');
  renderPieChart(filteredProjects);
});

// ---------- Initial render ----------
renderPieChart(projects);
