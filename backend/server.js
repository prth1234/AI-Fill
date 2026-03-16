const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const { Client } = require('@opensearch-project/opensearch');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 4000;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// ─── OpenSearch Client ────────────────────────────────────────────────────────
const osClient = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200',
  ssl: { rejectUnauthorized: false },
});

const PROFILE_INDEX = 'autofill_profiles';
const JOBS_INDEX = 'autofill_jobs';

// ─── In-memory fallback store ─────────────────────────────────────────────────
// Used when OpenSearch is not yet running
global._profileStore = global._profileStore || {};

// ─── Ensure indexes exist ─────────────────────────────────────────────────────
async function ensureIndexes() {
  const indexes = [
    {
      index: PROFILE_INDEX,
      body: {
        mappings: {
          properties: {
            userId:       { type: 'keyword' },
            updatedAt:    { type: 'date' },
            personal:     { type: 'object', enabled: true },
            workExp:      { type: 'object', enabled: true },
            education:    { type: 'object', enabled: true },
            skills:       { type: 'object', enabled: true },
            certsProjects:{ type: 'object', enabled: true },
            preferences:  { type: 'object', enabled: true },
            customFields: { type: 'object', enabled: true },
            fullText:     { type: 'text', analyzer: 'standard' },
          },
        },
      },
    },
    {
      index: JOBS_INDEX,
      body: {
        mappings: {
          properties: {
            sessionId:   { type: 'keyword' },
            userId:      { type: 'keyword' },
            url:         { type: 'keyword' },
            platform:    { type: 'keyword' },
            companyName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            jobTitle:    { type: 'text', fields: { keyword: { type: 'keyword' } } },
            status:      { type: 'keyword' },
            progress:    { type: 'integer' },
            logs:        { type: 'object', enabled: false },
            createdAt:   { type: 'date' },
            updatedAt:   { type: 'date' },
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildFullText(profile) {
  const parts = [];
  const p = profile.personal || {};
  parts.push(`${p.firstName || ''} ${p.lastName || ''} ${p.email || ''} ${p.summary || ''} ${p.city || ''} ${p.country || ''}`);
  (profile.workExp?.experiences || []).forEach(e => {
    parts.push(`${e.title || ''} at ${e.company || ''} ${e.description || ''} ${e.achievements || ''}`);
  });
  (profile.education?.education || []).forEach(e => {
    parts.push(`${e.degree?.label || ''} in ${e.field || ''} at ${e.institution || ''} GPA ${e.gpa || ''} ${e.coursework || ''}`);
  });
  const sk = profile.skills || {};
  if (sk.skillsList) parts.push(sk.skillsList.join(', '));
  if (sk.skillsRaw) parts.push(sk.skillsRaw);
  (profile.certsProjects?.certifications || []).forEach(c => parts.push(`${c.name || ''} ${c.issuer || ''}`));
  (profile.certsProjects?.projects || []).forEach(pr => parts.push(`${pr.name || ''} ${pr.description || ''} ${pr.techStack || ''}`));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function computeCompleteness(profile) {
  const checks = [
    !!(profile.personal?.firstName),
    !!(profile.personal?.lastName),
    !!(profile.personal?.email),
    !!(profile.personal?.phone),
    !!(profile.personal?.summary),
    !!(profile.personal?.city),
    !!(profile.workExp?.experiences?.length),
    !!(profile.education?.education?.length),
    !!(profile.skills?.skillsList?.length || profile.skills?.skillsRaw),
    !!(profile.certsProjects?.certifications?.length || profile.certsProjects?.projects?.length),
    !!(profile.preferences?.roles?.length || profile.preferences?.salary),
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return score;
}

function buildProfileContext(profile) {
  const p = profile.personal || {};
  const workExps = (profile.workExp?.experiences || []).map(e =>
    `- ${e.title || 'Role'} at ${e.company || 'Company'} (${e.startDate || '?'} – ${e.current ? 'Present' : (e.endDate || '?')}): ${e.description || ''} Achievements: ${e.achievements || ''}`
  ).join('\n');

  const edus = (profile.education?.education || []).map(e =>
    `- ${e.degree?.label || ''} in ${e.field || ''} at ${e.institution || ''} (GPA: ${e.gpa || 'N/A'})`
  ).join('\n');

  const sk = profile.skills || {};
  const skillsText = sk.skillsList?.join(', ') || sk.skillsRaw || 'Not specified';

  const certs = (profile.certsProjects?.certifications || []).map(c =>
    `- ${c.name || ''} by ${c.issuer || ''}`
  ).join('\n');

  const projs = (profile.certsProjects?.projects || []).map(pr =>
    `- ${pr.name || ''}: ${pr.description || ''} (Tech: ${pr.techStack || ''})`
  ).join('\n');

  const prefs = profile.preferences || {};

  return `
=== USER PROFILE ===

PERSONAL INFO:
  Name: ${p.firstName || ''} ${p.lastName || ''}
  Email: ${p.email || 'N/A'}
  Phone: ${p.phone || 'N/A'}
  Location: ${[p.city, p.state, p.country].filter(Boolean).join(', ') || 'N/A'}
  LinkedIn: ${p.linkedin || 'N/A'}
  GitHub: ${p.github || 'N/A'}
  Work Authorization: ${p.workAuth?.label || 'N/A'}
  Summary: ${p.summary || 'N/A'}

WORK EXPERIENCE:
${workExps || '  None provided'}

EDUCATION:
${edus || '  None provided'}

SKILLS:
  ${skillsText}
  Total Experience: ${sk.yoe || 0} years ${sk.moe || 0} months

CERTIFICATIONS:
${certs || '  None provided'}

PROJECTS:
${projs || '  None provided'}

JOB PREFERENCES:
  Roles: ${(prefs.roles || []).join(', ') || 'N/A'}
  Salary: ${prefs.salary || 'N/A'}
  Work Type: ${prefs.workType?.label || 'N/A'}
  Relocation: ${p.willingToRelocate ? 'Yes' : 'No'}
  Notice Period: ${prefs.notice?.label || 'N/A'}
`.trim();
}

// ─── Safe OpenSearch get/set helpers ──────────────────────────────────────────
async function osGet(userId) {
  try {
    const result = await osClient.get({ index: PROFILE_INDEX, id: userId });
    return result.body._source;
  } catch {
    return null;
  }
}

async function osUpsert(userId, profile) {
  try {
    await osClient.index({
      index: PROFILE_INDEX,
      id: userId,
      body: profile,
      refresh: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function osDelete(userId) {
  try {
    await osClient.delete({ index: PROFILE_INDEX, id: userId, refresh: true });
    return true;
  } catch {
    return false;
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  let opensearchOk = false;
  let ollamaOk = false;
  try { await osClient.ping(); opensearchOk = true; } catch {}
  try {
    const r = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 2000 });
    ollamaOk = r.status === 200;
  } catch {}
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    services: { opensearch: opensearchOk, ollama: ollamaOk },
  });
});

// ─── Stats ────────────────────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const jobsRes = await osClient.search({
      index: JOBS_INDEX,
      body: {
        aggs: { by_status: { terms: { field: 'status' } } },
        size: 0,
      },
    });
    const buckets = jobsRes.body.aggregations?.by_status?.buckets || [];
    const submitted = buckets.find(b => b.key === 'submitted')?.doc_count || 0;
    const total = buckets.reduce((s, b) => s + b.doc_count, 0);

    // Compute profile completeness from any stored profile
    let profileComplete = 0;
    const userId = 'default_user';
    const profile = await osGet(userId) || global._profileStore[userId];
    if (profile) profileComplete = computeCompleteness(profile);

    res.json({ totalFilled: total, formsCompleted: submitted, hoursSaved: (submitted * 0.75).toFixed(1), profileComplete });
  } catch {
    const userId = 'default_user';
    const profile = global._profileStore[userId];
    res.json({
      totalFilled: 0,
      formsCompleted: 0,
      hoursSaved: 0,
      profileComplete: profile ? computeCompleteness(profile) : 0,
    });
  }
});

// ─── Profile CRUD ─────────────────────────────────────────────────────────────

// CREATE / UPSERT — POST /api/profile
app.post('/api/profile', async (req, res) => {
  const userId = req.body.userId || 'default_user';
  const profile = { ...req.body, userId, updatedAt: new Date().toISOString() };
  profile.fullText = buildFullText(profile);
  profile.completeness = computeCompleteness(profile);

  const saved = await osUpsert(userId, profile);
  global._profileStore[userId] = profile; // always keep in-memory mirror

  res.json({ success: true, userId, completeness: profile.completeness, opensearch: saved });
});

// READ — GET /api/profile/:userId  or  GET /api/profile  (defaults to default_user)
app.get('/api/profile/:userId?', async (req, res) => {
  const userId = req.params.userId || 'default_user';
  const profile = await osGet(userId) || global._profileStore[userId];
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(profile);
});

// UPDATE (partial patch) — PUT /api/profile/:userId
app.put('/api/profile/:userId', async (req, res) => {
  const userId = req.params.userId || 'default_user';

  // Fetch existing first
  let existing = await osGet(userId) || global._profileStore[userId] || {};
  const updated = { ...existing, ...req.body, userId, updatedAt: new Date().toISOString() };
  updated.fullText = buildFullText(updated);
  updated.completeness = computeCompleteness(updated);

  const saved = await osUpsert(userId, updated);
  global._profileStore[userId] = updated;

  res.json({ success: true, userId, completeness: updated.completeness, opensearch: saved });
});

// DELETE — DELETE /api/profile/:userId
app.delete('/api/profile/:userId', async (req, res) => {
  const userId = req.params.userId || 'default_user';
  const osDeleted = await osDelete(userId);
  delete global._profileStore[userId];
  res.json({ success: true, userId, opensearch: osDeleted });
});

// COMPLETENESS — GET /api/profile/:userId/completeness
app.get('/api/profile/:userId/completeness', async (req, res) => {
  const userId = req.params.userId || 'default_user';
  const profile = await osGet(userId) || global._profileStore[userId];
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const completeness = computeCompleteness(profile);
  res.json({ userId, completeness });
});

// ─── LLM Agent Endpoint ───────────────────────────────────────────────────────
// POST /api/agent/ask
// Body: { question: string, userId?: string }
// Returns: { answer: string, model: string, profileContext: boolean }

app.post('/api/agent/ask', async (req, res) => {
  const { question, userId = 'default_user' } = req.body;

  if (!question?.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }

  // 1. Fetch user profile from OpenSearch or cache
  const profile = await osGet(userId) || global._profileStore[userId];
  const profileContext = profile ? buildProfileContext(profile) : null;

  // 2. Build the system prompt
  const systemPrompt = profileContext
    ? `You are an intelligent AI assistant for a job application autofill tool.
You have been given the user's complete professional profile below.
Answer questions accurately and helpfully based ONLY on this profile data.
If the information is not in the profile, say so clearly.
Keep answers concise unless asked for detail.

${profileContext}`
    : `You are an AI assistant for a job application autofill tool.
The user has not yet set up their profile. Encourage them to complete their profile at the Profile Setup page.
You can still answer general questions about the application.`;

  // 3. Call Ollama (streaming or non-streaming)
  let answer;
  let modelUsed = OLLAMA_MODEL;
  let ollamaAvailable = true;

  try {
    const ollamaRes = await axios.post(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: question },
        ],
        stream: false,
        options: { temperature: 0.3, num_predict: 512 },
      },
      { timeout: 60000 }
    );
    answer = ollamaRes.data?.message?.content || ollamaRes.data?.response || 'No response from LLM.';
  } catch (err) {
    ollamaAvailable = false;
    // Graceful fallback — answer from profile data without LLM
    if (profileContext) {
      answer = `⚠️ The local LLM (Ollama) is not running. Here is a summary of what I know from your profile:\n\n${profileContext}\n\nTo enable AI-powered answers, please start Ollama: \`ollama serve\` and pull a model: \`ollama pull llama3.2\``;
    } else {
      answer = `⚠️ The local LLM (Ollama) is offline and no profile was found. Please:\n1. Set up your profile in the Profile Setup page.\n2. Start Ollama with \`ollama serve\`\n3. Pull a model: \`ollama pull llama3.2\``;
    }
    modelUsed = 'fallback';
  }

  res.json({
    answer,
    model: modelUsed,
    ollamaAvailable,
    hasProfile: !!profile,
    userId,
  });
});

// ─── AutoFill Sessions ────────────────────────────────────────────────────────
const sessions = new Map();

app.post('/api/autofill/start', async (req, res) => {
  const { url, platform, headless, jobContext } = req.body;
  const sessionId = uuidv4();

  sessions.set(sessionId, {
    sessionId, url, platform, headless, jobContext,
    status: 'running', progress: 0, logs: [],
    createdAt: new Date().toISOString(),
  });

  try {
    await osClient.index({
      index: JOBS_INDEX,
      id: sessionId,
      body: {
        sessionId, url, platform, status: 'running', progress: 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
    });
  } catch {}

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
    await osClient.update({
      index: JOBS_INDEX,
      id: req.params.sessionId,
      body: { doc: { status: 'submitted', progress: 100, updatedAt: new Date().toISOString() } },
    });
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
    const jobs = Array.from(sessions.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(jobs);
  }
});

// ─── Simulation stub ──────────────────────────────────────────────────────────
function simulateSession(sessionId) {
  const steps = [
    { pct: 10,  log: '🌐 Browser launched, navigating to URL…' },
    { pct: 20,  log: '🔍 Detecting form platform…' },
    { pct: 30,  log: '📋 Found 24 form fields. Fetching user profile from OpenSearch…' },
    { pct: 45,  log: '🧠 LLM generating answers for Personal Info section…' },
    { pct: 55,  log: '✍️  Filling: Name, Email, Phone, Location…' },
    { pct: 65,  log: '🧠 LLM generating answers for Work Experience section…' },
    { pct: 75,  log: '✍️  Filling: Job titles, company names, dates, descriptions…' },
    { pct: 85,  log: '🧠 LLM generating answers for Skills & Education…' },
    { pct: 95,  log: '✅ All fields filled. Pausing for your review…', pause: true },
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
  console.log(`🤖 Ollama: ${OLLAMA_BASE_URL} (model: ${OLLAMA_MODEL})`);
  await ensureIndexes();
});
