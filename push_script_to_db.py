#!/usr/bin/env python3
import json
import requests
import sys
import urllib3

# Disable SSL warnings for local development
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configuration
API_BASE_URL = "http://localhost:3001/api"
USER_EMAIL = "a@b.c"
USER_PASSWORD = "1234"  # Default test password

def login(email, password):
    """Login and get authentication token"""
    print(f"Logging in as {email}...")
    response = requests.post(
        f"{API_BASE_URL}/auth/login",
        json={"email": email, "password": password},
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        print("Login successful!")
        # The backend uses cookies for authentication
        return response.cookies
    else:
        print(f"Login failed: {response.status_code}")
        print(response.text)
        return None

def create_script_from_parsed(cookies, parsed_script_path):
    """Create script from parsed JSON data"""
    print(f"Reading parsed script from {parsed_script_path}...")
    
    with open(parsed_script_path, 'r') as f:
        parsed_script = json.load(f)
    
    # Wrap in the expected payload format
    payload = {
        "parsed_script": parsed_script
    }
    
    print("Sending create_script_from_parsed request...")
    response = requests.post(
        f"{API_BASE_URL}/scripts/create_script_from_parsed",
        json=payload,
        cookies=cookies,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        script_id = response.json()
        print(f"Script created successfully! ID: {script_id}")
        return script_id
    else:
        print(f"Failed to create script: {response.status_code}")
        print(response.text)
        return None

def main():
    # Login
    cookies = login(USER_EMAIL, USER_PASSWORD)
    if not cookies:
        print("Failed to authenticate")
        sys.exit(1)
    
    # Create script from parsed JSON
    parsed_script_path = "/home/admins/projects/pessoa/backend/debug_gemini_responses/test_pdf_parsed.json"
    script_id = create_script_from_parsed(cookies, parsed_script_path)
    
    if script_id:
        print(f"\nSuccess! Script created with ID: {script_id}")
        print(f"You can view it at: http://localhost:3000/script/{script_id}")
    else:
        print("\nFailed to create script")
        sys.exit(1)

if __name__ == "__main__":
    main()