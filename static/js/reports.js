/**
 * SafeSpot – Community Reports Feed & Tracking Controller
 * Live search, multi-criteria filtering, sorting, and upvoting.
 */

let allReportsList = [];

document.addEventListener('DOMContentLoaded', () => {
  const reportsGrid = document.getElementById('reportsGrid');
  if (!reportsGrid) return;

  loadReports();
  setupFilterListeners();
});

/**
 * Fetches all reports from the API.
 */
function loadReports() {
  const container = document.getElementById('reportsGrid');
  container.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #64748b;">
      <div style="font-size: 2rem; margin-bottom: 0.5rem; animation: spin 1s infinite linear;">🔄</div>
      <p>Loading community safety reports...</p>
    </div>
  `;

  fetch('/api/reports')
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #ef4444;">Failed to load reports.</div>`;
        return;
      }

      allReportsList = data.reports;
      renderReports(allReportsList);
    })
    .catch(err => {
      console.error(err);
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #ef4444;">Error connecting to server.</div>`;
    });
}

/**
 * Renders report cards in the grid.
 */
function renderReports(reports) {
  const container = document.getElementById('reportsGrid');
  const countBadge = document.getElementById('visibleReportsCount');
  
  if (countBadge) {
    countBadge.textContent = `${reports.length} Reports Found`;
  }

  if (reports.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem; background: #fff; border-radius: 16px; border: 1px dashed #cbd5e1;">
        <span style="font-size: 3rem; display: block; margin-bottom: 0.75rem;">🛡️</span>
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">No hazard reports match your criteria</h3>
        <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 1.5rem;">Try clearing your search filters or report a new safety concern.</p>
        <button class="btn btn-primary" onclick="resetFilters()">Reset All Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = reports.map(report => {
    const meta = getCategoryMeta(report.category);
    const mediaHtml = report.photo_url
      ? `<img src="/static/uploads/${report.photo_url}" alt="${report.title}" loading="lazy">`
      : `<div class="report-card-media-placeholder">${meta.icon}</div>`;

    return `
      <article class="report-card" id="report-${report.id}">
        <div class="report-card-media">
          ${mediaHtml}
        </div>
        <div class="report-card-body">
          <div class="report-card-badges">
            <span class="badge badge-sev-${report.severity}">
              <span class="badge-dot"></span>${report.severity}
            </span>
            <span class="badge badge-status-${report.status.toLowerCase()}">${report.status}</span>
            <span class="badge badge-cat">${meta.icon} ${meta.label}</span>
          </div>

          <h3 class="report-card-title">${report.title}</h3>
          <p class="report-card-desc">${report.description}</p>

          <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: #475569; margin-bottom: 1rem; background: #f8fafc; padding: 0.4rem 0.6rem; border-radius: 6px;">
            <span>📍</span>
            <span style="font-weight: 600;">${report.location_name}</span>
          </div>

          <div class="report-card-meta">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <button class="upvote-btn" onclick="handleFeedUpvote(${report.id}, this)">
                <span>👍</span>
                <span class="upvote-count">${report.upvotes}</span>
                <span>Confirm</span>
              </button>
            </div>
            
            <a href="/?focus=${report.id}" class="btn btn-outline btn-sm" style="display: inline-flex; align-items: center; gap: 0.35rem;">
              <span>🗺️</span> View on Map
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

/**
 * Sets up live search, filter dropdowns, and sorting listeners.
 */
function setupFilterListeners() {
  const searchInput = document.getElementById('searchQuery');
  const categorySelect = document.getElementById('filterCategory');
  const statusSelect = document.getElementById('filterStatus');
  const severitySelect = document.getElementById('filterSeverity');
  const sortSelect = document.getElementById('sortBy');

  const applyFilters = () => {
    const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const cat = categorySelect ? categorySelect.value : 'all';
    const stat = statusSelect ? statusSelect.value : 'all';
    const sev = severitySelect ? severitySelect.value : 'all';
    const sort = sortSelect ? sortSelect.value : 'newest';

    let filtered = allReportsList.filter(r => {
      const matchQuery = !q || 
        r.title.toLowerCase().includes(q) || 
        r.description.toLowerCase().includes(q) || 
        r.location_name.toLowerCase().includes(q);
      
      const matchCat = cat === 'all' || r.category === cat;
      const matchStat = stat === 'all' || r.status === stat;
      const matchSev = sev === 'all' || r.severity === sev;

      return matchQuery && matchCat && matchStat && matchSev;
    });

    // Sorting
    if (sort === 'upvotes') {
      filtered.sort((a, b) => b.upvotes - a.upvotes);
    } else if (sort === 'severity') {
      const weights = { critical: 4, high: 3, medium: 2, low: 1 };
      filtered.sort((a, b) => (weights[b.severity] || 0) - (weights[a.severity] || 0));
    } else {
      // Newest first (default)
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    renderReports(filtered);
  };

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (categorySelect) categorySelect.addEventListener('change', applyFilters);
  if (statusSelect) statusSelect.addEventListener('change', applyFilters);
  if (severitySelect) severitySelect.addEventListener('change', applyFilters);
  if (sortSelect) sortSelect.addEventListener('change', applyFilters);
}

/**
 * Resets all filter controls back to default.
 */
function resetFilters() {
  const searchInput = document.getElementById('searchQuery');
  const categorySelect = document.getElementById('filterCategory');
  const statusSelect = document.getElementById('filterStatus');
  const severitySelect = document.getElementById('filterSeverity');
  const sortSelect = document.getElementById('sortBy');

  if (searchInput) searchInput.value = '';
  if (categorySelect) categorySelect.value = 'all';
  if (statusSelect) statusSelect.value = 'all';
  if (severitySelect) severitySelect.value = 'all';
  if (sortSelect) sortSelect.value = 'newest';

  renderReports(allReportsList);
}

/**
 * Feed Upvote Handler.
 */
function handleFeedUpvote(reportId, btnElement) {
  fetch(`/api/reports/${reportId}/upvote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const countSpan = btnElement.querySelector('.upvote-count');
        if (countSpan) countSpan.textContent = data.upvotes;
        
        // Update local memory list
        const r = allReportsList.find(x => x.id === reportId);
        if (r) r.upvotes = data.upvotes;

        showToast(data.message, 'success');
      } else {
        showToast(data.message || 'Could not verify', 'warning');
      }
    })
    .catch(err => {
      console.error(err);
      showToast('Network error while verifying', 'danger');
    });
}
