import os
import uuid
import time
import json
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any

import boto3
from botocore.client import Config
from fastapi import FastAPI, HTTPException, Body, Path, Query, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
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

# ─── In-memory fallback store with File persistence ────────────────────────────
STORAGE_DIR = os.path.join(os.path.dirname(__file__), "local_storage")
PROFILES_FILE = os.path.join(STORAGE_DIR, "profiles.json")
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

_profile_store = load_local_profiles()
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
    import re
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
    work_exps = "\n".join([
        f"- {e.get('title', 'Role')} at {e.get('company', 'Company')} ({e.get('startDate', '?')} – {'Present' if e.get('current') else (e.get('endDate', '?'))}): {e.get('description', '')} Achievements: {e.get('achievements', '')}"
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
=== USER PROFILE ===

PERSONAL INFO:
  Name: {p.get('firstName', '')} {p.get('lastName', '')}
  Email: {p.get('email', 'N/A')}
  Phone: {p.get('phone', 'N/A')}
  Location: {", ".join(filter(None, [p.get('city'), p.get('state'), p.get('country')])) or 'N/A'}
  LinkedIn: {p.get('linkedin', 'N/A')}
  GitHub: {p.get('github', 'N/A')}
  Work Authorization: {p.get('workAuth', {}).get('label', 'N/A')}
  Summary: {p.get('summary', 'N/A')}

WORK EXPERIENCE:
{work_exps or '  None provided'}

EDUCATION:
{edus or '  None provided'}

SKILLS:
  {skills_text}
  Total Experience: {sk.get('yoe', 0)} years {sk.get('moe', 0)} months

CERTIFICATIONS:
{certs or '  None provided'}

PROJECTS:
{projs or '  None provided'}

JOB PREFERENCES:
  Roles: {", ".join(prefs.get("roles", [])) or 'N/A'}
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

@app.post("/api/agent/ask")
async def agent_ask(req: AskRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="question is required")
    
    user_id = req.userId or "default_user"
    profile = os_get(user_id) or _profile_store.get(user_id)
    profile_context = build_profile_context(profile) if profile else None
    
    if profile_context:
        system_prompt = f"You are an intelligent AI assistant for a job application autofill tool.\nYou have been given the user's complete professional profile below.\nAnswer questions accurately and helpfully based ONLY on this profile data.\nIf the information is not in the profile, say so clearly.\nKeep answers concise unless asked for detail.\n\n{profile_context}"
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
    steps = [
        {"pct": 10, "log": "🌐 Browser launched, navigating to URL…"},
        {"pct": 20, "log": "🔍 Detecting form platform…"},
        {"pct": 30, "log": "📋 Found 24 form fields. Fetching user profile from OpenSearch…"},
        {"pct": 45, "log": "🧠 LLM generating answers for Personal Info section…"},
        {"pct": 55, "log": "✍️  Filling: Name, Email, Phone, Location…"},
        {"pct": 65, "log": "🧠 LLM generating answers for Work Experience section…"},
        {"pct": 75, "log": "✍️  Filling: Job titles, company names, dates, descriptions…"},
        {"pct": 85, "log": "🧠 LLM generating answers for Skills & Education…"},
        {"pct": 95, "log": "✅ All fields filled. Pausing for your review…", "pause": True},
    ]
    
    for step in steps:
        await asyncio.sleep(2)
        session = _sessions.get(session_id)
        if not session or session.get("stopped"):
            break
        
        session.update({
            "progress": step["pct"],
            "log": step["log"],
            "level": "info"
        })
        
        if step.get("pause"):
            session["status"] = "paused"
            break

if __name__ == "__main__":
    import uvicorn
    print(f"\n🚀 AI AutoFill Python Backend (FastAPI) starting on http://localhost:{PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
