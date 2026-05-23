// =====================================================================
// Meta page — DSC 106 Lab 6, Lab 8
//
// Lab 6 gave us a static scatter plot of commits by time-of-day, plus
// brushing + a language breakdown.
//
// Lab 8 turns this into an interactive narrative visualization:
//   Step 1: time-of-day filter slider with stable circles + entry animation
//   Step 2: unit visualization of file sizes (one dot per line of code)
//   Step 3: scrollytelling — scrolling past commit descriptions
//           progressively reveals more of the timeline
// =====================================================================

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

// ---------------------------------------------------------------------
// Module-scope state. The scatter plot, slider handler, and scrolly
// handler all read/write these.
// ---------------------------------------------------------------------
let xScale;
let yScale;
let commits = [];
let filteredCommits = [];

let commitProgress = 100;       // slider value 0–100
let timeScale;                  // maps 0–100 ↔ datetime range
let commitMaxTime;              // max datetime currently shown

// Color scale for the file unit visualization (one color per file type).
const colors = d3.scaleOrdinal(d3.schemeTableau10);

// ----- Step 1.1: Load the CSV -----

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

// ----- Step 1.2: Group lines into commits -----
// We sort by datetime here because Scrollama (Step 3) needs commits to
// appear in chronological order — otherwise scrolling looks chaotic.

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;
      const ret = {
        id: commit,
        url: 'https://github.com/bigmacchung/portfolio/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        // Hour of day as a decimal so we can plot it on a continuous scale.
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      // Stash the underlying line records as a non-enumerable property so
      // they're available for the language breakdown without cluttering
      // the commit object when we console.log it.
      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: false,
        writable: false,
        enumerable: false,
      });

      return ret;
    })
    .sort((a, b) => a.datetime - b.datetime);
}

// ----- Step 1.3: Display the summary stats -----

function renderCommitInfo(data, commits) {
  // Clear so re-renders don't append another <dl>.
  d3.select('#stats').selectAll('*').remove();

  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  // Total lines of code.
  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  // Total commits.
  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);

  // Number of distinct files in the codebase.
  const numberOfFiles = d3.group(data, (d) => d.file).size;
  dl.append('dt').text('Files');
  dl.append('dd').text(numberOfFiles);

  // Maximum file length (max line number per file, then max of those).
  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (l) => l.line),
    (d) => d.file,
  );
  const maxFileLength = d3.max(fileLengths, (d) => d[1]);
  dl.append('dt').text('Longest file (lines)');
  dl.append('dd').text(maxFileLength);

  // Average file length, rounded to 1 decimal place.
  const averageFileLength = d3.mean(fileLengths, (d) => d[1]);
  dl.append('dt').text('Average file length');
  dl.append('dd').text(averageFileLength.toFixed(1) + ' lines');

  // Longest line in the entire codebase (in characters).
  const longestLine = d3.max(data, (d) => d.length);
  dl.append('dt').text('Longest line (chars)');
  dl.append('dd').text(longestLine);

  // Time of day where the most work is done.
  const workByPeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) =>
      new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' }),
  );
  const maxPeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0];
  dl.append('dt').text('Most active period');
  dl.append('dd').text(maxPeriod ?? '—');
}

// ----- Step 3: Tooltip helpers -----

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  // Renamed to avoid clashing with #commit-time used by the slider label.
  const time = document.getElementById('commit-time-tt');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  time.textContent = commit.datetime?.toLocaleString('en', {
    timeStyle: 'short',
  });
  author.textContent = commit.author;
  lines.textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

// ----- Step 5: Brushing helpers (kept from Lab 6) -----

function isCommitSelected(selection, commit) {
  if (!selection) return false;

  const [x0, x1] = selection.map((d) => d[0]);
  const [y0, y1] = selection.map((d) => d[1]);
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);

  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }

  const lines = selectedCommits.flatMap((d) => d.lines);

  // Count lines per language type (extension).
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  container.innerHTML = '';
  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll('#chart circle').classed('selected', (d) =>
    isCommitSelected(selection, d),
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

// ----- Step 2 + 4 + 5: Initial scatterplot render -----

function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 50 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // Time scale for the x-axis (commit datetime).
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  // Linear scale for the y-axis (hour of day, 0–24).
  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  // Sqrt scale for dot radius (Step 4.2: areas grow linearly with line count).
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3
    .scaleSqrt()
    .domain([minLines, maxLines])
    .range([3, 30]);

  // Gridlines first so they appear behind the dots and axes.
  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);
  gridlines.call(
    d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width),
  );

  // Axes — tag them with classes so updateScatterPlot can find them.
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  svg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  svg
    .append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  // Dots group — sort by descending size so smaller (foreground) dots stay hoverable.
  const dots = svg.append('g').attr('class', 'dots');
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll('circle')
    // Step 1.3: key function = commit id so D3 reuses the same <circle>
    // for the same commit across re-renders.
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .style('--r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  // Step 5: brushing. Attach the brush, then raise the dots & all elements
  // following the overlay so circle hover events still fire.
  svg.call(d3.brush().on('start brush end', brushed));
  svg.selectAll('.dots, .overlay ~ *').raise();
}

// ----- Step 1.2: Update an existing scatterplot in place -----
// Same shape as renderScatterPlot but reuses the existing <svg>, axes,
// and dots <g> rather than appending new ones. Triggered every time
// the slider moves or the user scrolls past a commit step.

function updateScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 50 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3.select('#chart').select('svg');

  // Re-domain the x-axis so the visible range matches the filter window.
  // (We keep the *original* full-range domain on the y-axis since hours
  // 0–24 don't change.)
  xScale = xScale.domain(d3.extent(commits, (d) => d.datetime));

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3
    .scaleSqrt()
    .domain([minLines || 0, maxLines || 1])
    .range([3, 30]);

  const xAxis = d3.axisBottom(xScale);

  // Clear out the old ticks then re-draw the axis with the new scale.
  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(xAxis);

  const dots = svg.select('g.dots');
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id) // key function (Step 1.3)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .style('--r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

// ----- Step 2: File unit visualization -----
// One <div class="loc"> per line of code, grouped by file, sorted by
// file length, colored by file type.

function updateFileDisplay(filteredCommits) {
  const lines = filteredCommits.flatMap((d) => d.lines);
  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length); // Step 2.3

  const filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join(
      // First time only — set up the dt / code / small / dd skeleton.
      (enter) =>
        enter.append('div').call((div) => {
          const dt = div.append('dt');
          dt.append('code');
          dt.append('small');
          div.append('dd');
        }),
    );

  // Update text on every call so filtered counts stay in sync.
  filesContainer.select('dt > code').text((d) => d.name);
  filesContainer
    .select('dt > small')
    .text((d) => `${d.lines.length} lines`);

  // One dot per line, colored by line type (file extension).
  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${colors(d.type)}`);
}

// ----- Step 1.1 + 1.2: Slider event handler -----

function onTimeSliderChange() {
  commitProgress = Number(document.getElementById('commit-progress').value);
  commitMaxTime = timeScale.invert(commitProgress);

  document.getElementById('commit-time').textContent =
    commitMaxTime.toLocaleString('en', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  updateScatterPlot(data, filteredCommits);
  updateFileDisplay(filteredCommits);
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

const data = await loadData();
commits = processCommits(data);

timeScale = d3
  .scaleTime()
  .domain([
    d3.min(commits, (d) => d.datetime),
    d3.max(commits, (d) => d.datetime),
  ])
  .range([0, 100]);

commitMaxTime = timeScale.invert(commitProgress);
filteredCommits = commits;

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
updateFileDisplay(filteredCommits);

document
  .getElementById('commit-progress')
  .addEventListener('input', onTimeSliderChange);

// Initialize the slider's time display
onTimeSliderChange();

// ----- Step 3.2: Generate commit narrative text -----

d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html(
    (d, i) => `
      On ${d.datetime.toLocaleString('en', {
        dateStyle: 'full',
        timeStyle: 'short',
      })},
      I made <a href="${d.url}" target="_blank">${
        i > 0
          ? 'another glorious commit'
          : 'my first commit, and it was glorious'
      }</a>.
      I edited ${d.totalLines} lines across ${
        d3.rollups(
          d.lines,
          (D) => D.length,
          (d) => d.file,
        ).length
      } files.
      Then I looked over all I had made, and I saw that it was very good.
    `,
  );

// ----- Step 3.3: Wire up Scrollama -----

function onStepEnter(response) {
  const stepCommit = response.element.__data__;
  commitMaxTime = stepCommit.datetime;
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  // Keep the slider + time label in sync with where we've scrolled to.
  commitProgress = timeScale(commitMaxTime);
  const slider = document.getElementById('commit-progress');
  if (slider) slider.value = commitProgress;
  document.getElementById('commit-time').textContent =
    commitMaxTime.toLocaleString('en', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

  updateScatterPlot(data, filteredCommits);
  updateFileDisplay(filteredCommits);
}

const scroller = scrollama();
scroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
    offset: 0.5,
  })
  .onStepEnter(onStepEnter);

window.addEventListener('resize', () => scroller.resize());
