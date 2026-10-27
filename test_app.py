"""
SafeSpot – Automated Test Suite
Tests database CRUD operations, API endpoints, web views, authentication, and moderation.
"""

import unittest
import json
import os
from app import app
import database

class SafeSpotTestCase(unittest.TestCase):
    def setUp(self):
        # Configure app for testing
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        self.client = app.test_client()

    def test_01_database_stats(self):
        """Test database stats calculation."""
        stats = database.get_dashboard_stats()
        self.assertIn('total', stats)
        self.assertIn('pending', stats)
        self.assertIn('resolved', stats)
        self.assertGreaterEqual(stats['total'], 1)

    def test_02_get_home_page(self):
        """Test home page loads with Leaflet map."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'SafeSpot', response.data)
        self.assertIn(b'id="map"', response.data)

    def test_03_get_reports_page(self):
        """Test community reports feed page loads."""
        response = self.client.get('/reports')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Community Hazard Tracker', response.data)

    def test_04_get_report_form_page(self):
        """Test hazard reporting page loads with location picker."""
        response = self.client.get('/report')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Report a Safety Hazard', response.data)

    def test_05_api_get_reports(self):
        """Test REST API endpoint returns JSON reports list."""
        response = self.client.get('/api/reports')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIsInstance(data['reports'], list)
        self.assertGreaterEqual(len(data['reports']), 1)

    def test_06_api_create_report(self):
        """Test reporting a new safety hazard via API."""
        new_hazard = {
            'title': 'Flickering Street Lamp Near School',
            'category': 'lighting',
            'severity': 'medium',
            'description': 'The streetlight near the pedestrian crosswalk flickers continuously, causing poor night visibility.',
            'location_name': 'Maple Ave & 3rd St',
            'latitude': 12.9720,
            'longitude': 77.5950,
            'reporter_name': 'Test Citizen'
        }
        response = self.client.post('/api/reports',
                                    data=json.dumps(new_hazard),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['report']['title'], 'Flickering Street Lamp Near School')
        self.__class__.created_id = data['report']['id']

    def test_07_api_upvote(self):
        """Test upvoting/verifying a hazard report."""
        report_id = getattr(self.__class__, 'created_id', 1)
        response = self.client.post(f'/api/reports/{report_id}/upvote')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('upvotes', data)

    def test_08_admin_protection(self):
        """Test that unauthenticated access to admin dashboard redirects to login."""
        response = self.client.get('/admin')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/admin/login', response.headers['Location'])

    def test_09_admin_login_and_status_update(self):
        """Test admin login flow and changing report status."""
        # Login with correct credentials
        login_res = self.client.post('/admin/login', data={
            'username': 'admin',
            'password': 'admin123'
        }, follow_redirects=True)
        self.assertEqual(login_res.status_code, 200)
        self.assertIn(b'Admin Moderation Center', login_res.data)

        # Update status
        report_id = getattr(self.__class__, 'created_id', 1)
        update_res = self.client.post(f'/api/admin/reports/{report_id}/status',
                                      data=json.dumps({'status': 'Investigating'}),
                                      content_type='application/json')
        self.assertEqual(update_res.status_code, 200)
        data = json.loads(update_res.data)
        self.assertTrue(data['success'])

    def test_10_admin_delete_report(self):
        """Test admin deleting a hazard report."""
        # Ensure logged in
        with self.client.session_transaction() as sess:
            sess['is_admin'] = True

        report_id = getattr(self.__class__, 'created_id', 1)
        del_res = self.client.delete(f'/api/admin/reports/{report_id}')
        self.assertEqual(del_res.status_code, 200)
        data = json.loads(del_res.data)
        self.assertTrue(data['success'])

    def test_11_my_location_feature(self):
        """Test home page contains My Location button and GPS icon."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'id="locateMeBtn"', response.data)
        self.assertIn(b'My Location', response.data)
        self.assertIn(b'gps-icon', response.data)

    def test_12_api_rejects_invalid_report_data(self):
        """Test invalid categories and out-of-range coordinates are rejected."""
        report = {
            'title': 'Invalid report',
            'category': 'not-a-category',
            'severity': 'medium',
            'description': 'This report should not be stored.',
            'location_name': 'Test location',
            'latitude': 12.9,
            'longitude': 77.5
        }

        invalid_reports = [
            report,
            {**report, 'category': 'lighting', 'latitude': float('nan')},
            {**report, 'category': 'lighting', 'latitude': 91}
        ]
        total_before = database.get_dashboard_stats()['total']

        for invalid_report in invalid_reports:
            response = self.client.post(
                '/api/reports',
                data=json.dumps(invalid_report),
                content_type='application/json'
            )
            self.assertEqual(response.status_code, 400)
            self.assertFalse(json.loads(response.data)['success'])

        malformed_json = self.client.post(
            '/api/reports',
            data='null',
            content_type='application/json'
        )
        self.assertEqual(malformed_json.status_code, 400)

        invalid_form = self.client.post('/report', data=report)
        self.assertEqual(invalid_form.status_code, 200)
        self.assertEqual(database.get_dashboard_stats()['total'], total_before)

    def test_13_api_upvote_missing_report_returns_not_found(self):
        """Test a vote for a non-existent report returns 404, not a server error."""
        response = self.client.post('/api/reports/2147483647/upvote')
        self.assertEqual(response.status_code, 404)
        self.assertFalse(json.loads(response.data)['success'])

    def test_14_admin_delete_report_without_vote_records(self):
        """Test deleting a report succeeds even when it has no vote-log rows."""
        report_id = database.create_report(
            title='Delete without votes',
            category='other',
            severity='low',
            description='Temporary test record.',
            location_name='Test location',
            latitude=12.9,
            longitude=77.5
        )

        with self.client.session_transaction() as sess:
            sess['is_admin'] = True

        response = self.client.delete(f'/api/admin/reports/{report_id}')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(json.loads(response.data)['success'])

if __name__ == '__main__':
    unittest.main()
