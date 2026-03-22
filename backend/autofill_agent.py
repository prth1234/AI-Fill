import os
import sys
import json
import time
import re
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
STORAGE_DIR = os.path.join(os.path.dirname(__file__), "local_storage")
PROFILES_FILE = os.path.join(STORAGE_DIR, "profiles.json")

def load_profile(user_id="default_user"):
    if os.path.exists(PROFILES_FILE):
        with open(PROFILES_FILE, "r") as f:
            data = json.load(f)
            return data.get(user_id, {})
    return {}

def normalize(text):
    if not text: return ""
    return re.sub(r'[^a-z0-9]', '', text.lower())

def stringify_value(value):
    if value is None: return ""
    if isinstance(value, bool): return "Yes" if value else "No"
    if isinstance(value, (int, float)): return str(value)
    if isinstance(value, list): return ", ".join([stringify_value(v) for v in value if v])
    if isinstance(value, dict):
        if "label" in value: return value["label"]
        return ", ".join([stringify_value(v) for v in value.values() if v])
    return str(value).strip()

def get_answer_for_label(label, profile):
    norm_label = normalize(label)
    
    # 1. Personal Info
    p = profile.get("personal", {})
    mapping = {
        "firstname": p.get("firstName"),
        "lastname": p.get("lastName"),
        "fullname": f"{p.get('firstName', '')} {p.get('lastName', '')}".strip(),
        "name": f"{p.get('firstName', '')} {p.get('lastName', '')}".strip(),
        "email": p.get("email"),
        "phone": p.get("phone"),
        "city": p.get("city"),
        "state": p.get("state"),
        "zip": p.get("zipcode"),
        "linkedin": p.get("linkedin"),
        "github": p.get("github"),
        "website": p.get("website"),
        "summary": p.get("summary"),
    }
    
    # 2. Work Experience (Latest)
    work = profile.get("workExp", {}).get("experiences", [])
    if work:
        latest = work[0]
        mapping.update({
            "currentcompany": latest.get("company"),
            "currenttitle": latest.get("title"),
            "jobtitle": latest.get("title"),
        })

    # Exact or Partial Match
    for key, val in mapping.items():
        if key in norm_label or norm_label in key:
            return stringify_value(val)
            
    # Custom fields check
    for field in profile.get("fields", []):
        if normalize(field.get("key")) in norm_label:
            return stringify_value(field.get("value"))
            
    return None

def run_autofill(url):
    profile = load_profile()
    if not profile:
        print("❌ No profile found in local_storage/profiles.json. Please set it up in the UI first.")
        return

    with sync_playwright() as p:
        print(f"🚀 Launching browser for: {url}")
        browser = p.chromium.launch(headless=False) # Visible for manual login
        page = browser.new_page()
        page.goto(url)

        print("\n--- 🛑 ACTION REQUIRED ---")
        print("Please LOGIN and navigate to the actual application form.")
        print("Once the form is visible on screen, come back here and press [ENTER].")
        input("Press ENTER to start Autofill... ")

        print("🔍 Scanning for form fields...")
        
        # Find all common inputs
        selectors = ["input:not([type='hidden'])", "select", "textarea"]
        elements = page.query_selector_all(", ".join(selectors))
        
        filled_count = 0
        for el in elements:
            try:
                # Try to find a label
                name = el.get_attribute("name") or ""
                placeholder = el.get_attribute("placeholder") or ""
                id_attr = el.get_attribute("id") or ""
                
                # Get associated label text
                label_text = ""
                if id_attr:
                    label_el = page.query_selector(f"label[for='{id_attr}']")
                    if label_el: label_text = label_el.inner_text()
                
                if not label_text:
                    # Look for closest preceding text or parent text
                    label_text = name or placeholder
                
                answer = get_answer_for_label(label_text, profile)
                
                if answer:
                    print(f"✅ Filling [{label_text or name}]: {answer}")
                    tag = el.evaluate("el => el.tagName").lower()
                    type_attr = el.get_attribute("type") or "text"
                    
                    if tag == "select":
                        el.select_option(label=answer)
                    elif type_attr == "checkbox" or type_attr == "radio":
                        if answer.lower() in ["yes", "true", "1"]:
                            el.check()
                    else:
                        el.fill(answer)
                    filled_count += 1
                    time.sleep(0.2) # Natural pacing
            except Exception as e:
                pass

        print(f"\n✨ Done! Filled {filled_count} fields.")
        print("Please review the form. You can proceed to submit manually.")
        input("Press ENTER to close the browser...")
        browser.close()

if __name__ == "__main__":
    target_url = sys.argv[1] if len(sys.argv) > 1 else input("Enter Application URL: ")
    if not target_url.startswith("http"):
        print("Invalid URL.")
    else:
        run_autofill(target_url)
