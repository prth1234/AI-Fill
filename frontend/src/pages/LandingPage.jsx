import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LightPillar from '../components/LightPillar';
import { STANDARD_FIELDS, TEMPLATES } from '../fieldSchema';
import './LandingPage.css';

function UseCaseModal({ onClose }) {
  const navigate = useNavigate();
  const [template, setTemplate] = useState(() => localStorage.getItem('autofill_selected_template') || 'general');
  const [activeFields, setActiveFields] = useState(() => {
    const saved = localStorage.getItem('autofill_active_fields');
    return saved ? JSON.parse(saved) : TEMPLATES.general.fields;
  });
  const [customKeys, setCustomKeys] = useState(() => {
    const saved = localStorage.getItem('autofill_custom_keys');
    return saved ? JSON.parse(saved) : [];
  });
  const [newCustom, setNewCustom] = useState('');

  useEffect(() => {
    localStorage.setItem('autofill_selected_template', template);
  }, [template]);

  useEffect(() => {
    localStorage.setItem('autofill_active_fields', JSON.stringify(activeFields));
  }, [activeFields]);

  useEffect(() => {
    localStorage.setItem('autofill_custom_keys', JSON.stringify(customKeys));
  }, [customKeys]);

  // Update active fields when template changes
  const handleTemplateChange = (e) => {
    const t = e.target.value;
    setTemplate(t);
    if (TEMPLATES[t]) {
      setActiveFields(TEMPLATES[t].fields);
    }
  };

  const toggleField = (id) => {
    setActiveFields(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const handleAddAll = () => setActiveFields(STANDARD_FIELDS.map(f => f.id));
  const handleRemoveAll = () => setActiveFields([]);

  const handleAddCustom = (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      if (newCustom.trim() && !customKeys.includes(newCustom.trim())) {
        setCustomKeys(prev => [...prev, newCustom.trim()]);
        setNewCustom('');
      }
    }
  };
  const removeCustom = (key) => setCustomKeys(prev => prev.filter(k => k !== key));

  const handleStart = () => {
    localStorage.setItem('autofill_active_fields', JSON.stringify(activeFields));
    localStorage.setItem('autofill_custom_keys', JSON.stringify(customKeys));
    navigate('/profile');
  };

  return (
    <div className="landing-modal-backdrop" onClick={onClose}>
      <div className="landing-modal" onClick={e => e.stopPropagation()}>
        <div className="landing-modal-header">
          <span className="landing-modal-label">What are you automating?</span>
          <button className="landing-modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p className="landing-modal-subtitle">
          Start with a template, and customize the fields you want the AI to learn.
        </p>

        <div className="landing-modal-section">
          <label className="landing-modal-field-label">Select Profile Template</label>
          <select value={template} onChange={handleTemplateChange} className="landing-modal-select">
            {Object.values(TEMPLATES).map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="landing-modal-section">
          <div className="landing-modal-split">
            <label className="landing-modal-field-label">Included Form Fields ({activeFields.length})</label>
            <div className="landing-modal-actions-sm">
              <button type="button" onClick={handleAddAll}>Add All</button>
              <button type="button" onClick={handleRemoveAll}>Remove All</button>
            </div>
          </div>
          
          <div className="landing-modal-chips">
            {STANDARD_FIELDS.map(f => {
              const isActive = activeFields.includes(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => toggleField(f.id)}
                  className={`landing-chip ${isActive ? 'active' : ''}`}
                >
                  {f.label} {isActive ? '×' : '+'}
                </button>
              );
            })}
          </div>
        </div>

        <div className="landing-modal-section border-top">
          <label className="landing-modal-field-label">Add Custom Keys (Optional)</label>
          <p className="landing-modal-hint">Specify any extra context keys you want to include (e.g. System Prompt, Tone)</p>
          <div className="landing-modal-input-row">
            <input 
              value={newCustom} 
              onChange={e => setNewCustom(e.target.value)} 
              onKeyDown={handleAddCustom}
              placeholder="e.g. Tone of voice" 
              className="landing-modal-input" 
            />
            <button className="landing-modal-btn-add" onClick={handleAddCustom}>Add</button>
          </div>
          {customKeys.length > 0 && (
            <div className="landing-modal-chips" style={{ marginTop: '12px' }}>
              {customKeys.map(k => (
                <button key={k} onClick={() => removeCustom(k)} className="landing-chip custom">
                  {k} ×
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="landing-modal-footer">
          <button className="landing-btn-primary full-width" onClick={handleStart}>
            Continue setup ({activeFields.length + customKeys.length} fields)
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="landing-root">
      {/* Full-screen WebGL background */}
      <div className="landing-pillar-bg">
        <LightPillar
          topColor="#5227FF"
          bottomColor="#FF9FFC"
          intensity={1}
          rotationSpeed={0.25}
          glowAmount={0.002}
          pillarWidth={3}
          pillarHeight={0.4}
          noiseIntensity={0.4}
          pillarRotation={15}
          interactive={false}
          mixBlendMode="screen"
          quality="high"
        />
      </div>

      <div className="landing-overlay" />

      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">AutoFill</div>
        <div className="landing-nav-links">
          <a href="https://github.com" target="_blank" rel="noreferrer" className="landing-nav-link">
            GitHub
          </a>
          <button className="landing-nav-cta" onClick={() => setShowModal(true)}>
            Get started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main className="landing-hero">
        <div className="landing-badge">Automated • Intelligent • Universal</div>

        <h1 className="landing-headline">
          Fill once.<br />
          <span className="landing-headline-accent">Apply everywhere.</span>
        </h1>

        <p className="landing-subtext">
          AutoFill securely stores your profile and uses advanced AI to handle every application field — from the first text box to the final submit button. Perfect for Software Engineers, Data Engineers, and ambitious professionals.
        </p>

        <div className="landing-actions">
          <button className="landing-btn-primary" onClick={() => setShowModal(true)}>
            Get started
          </button>
          <a className="landing-btn-ghost" href="#how-it-works">
            How it works
          </a>
        </div>
      </main>

      {/* Stats bar */}
      <footer className="landing-stats">
        {[
          ['Workday', 'Supported'],
          ['Greenhouse', 'Supported'],
          ['Lever', 'Supported'],
          ['Custom Profiles', 'Any Role'],
          ['Playwright', 'Automation'],
        ].map(([name, label]) => (
          <div key={name} className="landing-stat">
            <span className="landing-stat-name">{name}</span>
            <span className="landing-stat-label">{label}</span>
          </div>
        ))}
      </footer>

      {showModal && <UseCaseModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
