import os
import uuid
import time
import json
import asyncio
import hashlib
import re
from datetime import datetime
from typing import Optional, List, Dict, Any

import boto3
from botocore.client import Config
from fastapi import FastAPI, HTTPException, Body, Path, Query, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import sys
from playwright.async_api import async_playwright
import httpx
from opensearchpy import OpenSearch
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI AutoFill Python Backend")

# ─── Configuration ───────────────────────────────────────────────────────────
PORT = int(os.getenv("PORT", 4000))

# DB_TYPE: "opensearch" or "local"
DB_TYPE = os.getenv("DB_TYPE", "local")
OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "http://localhost:9200")

# STORAGE_TYPE: "s3" or "local"
STORAGE_TYPE = os.getenv("STORAGE_TYPE", "local")
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET", "resumes")

# Ollama local LLM config
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

# ─── S3 / MinIO Configuration ────────────────────────────────────────────────
s3_client = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    config=Config(signature_version="s3v4"),
    region_name="us-east-1"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── OpenSearch Client ────────────────────────────────────────────────────────
os_client = OpenSearch(
    hosts=[OPENSEARCH_URL],
    use_ssl=False,
    verify_certs=False,
    ssl_show_warn=False
)

PROFILE_INDEX = "autofill_profiles"
JOBS_INDEX = "autofill_jobs"
LEARNED_ANSWERS_INDEX = "autofill_learned_answers"

# ─── In-memory fallback store with File persistence ────────────────────────────
STORAGE_DIR = os.path.join(os.path.dirname(__file__), "local_storage")
PROFILES_FILE = os.path.join(STORAGE_DIR, "profiles.json")
LEARNED_ANSWERS_FILE = os.path.join(STORAGE_DIR, "learned_answers.json")
UPLOADS_DIR = os.path.join(STORAGE_DIR, "uploads")

os.makedirs(UPLOADS_DIR, exist_ok=True)

def load_local_profiles():
    if os.path.exists(PROFILES_FILE):
        try:
            with open(PROFILES_FILE, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_local_profiles(store):
    try:
        with open(PROFILES_FILE, "w") as f:
            json.dump(store, f, indent=2)
    except:
        pass

def load_local_learned_answers():
    if os.path.exists(LEARNED_ANSWERS_FILE):
        try:
            with open(LEARNED_ANSWERS_FILE, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_local_learned_answers(store):
    try:
        with open(LEARNED_ANSWERS_FILE, "w") as f:
            json.dump(store, f, indent=2)
    except:
        pass

_profile_store = load_local_profiles()
_learned_answers_store = load_local_learned_answers()
# Mirroring sessions Map in JS
_sessions = {}

# ─── Helpers ──────────────────────────────────────────────────────────────────
def build_full_text(profile: Dict[str, Any]) -> str:
    parts = []
    personal = profile.get("personal", {})
    parts.append(f"{personal.get('firstName', '')} {personal.get('lastName', '')} {personal.get('email', '')} {personal.get('summary', '')} {personal.get('city', '')} {personal.get('country', '')}")
    
    for e in profile.get("workExp", {}).get("experiences", []):
        parts.append(f"{e.get('title', '')} at {e.get('company', '')} {e.get('description', '')} {e.get('achievements', '')}")
        
    for e in profile.get("education", {}).get("education", []):
        parts.append(f"{e.get('degree', {}).get('label', '')} in {e.get('field', '')} at {e.get('institution', '')} GPA {e.get('gpa', '')} {e.get('coursework', '')}")
    
    skills = profile.get("skills", {})
    if skills.get("skillsList"):
        parts.append(", ".join(skills["skillsList"]))
    if skills.get("skillsRaw"):
        parts.append(skills["skillsRaw"])
        
    for c in profile.get("certsProjects", {}).get("certifications", []):
        parts.append(f"{c.get('name', '')} {c.get('issuer', '')}")
        
    for pr in profile.get("certsProjects", {}).get("projects", []):
        parts.append(f"{pr.get('name', '')} {pr.get('description', '')} {pr.get('techStack', '')}")
        
    full_text = " ".join(parts)
    return re.sub(r'\s+', ' ', full_text).strip()

def compute_completeness(profile: Dict[str, Any]) -> int:
    personal = profile.get("personal", {})
    work_exp = profile.get("workExp", {})
    edu = profile.get("education", {})
    skills = profile.get("skills", {})
    certs = profile.get("certsProjects", {})
    prefs = profile.get("preferences", {})

    checks = [
        bool(personal.get("firstName")),
        bool(personal.get("lastName")),
        bool(personal.get("email")),
        bool(personal.get("phone")),
        bool(personal.get("summary")),
        bool(personal.get("city")),
        bool(work_exp.get("experiences") and len(work_exp["experiences"]) > 0),
        bool(edu.get("education") and len(edu["education"]) > 0),
        bool(skills.get("skillsList") or skills.get("skillsRaw")),
        bool(certs.get("certifications") or certs.get("projects")),
        bool(prefs.get("roles") or prefs.get("salary"))
    ]
    score = round((sum(checks) / len(checks)) * 100)
    return score

def build_profile_context(profile: Dict[str, Any]) -> str:
    p = profile.get("personal", {})
    work_exps_list = profile.get("workExp", {}).get("experiences", [])
    
    # Calculate Total Experience by summing durations
    total_months = 0
    now = datetime.utcnow()
    
    for e in work_exps_list:
        try:
            start_str = e.get("startDate")
            if not start_str: continue
            
            start_date = datetime.strptime(start_str, "%Y-%m-%d")
            
            if e.get("current"):
                end_date = now
            else:
                end_str = e.get("endDate")
                if not end_str: continue
                end_date = datetime.strptime(end_str, "%Y-%m-%d")
            
            # Approximate months
            diff = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)
            if diff > 0:
                total_months += diff
        except:
            pass
            
    yoe_calc = total_months // 12
    moe_calc = total_months % 12
    
    work_exps = "\n".join([
        f"- {e.get('title', 'Role')} at {e.get('company', 'Company')} ({e.get('startDate', '?')} to {'Present' if e.get('current') else (e.get('endDate', '?'))}):\n"
        f"  Role Description/Responsibilities: {e.get('description', 'No details provided.')}\n"
        f"  Key Achievements: {e.get('achievements', 'None listed.')}"
        for e in work_exps_list
    ])
    
    edus_list = profile.get("education", {}).get("education", [])
    edus = "\n".join([
        f"- {e.get('degree', {}).get('label', '')} in {e.get('field', '')} at {e.get('institution', '')} (GPA: {e.get('gpa', 'N/A')})"
        for e in edus_list
    ])
    
    sk = profile.get("skills", {})
    skills_text = ", ".join(sk.get("skillsList", [])) if sk.get("skillsList") else (sk.get("skillsRaw") or 'Not specified')
    
    certs_list = profile.get("certsProjects", {}).get("certifications", [])
    certs = "\n".join([f"- {c.get('name', '')} by {c.get('issuer', '')}" for c in certs_list])
    
    projs_list = profile.get("certsProjects", {}).get("projects", [])
    projs = "\n".join([f"- {pr.get('name', '')}: {pr.get('description', '')} (Tech: {pr.get('techStack', '')})" for pr in projs_list])
    
    prefs = profile.get("preferences", {})
    
    return f"""
=== USER PROFESSIONAL PROFILE ===

PERSONAL INFO:
  Name: {p.get('firstName', '')} {p.get('lastName', '')}
  Email: {p.get('email', 'N/A')}
  Phone: {p.get('phone', 'N/A')}
  Location: {", ".join(filter(None, [p.get('city'), p.get('state'), p.get('country')])) or 'N/A'}
  LinkedIn: {p.get('linkedin', 'N/A')}
  GitHub: {p.get('github', 'N/A')}
  Work Authorization: {p.get('workAuth', {}).get('label', 'N/A')}
  Summary: {p.get('summary', 'N/A')}

WORK EXPERIENCE (Detailed History):
{work_exps or '  None provided'}

EXPERIENCE SUMMARY:
  Total Cumulative Experience: {yoe_calc} years, {moe_calc} months (Calculated by summing all individual job durations)
  Skills: {skills_text}

EDUCATION:
{edus or '  None provided'}

CERTIFICATIONS:
{certs or '  None provided'}

PROJECTS:
{projs or '  None provided'}

JOB PREFERENCES & TARGETS:
  Roles: {", ".join(prefs.get("roles", [])) or 'N/A'} (Note: Role description for each company above explains exactly what I did in those roles)
  Salary: {prefs.get('salary', 'N/A')}
  Work Type: {prefs.get('workType', {}).get('label', 'N/A')}
  Relocation: {'Yes' if p.get('willingToRelocate') else 'No'}
  Notice Period: {prefs.get('notice', {}).get('label', 'N/A')}
""".strip()

# ─── Safe OpenSearch helpers ──────────────────────────────────────────────────
def os_get(user_id: str) -> Optional[Dict[str, Any]]:
    try:
        result = os_client.get(index=PROFILE_INDEX, id=user_id)
        return result["_source"]
    except:
        return None

def os_upsert(user_id: str, profile: Dict[str, Any]) -> bool:
    try:
        os_client.index(
            index=PROFILE_INDEX,
            id=user_id,
            body=profile,
            refresh=True
        )
        return True
    except:
        return False

def os_delete(user_id: str) -> bool:
    try:
        os_client.delete(index=PROFILE_INDEX, id=user_id, refresh=True)
        return True
    except:
        return False

def normalize_question_key(value: str) -> str:
    text = (value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()

def learned_answer_doc_id(user_id: str, normalized_key: str) -> str:
    digest = hashlib.sha1(f"{user_id}:{normalized_key}".encode("utf-8")).hexdigest()
    return digest

def get_local_learned_answers(user_id: str) -> Dict[str, Dict[str, Any]]:
    return _learned_answers_store.get(user_id, {})

def get_learned_answers(user_id: str) -> Dict[str, Dict[str, Any]]:
    answers = dict(get_local_learned_answers(user_id))
    if DB_TYPE != "opensearch":
        return answers

    try:
        result = os_client.search(
            index=LEARNED_ANSWERS_INDEX,
            body={
                "size": 500,
                "query": {
                    "term": {
                        "userId": user_id
                    }
                }
            }
        )
        for hit in result.get("hits", {}).get("hits", []):
            src = hit.get("_source", {})
            key = src.get("normalizedQuestionKey")
            if key:
                answers[key] = src
    except:
        pass

    return answers

def save_learned_answer(user_id: str, question_text: str, answer: Any, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    normalized_key = normalize_question_key(question_text)
    now = datetime.utcnow().isoformat() + "Z"
    existing = get_local_learned_answers(user_id).get(normalized_key, {})
    usage_count = int(existing.get("usageCount", 0)) + 1
    doc = {
        "userId": user_id,
        "questionText": question_text,
        "normalizedQuestionKey": normalized_key,
        "answer": answer,
        "confirmedByUser": True,
        "usageCount": usage_count,
        "source": "user_feedback",
        "updatedAt": now,
        "lastUsedAt": now,
    }
    if metadata:
        doc.update(metadata)

    user_answers = _learned_answers_store.setdefault(user_id, {})
    user_answers[normalized_key] = doc
    save_local_learned_answers(_learned_answers_store)

    if DB_TYPE == "opensearch":
        try:
            os_client.index(
                index=LEARNED_ANSWERS_INDEX,
                id=learned_answer_doc_id(user_id, normalized_key),
                body=doc,
                refresh=True
            )
        except:
            pass

    return doc

# ─── Lifecycle — Ensure Indexes ───────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    indexes = [
        {
            "index": PROFILE_INDEX,
            "body": {
                "mappings": {
                    "properties": {
                        "userId":       {"type": "keyword"},
                        "updatedAt":    {"type": "date"},
                        "fullText":     {"type": "text", "analyzer": "standard"},
                    }
                }
            }
        },
        {
            "index": JOBS_INDEX,
            "body": {
                "mappings": {
                    "properties": {
                        "sessionId":   {"type": "keyword"},
                        "userId":      {"type": "keyword"},
                        "url":         {"type": "keyword"},
                        "platform":    {"type": "keyword"},
                        "status":      {"type": "keyword"},
                        "progress":    {"type": "integer"},
                        "createdAt":   {"type": "date"},
                        "updatedAt":   {"type": "date"},
                    }
                }
            }
        },
        {
            "index": LEARNED_ANSWERS_INDEX,
            "body": {
                "mappings": {
                    "properties": {
                        "userId": {"type": "keyword"},
                        "questionText": {"type": "text"},
                        "normalizedQuestionKey": {"type": "keyword"},
                        "answer": {"type": "text"},
                        "confirmedByUser": {"type": "boolean"},
                        "usageCount": {"type": "integer"},
                        "source": {"type": "keyword"},
                        "updatedAt": {"type": "date"},
                        "lastUsedAt": {"type": "date"},
                    }
                }
            }
        }
    ]
    if DB_TYPE == "opensearch":
        for idx in indexes:
            try:
                if not os_client.indices.exists(index=idx["index"]):
                    os_client.indices.create(index=idx["index"], body=idx["body"])
                    print(f"✅ Created index: {idx['index']}")
            except Exception as e:
                print(f"⚠️ Could not check/create index {idx['index']}: {e}")

    if STORAGE_TYPE == "s3":
        # Ensure S3 Bucket exists
        try:
            s3_client.head_bucket(Bucket=S3_BUCKET)
        except:
            try:
                s3_client.create_bucket(Bucket=S3_BUCKET)
                print(f"✅ Created S3 bucket: {S3_BUCKET}")
            except Exception as e:
                print(f"⚠️ Could not connect to S3 at {S3_ENDPOINT}: {e}")

# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health_check():
    opensearch_ok = False
    ollama_ok = False
    try:
        os_client.ping()
        opensearch_ok = True
    except:
        pass
    
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=1.0)
            ollama_ok = r.status_code == 200
    except:
        pass

    openai_ok = bool(OPENAI_API_KEY)
        
    return {
        "status": "ok",
        "time": datetime.utcnow().isoformat() + "Z",
        "services": {
            "opensearch": opensearch_ok, 
            "ollama": ollama_ok,
            "openai": openai_ok
        }
    }

# ─── Stats ────────────────────────────────────────────────────────────────────
@app.get("/api/stats")
async def get_stats():
    try:
        jobs_res = os_client.search(
            index=JOBS_INDEX,
            body={
                "aggs": {"by_status": {"terms": {"field": "status"}}},
                "size": 0
            }
        )
        buckets = jobs_res.get("aggregations", {}).get("by_status", {}).get("buckets", [])
        submitted = next((b["doc_count"] for b in buckets if b["key"] == "submitted"), 0)
        total = sum(b["doc_count"] for b in buckets)
        
        user_id = "default_user"
        profile = os_get(user_id) or _profile_store.get(user_id)
        profile_complete = compute_completeness(profile) if profile else 0
        
        return {
            "totalFilled": total,
            "formsCompleted": submitted,
            "hoursSaved": f"{submitted * 0.75:.1f}",
            "profileComplete": profile_complete
        }
    except:
        user_id = "default_user"
        profile = _profile_store.get(user_id)
        return {
            "totalFilled": 0, "formsCompleted": 0, "hoursSaved": "0.0",
            "profileComplete": compute_completeness(profile) if profile else 0
        }

# ─── Profile CRUD ─────────────────────────────────────────────────────────────
@app.post("/api/profile")
async def create_profile(body: Dict[str, Any] = Body(...)):
    user_id = body.get("userId", "default_user")
    profile = {**body, "userId": user_id, "updated_at": datetime.utcnow().isoformat() + "Z"}
    profile["fullText"] = build_full_text(profile)
    profile["completeness"] = compute_completeness(profile)
    
    saved = os_upsert(user_id, profile)
    _profile_store[user_id] = profile
    save_local_profiles(_profile_store)
    
    return {
        "success": True, 
        "userId": user_id, 
        "completeness": profile["completeness"], 
        "opensearch": saved
    }

@app.get("/api/profile/{user_id}")
async def get_profile(user_id: str = "default_user"):
    profile = os_get(user_id) or _profile_store.get(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@app.get("/api/profile")
async def get_profile_default():
    return await get_profile("default_user")

@app.put("/api/profile/{user_id}")
async def update_profile(user_id: str, body: Dict[str, Any] = Body(...)):
    existing = os_get(user_id) or _profile_store.get(user_id, {})
    updated = {**existing, **body, "userId": user_id, "updatedAt": datetime.utcnow().isoformat() + "Z"}
    updated["fullText"] = build_full_text(updated)
    updated["completeness"] = compute_completeness(updated)
    
    saved = os_upsert(user_id, updated)
    _profile_store[user_id] = updated
    save_local_profiles(_profile_store)
    
    return {
        "success": True, 
        "userId": user_id, 
        "completeness": updated["completeness"], 
        "opensearch": saved
    }

@app.delete("/api/profile/{user_id}")
async def delete_profile(user_id: str):
    os_deleted = os_delete(user_id)
    if user_id in _profile_store:
        _profile_store.pop(user_id, None)
        save_local_profiles(_profile_store)
    return {"success": True, "userId": user_id, "opensearch": os_deleted}

# ─── LLM Agent ────────────────────────────────────────────────────────────────
class AskRequest(BaseModel):
    question: str
    userId: Optional[str] = "default_user"

class InteractiveField(BaseModel):
    id: Optional[str] = None
    label: str
    type: Optional[str] = "text"
    required: Optional[bool] = True
    options: Optional[List[str]] = []
    question: Optional[str] = None
    selector: Optional[str] = None

class InteractiveAutofillStartRequest(BaseModel):
    url: Optional[str] = None
    platform: Optional[str] = None
    headless: Optional[bool] = False
    jobContext: Optional[str] = ""
    userId: Optional[str] = "default_user"
    reviewBeforeSubmit: Optional[bool] = True
    fields: List[InteractiveField] = Field(default_factory=list)

class InteractiveAutofillAnswer(BaseModel):
    fieldId: str
    answer: Any
    saveForFuture: Optional[bool] = True
    questionText: Optional[str] = None

class InteractiveAutofillResponseRequest(BaseModel):
    userId: Optional[str] = "default_user"
    answers: List[InteractiveAutofillAnswer] = Field(default_factory=list)

def profile_path_value(profile: Dict[str, Any], path: List[str], default: Any = None) -> Any:
    current = profile
    for segment in path:
        if not isinstance(current, dict):
            return default
        current = current.get(segment)
        if current is None:
            return default
    return current

def stringify_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        parts = [stringify_value(v) for v in value if stringify_value(v)]
        return ", ".join(parts)
    if isinstance(value, dict):
        if "label" in value:
            return str(value.get("label") or "")
        if "value" in value and not value.get("label"):
            return str(value.get("value") or "")
        parts = [stringify_value(v) for v in value.values()]
        return ", ".join([p for p in parts if p])
    return str(value).strip()

def build_known_profile_answers(profile: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    if not profile:
        return {}

    personal = profile.get("personal", {})
    prefs = profile.get("preferences", {})
    skills = profile.get("skills", {})
    work_experiences = profile.get("workExp", {}).get("experiences", []) or []
    education_entries = profile.get("education", {}).get("education", []) or []
    current_work = next((exp for exp in work_experiences if exp.get("current")), work_experiences[0] if work_experiences else {})
    latest_education = education_entries[0] if education_entries else {}

    alias_map = {
        "first name": personal.get("firstName"),
        "firstname": personal.get("firstName"),
        "last name": personal.get("lastName"),
        "lastname": personal.get("lastName"),
        "full name": f"{personal.get('firstName', '')} {personal.get('lastName', '')}".strip(),
        "name": f"{personal.get('firstName', '')} {personal.get('lastName', '')}".strip(),
        "email": personal.get("email"),
        "email address": personal.get("email"),
        "phone": personal.get("phone"),
        "phone number": personal.get("phone"),
        "city": personal.get("city"),
        "state": personal.get("state"),
        "country": personal.get("country"),
        "zipcode": personal.get("zipcode"),
        "zip code": personal.get("zipcode"),
        "postal code": personal.get("zipcode"),
        "linkedin": personal.get("linkedin"),
        "linkedin url": personal.get("linkedin"),
        "github": personal.get("github"),
        "website": personal.get("website"),
        "portfolio": personal.get("website"),
        "summary": personal.get("summary"),
        "professional summary": personal.get("summary"),
        "about me": personal.get("summary"),
        "work authorization": stringify_value(personal.get("workAuth")),
        "current company": current_work.get("company"),
        "current employer": current_work.get("company"),
        "current title": current_work.get("title"),
        "current role": current_work.get("title"),
        "current job title": current_work.get("title"),
        "current location": current_work.get("location"),
        "current job status": "Employed" if current_work else None,
        "employment status": "Employed" if current_work else None,
        "start date": current_work.get("startDate"),
        "current start date": current_work.get("startDate"),
        "notice period": stringify_value(prefs.get("notice")),
        "salary expectation": prefs.get("salary") or prefs.get("salaryMin"),
        "expected salary": prefs.get("salary") or prefs.get("salaryMin"),
        "desired role": prefs.get("desiredRoles") or stringify_value(prefs.get("roles")),
        "desired roles": prefs.get("desiredRoles") or stringify_value(prefs.get("roles")),
        "skills": stringify_value(skills.get("skillsList") or skills.get("skillsRaw")),
        "technical skills": stringify_value(skills.get("skillsList") or skills.get("skillsRaw")),
        "years of experience": skills.get("yoe"),
        "degree": stringify_value(latest_education.get("degree")),
        "field of study": latest_education.get("field"),
        "institution": latest_education.get("institution"),
    }

    custom_fields = profile.get("fields", []) or []
    for item in custom_fields:
        key = normalize_question_key(item.get("key", ""))
        if key:
            alias_map[key] = item.get("value")

    known = {}
    for alias, value in alias_map.items():
        text = stringify_value(value)
        if text:
            known[normalize_question_key(alias)] = {
                "value": text,
                "source": "profile",
                "confidence": 0.98
            }
    return known

def option_compatible_value(value: str, options: List[str]) -> Optional[str]:
    if not value:
        return None
    normalized_value = normalize_question_key(value)
    for option in options or []:
        if normalize_question_key(option) == normalized_value:
            return option
    for option in options or []:
        if normalized_value in normalize_question_key(option) or normalize_question_key(option) in normalized_value:
            return option
    return None

def heuristic_recommendation(field: InteractiveField, profile: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    label = normalize_question_key(field.label)
    personal = profile.get("personal", {}) if profile else {}
    current_work = next(
        (exp for exp in profile.get("workExp", {}).get("experiences", []) if exp.get("current")),
        None
    ) if profile else None

    recommendation = None
    if "why do you want to leave" in label or "reason for leaving" in label:
        recommendation = (
            f"I am looking for a role with stronger alignment to my long-term goals in "
            f"software engineering, AI, and higher-impact product ownership."
        )
    elif "cover letter" in label or "why are you interested" in label:
        recommendation = personal.get("summary")
    elif "current job status" in label or "employment status" in label:
        recommendation = "Employed" if current_work else None

    if not recommendation:
        return None

    return {
        "value": stringify_value(recommendation),
        "source": "heuristic_recommendation",
        "confidence": 0.62
    }

def resolve_field_value(field: InteractiveField, profile: Dict[str, Any], learned_answers: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    known_profile_answers = build_known_profile_answers(profile)
    lookup_candidates = [
        field.id or "",
        field.label or "",
        field.question or ""
    ]

    for candidate in lookup_candidates:
        key = normalize_question_key(candidate)
        if not key:
            continue

        if key in known_profile_answers:
            match = dict(known_profile_answers[key])
            if field.options:
                option_match = option_compatible_value(match["value"], field.options)
                if option_match:
                    match["value"] = option_match
                    return {**match, "questionKey": key}
            else:
                return {**match, "questionKey": key}

        if key in learned_answers:
            learned = learned_answers[key]
            value = stringify_value(learned.get("answer"))
            if field.options:
                value = option_compatible_value(value, field.options)
            if value:
                return {
                    "value": value,
                    "source": learned.get("source", "learned_answer"),
                    "confidence": 0.95,
                    "questionKey": key,
                    "learned": True
                }

    recommendation = heuristic_recommendation(field, profile)
    if recommendation:
        return {
            **recommendation,
            "questionKey": normalize_question_key(field.question or field.label or field.id or "")
        }

    return {
        "value": None,
        "source": "unresolved",
        "confidence": 0.0,
        "questionKey": normalize_question_key(field.question or field.label or field.id or "")
    }

def build_pending_question(field: InteractiveField, resolution: Dict[str, Any]) -> Dict[str, Any]:
    question_text = field.question or f"What should I fill for '{field.label}'?"
    return {
        "fieldId": field.id or normalize_question_key(field.label),
        "label": field.label,
        "questionText": question_text,
        "questionKey": resolution.get("questionKey") or normalize_question_key(question_text),
        "type": field.type or "text",
        "options": field.options or [],
        "required": bool(field.required),
        "recommendation": resolution.get("value"),
        "recommendationSource": resolution.get("source"),
        "recommendationConfidence": resolution.get("confidence", 0.0),
        "selector": field.selector,
    }

def update_job_index(session_id: str, status: str, progress: int):
    try:
        os_client.update(
            index=JOBS_INDEX,
            id=session_id,
            body={"doc": {"status": status, "progress": progress, "updatedAt": datetime.utcnow().isoformat() + "Z"}}
        )
    except:
        pass

async def build_interactive_session_state(session: Dict[str, Any]):
    user_id = session.get("userId", "default_user")
    profile = os_get(user_id) or _profile_store.get(user_id, {})
    learned_answers = get_learned_answers(user_id)
    fields = [InteractiveField(**field) if not isinstance(field, InteractiveField) else field for field in session.get("fields", [])]

    draft_answers = []
    pending_questions = []

    for field in fields:
        field_id = field.id or normalize_question_key(field.label)
        existing = session.get("userAnswers", {}).get(field_id)
        if existing is not None:
            draft_answers.append({
                "fieldId": field_id,
                "label": field.label,
                "value": existing,
                "source": "user_input",
                "confidence": 1.0,
                "required": bool(field.required),
                "options": field.options or [],
                "selector": field.selector,
            })
            continue

        resolution = resolve_field_value(field, profile, learned_answers)
        value = resolution.get("value")
        confidence = float(resolution.get("confidence", 0.0))
        if value and confidence >= 0.8:
            draft_answers.append({
                "fieldId": field_id,
                "label": field.label,
                "value": value,
                "source": resolution.get("source"),
                "confidence": confidence,
                "required": bool(field.required),
                "options": field.options or [],
                "selector": field.selector,
            })
        else:
            pending_questions.append(build_pending_question(field, resolution))

    resolved_count = len(draft_answers)
    total_fields = len(fields)
    progress = round((resolved_count / total_fields) * 100) if total_fields else 100
    session["draftAnswers"] = draft_answers
    session["pendingQuestions"] = pending_questions
    session["review"] = {
        "filledFields": len(draft_answers),
        "pendingFields": len(pending_questions),
        "totalFields": total_fields,
        "readyToSubmit": len(pending_questions) == 0
    }
    session["progress"] = progress

    if pending_questions:
        session["status"] = "awaiting_user_input"
        session["log"] = f"Need user input for {len(pending_questions)} field(s) before review."
        session["level"] = "warn"
        update_job_index(session["sessionId"], "awaiting_user_input", progress)
    else:
        session["status"] = "review"
        session["log"] = "Draft answers are ready for review."
        session["level"] = "success"
        update_job_index(session["sessionId"], "review", progress)

@app.post("/api/agent/ask")
async def agent_ask(req: AskRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="question is required")
    
    user_id = req.userId or "default_user"
    profile = os_get(user_id) or _profile_store.get(user_id)
    profile_context = build_profile_context(profile) if profile else None
    
    if profile_context:
        current_date = datetime.utcnow().strftime('%Y-%m-%d')
        system_prompt = (
            "You are an intelligent AI assistant for a job application autofill tool.\n"
            "You have been provided with the user's complete professional profile below.\n\n"
            "IMPORTANT GUIDELINES:\n"
            "1. Answer questions accurately based ONLY on the provided profile data.\n"
            "2. 'Role Description' or 'Responsibilities' under each work experience entry explains exactly what the user did at that company.\n"
            "3. Total years of experience (YOE) is calculated by summing the individual durations of all work experiences, not just from the first start date.\n"
            "4. If information is missing, state that you don't have that specific detail in the profile.\n"
            "5. Keep responses concise unless the user asks for more detail.\n"
            f"6. Today's Date is: {current_date}\n\n"
            f"{profile_context}"
        )
    else:
        system_prompt = "You are an AI assistant for a job application autofill tool.\nThe user has not yet set up their profile. Encourage them to complete their profile at the Profile Setup page.\nYou can still answer general questions about the application."

    answer = ""
    model_used = OLLAMA_MODEL
    ollama_available = True
    
    # 1. Try Ollama (Local)
    try:
        async with httpx.AsyncClient() as client:
            ollama_res = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": req.question}
                    ],
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 512}
                },
                timeout=120.0
            )
            if ollama_res.status_code == 200:
                data = ollama_res.json()
                answer = data.get("message", {}).get("content", data.get("response", "No response from LLM."))
                model_used = f"ollama:{OLLAMA_MODEL}"
            else:
                raise Exception(f"Ollama returned {ollama_res.status_code}")
    except Exception as e:
        print(f"Ollama failed for {user_id}: {repr(e)}")
        ollama_available = False
        
        # 2. Try OpenAI (Fallback)
        if OPENAI_API_KEY:
            try:
                async with httpx.AsyncClient() as client:
                    oa_res = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                        json={
                            "model": OPENAI_MODEL,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": req.question}
                            ],
                            "temperature": 0.3
                        },
                        timeout=30.0
                    )
                    if oa_res.status_code == 200:
                        oa_data = oa_res.json()
                        answer = oa_data["choices"][0]["message"]["content"]
                        model_used = f"openai:{OPENAI_MODEL}"
                    else:
                        raise Exception(f"OpenAI returned {oa_res.status_code}")
            except Exception as oa_e:
                print(f"OpenAI fallback failed for {user_id}: {oa_e}")
                pass

    # 3. Final Fallback (Summary template)
    if not answer:
        if profile_context:
            answer = f"⚠️ Both local LLM (Ollama) and OpenAI fallback are unavailable.\n\nHere is a summary from your profile:\n\n{profile_context}\n\nTo fix this:\n1. Start Ollama: `ollama serve` and `ollama pull {OLLAMA_MODEL}`\n2. OR provide an `OPENAI_API_KEY` in the `.env` file."
        else:
            answer = "⚠️ No AI service is online and no profile was found. Please set up your profile or start an LLM service (Ollama or OpenAI)."
        model_used = "fallback"

    return {
        "answer": answer,
        "model": model_used,
        "ollamaAvailable": ollama_available,
        "openaiAvailable": bool(OPENAI_API_KEY),
        "hasProfile": bool(profile),
        "userId": user_id
    }

# ─── Blob Storage Endpoints ───────────────────────────────────────────────────
@app.post("/api/resume/upload")
async def upload_resume(file: UploadFile = File(...), user_id: str = "default_user"):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    file_key = f"{user_id}/resume.pdf"
    content = await file.read()
    orig_name = os.path.splitext(file.filename)[0]
    
    # 1. Determine version by counting existing files
    version = 1
    if STORAGE_TYPE == "local":
        user_dir = os.path.join(UPLOADS_DIR, user_id)
        if os.path.exists(user_dir):
            version = len([f for f in os.listdir(user_dir) if f.endswith(".pdf")]) + 1
    else:
        try:
            resp = s3_client.list_objects_v2(Bucket=S3_BUCKET, Prefix=f"{user_id}/")
            version = resp.get("KeyCount", 0) + 1
        except: pass

    new_filename = f"{orig_name}_v{version}.pdf"
    file_key = f"{user_id}/{new_filename}"
    
    # Update local storage with latest key pointer (optional but good for 'download')
    # We'll save the 'latest' pointer in the profiles or handled by status
    
    if STORAGE_TYPE == "local":
        user_dir = os.path.join(UPLOADS_DIR, user_id)
        os.makedirs(user_dir, exist_ok=True)
        local_path = os.path.join(user_dir, new_filename)
        with open(local_path, "wb") as f:
            f.write(content)
        return {"success": True, "storage": "local", "filename": new_filename, "version": version}
    else:
        try:
            s3_client.put_object(
                Bucket=S3_BUCKET,
                Key=file_key,
                Body=content,
                ContentType="application/pdf"
            )
            return {"success": True, "storage": "s3", "key": file_key, "filename": new_filename, "version": version}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"S3 upload failed: {e}")

@app.get("/api/resume/download")
async def download_resume(user_id: str = "default_user", filename: Optional[str] = None):
    # If no filename provided, get the latest one
    if not filename:
        status = await resume_status(user_id)
        if not status.get("exists"):
            raise HTTPException(status_code=404, detail="Resume not found.")
        filename = status["filename"]

    file_key = f"{user_id}/{filename}"
    
    if STORAGE_TYPE == "local":
        local_path = os.path.join(UPLOADS_DIR, user_id, filename)
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                return Response(content=f.read(), media_type="application/pdf")
    else:
        try:
            res = s3_client.get_object(Bucket=S3_BUCKET, Key=file_key)
            return Response(content=res["Body"].read(), media_type="application/pdf")
        except:
            pass
    
    raise HTTPException(status_code=404, detail=f"File {filename} not found.")

@app.get("/api/resume/status")
async def resume_status(user_id: str = "default_user"):
    # Return the latest version info
    latest_file = None
    
    if STORAGE_TYPE == "local":
        user_dir = os.path.join(UPLOADS_DIR, user_id)
        if os.path.exists(user_dir):
            files = [f for f in os.listdir(user_dir) if f.endswith(".pdf")]
            if files:
                # Sort by version number suffix if possible, or use stats
                files.sort(key=lambda x: os.path.getmtime(os.path.join(user_dir, x)), reverse=True)
                latest_file = files[0]
                return {"exists": True, "storage": "local", "filename": latest_file}
    else:
        try:
            resp = s3_client.list_objects_v2(Bucket=S3_BUCKET, Prefix=f"{user_id}/")
            if resp.get("Contents"):
                # Sort by last modified
                sorted_contents = sorted(resp["Contents"], key=lambda x: x["LastModified"], reverse=True)
                latest_file = sorted_contents[0]["Key"].split("/")[-1]
                return {"exists": True, "storage": "s3", "filename": latest_file}
        except:
            pass
        
    return {"exists": False}

# ─── AutoFill Management ──────────────────────────────────────────────────────
@app.post("/api/autofill/start")
async def start_autofill(body: Dict[str, Any] = Body(...)):
    session_id = str(uuid.uuid4())
    session_data = {
        **body, "sessionId": session_id, "status": "running", 
        "progress": 0, "logs": [], "createdAt": datetime.utcnow().isoformat() + "Z"
    }
    _sessions[session_id] = session_data
    
    try:
        os_client.index(
            index=JOBS_INDEX,
            id=session_id,
            body={
                "sessionId": session_id, "url": body.get("url"), 
                "platform": body.get("platform"), "status": "running", "progress": 0,
                "createdAt": session_data["createdAt"], "updatedAt": session_data["createdAt"]
            }
        )
    except:
        pass
    
    # Start background task simulation
    asyncio.create_task(simulate_session(session_id))
    return {"sessionId": session_id, "status": "started"}

@app.post("/api/autofill/interactive/start")
async def start_interactive_autofill(req: InteractiveAutofillStartRequest):
    session_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat() + "Z"
    session_data = {
        "sessionId": session_id,
        "userId": req.userId or "default_user",
        "url": req.url,
        "platform": req.platform,
        "headless": req.headless,
        "jobContext": req.jobContext,
        "reviewBeforeSubmit": bool(req.reviewBeforeSubmit),
        "status": "running",
        "progress": 0,
        "fields": [field.dict() for field in req.fields],
        "userAnswers": {},
        "draftAnswers": [],
        "pendingQuestions": [],
        "logs": [],
        "createdAt": created_at,
        "updatedAt": created_at,
        "mode": "interactive"
    }
    _sessions[session_id] = session_data

    try:
        os_client.index(
            index=JOBS_INDEX,
            id=session_id,
            body={
                "sessionId": session_id,
                "userId": session_data["userId"],
                "url": req.url,
                "platform": req.platform,
                "status": "running",
                "progress": 0,
                "createdAt": created_at,
                "updatedAt": created_at
            },
            refresh=True
        )
    except:
        pass

    await build_interactive_session_state(session_data)
    session_data["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    return session_data

@app.get("/api/autofill/status/{session_id}")
async def get_autofill_status(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@app.post("/api/autofill/approve/{session_id}")
async def approve_autofill(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session["status"] = "done"
    session["progress"] = 100
    try:
        os_client.update(
            index=JOBS_INDEX,
            id=session_id,
            body={"doc": {"status": "submitted", "progress": 100, "updatedAt": datetime.utcnow().isoformat() + "Z"}}
        )
    except:
        pass
    return {"success": True}

@app.post("/api/autofill/interactive/respond/{session_id}")
async def respond_interactive_autofill(session_id: str, req: InteractiveAutofillResponseRequest):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_id = req.userId or session.get("userId") or "default_user"
    answer_map = session.setdefault("userAnswers", {})

    for item in req.answers:
        answer_map[item.fieldId] = item.answer
        if item.saveForFuture:
            question_text = item.questionText or item.fieldId
            save_learned_answer(
                user_id,
                question_text,
                item.answer,
                metadata={"sessionId": session_id}
            )

    session["status"] = "running"
    session["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    await build_interactive_session_state(session)
    session["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    return session

@app.post("/api/autofill/review/{session_id}/submit")
async def submit_reviewed_autofill(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get("pendingQuestions"):
        raise HTTPException(status_code=400, detail="Session still requires user input before submission")

    session["status"] = "done"
    session["progress"] = 100
    session["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    session["submittedAt"] = session["updatedAt"]
    session["log"] = "Application draft approved and marked ready for downstream submission."
    session["level"] = "success"
    update_job_index(session_id, "submitted", 100)
    return {
        "success": True,
        "sessionId": session_id,
        "status": session["status"],
        "submittedAt": session["submittedAt"],
        "draftAnswers": session.get("draftAnswers", [])
    }

@app.get("/api/learned-answers/{user_id}")
async def list_learned_answers(user_id: str):
    answers = get_learned_answers(user_id)
    return {
        "userId": user_id,
        "count": len(answers),
        "items": list(answers.values())
    }

@app.post("/api/autofill/stop/{session_id}")
async def stop_autofill(session_id: str):
    session = _sessions.get(session_id)
    if session:
        session["status"] = "stopped"
        session["stopped"] = True
    return {"success": True}

# ─── Job History ──────────────────────────────────────────────────────────────
@app.get("/api/jobs")
async def get_jobs():
    try:
        result = os_client.search(
            index=JOBS_INDEX,
            body={
                "query": {"match_all": {}}, 
                "sort": [{"createdAt": {"order": "desc"}}], 
                "size": 100
            }
        )
        hits = [h["_source"] for h in result["hits"]["hits"]]
        return hits
    except:
        # Fallback to in-memory _sessions
        jobs = list(_sessions.values())
        jobs.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
        return jobs

# ─── Simulation Stub ──────────────────────────────────────────────────────────
async def simulate_session(session_id: str):
    session = _sessions.get(session_id)
    if not session: return

    url = session.get("url")
    headless = session.get("headless", True)
    user_id = str(session.get("userId", "default_user"))
    profile = os_get(user_id) or _profile_store.get(user_id, {})
    
    session.update({"log": "Launching Playwright browser...", "progress": 10})
    
    try:
        async with async_playwright() as p:
            # Launcher
            browser = await p.chromium.launch(headless=headless)
            context = await browser.new_context()
            page = await context.new_page()
            
            session.update({"log": f"Navigating to {url}...", "level": "info", "progress": 20})
            await page.goto(url)
            
            if not headless:
                session.update({"log": "PAUSED: Please login manually in the browser window. The AI will wait 30s...", "status": "paused", "level": "warn"})
                # Wait for user to navigate/login - simple wait for now
                await asyncio.sleep(30) 
                session["status"] = "running"

            session.update({"log": "Detecting form fields...", "progress": 40})
            
            # Detect inputs, selects, textareas
            elements = await page.query_selector_all("input:not([type='hidden']), select, textarea")
            detected_fields = []
            
            for el in elements:
                try:
                    name = await el.get_attribute("name") or ""
                    placeholder = await el.get_attribute("placeholder") or ""
                    id_attr = await el.get_attribute("id") or ""
                    tag = (await el.evaluate("el => el.tagName")).lower()
                    label_text = ""
                    
                    if id_attr:
                        label_el = await page.query_selector(f"label[for='{id_attr}']")
                        if label_el: label_text = await label_el.inner_text()
                    
                    field = {
                        "id": id_attr or name,
                        "label": label_text or placeholder or name or "Unknown Field",
                        "type": "text" if tag != "select" else "select",
                        "selector": f"#{id_attr}" if id_attr else (f"[name='{name}']" if name else None)
                    }
                    if field["label"] != "Unknown Field":
                        detected_fields.append(field)
                except: pass

            session["fields"] = detected_fields
            await build_interactive_session_state(session)
            
            # Auto-fill high confidence fields
            session.update({"log": f"Found {len(detected_fields)} fields. Filling high-confidence matches...", "progress": 60})
            
            filled = 0
            drafts = session.get("draftAnswers", [])
            if isinstance(drafts, list):
                for draft in drafts:
                    if isinstance(draft, dict) and float(draft.get("confidence", 0)) > 0.8:
                        try:
                            selector = str(draft.get("selector", ""))
                            if selector:
                                val = str(draft.get("value", ""))
                                await page.fill(selector, val)
                                filled = filled + 1
                        except: pass
            
            pending = session.get("pendingQuestions", [])
            session.update({
                "log": f"Auto-filled {filled} fields. Remaining: {len(pending) if isinstance(pending, list) else 0}",
                "progress": 95,
                "status": "review" if not pending else "awaiting_user_input"
            })
            
            # Keep browser open if non-headless so user can see it
            if not headless:
                await asyncio.sleep(600) # Keep alive for 10 mins
            
            await browser.close()

    except Exception as e:
        session.update({"log": f"Automation Error: {str(e)}", "status": "error", "level": "error"})

if __name__ == "__main__":
    import uvicorn
    print(f"\n🚀 AI AutoFill Python Backend (FastAPI) starting on http://localhost:{PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
