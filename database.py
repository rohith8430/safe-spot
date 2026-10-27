"""
SafeSpot - Database Management Module
Uses Python's built-in sqlite3 library for persistent data storage.
Beginner-friendly with complete CRUD (Create, Read, Update, Delete) helpers.
"""

import sqlite3
import os
from datetime import datetime
from config import Config

def get_db_connection():
    """
    Establishes and returns a connection to the SQLite database.
    Configures row_factory so that query results behave like Python dictionaries.
    """
    conn = sqlite3.connect(Config.DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """
    Creates the database schema if tables do not exist yet.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create hazards / reports table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            severity TEXT NOT NULL,
            description TEXT NOT NULL,
            location_name TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            photo_url TEXT DEFAULT '',
            reporter_name TEXT DEFAULT 'Anonymous',
            status TEXT DEFAULT 'Pending',
            upvotes INTEGER DEFAULT 1,
            admin_notes TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    # Create an upvotes log table to prevent duplicate votes per IP or session token
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS upvotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id INTEGER NOT NULL,
            client_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(report_id, client_id),
            FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE CASCADE
        );
    """)

    conn.commit()
    conn.close()

def seed_db_if_empty():
    """
    Inserts sample community reports if the database is currently empty.
    This provides an immediate, engaging interactive experience for testing.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as count FROM reports")
    count = cursor.fetchone()['count']
    
    if count == 0:
        sample_reports = [
            (
                "Non-functional Streetlights on Main Blvd",
                "lighting",
                "high",
                "Three consecutive street lamps have been completely dark for over a week. The sidewalk is pitch black after 7 PM, making it unsafe for pedestrians.",
                "Main Blvd & 4th Cross",
                12.9716, 77.5946,
                "",
                "Priya Sharma",
                "Pending",
                14
            ),
            (
                "Large Deep Pothole Near Metro Station",
                "pothole",
                "critical",
                "Severe crater-like pothole directly in the bike lane and left motor lane. Multiple two-wheelers have skidded here during evening hours.",
                "Near City Central Metro Exit 2",
                12.9750, 77.6010,
                "",
                "Arjun Mehta",
                "Investigating",
                28
            ),
            (
                "Poor Visibility & Overgrown Foliage",
                "obstruction",
                "medium",
                "Dense overgrown tree branches completely obscure the stop sign and zebra crossing line. Needs immediate municipal trimming.",
                "Oakridge Lane & 9th Ave",
                12.9655, 77.5890,
                "",
                "David Wilson",
                "Pending",
                7
            ),
            (
                "Severe Waterlogging After Rain",
                "flood",
                "high",
                "Storm drains are completely clogged with debris. Knee-deep stagnant water accumulates quickly, blocking pedestrian access to bus stop.",
                "Market Road Bus Terminal",
                12.9810, 77.5920,
                "",
                "Sunita Rao",
                "Resolved",
                32
            ),
            (
                "Harassment Hotspot Near Dark Alleyway",
                "harassment",
                "critical",
                "Several women reported catcalling and verbal harassment near the unlit passageway connecting 12th St and Commercial Rd. Police patrol requested.",
                "12th Street Alley Entrance",
                12.9680, 77.6050,
                "",
                "Community Watch Member",
                "Investigating",
                45
            ),
            (
                "Broken Concrete Cover on Sidewalk Drain",
                "obstruction",
                "medium",
                "Manhole / drain cover is broken in half with an exposed 3-foot drop. Major tripping hazard for children and elderly pedestrians.",
                "Greenwood Park Perimeter Walkway",
                12.9735, 77.5855,
                "",
                "Robert Chen",
                "Resolved",
                19
            )
        ]
        
        cursor.executemany("""
            INSERT INTO reports (
                title, category, severity, description, location_name,
                latitude, longitude, photo_url, reporter_name, status, upvotes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_reports)
        
        conn.commit()
    
    conn.close()

def get_all_reports(status=None, category=None, severity=None, search=None):
    """
    Retrieves reports from the database with optional filtering and search.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM reports WHERE 1=1"
    params = []
    
    if status and status != 'all':
        query += " AND status = ?"
        params.append(status)
        
    if category and category != 'all':
        query += " AND category = ?"
        params.append(category)
        
    if severity and severity != 'all':
        query += " AND severity = ?"
        params.append(severity)
        
    if search:
        search_term = f"%{search.strip()}%"
        query += " AND (title LIKE ? OR description LIKE ? OR location_name LIKE ?)"
        params.extend([search_term, search_term, search_term])
        
    query += " ORDER BY created_at DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    # Convert sqlite3.Row objects to list of dictionaries
    reports = [dict(row) for row in rows]
    conn.close()
    return reports

def get_report_by_id(report_id):
    """
    Fetches a single report by its primary ID.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_report(title, category, severity, description, location_name, latitude, longitude, photo_url="", reporter_name="Anonymous"):
    """
    Inserts a newly reported hazard into the database.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO reports (
            title, category, severity, description, location_name,
            latitude, longitude, photo_url, reporter_name, status, upvotes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 1)
    """, (
        title.strip(),
        category.strip(),
        severity.strip(),
        description.strip(),
        location_name.strip(),
        float(latitude),
        float(longitude),
        photo_url,
        reporter_name.strip() if reporter_name else "Anonymous"
    ))
    
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id

def update_report_status(report_id, new_status, admin_notes=""):
    """
    Updates the status and optional moderation notes for a report.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE reports
        SET status = ?,
            admin_notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (new_status, admin_notes, report_id))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success

def toggle_upvote(report_id, client_id):
    """
    Allows a community member to upvote or confirm a hazard report.
    Prevents repeated upvotes from the same client session.
    Returns (success, new_upvote_count, message).
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("SELECT id FROM reports WHERE id = ?", (report_id,))
        if not cursor.fetchone():
            return False, 0, "Report not found"

        # Check if already upvoted
        cursor.execute("SELECT id FROM upvotes WHERE report_id = ? AND client_id = ?", (report_id, client_id))
        existing = cursor.fetchone()
        
        if existing:
            # Remove upvote (toggle off)
            cursor.execute("DELETE FROM upvotes WHERE id = ?", (existing['id'],))
            cursor.execute("UPDATE reports SET upvotes = MAX(1, upvotes - 1) WHERE id = ?", (report_id,))
            conn.commit()
            
            cursor.execute("SELECT upvotes FROM reports WHERE id = ?", (report_id,))
            new_count = cursor.fetchone()['upvotes']
            return True, new_count, "Upvote removed"
        else:
            # Add upvote (toggle on)
            cursor.execute("INSERT INTO upvotes (report_id, client_id) VALUES (?, ?)", (report_id, client_id))
            cursor.execute("UPDATE reports SET upvotes = upvotes + 1 WHERE id = ?", (report_id,))
            conn.commit()
            
            cursor.execute("SELECT upvotes FROM reports WHERE id = ?", (report_id,))
            new_count = cursor.fetchone()['upvotes']
            return True, new_count, "Upvote recorded! Thank you for verifying."
    finally:
        if conn.in_transaction:
            conn.rollback()
        conn.close()

def delete_report(report_id):
    """
    Permanently deletes a report (used by administrators).
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM reports WHERE id = ?", (report_id,))
    report_deleted = cursor.rowcount > 0
    if not report_deleted:
        conn.close()
        return False

    cursor.execute("DELETE FROM upvotes WHERE report_id = ?", (report_id,))
    conn.commit()
    conn.close()
    return True

def get_dashboard_stats():
    """
    Calculates summary statistics for the admin dashboard and public header counters.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as total FROM reports")
    total = cursor.fetchone()['total']
    
    cursor.execute("SELECT COUNT(*) as pending FROM reports WHERE status = 'Pending'")
    pending = cursor.fetchone()['pending']
    
    cursor.execute("SELECT COUNT(*) as investigating FROM reports WHERE status = 'Investigating'")
    investigating = cursor.fetchone()['investigating']
    
    cursor.execute("SELECT COUNT(*) as resolved FROM reports WHERE status = 'Resolved'")
    resolved = cursor.fetchone()['resolved']
    
    cursor.execute("SELECT COUNT(*) as critical FROM reports WHERE severity = 'critical' AND status != 'Resolved'")
    critical = cursor.fetchone()['critical']
    
    # Category distribution for visual progress / stats
    cursor.execute("""
        SELECT category, COUNT(*) as count 
        FROM reports 
        GROUP BY category 
        ORDER BY count DESC
    """)
    categories = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return {
        'total': total,
        'pending': pending,
        'investigating': investigating,
        'resolved': resolved,
        'critical': critical,
        'categories': categories
    }
