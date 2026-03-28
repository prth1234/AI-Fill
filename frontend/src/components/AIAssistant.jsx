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
  TbThumbDownFilled,
  TbPlus,
  TbTrash,
  TbMaximize,
  TbMinimize
} from "react-icons/tb";
import { FaStopCircle } from "react-icons/fa";
import { MdHistory, MdArrowBack } from "react-icons/md";
import GradientText from './GradientText';
import ShinyText from './ShinyText';





const API = 'http://localhost:4000/api';

const SUGGESTED_QUESTIONS = [
  'What is my work experience?',
  'What skills do I have?',
  'What is my educational background?',
  'What are my job preferences?',
  'How complete is my profile?',
];

function CustomCodeBlock({ language, value }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="custom-code-block" style={{ margin: '8px 0', border: '1px solid var(--color-border-container-divider, rgba(128,128,128,0.2))', borderRadius: '8px', overflow: 'hidden', background: 'rgba(128,128,128,0.05)', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'rgba(128,128,128,0.1)', borderBottom: '1px solid var(--color-border-container-divider, rgba(128,128,128,0.2))', fontSize: '12px', color: 'var(--color-text-body-secondary)', fontFamily: 'inherit' }}>
        <span style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '11px', letterSpacing: '0.05em' }}>{language || 'text'}</span>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: copied ? '#22c55e' : 'inherit', padding: 0 }}>
            {copied ? <TbCheck size={14} /> : <TbCopy size={14} />} {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
            {expanded ? <TbMinimize size={14} /> : <TbMaximize size={14} />} {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      {/* Content */}
      <div style={{ maxHeight: expanded ? 'none' : '300px', overflowY: 'auto' }}>
        <pre style={{ margin: 0, padding: '12px', background: 'transparent', border: 'none', borderRadius: 0, overflowX: 'auto', maxWidth: '100%', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: '13px' }}>
          <code style={{ background: 'transparent', padding: 0, color: 'inherit', fontSize: 'inherit' }}>
            {value}
          </code>
        </pre>
      </div>
    </div>
  );
}

const markdownComponents = {
  pre({ children }) {
    return <div className="markdown-pre-wrapper">{children}</div>;
  },
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    if (!inline && match) {
      return <CustomCodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} />;
    } else if (!inline) {
      const stringVal = String(children);
      if (stringVal.includes('\n')) {
        return <CustomCodeBlock language="text" value={stringVal.replace(/\n$/, '')} />;
      }
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }
};

function ChatMessage({ msg, onRetry, dots }) {

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '85%', minWidth: 0 }}>
          <div className={isUser ? 'user-message-bubble' : (msg.typing ? '' : 'assistant-message-bubble')} style={{
            minWidth: !isUser && !msg.typing ? '240px' : 'auto',
            padding: msg.typing ? '4px 0' : undefined,
            overflowX: 'auto'
          }}>
            {msg.typing ? (
              <Box variant="small" color="inherit">
                <ShinyText 
                  text={`Thinking${dots || '...'}`} 
                  speed={2} 
                  color="#b5b5b5" 
                  shineColor="#ffffff" 
                  spread={120}
                />
              </Box>
            ) : (




              <div style={{ lineHeight: 1.4, fontSize: '14px' }}>
                {isUser ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                ) : (
                  <div className="markdown-content">
                    <ReactMarkdown
                      components={markdownComponents}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Action Bar (Outside the bubble, left-aligned) */}
          {!isUser && !msg.typing && (
            <div style={{ 
              display: 'flex', 
              gap: '14px', 
              alignItems: 'center', 
              marginLeft: '8px',
              marginTop: '4px'
            }}>
              <button onClick={handleCopy} title="Copy" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: copied ? '#22c55e' : 'var(--color-text-body-secondary)', transition: 'color 0.2s', display: 'flex' }}>
                 {copied ? <TbCheck size={16} /> : <TbCopy size={16} />}
              </button>
              {onRetry && (
                <button onClick={onRetry} title="Retry" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-text-body-secondary)', transition: 'color 0.2s', display: 'flex' }}>
                   <TbRefresh size={16} />
                </button>
              )}
              <button onClick={() => setFeedback(feedback === 'up' ? null : 'up')} title="Helpful" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: feedback === 'up' ? '#a855f7' : 'var(--color-text-body-secondary)', transition: 'color 0.2s', display: 'flex' }}>
                 {feedback === 'up' ? <TbThumbUpFilled size={16} /> : <TbThumbUp size={16} />}
              </button>
              <button onClick={() => setFeedback(feedback === 'down' ? null : 'down')} title="Not helpful" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: feedback === 'down' ? '#ef4444' : 'var(--color-text-body-secondary)', transition: 'color 0.2s', display: 'flex' }}>
                 {feedback === 'down' ? <TbThumbDownFilled size={16} /> : <TbThumbDown size={16} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </Box>
  );
}

function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return defaultValue;
      const parsed = JSON.parse(saved);
      return parsed !== null ? parsed : defaultValue;
    } catch { return defaultValue; }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
}

export default function AIAssistant({ onClose }) {
  const [sessions, setSessions] = usePersistedState('genie_ai_sessions', [
    { id: Date.now(), title: 'New Chat', messages: [], timestamp: Date.now() }
  ]);
  const [currentSessionId, setCurrentSessionId] = usePersistedState('genie_current_session_id', sessions[0].id);
  const [showHistory, setShowHistory] = useState(false);
  const [dots, setDots] = useState('');
  
  // Get current session
  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  const messages = currentSession.messages;

  // Helper to update current session messages
  const setMessages = (setter) => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        const newMsgs = typeof setter === 'function' ? setter(s.messages) : setter;
        // Update title if first user message is added
        let newTitle = s.title;
        if (s.title === 'New Chat' && newMsgs.length > 0) {
          const firstUserMsg = newMsgs.find(m => m.role === 'user');
          if (firstUserMsg) newTitle = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
        }
        return { ...s, messages: newMsgs, title: newTitle, timestamp: Date.now() };
      }
      return s;
    }));
  };

  const createNewChat = () => {
    const newId = Date.now();
    const newSession = { id: newId, title: 'New Chat', messages: [], timestamp: newId };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setShowHistory(false);
  };

  const deleteSession = (e, id) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    if (newSessions.length === 0) {
      const newId = Date.now();
      setSessions([{ id: newId, title: 'New Chat', messages: [], timestamp: newId }]);
      setCurrentSessionId(newId);
    } else {
      setSessions(newSessions);
      if (currentSessionId === id) setCurrentSessionId(newSessions[0].id);
    }
  };

  
  // Animation loop for dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const [input, setInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(null);
  const scrollContainerRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      // Cleanup: Abort any pending request if component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      // Remove the latest thinking message
      setMessages(prev => prev.filter(m => !m.typing));
      setLoading(false);
    }
  };

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
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

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { data } = await axios.post(`${API}/agent/ask`, 
        { question: q, userId: 'default_user' },
        { signal: controller.signal }
      );

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
      position: 'sticky',
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 60px)', /* Rigid dimensional bound to force internal flex-overflow to trigger safely */
      background: 'var(--color-background-layout-panel-content)'
    }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '16px 50px 16px 20px', borderBottom: '1px solid var(--color-border-container-divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

          {showHistory && (
             <button onClick={() => setShowHistory(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--color-text-body-secondary)' }}>
                <MdArrowBack size={20} />
             </button>
          )}
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
            <GradientText
              colors={["#5227FF", "#FF9FFC", "#B19EEF"]}
              animationSpeed={8}
              showBorder={false}
            >
              {showHistory ? 'History' : 'Genie AI'}
            </GradientText>
          </h1>
        </div>
        
        {!showHistory && (
          <div style={{ display: 'flex', gap: '2px' }}>
            <button onClick={createNewChat} title="New Chat" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--color-text-body-secondary)', transition: 'color 0.2s' }}>
              <TbPlus size={22} />
            </button>
            <button onClick={() => setShowHistory(true)} title="Chat History" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--color-text-body-secondary)', transition: 'color 0.2s' }}>
              <MdHistory size={22} />
            </button>
          </div>
        )}

      </div>

      {showHistory ? (
        /* History View */
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
             {sessions.map(session => (
               <div 
                 key={session.id} 
                 onClick={() => { setCurrentSessionId(session.id); setShowHistory(false); }}
                 style={{ 
                   padding: '12px 16px', 
                   borderRadius: '12px', 
                   background: session.id === currentSessionId ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                   border: session.id === currentSessionId ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid transparent',
                   cursor: 'pointer',
                   display: 'flex',
                   justifyContent: 'space-between',
                   alignItems: 'center',
                   transition: 'all 0.2s ease',
                   ':hover': { background: 'rgba(255, 255, 255, 0.05)' }
                 }}
                 className="history-item"
               >
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--color-text-body-default)' }}>
                      {session.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-body-secondary)' }}>
                       {new Date(session.id).toLocaleDateString()}
                    </div>
                 </div>
                 <button onClick={(e) => deleteSession(e, session.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-text-body-secondary)', opacity: 0.6 }}>
                    <TbTrash size={16} />
                 </button>
               </div>
             ))}
          </div>
        </div>
      ) : (
        /* Chat View */
        <>
        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', paddingBottom: '32px' }}>
          <SpaceBetween size="m">
            {messages.map((msg, idx) => (
              <ChatMessage 
                key={msg.id} 
                msg={msg} 
                dots={dots}
                onRetry={(msg.role === 'assistant' && !msg.typing && idx > 0 && messages[idx-1].role === 'user') ? () => sendMessage(messages[idx-1].content) : null}
              />
            ))}
          </SpaceBetween>
          
          {messages.length === 0 && (
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
                onClick={loading ? cancelRequest : () => sendMessage()}
                disabled={!loading && !input.trim()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: (!loading && !input.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (!loading && !input.trim()) ? 0.3 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  outline: 'none',
                  transition: 'opacity 0.2s ease'
                }}
              >
                {loading ? (
                  <FaStopCircle size={32} color="#ef4444" title="Stop AI" />
                ) : (
                  <TbCircleArrowUpFilled size={32} color="var(--color-background-button-primary-default)" title="Send Message" />
                )}
              </button>
            </div>
            <Box variant="small" color="text-body-secondary" textAlign="center">
              Genie AI can make mistakes
            </Box>
          </SpaceBetween>
        </div>
        </>
      )}


      <style>{`
        .markdown-content p { margin-bottom: 0.5rem; line-height: 1.5; }
        .markdown-content p:last-child { margin-bottom: 0; }
        .markdown-content ul { padding-left: 20px; margin-top: 0.25rem; margin-bottom: 0.5rem; }
        .markdown-content li { margin-bottom: 0.25rem; list-style-type: disc; }
        .markdown-content li > p { margin: 0; display: inline; }
        .markdown-content strong { font-weight: 700; color: inherit; }
        
        .markdown-content pre {
          background: rgba(128, 128, 128, 0.1);
          padding: 12px;
          border-radius: 8px;
          overflow-x: auto;
          max-width: 100%;
          border: 1px solid rgba(128, 128, 128, 0.2);
          margin: 8px 0;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 13px;
        }
        
        .markdown-content code {
          background: rgba(128, 128, 128, 0.1);
          padding: 2px 4px;
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 13px;
        }
        
        .markdown-content pre code {
          background: transparent;
          padding: 0;
          border-radius: 0;
          font-size: inherit;
        }

        .flex-wrap { flex-wrap: wrap; }
        
        .history-item:hover {
          background: rgba(168, 85, 247, 0.05) !important;
        }

        .user-message-bubble {

          padding: 8px 16px;
          border-radius: 18px; /* Smoother base radius */
          border-top-right-radius: 4px; /* The "edge" that makes it a bubble */
          background: transparent;
          border: 1.5px solid #0073bb;
          color: #0073bb;
          font-weight: 500;
          font-size: 13px;
          line-height: 1.2;
          position: relative;
        }

        [data-awsui-color-mode="dark"] .user-message-bubble,
        .awsui-dark-mode .user-message-bubble {
          background: transparent !important;
          border: 1.5px solid #38bdf8 !important;
          color: #38bdf8 !important;
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.15);
        }






        .assistant-message-bubble {
          padding: 12px 16px;
          border-radius: 16px;
          border-top-left-radius: 4px;
          border-top-right-radius: 16px;
          background: transparent;
          border: 1px solid #777777;
          color: var(--color-text-body-default);
        }
      `}</style>
    </div>
  );
}

