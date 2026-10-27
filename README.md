# 🛡️ SafeSpot – Community Safety Mapping Application

SafeSpot is an interactive, civic-tech web application designed to empower communities to report, visualize, and track neighborhood safety hazards in real-time. Built with **Python Flask**, **SQLite**, **Leaflet.js**, **Vanilla CSS**, and **JavaScript**.

---

## 📁 Project Folder Structure

```
safespot/
│
├── app.py                  # Main Flask application with routing & REST API endpoints
├── database.py             # SQLite database management, CRUD helpers, & sample seed data
├── config.py               # App configuration, upload paths, and admin credentials
├── requirements.txt        # Python package dependencies (Flask)
├── safespot.db             # Auto-generated SQLite database file (created on launch)
├── README.md               # Beginner guide, architecture overview, and usage instructions
│
├── static/                 # Static frontend assets
│   ├── css/
│   │   └── style.css       # Custom design system with civic safety theme & glassmorphism
│   ├── js/
│   │   ├── main.js         # Global utilities, toast notifications, and modal controls
│   │   ├── map.js          # Leaflet map logic, custom category markers, popups, and GPS
│   │   ├── reports.js      # Public community feed controller, live search, & upvoting
│   │   └── admin.js        # Admin moderation table, live status updater, & CSV export
│   └── uploads/            # Secure directory for user-uploaded hazard photos
│
└── templates/              # Jinja2 HTML templates
    ├── base.html           # Master layout with navbar, footer, and flash messages
    ├── index.html          # Interactive fullscreen map with live filters & quick reporting
    ├── report_hazard.html  # Dedicated hazard reporting form with interactive coordinate picker
    ├── reports.html        # Public hazard feed with search, category filtering, and cards
    ├── admin.html          # Admin dashboard for moderating hazards and updating statuses
    └── admin_login.html    # Secure admin portal authentication page
```

---

## 🚀 Getting Started

### 1. Requirements
Ensure you have **Python 3.8+** installed on your system.

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Application
```bash
python app.py
```

Open your browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 🌟 Key Features

### 1. Interactive Leaflet Map
- **Custom Categorized Markers**: Color-coded pins with distinct icons:
  - 💡 **Poor Lighting** (Amber)
  - 🚧 **Road Damage & Potholes** (Orange)
  - ⚠️ **Harassment & Unsafe Areas** (Red with critical pulse animation)
  - 🛑 **Sidewalk Obstruction** (Purple)
  - 💧 **Waterlogging & Clogged Drains** (Blue)
  - 📍 **Other Hazards** (Slate)
- **Click-to-Pin Location Picker**: Click anywhere on the map or drag the pin to automatically grab coordinates.
- **"Locate Me" Geolocation**: 1-click button using browser GPS to fly directly to your current location.
- **Category Filter Bar**: Toggle markers instantly without reloading the page.
- **Rich Popups**: View hazard severity, description, address, photos, and live confirmation upvotes.

### 2. Hazard Reporting
- Submit reports through either the **Quick Modal** on the map or the **Dedicated Reporting Page** (`/report`).
- Fields: Title, Category, Severity (Low, Medium, High, Critical), Location description, Latitude/Longitude coordinates, Photo upload, and optional Reporter Name (or Anonymous).
- Real-time client and server validation.

### 3. Community Feed & Report Tracking (`/reports`)
- Browse all neighborhood hazards in a responsive card grid.
- **Instant Search**: Search by hazard title, street name, or keywords.
- **Filters**: Filter by category, severity level, or resolution status.
- **Sorting**: Sort by newest reports, most upvoted, or highest severity.
- **Community Verification / Upvote**: Neighbors can upvote hazards to boost visibility.
- **"View on Map" Link**: Jumps to the exact marker on the interactive map.

### 4. Admin Dashboard (`/admin`)
- Accessible via `/admin` (Protected session route).
- Configure `ADMIN_USERNAME` and `ADMIN_PASSWORD` as environment variables before deploying.
- **Safety Analytics**: Total reports, pending reviews, active investigations, critical alerts, and resolved cases.
- **Instant Status Management**: Change status on-the-fly (`Pending` ➡️ `Investigating` ➡️ `Resolved` ➡️ `Dismissed`) with live AJAX sync.
- **Delete Hazard**: Permanently remove resolved or spam reports.
- **Data Export**: 1-click **Export CSV** button to share data with local municipal authorities.

---

## 🛠️ Technology Stack
- **Backend**: Python 3, Flask
- **Database**: SQLite3 (built-in, zero-configuration)
- **Frontend**: HTML5, Vanilla CSS3 (Custom Glassmorphism & Animations), Modern Vanilla JavaScript (ES6+)
- **Mapping**: Leaflet.js with OpenStreetMap tiles
