/**
 * SafeSpot – Admin Dashboard Controller
 * Real-time status updates, deletion, table filtering, and report export.
 */

document.addEventListener('DOMContentLoaded', () => {
  setupStatusSelects();finish

/**
 * Handles instant status updates via dropdown change.
 */
function setupStatusSelects() {
  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', function () {
      const reportId = this.getAttribute('data-id');
      const newStatus = this.value;
      const prevStatus = this.getAttribute('data-prev') || this.value;

      fetch(`/api/admin/reports/${reportId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            this.setAttribute('data-prev', newStatus);
            showToast(data.message, 'success');

            // Update row badge if visible
            const row = document.getElementById(`admin-row-${reportId}`);
            if (row) {
              row.setAttribute('data-status', newStatus);
              const badge = row.querySelector('.badge-status');
              if (badge) {
                badge.className = `badge badge-status badge-status-${newStatus.toLowerCase()}`;
                badge.textContent = newStatus;
              }
            }
          } else {
            this.value = prevStatus;
            showToast(data.message || 'Status update failed', 'danger');
          }
        })
        .catch(err => {
          this.value = prevStatus;
          console.error(err);
          showToast('Failed to connect to server', 'danger');
        });
    });
  });
}

/**
 * Handles report deletion with confirmation.
 */
function setupDeleteButtons() {
  document.querySelectorAll('.btn-delete-report').forEach(btn => {
    btn.addEventListener('click', function () {
      const reportId = this.getAttribute('data-id');
      const title = this.getAttribute('data-title') || `#${reportId}`;

      if (!confirm(`Are you sure you want to permanently delete hazard report: "${title}"? This cannot be undone.`)) {
        return;
      }

      fetch(`/api/admin/reports/${reportId}`, {
        method: 'DELETE'
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showToast(data.message, 'success');
            const row = document.getElementById(`admin-row-${reportId}`);
            if (row) {
              row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
              row.style.opacity = '0';
              row.style.transform = 'translateX(20px)';
              setTimeout(() => row.remove(), 300);
            }
          } else {
            showToast(data.message || 'Could not delete report', 'danger');
          }
        })
        .catch(err => {
          console.error(err);
          showToast('Error deleting report', 'danger');
        });
    });
  });
}

/**
 * Live filtering of the moderation table.
 */
function setupAdminTableFilters() {
  const searchInput = document.getElementById('adminTableSearch');
  const statusFilter = document.getElementById('adminFilterStatus');
  const severityFilter = document.getElementById('adminFilterSeverity');

  const filterRows = () => {
    const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const stat = statusFilter ? statusFilter.value : 'all';
    const sev = severityFilter ? severityFilter.value : 'all';

    document.querySelectorAll('.admin-table tbody tr').forEach(row => {
      const text = row.innerText.toLowerCase();
      const rowStat = row.getAttribute('data-status') || '';
      const rowSev = row.getAttribute('data-severity') || '';

      const matchQ = !q || text.includes(q);
      const matchStat = stat === 'all' || rowStat.toLowerCase() === stat.toLowerCase();
      const matchSev = sev === 'all' || rowSev.toLowerCase() === sev.toLowerCase();

      if (matchQ && matchStat && matchSev) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  };

  if (searchInput) searchInput.addEventListener('input', filterRows);
  if (statusFilter) statusFilter.addEventListener('change', filterRows);
  if (severityFilter) severityFilter.addEventListener('change', filterRows);
}

/**
 * Handles CSV export of reports for municipality and community auditing.
 */
function setupExportButtons() {
  const exportBtn = document.getElementById('exportCsvBtn');
  if (!exportBtn) return;

  exportBtn.addEventListener('click', () => {
    fetch('/api/reports')
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.reports.length) {
          showToast('No reports available to export', 'warning');
          return;
        }

        const headers = ['ID', 'Title', 'Category', 'Severity', 'Status', 'Upvotes', 'Location', 'Latitude', 'Longitude', 'Created At'];
        const csvRows = [headers.join(',')];

        data.reports.forEach(r => {
          const values = [
            r.id,
            `"${(r.title || '').replace(/"/g, '""')}"`,
            r.category,
            r.severity,
            r.status,
            r.upvotes,
            `"${(r.location_name || '').replace(/"/g, '""')}"`,
            r.latitude,
            r.longitude,
            `"${r.created_at}"`
          ];
          csvRows.push(values.join(','));
        });

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `safespot_reports_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('CSV Export downloaded successfully!', 'success');
      })
      .catch(err => {
        console.error(err);
        showToast('Failed to export CSV', 'danger');
      });
  });
}
