/**
 * SafeSpot – Interactive Leaflet Map Controller
 * Features:
 * - Multi-Basemap Switcher (Streets, Satellite, Dark Mode, Topo)
 * - Live Map Keyword Search & Quick Jump
 * - Multi-criteria Filters (Category, Severity, Status, Nearby Distance Radius)
 * - GPS "My Location" with Real-time Distance Calculations
 * - Hotspot / Danger Risk Rings Visualizer
 * - Interactive Coordinate Picker & AJAX Quick Reporting
 */

let mapInstance = null;
let currentTileLayer = null;
let allMarkers = [];
let pickerMarker = null;
let userLocationMarker = null;
let userAccuracyCircle = null;
let userCurrentCoords = null;
let riskRingsActive = false;
let riskRingLayers = [];

// Unified filter state
let currentFilterState = {
  category: 'all',
  severity: 'all',
  status: 'all',
  radius: 'all',
  search: ''
};

// Available Tile Providers (All free & public without requiring proprietary API keys)
const BASEMAP_LAYERS = {
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }
  },
  dark: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 17,
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const mapElement = document.getElementById('map');
  if (!mapElement) return;

  initLeafletMap();
  setupBasemapSwitcher();
  setupMapSearch();
  setupMapTools();
  setupFilterControls();
  setupQuickReportModal();
});

/**
 * Initializes the Leaflet map and loads community reports.
 */
function initLeafletMap() {
  const defaultCenter = [12.9716, 77.5946];
  const defaultZoom = 13;

  mapInstance = L.map('map', {
    zoomControl: false,
    tap: false
  }).setView(defaultCenter, defaultZoom);

  // Add zoom control at top-right
  L.control.zoom({ position: 'topright' }).addTo(mapInstance);

  // Load saved or default base layer
  const savedTheme = localStorage.getItem('safespot_theme');
  const savedLayer = localStorage.getItem('safespot_basemap') || (savedTheme === 'dark' ? 'dark' : 'streets');
  switchBaseLayer(savedLayer, false);

  // Load hazard markers from backend API
  loadHazardMarkers();

  // Map click for coordinate picking
  mapInstance.on('click', handleMapClick);

  // Geolocation button
  const locateBtn = document.getElementById('locateMeBtn');
  if (locateBtn) {
    locateBtn.addEventListener('click', handleLocateUser);
  }

  // Check URL query parameters for focus ID
  const urlParams = new URLSearchParams(window.location.search);
  const focusId = urlParams.get('focus');
  if (focusId) {
    setTimeout(() => focusOnReport(focusId), 600);
  }
}

/**
 * Switches the active tile layer (Streets, Satellite, Dark, Topo).
 */
function switchBaseLayer(layerKey, syncTheme = true) {
  if (!mapInstance) return;
  if (!BASEMAP_LAYERS[layerKey]) layerKey = 'streets';
  window.currentBasemapKey = layerKey;

  if (currentTileLayer) {
    mapInstance.removeLayer(currentTileLayer);
  }

  const layerConfig = BASEMAP_LAYERS[layerKey];
  currentTileLayer = L.tileLayer(layerConfig.url, layerConfig.options).addTo(mapInstance);
  localStorage.setItem('safespot_basemap', layerKey);

  const mapElement = document.getElementById('map');
  if (mapElement) {
    if (layerKey === 'dark') {
      mapElement.classList.add('dark-map-tiles');
      if (syncTheme && typeof setTheme === 'function') {
        setTheme('dark', false);
      }
    } else {
      mapElement.classList.remove('dark-map-tiles');
      if (syncTheme && layerKey === 'streets' && typeof setTheme === 'function') {
        setTheme('light', false);
      }
    }
  }

  // Update UI active buttons
  document.querySelectorAll('.basemap-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-layer') === layerKey);
  });
}

/**
 * Sets up the basemap switcher event listeners.
 */
function setupBasemapSwitcher() {
  const switcher = document.getElementById('basemapSwitcher');
  if (!switcher) return;

  switcher.querySelectorAll('.basemap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const layer = btn.getAttribute('data-layer');
      switchBaseLayer(layer, true);
      showToast(`Map switched to ${layer.charAt(0).toUpperCase() + layer.slice(1)} view`, 'info');
    });
  });
}

/**
 * Sets up live search and quick jump on the map.
 */
function setupMapSearch() {
  const searchInput = document.getElementById('mapSearchInput');
  const searchClear = document.getElementById('mapSearchClear');

  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    currentFilterState.search = e.target.value.trim();
    if (searchClear) {
      searchClear.style.display = currentFilterState.search ? 'inline-block' : 'none';
    }
    applyAllFilters();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Jump and open popup for the first visible match
      const firstMatch = allMarkers.find(item => mapInstance.hasLayer(item.marker));
      if (firstMatch) {
        mapInstance.flyTo([firstMatch.report.latitude, firstMatch.report.longitude], 16, { duration: 1.0 });
        firstMatch.marker.openPopup();
      } else {
        showToast('No matching hazard found for this search.', 'warning');
      }
    }
  });

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.style.display = 'none';
      currentFilterState.search = '';
      applyAllFilters();
    });
  }
}

/**
 * Sets up quick map action tools (Fit All Hazards, Hotspot Danger Rings).
 */
function setupMapTools() {
  const fitAllBtn = document.getElementById('fitAllBtn');
  if (fitAllBtn) {
    fitAllBtn.addEventListener('click', fitAllVisibleHazards);
  }

  const riskRingsBtn = document.getElementById('toggleRiskRingsBtn');
  if (riskRingsBtn) {
    riskRingsBtn.addEventListener('click', toggleRiskRings);
  }
}

/**
 * Frames all currently visible hazard markers on the screen.
 */
function fitAllVisibleHazards() {
  const visible = allMarkers.filter(item => mapInstance.hasLayer(item.marker));
  if (visible.length === 0) {
    showToast('No hazards currently visible to fit.', 'warning');
    return;
  }

  const bounds = L.latLngBounds();
  visible.forEach(item => bounds.extend([item.report.latitude, item.report.longitude]));
  mapInstance.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  showToast(`Framed ${visible.length} hazards on screen`, 'info');
}

/**
 * Toggles circular danger hotspot zones around critical and high hazards.
 */
function toggleRiskRings() {
  riskRingsActive = !riskRingsActive;
  const btn = document.getElementById('toggleRiskRingsBtn');
  if (btn) btn.classList.toggle('active', riskRingsActive);

  if (riskRingsActive) {
    updateRiskRings();
    showToast('Hotspot warning rings active for critical & high hazards.', 'info');
  } else {
    clearRiskRings();
    showToast('Hotspot warning rings hidden.', 'info');
  }
}

function clearRiskRings() {
  riskRingLayers.forEach(layer => mapInstance.removeLayer(layer));
  riskRingLayers = [];
}

function updateRiskRings() {
  clearRiskRings();
  if (!riskRingsActive) return;

  allMarkers.forEach(item => {
    if (mapInstance.hasLayer(item.marker)) {
      const r = item.report;
      if (r.severity === 'critical' || r.severity === 'high') {
        const ringColor = r.severity === 'critical' ? '#ef4444' : '#f97316';
        const circle = L.circle([r.latitude, r.longitude], {
          radius: r.severity === 'critical' ? 250 : 150,
          color: ringColor,
          weight: 1.5,
          opacity: 0.65,
          fillColor: ringColor,
          fillOpacity: 0.12,
          dashArray: '4, 4'
        }).addTo(mapInstance);
        riskRingLayers.push(circle);
      }
    }
  });
}

/**
 * Creates custom styled HTML markers with category icons and critical pulse rings.
 */
function createCustomMarkerIcon(category, severity) {
  const meta = getCategoryMeta(category);
  const isCritical = severity === 'critical';

  const html = `
    <div class="custom-hazard-pin pin-${category}">
      ${isCritical ? '<div class="pin-pulse" style="background: rgba(239, 68, 68, 0.45);"></div>' : ''}
      <span>${meta.icon}</span>
    </div>
  `;

  return L.divIcon({
    className: 'custom-pin-wrapper',
    html: html,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22]
  });
}

/**
 * Fetches reports from the REST API and plots markers.
 */
function loadHazardMarkers() {
  fetch('/api/reports')
    .then(res => res.json())
    .then(data => {
      if (!data.success) return;

      // Clear existing markers
      allMarkers.forEach(item => mapInstance.removeLayer(item.marker));
      allMarkers = [];

      data.reports.forEach(report => {
        const icon = createCustomMarkerIcon(report.category, report.severity);
        const marker = L.marker([report.latitude, report.longitude], { icon: icon });

        // Bind interactive popup
        marker.bindPopup(buildPopupHTML(report), { maxWidth: 320 });
        marker.addTo(mapInstance);

        allMarkers.push({
          id: report.id,
          report: report,
          marker: marker
        });
      });

      // Apply initial filters & update count
      applyAllFilters();

      // Fit map to markers if no specific focus is set
      if (allMarkers.length > 0 && !window.location.search.includes('focus')) {
        const bounds = L.latLngBounds();
        allMarkers.forEach(item => bounds.extend([item.report.latitude, item.report.longitude]));
        mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    })
    .catch(err => {
      console.error('Failed to load hazard markers:', err);
      showToast('Could not load hazard markers', 'danger');
    });
}

/**
 * Builds HTML markup for the interactive Leaflet popup.
 */
function buildPopupHTML(report) {
  const meta = getCategoryMeta(report.category);
  const photoHtml = report.photo_url 
    ? `<div style="height: 120px; border-radius: 8px; overflow: hidden; margin-bottom: 0.75rem;">
         <img src="/static/uploads/${report.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="${report.title}">
       </div>`
    : '';

  let distanceBadge = '';
  if (userCurrentCoords) {
    const dist = getDistanceKm(userCurrentCoords.lat, userCurrentCoords.lng, report.latitude, report.longitude);
    distanceBadge = `<div class="popup-distance-badge">📍 <span>${formatDistance(dist)} away from you</span></div>`;
  }

  return `
    <div class="popup-card">
      ${photoHtml}
      <div class="popup-badges">
        <span class="badge badge-sev-${report.severity}">
          <span class="badge-dot"></span>${report.severity}
        </span>
        <span class="badge badge-status-${report.status.toLowerCase()}">${report.status}</span>
        <span class="badge badge-cat">${meta.icon} ${meta.label}</span>
      </div>

      <h4 class="popup-title">${report.title}</h4>
      <p class="popup-desc">${report.description}</p>

      <div class="popup-location">
        <span>📍</span>
        <span style="font-weight: 600;">${report.location_name}</span>
      </div>
      ${distanceBadge}

      <div class="popup-footer">
        <button class="upvote-btn" onclick="handleUpvote(${report.id}, this)">
          <span>👍</span>
          <span class="upvote-count">${report.upvotes}</span>
          <span>Verify</span>
        </button>
        <span style="font-size: 0.75rem; color: #94a3b8;">${formatDate(report.created_at)}</span>
      </div>
    </div>
  `;
}

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates.
 */
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's mean radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Human-readable distance formatter.
 */
function formatDistance(distKm) {
  if (distKm < 1) {
    return `${Math.round(distKm * 1000)}m`;
  }
  return `${distKm.toFixed(1)} km`;
}

/**
 * Handles map click to pick coordinates for reporting a new hazard.
 */
function handleMapClick(e) {
  const lat = e.latlng.lat.toFixed(6);
  const lng = e.latlng.lng.toFixed(6);

  const latInput = document.getElementById('reportLat');
  const lngInput = document.getElementById('reportLng');
  const coordDisplay = document.getElementById('coordPickedText');

  if (latInput && lngInput) {
    latInput.value = lat;
    lngInput.value = lng;
  }

  if (coordDisplay) {
    coordDisplay.innerHTML = `<strong>Selected Coordinates:</strong> ${lat}, ${lng}`;
    const box = document.getElementById('coordPickerBox');
    if (box) box.classList.add('picked');
  }

  if (pickerMarker) {
    pickerMarker.setLatLng(e.latlng);
  } else {
    pickerMarker = L.marker(e.latlng, {
      draggable: true,
      icon: L.divIcon({
        className: 'picker-pin',
        html: `<div style="background: #4f46e5; color: #fff; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.5); border: 3px solid #fff;">📍</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36]
      })
    }).addTo(mapInstance);

    pickerMarker.on('dragend', function (event) {
      const position = event.target.getLatLng();
      if (latInput && lngInput) {
        latInput.value = position.lat.toFixed(6);
        lngInput.value = position.lng.toFixed(6);
      }
      if (coordDisplay) {
        coordDisplay.innerHTML = `<strong>Selected Coordinates:</strong> ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
      }
    });
  }

  // Open modal if user clicked to report
  const modal = document.getElementById('quickReportModal');
  if (modal && !modal.classList.contains('active')) {
    openModal('quickReportModal');
  }
}

/**
 * Uses HTML5 Geolocation to center the map on the user's current GPS location.
 */
function handleLocateUser() {
  const locateBtn = document.getElementById('locateMeBtn');

  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser.', 'warning');
    return;
  }

  if (locateBtn) {
    locateBtn.classList.add('locating');
  }

  showToast('Requesting your current location...', 'info');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (locateBtn) {
        locateBtn.classList.remove('locating');
      }

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      const accuracy = position.coords.accuracy || 0;

      // Save user coordinates for nearby distance filter and popup badges
      userCurrentCoords = { lat: userLat, lng: userLng };

      // Smoothly pan & center map on the user's location
      const targetZoom = Math.max(mapInstance.getZoom(), 15);
      mapInstance.flyTo([userLat, userLng], targetZoom, { duration: 1.2 });

      // Clean existing user marker & circle
      if (userLocationMarker) {
        mapInstance.removeLayer(userLocationMarker);
        userLocationMarker = null;
      }
      if (userAccuracyCircle) {
        mapInstance.removeLayer(userAccuracyCircle);
        userAccuracyCircle = null;
      }

      // Add accuracy circle (in meters)
      userAccuracyCircle = L.circle([userLat, userLng], {
        radius: accuracy,
        color: '#2563eb',
        weight: 1.5,
        opacity: 0.65,
        fillColor: '#3b82f6',
        fillOpacity: 0.15
      }).addTo(mapInstance);

      // Blue pulsing marker for user position
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
          <div class="user-gps-pulse"></div>
          <div class="user-gps-dot"></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -14]
      });

      userLocationMarker = L.marker([userLat, userLng], {
        icon: userIcon,
        title: 'My Location',
        zIndexOffset: 1000
      }).addTo(mapInstance);

      const roundedAccuracy = Math.round(accuracy);
      const accuracyMsg = roundedAccuracy > 0 ? ` (Accuracy: within ±${roundedAccuracy}m)` : '';

      userLocationMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 0.88rem; min-width: 175px;">
          <div style="font-weight: 700; color: #1e40af; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 6px;">
            <span>📍</span> Your Current Location
          </div>
          <div style="color: #64748b; font-size: 0.78rem;">
            ${roundedAccuracy > 0 ? `Accuracy within ±${roundedAccuracy} meters` : 'Coordinates pinpointed'}
          </div>
          <div style="color: #0f172a; font-size: 0.75rem; margin-top: 0.35rem; font-family: monospace;">
            ${userLat.toFixed(5)}, ${userLng.toFixed(5)}
          </div>
        </div>
      `).openPopup();

      showToast(`Centered on your current location${accuracyMsg}`, 'success');

      // Refresh filters so distance calculations appear on all popups
      applyAllFilters();
    },
    (err) => {
      if (locateBtn) {
        locateBtn.classList.remove('locating');
      }

      console.warn('Geolocation error:', err.code, err.message);

      let friendlyMessage = 'Unable to access your location. Showing default city center.';
      switch (err.code) {
        case 1: // PERMISSION_DENIED
          friendlyMessage = 'Location access was denied. Please allow location permissions in your browser settings to view your position on the map.';
          break;
        case 2: // POSITION_UNAVAILABLE
          friendlyMessage = 'Location unavailable. Your device or network could not determine your current position.';
          break;
        case 3: // TIMEOUT
          friendlyMessage = 'Location request timed out. Please check your signal and click "My Location" to try again.';
          break;
        default:
          friendlyMessage = 'An unexpected error occurred while retrieving your location.';
      }

      showToast(friendlyMessage, 'warning');
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

/**
 * Unified filter engine: checks category, severity, status, radius, and search text.
 */
function applyAllFilters() {
  let visibleCount = 0;
  const bounds = L.latLngBounds();

  allMarkers.forEach(item => {
    const r = item.report;

    // 1. Category check
    let matchCategory = true;
    if (currentFilterState.category === 'resolved') {
      matchCategory = r.status === 'Resolved';
    } else if (currentFilterState.category !== 'all') {
      matchCategory = r.category === currentFilterState.category;
    }

    // 2. Severity check
    let matchSeverity = true;
    if (currentFilterState.severity !== 'all') {
      matchSeverity = r.severity === currentFilterState.severity;
    }

    // 3. Status check
    let matchStatus = true;
    if (currentFilterState.status !== 'all') {
      matchStatus = r.status === currentFilterState.status;
    }

    // 4. Radius check (only applies if user coordinates are known)
    let matchRadius = true;
    if (currentFilterState.radius !== 'all' && userCurrentCoords) {
      const maxKm = parseFloat(currentFilterState.radius);
      const dist = getDistanceKm(userCurrentCoords.lat, userCurrentCoords.lng, r.latitude, r.longitude);
      matchRadius = dist <= maxKm;
    }

    // 5. Keyword search check
    let matchSearch = true;
    if (currentFilterState.search) {
      const q = currentFilterState.search.toLowerCase();
      matchSearch = (r.title && r.title.toLowerCase().includes(q)) ||
                    (r.description && r.description.toLowerCase().includes(q)) ||
                    (r.location_name && r.location_name.toLowerCase().includes(q));
    }

    const isVisible = matchCategory && matchSeverity && matchStatus && matchRadius && matchSearch;

    if (isVisible) {
      // Re-bind popup to update distance calculation if available
      item.marker.setPopupContent(buildPopupHTML(r));
      mapInstance.addLayer(item.marker);
      bounds.extend([r.latitude, r.longitude]);
      visibleCount++;
    } else {
      mapInstance.removeLayer(item.marker);
    }
  });

  // Update visible count in counter badge
  const counter = document.getElementById('mapVisibleCount');
  if (counter) {
    counter.textContent = `${visibleCount} of ${allMarkers.length} visible`;
  }

  // Update hotspot warning rings if active
  if (riskRingsActive) {
    updateRiskRings();
  }

  return { visibleCount, bounds };
}

/**
 * Sets up listeners for both primary category pills and secondary option dropdowns.
 */
function setupFilterControls() {
  // Category pills
  const filterBtns = document.querySelectorAll('#categoryFilterPanel .filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentFilterState.category = btn.getAttribute('data-filter') || 'all';
      applyAllFilters();
    });
  });

  // Severity dropdown
  const sevSelect = document.getElementById('subfilterSeverity');
  if (sevSelect) {
    sevSelect.addEventListener('change', (e) => {
      currentFilterState.severity = e.target.value;
      applyAllFilters();
    });
  }

  // Status dropdown
  const statSelect = document.getElementById('subfilterStatus');
  if (statSelect) {
    statSelect.addEventListener('change', (e) => {
      currentFilterState.status = e.target.value;
      applyAllFilters();
    });
  }

  // Radius dropdown
  const radSelect = document.getElementById('subfilterRadius');
  if (radSelect) {
    radSelect.addEventListener('change', (e) => {
      currentFilterState.radius = e.target.value;
      if (currentFilterState.radius !== 'all' && !userCurrentCoords) {
        showToast('Requesting GPS location to calculate nearby radius...', 'info');
        handleLocateUser();
      }
      applyAllFilters();
    });
  }

  // Reset filters button
  const resetBtn = document.getElementById('mapResetFiltersBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetAllMapFilters);
  }
}

/**
 * Resets all search and filter options back to defaults.
 */
function resetAllMapFilters() {
  currentFilterState = {
    category: 'all',
    severity: 'all',
    status: 'all',
    radius: 'all',
    search: ''
  };

  const searchInput = document.getElementById('mapSearchInput');
  const searchClear = document.getElementById('mapSearchClear');
  if (searchInput) {
    searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';
  }

  const sevSelect = document.getElementById('subfilterSeverity');
  if (sevSelect) sevSelect.value = 'all';

  const statSelect = document.getElementById('subfilterStatus');
  if (statSelect) statSelect.value = 'all';

  const radSelect = document.getElementById('subfilterRadius');
  if (radSelect) radSelect.value = 'all';

  document.querySelectorAll('#categoryFilterPanel .filter-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-filter') === 'all');
  });

  applyAllFilters();
  showToast('All map filters reset', 'info');
}

/**
 * Focuses on a specific hazard ID (from direct link).
 */
function focusOnReport(reportId) {
  const target = allMarkers.find(item => item.id == reportId);
  if (target) {
    mapInstance.flyTo([target.report.latitude, target.report.longitude], 16, { duration: 1.2 });
    target.marker.openPopup();
  }
}

/**
 * Quick Report Form Submission via AJAX.
 */
function setupQuickReportModal() {
  const form = document.getElementById('quickReportForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Submitting...';
    submitBtn.disabled = true;

    fetch('/api/reports', {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

        if (data.success) {
          showToast('Hazard reported successfully! Thank you.', 'success');
          form.reset();
          closeModal('quickReportModal');

          if (pickerMarker) {
            mapInstance.removeLayer(pickerMarker);
            pickerMarker = null;
          }

          loadHazardMarkers();
          setTimeout(() => {
            focusOnReport(data.report.id);
          }, 800);
        } else {
          showToast(data.message || 'Error submitting report', 'danger');
        }
      })
      .catch(err => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        console.error(err);
        showToast('Submission error. Please check your connection.', 'danger');
      });
  });
}

/**
 * Upvote / Verification handler.
 */
function handleUpvote(reportId, btnElement) {
  fetch(`/api/reports/${reportId}/upvote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const countSpan = btnElement.querySelector('.upvote-count');
        if (countSpan) countSpan.textContent = data.upvotes;
        showToast(data.message, 'success');
      } else {
        showToast(data.message || 'Could not record verification', 'warning');
      }
    })
    .catch(err => {
      console.error(err);
      showToast('Network error while verifying', 'danger');
    });
}
