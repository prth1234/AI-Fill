#!/usr/bin/env python3
"""
AI AutoFill Agent v3 — visibility-filtered, react-select aware, LLM-powered.
Usage: backend/.venv/bin/python backend/autofill_agent.py "URL"
"""

import os, sys, json, time, re, httpx
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, Page

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

PROFILES_FILE   = os.path.join(os.path.dirname(__file__), "local_storage", "profiles.json")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "llama3.2:latest")
OPENAI_API_KEY  = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL    = os.getenv("OPENAI_MODEL", "gpt-4o")

def _find_resume(user_id="default_user") -> str:
    uploads = os.path.join(os.path.dirname(__file__), "local_storage", "uploads", user_id)
    if os.path.isdir(uploads):
        pdfs = sorted(
            [os.path.join(uploads, f) for f in os.listdir(uploads) if f.lower().endswith(".pdf")],
            key=os.path.getmtime, reverse=True
        )
        if pdfs: return pdfs[0]
    return os.path.join(os.path.dirname(__file__), "resume.pdf")

# ══════════════════════════════════════════════════════════════════════════════
# PROFILE
# ══════════════════════════════════════════════════════════════════════════════
def load_profile(user_id="default_user"):
    if os.path.exists(PROFILES_FILE):
        with open(PROFILES_FILE) as f:
            return json.load(f).get(user_id, {})
    return {}

def _month_year(d: str):
    if not d: return ("", "")
    try:
        parts = d.split("-")
        months = ["","January","February","March","April","May","June",
                  "July","August","September","October","November","December"]
        return (months[int(parts[1])], parts[0])
    except: return ("", "")

def build_profile_text(p: dict) -> str:
    info = p.get("personal", {})
    lines = [
        "=== PERSONAL ===",
        f"First Name: {info.get('firstName','')}",
        f"Last Name: {info.get('lastName','')}",
        f"Full Name: {info.get('firstName','')} {info.get('lastName','')}",
        f"Email: {info.get('email','')}",
        f"Phone: +91 {info.get('phone','')}",
        f"City: {info.get('city','')}",
        f"State: {info.get('state','')}",
        f"Country: {info.get('country','')}",
        f"ZIP: {info.get('zipcode','')}",
        f"LinkedIn: {info.get('linkedin','')}",
        f"GitHub: {info.get('github','')}",
        f"Website: {info.get('website','')}",
        f"Work Auth: {info.get('workAuth',{}).get('label','')}",
        f"Willing to Relocate: {'Yes' if info.get('willingToRelocate') else 'No'}",
        f"DOB: {info.get('dob','')}",
        f"Summary: {info.get('summary','')}",
        "", "=== WORK EXPERIENCE ===",
    ]
    for i, exp in enumerate(p.get("workExp", {}).get("experiences", [])):
        is_cur = bool(exp.get("current"))
        sm, sy = _month_year(exp.get("startDate", ""))
        em, ey = _month_year(exp.get("endDate", "")) if not is_cur else ("", "")
        lines += [
            f"[Job {i+1}] Company: {exp.get('company','')}",
            f"  Title: {exp.get('title','')}",
            f"  Type: {exp.get('employmentType',{}).get('label','')}",
            f"  Location: {exp.get('location','')}",
            f"  Start Month: {sm}  Start Year: {sy}",
            f"  End Month: {em}  End Year: {ey}  Current: {'Yes' if is_cur else 'No'}",
            f"  Desc: {exp.get('description','')[:300]}",
        ]
    lines += ["", "=== EDUCATION ==="]
    for edu in p.get("education", {}).get("education", []):
        sm, sy = _month_year(edu.get("startDate", ""))
        em, ey = _month_year(edu.get("endDate", ""))
        lines += [
            f"Institution: {edu.get('institution','')}",
            f"Degree: {edu.get('degree',{}).get('label','')}",
            f"Field: {edu.get('field','')}",
            f"GPA: {edu.get('gpa','')}",
            f"Start Month: {sm}  Start Year: {sy}",
            f"End Month: {em}  End Year: {ey}",
        ]
    sk = p.get("skills", {}); pref = p.get("preferences", {})
    lines += [
        "", "=== SKILLS ===",
        f"Skills: {', '.join(sk.get('skillsList',[]))}",
        f"Years of Experience: {sk.get('yoe','')}",
        f"Full Skills: {sk.get('skillsRaw','')[:300]}",
        "", "=== PREFERENCES ===",
        f"Desired Roles: {pref.get('desiredRoles','')}",
        f"Salary Min: {pref.get('salaryMin','')}",
        f"Notice Period: {pref.get('notice',{}).get('label','')}",
        f"Work Mode: {pref.get('workMode',{}).get('label','')}",
    ]
    return "\n".join(lines)

# ══════════════════════════════════════════════════════════════════════════════
# DOM FIELD EXTRACTION — raw string so JS regex backslashes are preserved
# ══════════════════════════════════════════════════════════════════════════════
EXTRACT_JS = r"""
() => {
    const fields = [];

    function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0
            && style.display !== 'none'
            && style.visibility !== 'hidden'
            && style.opacity !== '0'
            && !el.disabled;
    }

    function getLabel(el) {
        const lblIds = (el.getAttribute('aria-labelledby') || '').split(' ').filter(Boolean);
        if (lblIds.length) {
            const t = lblIds.map(id => document.getElementById(id))
                            .filter(Boolean).map(n => n.innerText.trim()).join(' ');
            if (t) return t.replace(/\*/g,'').trim();
        }
        const al = el.getAttribute('aria-label');
        if (al) return al.replace(/\*/g,'').trim();
        if (el.id) {
            const lbl = document.querySelector(`label[for="${el.id}"]`);
            if (lbl) return lbl.innerText.replace(/\*/g,'').trim();
        }
        const cl = el.closest('label');
        if (cl) return cl.innerText.replace(/\*/g,'').trim();
        let node = el.parentElement;
        for (let i = 0; i < 3; i++) {
            if (!node) break;
            const found = node.querySelector('label, [class*="label"], [class*="Label"]');
            if (found && found !== el) return found.innerText.replace(/\*/g,'').trim();
            node = node.parentElement;
        }
        if (el.placeholder) return el.placeholder.trim();
        if (el.name) return el.name.trim();
        return null;
    }

    function getNativeOptions(el) {
        if (el.tagName === 'SELECT') {
            return Array.from(el.options).filter(o=>o.value||o.text).map(o=>o.text.trim()).filter(Boolean);
        }
        return [];
    }

    function getSelector(el) {
        if (el.id) return '#' + el.id;
        if (el.name) return `[name="${el.name}"]`;
        return null;
    }

    // Native inputs
    const nativeQuery = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=file]), select, textarea';
    document.querySelectorAll(nativeQuery).forEach(el => {
        if (!isVisible(el)) return;
        const label = getLabel(el);
        if (!label || label.length < 1) return;
        fields.push({
            kind: 'native',
            tag: el.tagName.toLowerCase(),
            type: el.type || el.tagName.toLowerCase(),
            id: el.id || '',
            name: el.name || '',
            label,
            options: getNativeOptions(el),
            selector: getSelector(el),
            required: el.required || el.getAttribute('aria-required') === 'true',
        });
    });

    // Custom dropdowns
    const customSelectors = [
        '[role="combobox"]:not(input)',
        '[aria-haspopup="listbox"]:not(input):not(select)',
        '[class*="Select__control"]',
        '[class*="select__control"]',
        '[class*="dropdown-container"]',
    ].join(', ');

    try {
        document.querySelectorAll(customSelectors).forEach(el => {
            if (!isVisible(el)) return;
            if (el.closest('select')) return;
            const label = getLabel(el);
            if (!label) return;
            const already = fields.some(f => f.label === label && f.kind === 'native');
            if (already) return;
            const display = el.innerText.trim().replace(/[\n\u2193\u25bc\u25be]/g, '').trim();
            const isPlaceholder = display.toLowerCase() === 'select...' || display === '';
            fields.push({
                kind: 'custom',
                tag: el.tagName.toLowerCase(),
                type: 'custom-select',
                id: el.id || '',
                name: el.getAttribute('name') || '',
                label,
                options: [],
                selector: el.id ? '#' + el.id : null,
                required: el.getAttribute('aria-required') === 'true',
                currentValue: isPlaceholder ? '' : display,
            });
        });
    } catch(e) {}

    // Deduplicate by label
    const seen = new Set();
    return fields.filter(f => {
        if (seen.has(f.label)) return false;
        seen.add(f.label);
        return true;
    });
}
"""

def extract_fields(page: Page) -> list[dict]:
    return page.evaluate(EXTRACT_JS)

# ══════════════════════════════════════════════════════════════════════════════
# FUZZY MATCH
# ══════════════════════════════════════════════════════════════════════════════
def fuzzy_match(value: str, options: list[str]) -> str | None:
    if not value or not options: return None
    v = value.lower().strip()
    for o in options:
        if o.lower().strip() == v: return o
    for o in options:
        ol = o.lower().strip()
        if v in ol or ol in v: return o
    vw = set(re.findall(r'\w+', v))
    best, score = None, 0
    for o in options:
        ow = set(re.findall(r'\w+', o.lower()))
        s = len(vw & ow)
        if s > score: score, best = s, o
    if best and score > 0: return best
    for o in options:
        if re.search(r'\b(other|others|prefer not|n/a|none)\b', o.lower()): return o
    return None

# ══════════════════════════════════════════════════════════════════════════════
# CUSTOM DROPDOWN HANDLER
# ══════════════════════════════════════════════════════════════════════════════
def get_open_options(page: Page) -> list[str]:
    return page.evaluate(r"""
        () => {
            const selectors = [
                '[role="option"]',
                '[role="listbox"] [role="option"]',
                '[role="listbox"] li',
                '[class*="menu"] [class*="option"]',
                '[class*="dropdown"] li:not([role="separator"])',
                'ul[role="listbox"] li',
                '.select__menu .select__option',
                '.Select-option'
            ];
            for (const sel of selectors) {
                const els = document.querySelectorAll(sel);
                const vis = Array.from(els).filter(e => e.offsetParent !== null);
                if (vis.length > 0) {
                    return vis.map(e => e.innerText.trim()).filter(t => t && t.length > 0);
                }
            }
            return [];
        }
    """)

def click_option_by_text(page: Page, text: str) -> bool:
    try:
        # React relies on trusted MouseEvents, which JS el.click() often fails to trigger.
        # Playwright's native click fixes this.
        selectors = [
            f'[role="option"]:has-text("{text}")',
            f'[role="listbox"] [role="option"]:has-text("{text}")',
            f'[role="listbox"] li:has-text("{text}")',
            f'[class*="menu"] [class*="option"]:has-text("{text}")',
            f'[class*="dropdown"] li:has-text("{text}")',
            f'ul[role="listbox"] li:has-text("{text}")',
            f'.select__menu .select__option:has-text("{text}")',
            f'.Select-option:has-text("{text}")',
            f'text="{text}"'
        ]
        for sel in selectors:
            try:
                el = page.query_selector(sel)
                if el and el.is_visible():
                    el.click()
                    return True
            except: pass
        return False
    except: return False

def find_custom_trigger(page: Page, field: dict):
    label = field.get("label", "")
    candidates = []
    if field.get("id"): candidates.append(f"#{field['id']}")
    if field.get("selector"): candidates.append(field["selector"])
    candidates += [f'[aria-label="{label}"]', f'[placeholder="{label}"]']
    for sel in candidates:
        try:
            el = page.query_selector(sel)
            if el and el.is_visible(): return el
        except: pass

    result = page.evaluate(r"""
        (label) => {
            const triggers = document.querySelectorAll(
                '[role="combobox"], [aria-haspopup="listbox"], [class*="Select__control"], [class*="select__control"]'
            );
            for (const t of triggers) {
                if (!t.offsetParent) continue;
                const parent = t.closest('div,li,fieldset') || t.parentElement;
                if (parent && parent.innerText.includes(label)) {
                    return t.id || '_found_';
                }
            }
            const labels = document.querySelectorAll('label, [class*="label"]');
            for (const lbl of labels) {
                if (lbl.innerText.trim().replace(/\*/g,'').trim() === label) {
                    const container = lbl.closest('div,li,fieldset') || lbl.parentElement;
                    if (!container) continue;
                    const sel = container.querySelector('[role="combobox"], [aria-haspopup], [class*="select"]');
                    if (sel && sel.offsetParent) return sel.id || '_found_';
                }
            }
            return null;
        }
    """, label)

    if result and result != "_found_":
        try:
            el = page.query_selector(f"#{result}")
            if el and el.is_visible(): return el
        except: pass
    return None

def handle_custom_dropdown(page: Page, field: dict, value: str) -> bool:
    trigger = find_custom_trigger(page, field)
    if not trigger: return False
    try:
        trigger.scroll_into_view_if_needed()
        time.sleep(0.3)
        trigger.click()
        page.wait_for_timeout(800)
        options = get_open_options(page)
        
        # Determine the typing target (if the dropdown allows typing to filter)
        typing_target = None
        # 1. Is the trigger itself an input? (combobox)
        trigger_tag = trigger.evaluate("el => el.tagName.toLowerCase()")
        if trigger_tag == "input":
            typing_target = trigger
        else:
            # 2. Look for a dedicated search box
            for sel in [
                '[role="listbox"] input', '.select__menu input', 
                '.select__input input', '[class*="Select__input"] input', 
                '[aria-autocomplete="list"]'
            ]:
                try:
                    el = page.query_selector(sel)
                    if el and el.is_visible(): 
                        typing_target = el
                        break
                except: pass

        if typing_target:
            try: typing_target.click(timeout=1000)
            except: pass
            
            # Mimic Human: type slowly (first 4 chars) to let network drop down suggestions
            typing_text = value[:4] if len(value) > 4 else value
            typing_target.type(typing_text, delay=120)
            page.wait_for_timeout(1000)
            
            options_after_type = get_open_options(page)
            
            # If no options trickled in, or it requires the full word, type the rest
            if not options_after_type and len(value) > len(typing_text):
                try: typing_target.fill("")
                except: pass
                typing_target.type(value, delay=80)
                page.wait_for_timeout(1000)
            
            # Refresh options
            current_options = get_open_options(page)
            if current_options:
                options = current_options

        # If we failed to get ANY options
        if not options:
            page.keyboard.press("Escape")
            return False

        matched = fuzzy_match(value, options)
        if not matched:
            page.keyboard.press("Escape")
            return False

        # Attempt native element click
        ok = click_option_by_text(page, matched)
        
        # 3. Supreme human mimicry: if click failed, the dropdown is likely still open.
        # Natively pressing ArrowDown immediately highlights the top matched item, 
        # and Enter forces selection across almost all custom web component libraries natively.
        if not ok and typing_target:
            page.keyboard.press("ArrowDown")
            page.wait_for_timeout(100)
            page.keyboard.press("Enter")
            page.wait_for_timeout(300)
            ok = True
        elif not ok:
            # Absolute Javascript fallback if native click failed
            ok = page.evaluate(f'''
                () => {{
                    for(const el of document.querySelectorAll('[role="option"], li, [class*="option"]')) {{
                        if (el.innerText && el.innerText.trim().includes("{matched}")) {{
                            el.click(); return true;
                        }}
                    }} return false;
                }}
            ''')

        page.wait_for_timeout(400)
        
        # Lock selection & move focus away to successfully close dropdowns that get stuck
        page.keyboard.press("Tab")
        page.wait_for_timeout(200)
        return bool(ok)
    except:
        try: page.keyboard.press("Escape")
        except: pass
        return False

# ══════════════════════════════════════════════════════════════════════════════
# NATIVE FIELD FILLER
# ══════════════════════════════════════════════════════════════════════════════
def fill_native(page: Page, field: dict, value: str) -> bool:
    selectors = []
    if field.get("selector"): selectors.append(field["selector"])
    if field.get("id"): selectors.append(f"#{field['id']}")
    if field.get("name"): selectors.append(f'[name="{field["name"]}"]')

    el = None
    for sel in selectors:
        try:
            c = page.query_selector(sel)
            if c and c.is_visible(): el = c; break
        except: pass
    if not el: return False

    tag = field.get("tag", "")
    ftype = field.get("type", "")
    try:
        if tag == "select":
            opts = field.get("options", [])
            matched = fuzzy_match(value, opts)
            if matched:
                el.select_option(label=matched)
                return True
            return False
        elif ftype in ("checkbox", "radio"):
            ticked = value.lower() in ("yes","true","1","check","checked")
            if ticked:
                if not el.is_checked(): el.check()
            else:
                if el.is_checked(): el.uncheck()
            return True
        else:
            el.scroll_into_view_if_needed()
            el.click()
            time.sleep(0.1)
            if field.get("id"):
                safe_val = value.replace("'", "\\'").replace("\n", "\\n")
                page.evaluate(f"""
                    (() => {{
                        const el = document.getElementById('{field["id"]}');
                        if (!el) return;
                        const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
                                  || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
                        if (desc) desc.set.call(el, '{safe_val}');
                        else el.value = '{safe_val}';
                        el.dispatchEvent(new Event('input', {{bubbles: true}}));
                        el.dispatchEvent(new Event('change', {{bubbles: true}}));
                    }})()
                """)
            else:
                el.fill("")
                el.type(value, delay=30)
            return True
    except:
        return False

# ══════════════════════════════════════════════════════════════════════════════
# RESUME UPLOAD
# ══════════════════════════════════════════════════════════════════════════════
def upload_resume(page: Page, resume_path: str) -> bool:
    if not os.path.exists(resume_path):
        print(f"  ⚠️  Resume not found: {resume_path}")
        return False
    try:
        file_input = page.query_selector('input[type="file"]')
        if file_input:
            file_input.set_input_files(resume_path)
            page.wait_for_timeout(1000)
            print(f"  ✅ Filled  [Resume/CV]: {os.path.basename(resume_path)}")
            return True
        attach_btn = page.query_selector('text=Attach, button:has-text("Attach"), [data-source="resume_upload"]')
        if attach_btn:
            with page.expect_file_chooser() as fc_info:
                attach_btn.click()
            fc_info.value.set_files(resume_path)
            page.wait_for_timeout(1500)
            print(f"  ✅ Filled  [Resume/CV]: {os.path.basename(resume_path)}")
            return True
    except Exception as e:
        print(f"  ❌ Resume upload error: {e}")
    return False

# ══════════════════════════════════════════════════════════════════════════════
# LLM
# ══════════════════════════════════════════════════════════════════════════════
def call_llm(prompt: str) -> str:
    try:
        res = httpx.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json={"model": OLLAMA_MODEL,
                  "messages": [{"role": "user", "content": prompt}],
                  "stream": False, "options": {"temperature": 0.0, "num_predict": 4096}},
            timeout=120.0,
        )
        if res.status_code == 200:
            return res.json().get("message", {}).get("content", "")
    except Exception as e:
        print(f"  [Ollama] Failed: {e}")
    if OPENAI_API_KEY:
        try:
            res = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                json={"model": OPENAI_MODEL,
                      "messages": [{"role": "user", "content": prompt}],
                      "temperature": 0.0},
                timeout=60.0,
            )
            if res.status_code == 200:
                return res.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"  [OpenAI] Failed: {e}")
    return ""

def get_llm_answers(fields: list[dict], profile_text: str, is_validator: bool = False, critic_context: str = "") -> dict:
    fields_json = json.dumps([
        {"label": f["label"], "type": f["type"],
         "options": f.get("options", []), "required": f.get("required", False)}
        for f in fields
    ], indent=2)

    role_desc = "You are a highly thorough job application form-filling assistant."
    if is_validator:
        role_desc = """You are an AI Critic and Validator. The previous agent SKIPPED or FAILED to fill out the following fields.
YOUR JOB: Critique the failure, find the correct value from the candidate's profile, and ALWAYS provide an answer if possible. DO NOT SKIP unless absolutely impossible."""

    prompt = f"""{role_desc}

CRITICAL INSTRUCTION: Your output MUST be a strict JSON object where the keys are the EXACT 'label' strings from the FORM FIELDS list (e.g., "Company name", "Start date year") and the values are what you want to type into that field.

Example Output format:
{{
  "First Name": "Parth",
  "Last Name": "Singh",
  "Company name": "Snow",
  "Gender": null
}}

RULES FOR VALUES:
1. First Name fields: provide ONLY the first name (e.g., Parth).
2. Last Name fields: provide ONLY the last name (e.g., Singh).
3. Job Company fields: use your most recent company (Job 1).
4. Job Title fields: use your most recent title.
5. Start date month: Job 1 start month (e.g., "August").
6. Start date year: Job 1 start year (e.g., "2024").
7. End date for current role: output null.
8. "Current role" checkbox: output "yes" or "checked".
9. Education School: institution name (PES University).
10. Education Degree: degree label (e.g., "Bachelor's Degree").
11. Education Discipline: field of study (e.g., "Computer Science").
12. Current Career Stage: "Associate" or similar.
13. Gender / LGBTQ / Disability / Veteran: output null.
14. Current Industry: "Technology" or "Software Development".
15. For SELECT fields with options: ONLY choose an exact option string from its list; if none match exactly, pick the closest semantic match if reasonable, else null.
16. For custom-select always return the natural readable value.
17. CAPTCHA: output null.
18. Return ONLY valid JSON. No markdown. No explanations. {critic_context}

CANDIDATE PROFILE:
{profile_text}

FORM FIELDS:
{fields_json}

JSON:"""

    print(f"  [LLM] Analysing {len(fields)} fields...")
    raw = call_llm(prompt)
    if not raw:
        print("  [LLM] No response from model.")
        return {}
    
    try:
        s = raw.index("{"); e = raw.rindex("}") + 1
        parsed = json.loads(raw[s:e])
        
        # Match keys (labels from LLM) to our fields
        matched_map = {}
        for k, v in parsed.items():
            if not v or str(v).lower() in ("null", "none", ""): continue
            # Find matching field
            for _, f in enumerate(fields):
                if f["label"].lower().strip() == k.lower().strip() or f["label"] == k:
                    matched_map[f["label"]] = v
                    break
        
        print(f"  [LLM] Mapped {len(matched_map)} fields correctly.")
        return matched_map
    except Exception as ex:
        print(f"  [LLM] Parse error: {ex}\n  Raw: {raw[:500]}")
        return {}

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
def run_autofill(url: str):
    profile = load_profile()
    if not profile:
        print("❌ No profile found.")
        sys.exit(1)

    profile_text = build_profile_text(profile)
    name = f"{profile['personal']['firstName']} {profile['personal']['lastName']}"
    print(f"\n✅ Profile: {name}")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False, slow_mo=30)
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()
        page.on("dialog", lambda d: d.dismiss())

        print(f"\n🚀 Opening: {url}\n")
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2000)

        print("─" * 60)
        print("🛑  Navigate the form page. Login if needed.")
        print("    Once the APPLICATION FORM is visible → ENTER.")
        print("─" * 60)
        input("\n▶  Press ENTER when ready... ")
        page.wait_for_timeout(2000)

        # Resume upload
        resume_path = _find_resume()
        print(f"\n📎 Uploading: {os.path.basename(resume_path)}")
        upload_resume(page, resume_path)
        page.wait_for_timeout(500)

        # Scan
        print("\n🔍 Scanning visible form fields (deduped)...")
        fields = extract_fields(page)
        print(f"   Found {len(fields)} unique fields\n")

        if not fields:
            print("⚠️  No fields found.")
            input("▶  Press ENTER to close... ")
            browser.close()
            return

        # LLM PASS 1
        print("🤖 Getting AI answers (Pass 1)...")
        answers = get_llm_answers(fields, profile_text, is_validator=False)

        # Fill Loop
        filled_count = skipped_count = failed_count = 0
        skipped_fields = []
        
        for field in fields:
            label = field.get("label", "?")
            value = answers.get(label)
            kind  = field.get("kind", "native")
            ftype = field.get("type", "")

            if not value or str(value).lower() in ("null", "none", ""):
                print(f"  ⏭  Skip   [{label}]")
                skipped_fields.append(field)
                skipped_count += 1
                continue

            value = str(value).strip()
            ok = False

            if kind == "custom" or ftype == "custom-select":
                ok = handle_custom_dropdown(page, field, value)
                if not ok: ok = fill_native(page, field, value)
            elif field.get("tag") == "select":
                ok = fill_native(page, field, value)
                # Fallback to custom if native select fails (some custom dropdowns hide standard selects)
                if not ok: ok = handle_custom_dropdown(page, field, value)
            else:
                ok = fill_native(page, field, value)
                if not ok: ok = handle_custom_dropdown(page, field, value)

            if ok:
                print(f"  ✅ Filled  [{label}]: {value[:70]}")
                filled_count += 1
                time.sleep(0.3)
            else:
                print(f"  ❌ Failed  [{label}]: '{value[:50]}'")
                skipped_fields.append(field)
                failed_count += 1

        # ══════════════════════════════════════
        # VALIDATOR PASS (ITERATIVE LOOP)
        # ══════════════════════════════════════
        max_retries = 3
        attempt = 1
        
        while skipped_fields and attempt <= max_retries:
            print(f"\n🕵️‍♂️ Validator AI (Pass {attempt}) is reviewing {len(skipped_fields)} skipped/failed fields...")
            val_answers = get_llm_answers(
                skipped_fields, 
                profile_text, 
                is_validator=True, 
                critic_context="CRITIQUE: Most of these fields were skipped in pass 1. YOU MUST FIND A VALID ANSWER for them from the profile. e.g. if 'Years of Experience' was missed, guess it from the work history!"
            )
            
            if not val_answers:
                break
            
            still_skipped = []
            print(f"   Validator found answers for {len(val_answers)} missed fields. Attempting to fill...\n")
            
            for field in skipped_fields:
                label = field.get("label", "?")
                value = val_answers.get(label)
                if not value or str(value).lower() in ("null", "none", ""):
                    still_skipped.append(field)
                    continue
                    
                value = str(value).strip()
                kind = field.get("kind", "native")
                ftype = field.get("type", "")
                
                ok = False
                if kind == "custom" or ftype == "custom-select":
                    ok = handle_custom_dropdown(page, field, value)
                    if not ok: ok = fill_native(page, field, value)
                else:
                    ok = fill_native(page, field, value)
                    if not ok: ok = handle_custom_dropdown(page, field, value)

                if ok:
                    print(f"  ✅ [Validator] Filled [{label}]: {value[:70]}")
                    filled_count += 1
                    skipped_count -= 1 # adjust original counter
                else:
                    print(f"  ❌ [Validator] Still failed [{label}]: '{value[:50]}'")
                    still_skipped.append(field)
                    
            skipped_fields = still_skipped
            attempt += 1

        print(f"\n{'─'*60}")
        print(f"✨  Done!  ✅ {filled_count} completed  ⏭ {skipped_count} remaining skipped")
        print(f"{'─'*60}")
        print("\n👀  Review form before submitting. Agent will NOT submit.\n")
        input("▶  Press ENTER to close the browser... ")
        browser.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        url = input("Enter URL: ").strip()
    else:
        url = sys.argv[1].strip()
    if not url.startswith("http"):
        print("❌ Invalid URL."); sys.exit(1)
    run_autofill(url)
