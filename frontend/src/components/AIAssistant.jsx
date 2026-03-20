import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Input from '@cloudscape-design/components/input';
import Button from '@cloudscape-design/components/button';
import Box from '@cloudscape-design/components/box';
import Spinner from '@cloudscape-design/components/spinner';
import ReactMarkdown from 'react-markdown';
import { 
  TbCircleArrowUpFilled, 
  TbCopy, 
  TbCheck, 
  TbRefresh, 
  TbThumbUp, 
  TbThumbDown, 
  TbThumbUpFilled, 
  TbThumbDownFilled 
} from "react-icons/tb";

const API = 'http://localhost:4000/api';

const SUGGESTED_QUESTIONS = [
  'What is my work experience?',
  'What skills do I have?',
  'What is my educational background?',
  'What are my job preferences?',
  'How complete is my profile?',
];

function ChatMessage({ msg, onRetry }) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box margin={{ bottom: 'm' }}>
      <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: '8px', alignItems: 'flex-start' }}>
        <div style={{
          maxWidth: '85%',
          minWidth: !isUser && !msg.typing ? '240px' : 'auto',
          padding: '12px 16px',
          borderRadius: '16px',
          borderTopLeftRadius: isUser ? '16px' : '4px',
          borderTopRightRadius: isUser ? '4px' : '16px',
          background: 'transparent',
          border: isUser ? '1px solid rgba(168, 85, 247, 0.8)' : '1px solid #777777',
          color: 'var(--color-text-body-default)'
        }}>
          {msg.typing ? (
            <SpaceBetween direction="horizontal" size="xs">
              <Spinner />
              <Box variant="small" color="inherit">Analyzing...</Box>
            </SpaceBetween>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '14px' }}>
              {isUser ? (
                msg.content
              ) : (
                <>
                  <div className="markdown-content">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  
                  {/* Action Bar */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    alignItems: 'center', 
                    marginTop: '12px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--color-border-container-divider)'
                  }}>
                    <button onClick={handleCopy} title="Copy" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: copied ? '#22c55e' : 'var(--color-text-body-secondary)', transition: 'color 0.2s', display: 'flex' }}>
                       {copied ? <TbCheck size={16} /> : <TbCopy size={16} />}
                    </button>
                    {onRetry && (
                      <button onClick={onRetry} title="Retry" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-text-body-secondary)', transition: 'color 0.2s', display: 'flex' }}>
                         <TbRefresh size={16} />
                      </button>
                    )}
                    <div style={{ flex: 1 }} />
                    <button onClick={() => setFeedback(feedback === 'up' ? null : 'up')} title="Helpful" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: feedback === 'up' ? '#a855f7' : 'var(--color-text-body-secondary)', transition: 'color 0.2s', display: 'flex' }}>
                       {feedback === 'up' ? <TbThumbUpFilled size={16} /> : <TbThumbUp size={16} />}
                    </button>
                    <button onClick={() => setFeedback(feedback === 'down' ? null : 'down')} title="Not helpful" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: feedback === 'down' ? '#ef4444' : 'var(--color-text-body-secondary)', transition: 'color 0.2s', display: 'flex' }}>
                       {feedback === 'down' ? <TbThumbDownFilled size={16} /> : <TbThumbDown size={16} />}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Box>
  );
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      id: 0,
      role: 'assistant',
      content: "Welcome. I am the Genie Assistant. I can answer questions about your professional profile — work history, skills, education, and preferences.",
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (hasProfile === null) {
      axios.get(`${API}/profile/default_user`)
        .then(r => setHasProfile(!r.data.error))
        .catch(() => setHasProfile(false));
    }
  }, [hasProfile]);

  const sendMessage = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');

    const userMsg = { id: Date.now(), role: 'user', content: q };
    const thinkingMsg = { id: Date.now() + 1, role: 'assistant', content: '', typing: true };

    setMessages(prev => [...prev, userMsg, thinkingMsg]);
    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/agent/ask`, { question: q, userId: 'default_user' });
      setHasProfile(data.hasProfile);
      setMessages(prev => prev.map(m =>
        m.id === thinkingMsg.id
          ? { ...m, content: data.answer, typing: false }
          : m
      ));
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === thinkingMsg.id
          ? { ...m, content: 'Error: Could not reach the backend.', typing: false }
          : m
      ));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 120px)',
      background: 'var(--color-background-layout-panel-content)'
    }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '16px 20px', borderBottom: '1px solid var(--color-border-container-divider)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Genie Assistant</h2>
          <span style={{ fontSize: '12px', color: 'var(--color-text-body-secondary)' }}>Query and interact with your profile context.</span>
        </div>
      </div>

      {/* Messages Area - Native independent scroll */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', paddingBottom: '32px' }}>
        <SpaceBetween size="m">
          {messages.map((msg, idx) => (
            <ChatMessage 
              key={msg.id} 
              msg={msg} 
              onRetry={(msg.role === 'assistant' && !msg.typing && idx > 0 && messages[idx-1].role === 'user') ? () => sendMessage(messages[idx-1].content) : null}
            />
          ))}
          <div ref={messagesEndRef} />
        </SpaceBetween>
        
        {messages.length === 1 && (
          <div style={{ marginTop: '24px' }}>
            <Box variant="h4" color="text-body-secondary" margin={{ bottom: 's' }}>Suggested Actions</Box>
            <SpaceBetween size="xs" direction="horizontal" className="flex-wrap">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <Button key={i} variant="normal" onClick={() => sendMessage(q)}>
                  {q}
                </Button>
              ))}
            </SpaceBetween>
          </div>
        )}
      </div>

      {/* Fixed Bottom Input Footer */}
      <div style={{ flexShrink: 0, padding: '16px 20px', borderTop: '1px solid var(--color-border-container-divider)', boxShadow: '0 -4px 12px rgba(0,0,0,0.05)' }}>
        <SpaceBetween size="xs">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <Input
                value={input}
                onChange={({ detail }) => setInput(detail.value)}
                onKeyDown={(e) => {
                  if (e.detail.key === 'Enter') {
                    sendMessage();
                  }
                }}
                placeholder="Ask a question..."
                disabled={loading}
                autoFocus
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: (loading || !input.trim()) ? 'not-allowed' : 'pointer',
                opacity: (loading || !input.trim()) ? 0.3 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                outline: 'none',
                transition: 'opacity 0.2s ease'
              }}
            >
              <TbCircleArrowUpFilled size={32} color="var(--color-background-button-primary-default)" />
            </button>
          </div>
          <Box variant="small" color="text-body-secondary" textAlign="center">
            Always review AI-generated answers
          </Box>
        </SpaceBetween>
      </div>

      <style>{`
        .markdown-content p { margin-bottom: 0.5rem; line-height: 1.5; }
        .markdown-content p:last-child { margin-bottom: 0; }
        .markdown-content ul { padding-left: 20px; margin-top: 0.25rem; margin-bottom: 0.5rem; }
        .markdown-content li { margin-bottom: 0.25rem; list-style-type: disc; }
        .markdown-content strong { font-weight: 700; color: inherit; }
        .flex-wrap { flex-wrap: wrap; }
      `}</style>
    </div>
  );
}
