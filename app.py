"""
SafeSpot – Community Safety Mapping Application
Flask Web Application & REST API
"""

import os
import uuid
import math
from functools import wraps
from flask import (
    Flask, render_template, request, jsonify, redirect, 
    url_for, session, flash
)
from werkzeug.utils import secure_filename
from config import Config
import database

app = Flask(__name__)
app.config.from_object(Config)

VALID_CATEGORIES = {
    'lighting', 'pothole', 'harassment', 'obstruction', 'flood',
    'electrical', 'traffic', 'animal', 'other'
}
VALID_SEVERITIES = {'low', 'medium', 'high', 'critical'}

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize database schema and insert demo seed data if fresh
database.init_db()
database.seed_db_if_empty()


def allowed_file(filename):
    """Check if the uploaded file has an allowed image extension."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']


def validate_report_data(data):
    """Validate shared fields submitted by the HTML form and JSON API."""
    if not hasattr(data, 'get'):
        return None, 'Invalid report data'

    fields = {}
    for name in ('title', 'category', 'description', 'location_name'):
        value = data.get(name, '')
        if not isinstance(value, str):
            return None, f'Invalid {name.replace("_", " ")}'
        fields[name] = value.strip()
        if not fields[name]:
            return None, f'{name.replace("_", " ").capitalize()} is required'

    if fields['category'] not in VALID_CATEGORIES:
        return None, 'Invalid hazard category'

    severity = data.get('severity', 'medium')
    if not isinstance(severity, str) or severity not in VALID_SEVERITIES:
        return None, 'Invalid hazard severity'
    fields['severity'] = severity

    coordinates = {}
    for name, lower, upper in (
        ('latitude', -90, 90),
        ('longitude', -180, 180)
    ):
        value = data.get(name)
        if isinstance(value, bool) or not isinstance(value, (str, int, float)):
            return None, 'Invalid latitude or longitude values'
        try:
            coordinate = float(value)
        except (ValueError, TypeError):
            return None, 'Invalid latitude or longitude values'
        if not math.isfinite(coordinate) or not lower <= coordinate <= upper:
            return None, 'Latitude or longitude is out of range'
        coordinates[name] = coordinate
    fields.update(coordinates)

    reporter_name = data.get('reporter_name', 'Anonymous')
    if reporter_name is None:
        reporter_name = 'Anonymous'
    if not isinstance(reporter_name, str):
        return None, 'Invalid reporter name'
    fields['reporter_name'] = reporter_name.strip() or 'Anonymous'
    return fields, None


def save_uploaded_photo(file):
    """Save an optional upload and return its generated name, or None if invalid."""
    if not file or not file.filename:
        return ''
    if not allowed_file(file.filename):
        return None

    safe_name = secure_filename(file.filename)
    if not safe_name:
        return None
    unique_name = f"{uuid.uuid4().hex[:8]}_{safe_name}"
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_name))
    return unique_name


def admin_required(f):
    """Decorator to protect administrative routes from unauthorized access."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('is_admin'):
            flash('Please log in with administrator credentials to access this page.', 'warning')
            return redirect(url_for('admin_login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function


# -------------------------------------------------------------
# Frontend Page Routes
# -------------------------------------------------------------

@app.route('/')
def index():
    """
    Home page: Fullscreen interactive Leaflet map, category filters,
    and hazard submission quick modal.
    """
    stats = database.get_dashboard_stats()
    return render_template('index.html', stats=stats)


@app.route('/report', methods=['GET', 'POST'])
def report_hazard():
    """
    Dedicated hazard reporting page with step-by-step guidance,
    interactive map coordinate picker, and photo upload.
    """
    if request.method == 'POST':
        fields, error = validate_report_data(request.form)
        if error:
            flash(error, 'danger')
            return render_template('report_hazard.html')

        photo_filename = save_uploaded_photo(request.files.get('photo'))
        if photo_filename is None:
            flash('Unsupported photo type. Please upload a PNG, JPG, WEBP, or GIF image.', 'danger')
            return render_template('report_hazard.html')

        new_id = database.create_report(
            **fields,
            photo_url=photo_filename,
        )

        flash(f'Hazard report #{new_id} submitted successfully! Thank you for keeping our community safe.', 'success')
        return redirect(url_for('reports_list'))

    return render_template('report_hazard.html')


@app.route('/reports')
def reports_list():
    """
    Public report tracker: Browse, search, filter, and track community hazards.
    """
    stats = database.get_dashboard_stats()
    return render_template('reports.html', stats=stats)


# -------------------------------------------------------------
# Admin Authentication & Dashboard
# -------------------------------------------------------------

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """Admin login page."""
    if session.get('is_admin'):
        return redirect(url_for('admin_dashboard'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        if username == app.config['ADMIN_USERNAME'] and password == app.config['ADMIN_PASSWORD']:
            session['is_admin'] = True
            session['admin_user'] = username
            flash('Welcome to the SafeSpot Admin Dashboard.', 'success')
            next_url = request.args.get('next')
            return redirect(next_url or url_for('admin_dashboard'))
        else:
            flash('Invalid username or password. Please try again.', 'danger')

    return render_template('admin_login.html')


@app.route('/admin/logout')
def admin_logout():
    """Log out of admin session."""
    session.pop('is_admin', None)
    session.pop('admin_user', None)
    flash('You have been logged out securely.', 'info')
    return redirect(url_for('index'))


@app.route('/admin')
@admin_required
def admin_dashboard():
    """
    Admin control center: Moderation table, status updates, deletion,
    and community safety analytics.
    """
    stats = database.get_dashboard_stats()
    reports = database.get_all_reports()
    return render_template('admin.html', stats=stats, reports=reports)


# -------------------------------------------------------------
# REST API Endpoints (For AJAX, Leaflet Map & Dynamic Interactions)
# -------------------------------------------------------------

@app.route('/api/reports', methods=['GET'])
def api_get_reports():
    """
    Returns reports as JSON with optional filtering by status, category,
    severity, or keyword search.
    """
    status = request.args.get('status', 'all')
    category = request.args.get('category', 'all')
    severity = request.args.get('severity', 'all')
    search = request.args.get('search', None)

    reports = database.get_all_reports(
        status=status,
        category=category,
        severity=severity,
        search=search
    )
    return jsonify({'success': True, 'count': len(reports), 'reports': reports})


@app.route('/api/reports/<int:report_id>', methods=['GET'])
def api_get_single_report(report_id):
    """Returns detailed JSON data for a single hazard report."""
    report = database.get_report_by_id(report_id)
    if not report:
        return jsonify({'success': False, 'message': 'Report not found'}), 404
    return jsonify({'success': True, 'report': report})


@app.route('/api/reports', methods=['POST'])
def api_create_report():
    """
    API endpoint to submit a hazard report via AJAX (JSON or Multipart Form).
    """
    data = request.get_json(silent=True) if request.is_json else request.form
    fields, error = validate_report_data(data)
    if error:
        return jsonify({'success': False, 'message': error}), 400

    photo_filename = save_uploaded_photo(request.files.get('photo'))
    if photo_filename is None:
        return jsonify({
            'success': False,
            'message': 'Unsupported photo type. Please upload a PNG, JPG, WEBP, or GIF image.'
        }), 400

    new_id = database.create_report(
        **fields,
        photo_url=photo_filename,
    )

    created_report = database.get_report_by_id(new_id)
    return jsonify({
        'success': True,
        'message': 'Hazard report logged successfully!',
        'report': created_report
    }), 201


@app.route('/api/reports/<int:report_id>/upvote', methods=['POST'])
def api_upvote_report(report_id):
    """
    Allows community members to upvote / verify a hazard report.
    Tracks client ID (derived from IP or client header) to prevent spam.
    """
    client_id = request.headers.get('X-Forwarded-For', request.remote_addr or 'unknown_client')
    success, count, message = database.toggle_upvote(report_id, client_id)

    if not success:
        status_code = 404 if message == 'Report not found' else 500
        return jsonify({'success': False, 'message': message}), status_code

    return jsonify({
        'success': True,
        'upvotes': count,
        'message': message
    })


@app.route('/api/admin/reports/<int:report_id>/status', methods=['POST'])
@admin_required
def api_update_status(report_id):
    """Admin endpoint to update hazard status and optional admin notes."""
    data = request.get_json() or {}
    new_status = data.get('status')
    admin_notes = data.get('admin_notes', '')

    valid_statuses = {'Pending', 'Investigating', 'Resolved', 'Dismissed'}
    if new_status not in valid_statuses:
        return jsonify({'success': False, 'message': f'Status must be one of: {", ".join(valid_statuses)}'}), 400

    success = database.update_report_status(report_id, new_status, admin_notes)
    if not success:
        return jsonify({'success': False, 'message': 'Failed to update report'}), 404

    return jsonify({
        'success': True,
        'message': f'Report #{report_id} status updated to {new_status}'
    })


@app.route('/api/admin/reports/<int:report_id>', methods=['DELETE'])
@admin_required
def api_delete_report(report_id):
    """Admin endpoint to delete a report."""
    success = database.delete_report(report_id)
    if not success:
        return jsonify({'success': False, 'message': 'Report not found or already deleted'}), 404

    return jsonify({
        'success': True,
        'message': f'Report #{report_id} has been permanently deleted.'
    })


@app.route('/api/stats', methods=['GET'])
def api_get_stats():
    """Returns live counters and category distribution."""
    stats = database.get_dashboard_stats()
    return jsonify({'success': True, 'stats': stats})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    print(f"SafeSpot server starting at http://{host}:{port}")
    app.run(debug=False, host=host, port=port)
