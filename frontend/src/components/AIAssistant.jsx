import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Input from '@cloudscape-design/components/input';
import Button from '@cloudscape-design/components/button';
import Box from '@cloudscape-design/components/box';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Spinner from '@cloudscape-design/components/spinner';
import Icon from '@cloudscape-design/components/icon';

const API = 'http://localhost:4000/api';

const SUGGESTED_QUESTIONS = [
  'What is my work experience?',
  'What skills do I have?',
  'What is my educational background?',
  'What are my job preferences?',
  'How complete is my profile?',
];

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  // Use Cloudscape Box for messages for that "native" look
  return (
    <Box margin={{ bottom: 'm' }}>
      <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: '8px', alignItems: 'flex-end' }}>
        {!isUser && (
          <div style={{ padding: '4px', background: '#7c3aed', borderRadius: '50%', color: 'white' }}>
            <Icon name="status-info" variant="inverted" size="normal" />
          </div>
        )}
        <div style={{ 
          maxWidth: '85%', 
          padding: '12px 16px', 
          borderRadius: '16px', 
          background: isUser ? '#7c3aed' : 'var(--color-background-container-content)',
          border: isUser ? 'none' : '1px solid var(--border)',
          color: isUser ? '#ffffff' : 'inherit'
        }}>
          {msg.typing ? (
            <SpaceBetween direction="horizontal" size="xs">
              <Spinner />
              <Box color="text-status-info" variant="small">AI is thinking...</Box>
            </SpaceBetween>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{msg.content}</div>
          )}
        </div>
      </div>
    </Box>
  );
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 0,
      role: 'assistant',
      content: "👋 Hi! I'm Genie. I can answer questions about your professional profile — work history, skills, education, and preferences.",
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if backend has a profile on open
  useEffect(() => {
    if (open && hasProfile === null) {
      axios.get(`${API}/profile/default_user`)
        .then(r => setHasProfile(!r.data.error))
        .catch(() => setHasProfile(false));
    }
  }, [open, hasProfile]);

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
          ? { ...m, content: '❌ Could not reach the backend.', typing: false }
          : m
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.detail.key === 'Enter' && !e.detail.shiftKey) {
      sendMessage();
    }
  };

  return (
    <>
      <button
        id="ai-assistant-btn"
        className={`ai-fab ${open ? 'ai-fab--open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <Icon name={open ? "close" : "search"} size="medium" variant="inverted" />
      </button>

      {open && (
        <div id="ai-assistant-panel" className="ai-panel">
          <Container
            header={
              <Header
                variant="h3"
                actions={
                  <Button
                    variant="icon"
                    iconName="close"
                    onClick={() => setOpen(false)}
                    ariaLabel="Close Assistant"
                  />
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span>Genie</span>
                </div>
              </Header>
            }
            footer={
              <div style={{ padding: '8px' }}>
                <SpaceBetween size="xs">
                  {messages.length === 1 && (
                    <div className="ai-suggestions" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {SUGGESTED_QUESTIONS.map((q, i) => (
                        <button key={i} className="skill-chip" style={{ height: '24px', fontSize: '11px' }} onClick={() => sendMessage(q)}>
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <Input
                        ref={inputRef}
                        value={input}
                        onChange={({ detail }) => setInput(detail.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask me..."
                        disabled={loading}
                      />
                    </div>
                    <Button
                      variant="primary"
                      iconName="send"
                      onClick={() => sendMessage()}
                      disabled={loading || !input.trim()}
                    />
                  </div>
                </SpaceBetween>
              </div>
            }
            disableContentPaddings
          >
            <div className="ai-messages" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                <SpaceBetween size="m">
                  {messages.map(msg => (
                    <ChatMessage key={msg.id} msg={msg} />
                  ))}
                  <div ref={messagesEndRef} />
                </SpaceBetween>
              </div>
            </div>
          </Container>
        </div>
      )}
    </>
  );
}
