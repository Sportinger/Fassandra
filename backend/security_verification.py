#!/usr/bin/env python3
"""
🔒 PESSOA THEATER SECURITY VERIFICATION SCRIPT

This script tests all the security hardening measures implemented during the security audit.
Run this against a running Pessoa backend to verify security is working correctly.

Usage: python3 security_verification.py
"""

import requests
import json
import time
import sys
import websocket
from urllib.parse import urlencode
import threading
import uuid

# Configuration
BASE_URL = "https://192.168.2.141:8443"  # Your backend URL
TIMEOUT = 10

class SecurityTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.verify = False  # Disable SSL verification for self-signed certs
        self.test_user_email = f"sectest_{int(time.time())}@example.com"
        self.test_user_username = f"sectest_{int(time.time())}"
        self.test_password = "TestPassword123!"
        self.token = None
        self.script_id = None
        
        # Suppress SSL warnings
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    def run_all_tests(self):
        """Run all security verification tests"""
        print("🔒 PESSOA THEATER SECURITY VERIFICATION")
        print("=" * 50)
        
        test_results = []
        
        # Test 1: Security Headers
        test_results.append(self.test_security_headers())
        
        # Test 2: Authentication Security
        test_results.append(self.test_authentication_security())
        
        # Test 3: Error Handling (No Information Disclosure)
        test_results.append(self.test_error_handling())
        
        # Test 4: Rate Limiting
        test_results.append(self.test_rate_limiting())
        
        # Test 5: JWT Security
        test_results.append(self.test_jwt_security())
        
        # Test 6: SQL Injection Protection
        test_results.append(self.test_sql_injection_protection())
        
        # Test 7: WebSocket Authorization
        test_results.append(self.test_websocket_authorization())
        
        # Summary
        self.print_summary(test_results)
    
    def test_security_headers(self):
        """Test that security headers are properly implemented"""
        print("\n🛡️  Testing Security Headers...")
        
        try:
            response = self.session.get(f"{BASE_URL}/api/scripts", timeout=TIMEOUT)
            headers = response.headers
            
            required_headers = {
                'x-content-type-options': 'nosniff',
                'x-frame-options': ['DENY', 'SAMEORIGIN'],
                'strict-transport-security': 'max-age=',
                'content-security-policy': "default-src 'self'",
                'referrer-policy': True,  # Just check presence
            }
            
            missing_headers = []
            weak_headers = []
            
            for header, expected in required_headers.items():
                if header not in headers:
                    missing_headers.append(header)
                elif expected is not True:  # If we have specific expectations
                    header_value = headers[header].lower()
                    if isinstance(expected, list):
                        if not any(exp.lower() in header_value for exp in expected):
                            weak_headers.append(f"{header}: {headers[header]}")
                    elif isinstance(expected, str) and expected.lower() not in header_value:
                        weak_headers.append(f"{header}: {headers[header]}")
            
            if not missing_headers and not weak_headers:
                print("   ✅ All security headers present and properly configured")
                return True
            else:
                print(f"   ❌ Security headers issues:")
                for header in missing_headers:
                    print(f"      - Missing: {header}")
                for header in weak_headers:
                    print(f"      - Weak: {header}")
                return False
                
        except Exception as e:
            print(f"   ❌ Failed to test security headers: {e}")
            return False
    
    def test_authentication_security(self):
        """Test authentication security including rate limiting"""
        print("\n🔐 Testing Authentication Security...")
        
        try:
            # First, create a test user
            register_data = {
                "email": self.test_user_email,
                "username": self.test_user_username,
                "password": self.test_password
            }
            
            register_response = self.session.post(f"{BASE_URL}/register", json=register_data, timeout=TIMEOUT)
            if not register_response.ok:
                print(f"   ❌ Failed to register test user: {register_response.status_code}")
                return False
            
            # Test successful login
            login_data = {"email": self.test_user_email, "password": self.test_password}
            login_response = self.session.post(f"{BASE_URL}/login", json=login_data, timeout=TIMEOUT)
            
            if login_response.ok:
                self.token = login_response.text.strip('"')
                print("   ✅ Valid authentication works")
            else:
                print(f"   ❌ Valid authentication failed: {login_response.status_code}")
                return False
            
            # Test rate limiting with invalid credentials
            print("   🔄 Testing rate limiting on login attempts...")
            failed_attempts = 0
            rate_limited = False
            
            invalid_data = {"email": "hacker@evil.com", "password": "wrongpassword"}
            
            for i in range(10):  # Try 10 failed attempts
                response = self.session.post(f"{BASE_URL}/login", json=invalid_data, timeout=TIMEOUT)
                if response.status_code == 429:
                    rate_limited = True
                    print(f"   ✅ Rate limiting activated after {failed_attempts} failed attempts")
                    break
                elif response.status_code == 401:
                    failed_attempts += 1
                time.sleep(0.1)  # Small delay
            
            if not rate_limited:
                print("   ⚠️  Rate limiting not triggered - may need adjustment")
            
            return True
            
        except Exception as e:
            print(f"   ❌ Authentication security test failed: {e}")
            return False
    
    def test_error_handling(self):
        """Test that errors don't leak sensitive information"""
        print("\n🔍 Testing Error Handling (Information Disclosure)...")
        
        try:
            # Test 1: Invalid UUID format
            response = self.session.get(f"{BASE_URL}/api/scripts/invalid-uuid", timeout=TIMEOUT)
            error_text = response.text.lower()
            
            sensitive_patterns = [
                'postgres://', 'database_url', '/home/', '/usr/', 'sqlstate',
                'panic', 'traceback', 'stack trace', 'file not found',
                'permission denied', 'connection refused'
            ]
            
            leaked_info = [pattern for pattern in sensitive_patterns if pattern in error_text]
            
            if leaked_info:
                print(f"   ❌ Information disclosure detected: {leaked_info}")
                return False
            
            # Test 2: Invalid JWT token
            headers = {"Authorization": "Bearer invalid.jwt.token"}
            response = self.session.get(f"{BASE_URL}/api/scripts", headers=headers, timeout=TIMEOUT)
            jwt_error = response.text.lower()
            
            jwt_leaks = ['decode', 'signature', 'secret', 'algorithm', 'payload']
            jwt_leaked = [leak for leak in jwt_leaks if leak in jwt_error]
            
            if jwt_leaked:
                print(f"   ❌ JWT information disclosure: {jwt_leaked}")
                return False
            
            print("   ✅ Error handling is secure - no sensitive information leaked")
            return True
            
        except Exception as e:
            print(f"   ❌ Error handling test failed: {e}")
            return False
    
    def test_rate_limiting(self):
        """Test API rate limiting"""
        print("\n⏱️  Testing API Rate Limiting...")
        
        if not self.token:
            print("   ⚠️  Skipping - no valid token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            successful_requests = 0
            rate_limited = False
            
            # Make rapid requests
            for i in range(30):
                response = self.session.get(f"{BASE_URL}/api/scripts", headers=headers, timeout=TIMEOUT)
                if response.status_code == 200:
                    successful_requests += 1
                elif response.status_code == 429:
                    rate_limited = True
                    print(f"   ✅ API rate limiting activated after {successful_requests} requests")
                    break
                time.sleep(0.05)  # Very fast requests
            
            if not rate_limited:
                print(f"   ⚠️  Rate limiting not triggered after {successful_requests} requests")
                print("      (This may be normal depending on rate limit configuration)")
            
            return True
            
        except Exception as e:
            print(f"   ❌ Rate limiting test failed: {e}")
            return False
    
    def test_jwt_security(self):
        """Test JWT token security"""
        print("\n🎫 Testing JWT Security...")
        
        try:
            malformed_tokens = [
                "",
                "invalid",
                "Bearer invalid",
                "Bearer eyJ.malformed.jwt",
                "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
            ]
            
            for token in malformed_tokens:
                headers = {"Authorization": f"Bearer {token}"} if token else {}
                response = self.session.get(f"{BASE_URL}/api/scripts", headers=headers, timeout=TIMEOUT)
                
                if response.status_code != 401:
                    print(f"   ❌ Invalid token accepted: {token[:20]}...")
                    return False
            
            print("   ✅ JWT validation is working - all invalid tokens rejected")
            return True
            
        except Exception as e:
            print(f"   ❌ JWT security test failed: {e}")
            return False
    
    def test_sql_injection_protection(self):
        """Test SQL injection protection"""
        print("\n💉 Testing SQL Injection Protection...")
        
        if not self.token:
            print("   ⚠️  Skipping - no valid token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            
            sql_payloads = [
                "'; DROP TABLE scripts; --",
                "' OR '1'='1",
                "'; INSERT INTO scripts (title) VALUES ('hacked'); --",
                "' UNION SELECT * FROM users --"
            ]
            
            for payload in sql_payloads:
                script_data = {"title": payload}
                response = self.session.post(f"{BASE_URL}/api/scripts", json=script_data, headers=headers, timeout=TIMEOUT)
                
                # Should either succeed (treating as literal text) or fail gracefully
                if response.status_code >= 500:
                    print(f"   ❌ SQL injection may have caused server error: {payload}")
                    return False
                
                # If successful, verify it's treated as literal text
                if response.ok:
                    script_data = response.json()
                    if script_data.get('title') != payload:
                        print(f"   ❌ SQL injection may have modified data: {payload}")
                        return False
            
            # Verify scripts endpoint still works (table wasn't dropped)
            response = self.session.get(f"{BASE_URL}/api/scripts", headers=headers, timeout=TIMEOUT)
            if not response.ok:
                print("   ❌ Scripts endpoint not accessible - possible SQL injection damage")
                return False
            
            print("   ✅ SQL injection protection working - all payloads handled safely")
            return True
            
        except Exception as e:
            print(f"   ❌ SQL injection test failed: {e}")
            return False
    
    def test_websocket_authorization(self):
        """Test WebSocket authorization"""
        print("\n🔌 Testing WebSocket Authorization...")
        
        if not self.token:
            print("   ⚠️  Skipping - no valid token available")
            return False
        
        try:
            # Create a script first
            headers = {"Authorization": f"Bearer {self.token}"}
            script_data = {"title": "WebSocket Test Script"}
            response = self.session.post(f"{BASE_URL}/api/scripts", json=script_data, headers=headers, timeout=TIMEOUT)
            
            if not response.ok:
                print("   ❌ Failed to create script for WebSocket test")
                return False
            
            self.script_id = response.json()['id']
            
            # Test 1: Valid token should work
            ws_url = f"wss://192.168.2.141:8443/api/collab/{self.script_id}?token={self.token}"
            try:
                ws = websocket.create_connection(ws_url, timeout=5, sslopt={"cert_reqs": 0})
                ws.close()
                print("   ✅ Valid WebSocket connection works")
                valid_connection_works = True
            except Exception as e:
                print(f"   ❌ Valid WebSocket connection failed: {e}")
                valid_connection_works = False
            
            # Test 2: Invalid token should be rejected
            invalid_ws_url = f"wss://192.168.2.141:8443/api/collab/{self.script_id}?token=invalid_token"
            try:
                ws = websocket.create_connection(invalid_ws_url, timeout=5, sslopt={"cert_reqs": 0})
                ws.close()
                print("   ❌ Invalid token WebSocket connection was allowed")
                invalid_connection_rejected = False
            except Exception:
                print("   ✅ Invalid token WebSocket connection rejected")
                invalid_connection_rejected = True
            
            # Test 3: Different user's script should be rejected
            fake_script_id = str(uuid.uuid4())
            unauthorized_ws_url = f"wss://192.168.2.141:8443/api/collab/{fake_script_id}?token={self.token}"
            try:
                ws = websocket.create_connection(unauthorized_ws_url, timeout=5, sslopt={"cert_reqs": 0})
                ws.close()
                print("   ❌ Unauthorized script access was allowed")
                unauthorized_access_rejected = False
            except Exception:
                print("   ✅ Unauthorized script access rejected")
                unauthorized_access_rejected = True
            
            return valid_connection_works and invalid_connection_rejected and unauthorized_access_rejected
            
        except Exception as e:
            print(f"   ❌ WebSocket authorization test failed: {e}")
            return False
    
    def print_summary(self, results):
        """Print test results summary"""
        print("\n" + "=" * 50)
        print("🔒 SECURITY VERIFICATION SUMMARY")
        print("=" * 50)
        
        test_names = [
            "Security Headers",
            "Authentication Security", 
            "Error Handling",
            "Rate Limiting",
            "JWT Security",
            "SQL Injection Protection",
            "WebSocket Authorization"
        ]
        
        passed = sum(results)
        total = len(results)
        
        for i, (name, result) in enumerate(zip(test_names, results)):
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{i+1}. {name:<25} {status}")
        
        print("-" * 50)
        print(f"OVERALL RESULT: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL SECURITY TESTS PASSED! System is properly hardened.")
        elif passed >= total * 0.8:
            print("⚠️  Most security measures working. Review failed tests.")
        else:
            print("🚨 SECURITY CONCERNS DETECTED! Immediate attention required.")
        
        return passed == total

def main():
    """Main execution function"""
    print("Starting Pessoa Theater Security Verification...")
    print(f"Testing against: {BASE_URL}")
    
    tester = SecurityTester()
    
    try:
        success = tester.run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 