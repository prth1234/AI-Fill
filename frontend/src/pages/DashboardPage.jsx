import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Cards from '@cloudscape-design/components/cards';
import Container from '@cloudscape-design/components/container';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Button from '@cloudscape-design/components/button';
import Box from '@cloudscape-design/components/box';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Link from '@cloudscape-design/components/link';
import Alert from '@cloudscape-design/components/alert';
import axios from 'axios';

const API = 'http://localhost:4000/api';

function StatBox({ label, value, description }) {
  return (
    <Container>
      <Box variant="awsui-key-label">{label}</Box>
      <Box variant="h1" textAlign="center" padding={{ vertical: 's' }}>{value}</Box>
      {description && <Box variant="small" color="text-status-inactive">{description}</Box>}
    </Container>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [backendOk, setBackendOk] = useState(null);

  useEffect(() => {
    axios.get(`${API}/health`)
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
    axios.get(`${API}/stats`)
      .then(r => setStats(r.data))
      .catch(() => {});
  }, []);

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="Your intelligent job application assistant — powered by open-source AI and Playwright"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" iconName="upload" onClick={() => navigate('/autofill')}>
                Launch AutoFill
              </Button>
              <Button iconName="edit" onClick={() => navigate('/profile')}>
                Edit Profile
              </Button>
            </SpaceBetween>
          }
        >
          AI AutoFill Dashboard
        </Header>
      }
    >
      <SpaceBetween size="l">


        <ColumnLayout columns={4}>
          <StatBox label="Applications Filled" value={stats?.totalFilled ?? '—'} description="All time" />
          <StatBox label="Forms Completed" value={stats?.formsCompleted ?? '—'} description="Successful" />
          <StatBox label="Hours Saved" value={stats?.hoursSaved ?? '—'} description="Estimated" />
          <StatBox label="Profile Completeness" value={stats?.profileComplete ?? '—'} description="%" />
        </ColumnLayout>



        <Cards
          cardDefinition={{
            header: item => item.title,
            sections: [
              { id: 'desc', content: item => item.desc },
              { id: 'action', content: item => <Button variant="primary" onClick={item.action}>{item.cta}</Button> },
            ],
          }}
          items={[
            { title: '1.  Set Up Your Profile', desc: 'Fill in your personal info, work history, education, skills, and job preferences. The AI will use this to fill every application field.', cta: 'Start Profile', action: () => navigate('/profile') },
            { title: '2.  Launch AutoFill', desc: 'Enter a job posting URL (Workday, Greenhouse, Lever, etc.) and let the AI + Playwright engine fill the entire application for you.', cta: 'Launch Now', action: () => navigate('/autofill') },
            { title: '3.  Review & Submit', desc: 'Before the bot submits, you get a final review screen to confirm all answers. You stay in control, always.', cta: 'View History', action: () => navigate('/jobs') },
          ]}
          columns={3}
        />

        <Container header={<Header variant="h3">How It Works</Header>}>
          <ColumnLayout columns={3} variant="text-grid">
            <div>
              <Box variant="h3">AI Context Layer</Box>
              <Box variant="p">Your profile is stored in OpenSearch (vector DB). When filling a form, the LLM retrieves semantically relevant chunks — so it always picks the right job for the right field.</Box>
            </div>
            <div>
              <Box variant="h3">Playwright Automation</Box>
              <Box variant="p">Playwright navigates the job application portal, identifies form fields, sends them to the LLM, and types the AI-generated answers — exactly like a human would.</Box>
            </div>
            <div>
              <Box variant="h3">Human-in-the-Loop</Box>
              <Box variant="p">Before any submission, the AI pauses and shows you a review screen. You can correct any mistakes before the bot clicks "Submit".</Box>
            </div>
          </ColumnLayout>
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}
