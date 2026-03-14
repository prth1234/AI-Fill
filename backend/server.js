const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const { Client } = require('@opensearch-project/opensearch');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// ─── OpenSearch Client ────────────────────────────────────────────────────────
const osClient = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200',
  ssl: { rejectUnauthorized: false },
});

const PROFILE_INDEX = 'autofill_profiles';
const JOBS_INDEX = 'autofill_jobs';

// Ensure indexes exist
async function ensureIndexes() {
  const indexes = [
    {
      index: PROFILE_INDEX,
      body: {
        mappings: {
          properties: {
            userId: { type: 'keyword' },
            updatedAt: { type: 'date' },
            personal: { type: 'object', enabled: true },
            workExp: { type: 'object', enabled: true },
            education: { type: 'object', enabled: true },
            skills: { type: 'object', enabled: true },
            certsProjects: { type: 'object', enabled: true },
            preferences: { type: 'object', enabled: true },
            fullText: { type: 'text', analyzer: 'standard' },
          },
        },
      },
    },
    {
      index: JOBS_INDEX,
      body: {
        mappings: {
          properties: {
            sessionId: { type: 'keyword' },
            userId: { type: 'keyword' },
            url: { type: 'keyword' },
            platform: { type: 'keyword' },
            companyName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            jobTitle: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            status: { type: 'keyword' },
            progress: { type: 'integer' },
            logs: { type: 'object', enabled: false },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      },
    },
  ];

  for (const { index, body } of indexes) {
    try {
      const exists = await osClient.indices.exists({ index });
      if (!exists.body) {
        await osClient.indices.create({ index, body });
        console.log(`✅ Created index: ${index}`);
      }
    } catch (err) {
      console.warn(`⚠️  Could not create index ${index}: ${err.message}`);
    }
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── Stats ────────────────────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const jobsRes = await osClient.search({
      index: JOBS_INDEX,
      body: {
        aggs: {
          by_status: { terms: { field: 'status' } },
        },
        size: 0,
      },
    });
    const buckets = jobsRes.body.aggregations?.by_status?.buckets || [];
    const submitted = buckets.find(b => b.key === 'submitted')?.doc_count || 0;
    const total = buckets.reduce((s, b) => s + b.doc_count, 0);
    res.json({
      totalFilled: total,
      formsCompleted: submitted,
      hoursSaved: (submitted * 0.75).toFixed(1),
      profileComplete: 72,
    });
  } catch {
    res.json({ totalFilled: 0, formsCompleted: 0, hoursSaved: 0, profileComplete: 0 });
  }
});

// ─── Profile ──────────────────────────────────────────────────────────────────
app.post('/api/profile', async (req, res) => {
  const userId = req.body.userId || 'default_user';
  const profile = { ...req.body, userId, updatedAt: new Date().toISOString() };

  // Build a flat text blob for full-text search
  profile.fullText = buildFullText(profile);

  try {
    await osClient.index({
      index: PROFILE_INDEX,
      id: userId,
      body: profile,
      refresh: true,
    });
    res.json({ success: true, userId });
  } catch (err) {
    console.error('OpenSearch error:', err.message);
    // Fallback: store in-memory if OpenSearch is unavailable
    global._profileCache = profile;
    res.json({ success: true, userId, cached: true, warning: 'OpenSearch unavailable, saved in-memory' });
  }
});

async function getProfile(req, res) {
  const userId = req.params.userId || 'default_user';
  try {
    const result = await osClient.get({ index: PROFILE_INDEX, id: userId });
    res.json(result.body._source);
  } catch {
    if (global._profileCache) return res.json(global._profileCache);
    res.status(404).json({ error: 'Profile not found' });
  }
}
app.get('/api/profile/:userId', getProfile);
app.get('/api/profile', getProfile);

function buildFullText(profile) {
  const parts = [];
  const p = profile.personal || {};
  parts.push(`${p.firstName} ${p.lastName} ${p.email} ${p.summary || ''}`);
  (profile.workExp?.experiences || []).forEach(e => {
    parts.push(`${e.title} ${e.company} ${e.description} ${e.achievements}`);
  });
  (profile.education?.education || []).forEach(e => {
    parts.push(`${e.degree?.label} ${e.field} ${e.institution} ${e.coursework}`);
  });
  const sk = profile.skills || {};
  [...(sk.primaryLangs || []), ...(sk.frameworks || []), ...(sk.databases || []), ...(sk.cloudDevops || [])].forEach(s => parts.push(s.label));
  (profile.certsProjects?.certifications || []).forEach(c => parts.push(`${c.name} ${c.issuer}`));
  (profile.certsProjects?.projects || []).forEach(p => parts.push(`${p.name} ${p.description} ${p.techStack}`));
  return parts.join(' ');
}

// ─── AutoFill Sessions ────────────────────────────────────────────────────────
const sessions = new Map(); // In-memory session store

app.post('/api/autofill/start', async (req, res) => {
  const { url, platform, headless, jobContext } = req.body;
  const sessionId = uuidv4();
  
  // Initialize session
  sessions.set(sessionId, {
    sessionId, url, platform, headless, jobContext,
    status: 'running', progress: 0, logs: [],
    createdAt: new Date().toISOString(),
  });

  // Store job record in OpenSearch
  try {
    await osClient.index({
      index: JOBS_INDEX,
      id: sessionId,
      body: {
        sessionId, url, platform, status: 'running', progress: 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
    });
  } catch { /* OpenSearch may not be running */ }

  // Simulate progress (replace with real Playwright logic)
  simulateSession(sessionId);

  res.json({ sessionId, status: 'started' });
});

app.get('/api/autofill/status/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

app.post('/api/autofill/approve/:sessionId', async (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.status = 'done';
  session.progress = 100;
  try {
    await osClient.update({ index: JOBS_INDEX, id: req.params.sessionId, body: { doc: { status: 'submitted', progress: 100, updatedAt: new Date().toISOString() } } });
  } catch {}
  res.json({ success: true });
});

app.post('/api/autofill/stop/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (session) { session.status = 'stopped'; session.stopped = true; }
  res.json({ success: true });
});

// ─── Job History ──────────────────────────────────────────────────────────────
app.get('/api/jobs', async (req, res) => {
  try {
    const result = await osClient.search({
      index: JOBS_INDEX,
      body: { query: { match_all: {} }, sort: [{ createdAt: { order: 'desc' } }], size: 100 },
    });
    const hits = result.body.hits?.hits?.map(h => h._source) || [];
    res.json(hits);
  } catch {
    // Return in-memory sessions as fallback
    const jobs = Array.from(sessions.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(jobs);
  }
});

// ─── Simulation (stub for Playwright integration) ─────────────────────────────
function simulateSession(sessionId) {
  const steps = [
    { pct: 10, log: '🌐 Browser launched, navigating to URL…' },
    { pct: 20, log: '🔍 Detecting form platform…' },
    { pct: 30, log: '📋 Found 24 form fields. Fetching user profile from OpenSearch…' },
    { pct: 45, log: '🧠 LLM generating answers for Personal Info section…' },
    { pct: 55, log: '✍️  Filling: Name, Email, Phone, Location…' },
    { pct: 65, log: '🧠 LLM generating answers for Work Experience section…' },
    { pct: 75, log: '✍️  Filling: Job titles, company names, dates, descriptions…' },
    { pct: 85, log: '🧠 LLM generating answers for Skills & Education…' },
    { pct: 95, log: '✅ All fields filled. Pausing for your review…', pause: true },
  ];

  let i = 0;
  const interval = setInterval(() => {
    const session = sessions.get(sessionId);
    if (!session || session.stopped || i >= steps.length) { clearInterval(interval); return; }
    const step = steps[i++];
    session.progress = step.pct;
    session.log = step.log;
    session.level = 'info';
    if (step.pause) { session.status = 'paused'; clearInterval(interval); }
  }, 2000);
}

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 AI AutoFill Backend running on http://localhost:${PORT}`);
  console.log(`📡 OpenSearch: ${process.env.OPENSEARCH_URL || 'http://localhost:9200'}`);
  await ensureIndexes();
});
