"""
SafeSpot - Configuration Module
Contains all app settings, paths, and admin credentials.
"""
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    # Secret key for session signing and CSRF protection
    SECRET_KEY = os.environ.get('SECRET_KEY', 'safespot-secret-key-change-in-production')
    
    # SQLite Database File Location
    DATABASE = os.path.join(BASE_DIR, 'safespot.db')
    
    # Upload folder for hazard photos
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
    
    # Max file upload size: 8 Megabytes
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024
    
    # Allowed image file extensions
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
    
    # Default Admin Credentials for Dashboard Access
    ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
