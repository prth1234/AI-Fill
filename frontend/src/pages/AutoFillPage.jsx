import React, { useState } from 'react';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Container from '@cloudscape-design/components/container';
import SpaceBetween from '@cloudscape-design/components/space-between';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Button from '@cloudscape-design/components/button';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import Toggle from '@cloudscape-design/components/toggle';
import Textarea from '@cloudscape-design/components/textarea';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Tabs from '@cloudscape-design/components/tabs';
import LineChart from '@cloudscape-design/components/line-chart';
import PieChart from '@cloudscape-design/components/pie-chart';
import axios from 'axios';


const API = 'http://localhost:4000/api';

const PLATFORM_OPTIONS = [
  { label: 'Workday', value: 'workday' },
  { label: 'Greenhouse', value: 'greenhouse' },
  { label: 'Lever', value: 'lever' },
  { label: 'iCIMS', value: 'icims' },
  { label: 'Taleo', value: 'taleo' },
  { label: 'SmartRecruiters', value: 'smartrecruiters' },
  { label: 'BambooHR', value: 'bamboohr' },
  { label: 'Custom / Other', value: 'other' },
];

const LOG_LEVELS = { info: 'info', warn: 'warning', error: 'error', success: 'success' };

export default function AutoFillPage() {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState(null);
  const [headless, setHeadless] = useState(false);
  const [jobContext, setJobContext] = useState('');
  const [status, setStatus] = useState('idle'); // idle | running | paused | done | error
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [draftAnswers, setDraftAnswers] = useState([]);
  const [review, setReview] = useState(null);

  const addLog = (msg, level = 'info') =>
    setLogs(prev => [...prev, { id: Date.now(), msg, level, time: new Date().toLocaleTimeString() }]);

  const handleLaunch = async () => {
    if (!url) return;
    setStatus('running');
    setProgress(0);
    setLogs([]);
    addLog(`Starting AutoFill session for: ${url}`, 'info');
    addLog(`Platform: ${platform?.label || 'auto-detect'}`, 'info');
    try {
      const res = await axios.post(`${API}/autofill/interactive/start`, { 
        url, 
        platform: platform?.value, 
        headless, 
        jobContext,
        userId: 'default_user',
        reviewBeforeSubmit: true,
        fields: [] // Backend will detect fields or we can pass some if we had them
      });
      
      setSessionId(res.data.sessionId);
      setPendingQuestions(res.data.pendingQuestions || []);
      setDraftAnswers(res.data.draftAnswers || []);
      setReview(res.data.review);
      
      addLog(`Session ID: ${res.data.sessionId}`, 'success');
      addLog('Playwright browser launching…', 'info');
      
      // Poll for progress and state updates
      const poll = setInterval(async () => {
        try {
          const p = await axios.get(`${API}/autofill/status/${res.data.sessionId}`);
          const data = p.data;
          
          setProgress(data.progress || 0);
          setPendingQuestions(data.pendingQuestions || []);
          setDraftAnswers(data.draftAnswers || []);
          setReview(data.review);
          
          if (data.log) addLog(data.log, data.level || 'info');
          
          if (data.status === 'awaiting_user_input') {
            setStatus('paused');
            // We don't necessarily clear interval here if we want to see logs, 
            // but for interactive it might be better to wait for response
          }
          
          if (data.status === 'review') {
            setStatus('paused');
            addLog('Ready for final review.', 'success');
          }

          if (data.status === 'done' || data.status === 'submitted') {
            setStatus('done');
            setProgress(100);
            clearInterval(poll);
            addLog('AutoFill complete!', 'success');
          }
          
          if (data.status === 'error') {
            setStatus('error');
            clearInterval(poll);
            addLog(`Error: ${data.error}`, 'error');
          }
        } catch { 
          clearInterval(poll); 
        }
      }, 2000);
    } catch (err) {
      setStatus('error');
      addLog(`Failed to start: ${err.message}`, 'error');
    }
  };

  const handleApprove = async () => {
    if (!sessionId) return;
    addLog('Submitting final application draft…', 'info');
    setStatus('running');
    try {
      const res = await axios.post(`${API}/autofill/review/${sessionId}/submit`);
      if (res.data.success) {
        setStatus('done');
        setProgress(100);
        addLog('Application successfully submitted!', 'success');
      }
    } catch (err) {
      addLog(`Submission failed: ${err.response?.data?.detail || err.message}`, 'error');
      setStatus('paused');
    }
  };

  const handleRespondent = async (fieldId, answer, questionText) => {
    if (!sessionId) return;
    try {
      addLog(`Answering: ${questionText}...`, 'info');
      const res = await axios.post(`${API}/autofill/interactive/respond/${sessionId}`, {
        userId: 'default_user',
        answers: [{
          fieldId,
          answer,
          saveForFuture: true,
          questionText
        }]
      });
      
      setPendingQuestions(res.data.pendingQuestions || []);
      setDraftAnswers(res.data.draftAnswers || []);
      setReview(res.data.review);
      
      if (res.data.status !== 'awaiting_user_input') {
        setStatus('running'); // Resume simulation/polling logic handled by interval usually
      }
    } catch (err) {
      addLog(`Failed to send answer: ${err.message}`, 'error');
    }
  };

  const handleStop = async () => {
    if (sessionId) await axios.post(`${API}/autofill/stop/${sessionId}`).catch(() => {});
    setStatus('idle');
    addLog('Session stopped.', 'warn');
  };

  return (
    <ContentLayout header={<Header variant="h1" description="Enter a job application URL and let AI + Playwright do the work">Launch AI AutoFill</Header>}>
      <SpaceBetween size="l">
        <Container header={<Header variant="h3">Job Application Details</Header>}>
          <SpaceBetween size="m">
            <FormField label="Job Application URL" description="Paste the direct link to the application form" constraintText="Supports Workday, Greenhouse, Lever, iCIMS, and more">
              <Input
                value={url}
                onChange={({ detail }) => setUrl(detail.value)}
                placeholder="https://company.wd5.myworkdayjobs.com/careers/job/..."
                type="url"
                disabled={status === 'running'}
              />
            </FormField>
            <ColumnLayout columns={2}>
              <FormField label="Application Platform (optional)" description="Leave blank for auto-detection">
                <Select
                  selectedOption={platform}
                  onChange={({ detail }) => setPlatform(detail.selectedOption)}
                  options={PLATFORM_OPTIONS}
                  placeholder="Auto-detect"
                  disabled={status === 'running'}
                />
              </FormField>
              <FormField label="Run Headless (background)?">
                <Toggle checked={headless} onChange={({ detail }) => setHeadless(detail.checked)} disabled={status === 'running'}>
                  {headless ? 'Headless (invisible)' : 'Visible browser window'}
                </Toggle>
              </FormField>
            </ColumnLayout>
            <FormField label="Job-specific Context (optional)" description="Extra AI instructions specific to this application">
              <Textarea
                value={jobContext}
                onChange={({ detail }) => setJobContext(detail.value)}
                placeholder="Emphasize my work with distributed systems. Mention my Go experience prominently. Target this as a data engineering role."
                rows={3}
                disabled={status === 'running'}
              />
            </FormField>
            <SpaceBetween direction="horizontal" size="s">
              <Button
                variant="primary"
                iconName="upload"
                onClick={handleLaunch}
                loading={status === 'running'}
                disabled={!url || status === 'running' || status === 'paused'}
              >
                {status === 'running' ? 'Running...' : 'Launch AutoFill'}
              </Button>
              {(status === 'running' || status === 'paused') && (
                <Button variant="normal" iconName="close" onClick={handleStop}>Stop Session</Button>
              )}
              {status === 'paused' && (
                <Button variant="primary" iconName="check" onClick={handleApprove}>Approve &amp; Submit</Button>
              )}
            </SpaceBetween>
          </SpaceBetween>
        </Container>

        {status !== 'idle' && (
          <SpaceBetween size="l">
            <Container header={<Header variant="h3">Session Progress</Header>}>
              <SpaceBetween size="m">
                <StatusIndicator type={
                  status === 'running' ? 'loading' :
                  status === 'paused' ? 'warning' :
                  status === 'done' ? 'success' : 'error'
                }>
                  {status === 'running' ? 'AutoFill in progress…' :
                  status === 'paused' ? (pendingQuestions.length > 0 ? 'Awaiting your input…' : 'Review and approve submission') :
                  status === 'done' ? 'Application submitted successfully!' : 'Session ended with errors'}
                </StatusIndicator>
                <ProgressBar
                  value={progress}
                  label="Form completion"
                  description={`${progress}% of fields processed (${review?.filledFields || 0}/${review?.totalFields || 0} fields)`}
                  status={status === 'error' ? 'error' : status === 'done' ? 'success' : 'in-progress'}
                />
                {status === 'paused' && pendingQuestions.length === 0 && (
                  <Alert type="warning" header="Ready for Submission">
                    The AI has filled all detected fields. Please review the <strong>Draft Answers</strong> below and click <strong>Approve &amp; Submit</strong> to finalize.
                  </Alert>
                )}
                {status === 'done' && (
                  <Alert type="success" header="Application Submitted!">
                    The application was submitted successfully. Check <strong>Job History</strong> for details.
                  </Alert>
                )}
              </SpaceBetween>
            </Container>

            {pendingQuestions.length > 0 && (
              <Container header={<Header variant="h3" description="The AI needs clarification on these fields">Interactive Questions</Header>}>
                <SpaceBetween size="l">
                  {pendingQuestions.map((q) => (
                    <FormField key={q.fieldId} label={q.label} description={q.questionText}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          {q.options && q.options.length > 0 ? (
                            <Select
                              selectedOption={q.answer ? { label: q.answer, value: q.answer } : (q.recommendation ? { label: q.recommendation, value: q.recommendation } : null)}
                              onChange={({ detail }) => {
                                q.answer = detail.selectedOption.value;
                                setPendingQuestions([...pendingQuestions]);
                              }}
                              options={q.options.map(o => ({ label: o, value: o }))}
                              placeholder="Select an option"
                            />
                          ) : (
                            <Input
                              value={q.answer || q.recommendation || ''}
                              onChange={({ detail }) => {
                                q.answer = detail.value;
                                setPendingQuestions([...pendingQuestions]);
                              }}
                              placeholder={q.recommendation ? `Suggested: ${q.recommendation}` : "Your answer..."}
                            />
                          )}
                        </div>
                        <Button 
                          variant="primary" 
                          onClick={() => handleRespondent(q.fieldId, q.answer || q.recommendation, q.questionText)}
                          disabled={!(q.answer || q.recommendation)}
                        >
                          Confirm
                        </Button>
                      </div>
                    </FormField>
                  ))}
                </SpaceBetween>
              </Container>
            )}

            {draftAnswers.length > 0 && (
              <Container header={<Header variant="h3" counter={`(${draftAnswers.length})`}>Draft Answers</Header>}>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #eaeded' }}>
                        <th style={{ padding: '8px' }}>Field</th>
                        <th style={{ padding: '8px' }}>AI Answer</th>
                        <th style={{ padding: '8px' }}>Confidence</th>
                        <th style={{ padding: '8px' }}>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftAnswers.map((a, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f2f3f3' }}>
                          <td style={{ padding: '8px', fontWeight: 500 }}>{a.label}</td>
                          <td style={{ padding: '8px' }}>{a.value}</td>
                          <td style={{ padding: '8px' }}>
                            <StatusIndicator type={a.confidence > 0.9 ? 'success' : 'warning'}>
                              {Math.round(a.confidence * 100)}%
                            </StatusIndicator>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <Box color="text-status-inactive" variant="small">{a.source}</Box>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Container>
            )}
          </SpaceBetween>
        )}

        <Container>
          <Tabs
            tabs={[
              {
                label: "Execution Logs",
                id: "logs",
                content: (
                  <Box variant="code" className="autofill-log" padding="m">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {logs.length === 0
                        ? <Box color="text-status-inactive">Logs will appear here when a session is running…</Box>
                        : logs.map(l => (
                            <div key={l.id} style={{ display: 'flex', gap: '8px', fontFamily: 'monospace', fontSize: '13px' }}>
                              <Box as="span" color="text-status-inactive" style={{ whiteSpace: 'nowrap' }}>[{l.time}]</Box>
                              <Box as="span" color={l.level === 'error' ? 'text-status-error' : l.level === 'success' ? 'text-status-success' : 'text-body-default'}>
                                {l.msg}
                              </Box>
                            </div>
                          ))
                      }
                    </div>
                  </Box>
                )
              },
              {
                label: "AI Monitoring",
                id: "monitoring",
                content: (
                  <ColumnLayout columns={2}>
                    <Container header={<Header variant="h3">Token Usage (AI)</Header>}>
                       <PieChart
                        data={[
                          { title: "Prompt Tokens", value: 450, color: "#0073bb" },
                          { title: "Completion Tokens", value: 120, color: "#6b6375" },
                          { title: "Reasoning Tokens", value: 80, color: "#aa3bff" }
                        ]}
                        detailPopoverContent={(detail, item) => [
                          { key: "Value", value: item.value },
                          { key: "Percentage", value: `${((item.value / 650) * 100).toFixed(1)}%` }
                        ]}
                        segmentDescription={(item, value) => `${value} units`}
                        ariaLabel="Token distribution chart"
                        height={180}
                      />
                    </Container>
                    <Container header={<Header variant="h3">API Latency (ms)</Header>}>
                      <LineChart
                        series={[
                          {
                            title: "Latency",
                            type: "line",
                            data: [
                              { x: 1, y: 120 }, { x: 2, y: 450 }, { x: 3, y: 300 },
                              { x: 4, y: 800 }, { x: 5, y: 350 }, { x: 6, y: 200 }
                            ],
                            color: "#0073bb"
                          }
                        ]}
                        xDomain={[1, 6]}
                        yDomain={[0, 1000]}
                        xTitle="Request #"
                        yTitle="Time (ms)"
                        height={180}
                        ariaLabel="Latency over time"
                      />
                    </Container>
                  </ColumnLayout>
                )
              }
            ]}
          />
        </Container>

      </SpaceBetween>
    </ContentLayout>
  );
}
