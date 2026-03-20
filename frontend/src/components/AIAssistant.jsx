import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Input from '@cloudscape-design/components/input';
import Button from '@cloudscape-design/components/button';
import Box from '@cloudscape-design/components/box';
import Spinner from '@cloudscape-design/components/spinner';
import Icon from '@cloudscape-design/components/icon';

const API = 'http://localhost:4000/api';

const SUGGESTED_QUESTIONS = [
  'What is my work experience?',
  'What skills do I have?',
  'What is my education?',
  'How complete is my profile?',
];

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`ai-bubble ${isUser ? 'ai-bubble--user' : 'ai-bubble--assistant'}`}>
      {msg.typing ? (
        <SpaceBetween direction="horizontal" size="xs">
          <Spinner size="normal" />
          <Box color="inherit" variant="small">AI is thinking...</Box>
        </SpaceBetween>
      ) : (
        <div>{msg.content}</div>
      )}
    </div>
  );
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 0,
      role: 'assistant',
      content: "👋 Hi! I'm your AI Assistant. Ask me anything about your profile!",
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current.focus(), 150);
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      setMessages(prev => prev.map(m => m.id === thinkingMsg.id ? { ...m, content: data.answer, typing: false } : m));
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === thinkingMsg.id ? { ...m, content: '❌ Error connecting to server.', typing: false } : m));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="ai-fab" onClick={() => setOpen(!open)}>
        <Icon name={open ? "close" : "search"} variant="inverted" />
      </button>

      {open && (
        <div className="ai-panel">
          <Container
            header={
              <Header
                variant="h3"
                actions={<Button variant="icon" iconName="close" onClick={() => setOpen(false)} />}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>AI Assistant</span>
                  <StatusIndicator type={hasProfile === true ? 'success' : hasProfile === false ? 'warning' : 'loading'}>
                    {hasProfile === true ? 'Profile Loaded' : hasProfile === false ? 'Empty Profile' : 'Checking…'}
                  </StatusIndicator>
                </div>
              </Header>
            }
            disableContentPaddings
          >
            <div className="ai-messages-scroll">
              <SpaceBetween size="m">
                {messages.map(msg => <ChatMessage key={msg.id} msg={msg} />)}
                <div ref={messagesEndRef} />
              </SpaceBetween>
            </div>

            <div className="ai-footer">
              <SpaceBetween size="m">
                {messages.length <= 2 && (
                  <div className="ai-suggestions">
                    {SUGGESTED_QUESTIONS.map((q, i) => (
                      <button key={i} className="skill-chip" style={{ height: '24px', fontSize: '11px' }} onClick={() => sendMessage(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={({ detail }) => setInput(detail.value)}
                      onKeyDown={e => e.detail.key === 'Enter' && sendMessage()}
                      placeholder="Ask me anything..."
                      disabled={loading}
                    />
                  </div>
                  <Button variant="primary" iconName="send" onClick={() => sendMessage()} disabled={loading || !input.trim()} />
                </div>
              </SpaceBetween>
            </div>
          </Container>
        </div>
      )}
    </>
  );
}
