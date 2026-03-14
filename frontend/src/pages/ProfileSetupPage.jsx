import React, { useState } from 'react';
import Wizard from '@cloudscape-design/components/wizard';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Multiselect from '@cloudscape-design/components/multiselect';
import Textarea from '@cloudscape-design/components/textarea';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Button from '@cloudscape-design/components/button';
import Box from '@cloudscape-design/components/box';
import Alert from '@cloudscape-design/components/alert';
import Badge from '@cloudscape-design/components/badge';
import Cards from '@cloudscape-design/components/cards';
import Toggle from '@cloudscape-design/components/toggle';
import Slider from '@cloudscape-design/components/slider';
import DatePicker from '@cloudscape-design/components/date-picker';
import AttributeEditor from '@cloudscape-design/components/attribute-editor';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import axios from 'axios';

const API = 'http://localhost:4000/api';

// ─── Step 1: Personal Info ────────────────────────────────────────────────────
function PersonalInfo({ data, onChange }) {
  const f = (k) => ({ value: data[k] || '', onChange: ({ detail }) => onChange(k, detail.value) });
  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h2">Basic Details</Header>}>
        <SpaceBetween size="m">
          <ColumnLayout columns={2}>
            <FormField label="First Name" constraintText="As it appears on official documents">
              <Input {...f('firstName')} placeholder="e.g. Parth" />
            </FormField>
            <FormField label="Last Name">
              <Input {...f('lastName')} placeholder="e.g. Sharma" />
            </FormField>
          </ColumnLayout>
          <ColumnLayout columns={2}>
            <FormField label="Email Address">
              <Input {...f('email')} type="email" placeholder="parth@example.com" />
            </FormField>
            <FormField label="Phone Number" constraintText="Include country code">
              <Input {...f('phone')} placeholder="+1 (555) 000-0000" />
            </FormField>
          </ColumnLayout>
          <ColumnLayout columns={2}>
            <FormField label="LinkedIn URL">
              <Input {...f('linkedin')} placeholder="https://linkedin.com/in/yourprofile" />
            </FormField>
            <FormField label="GitHub / Portfolio URL">
              <Input {...f('github')} placeholder="https://github.com/yourusername" />
            </FormField>
          </ColumnLayout>
          <FormField label="Personal Website">
            <Input {...f('website')} placeholder="https://yourwebsite.com" />
          </FormField>
        </SpaceBetween>
      </Container>

      <Container header={<Header variant="h2">Location & Eligibility</Header>}>
        <SpaceBetween size="m">
          <ColumnLayout columns={3}>
            <FormField label="City">
              <Input {...f('city')} placeholder="San Francisco" />
            </FormField>
            <FormField label="State / Province">
              <Input {...f('state')} placeholder="California" />
            </FormField>
            <FormField label="Country">
              <Input {...f('country')} placeholder="United States" />
            </FormField>
          </ColumnLayout>
          <ColumnLayout columns={2}>
            <FormField label="ZIP / Postal Code">
              <Input {...f('zipcode')} placeholder="94105" />
            </FormField>
            <FormField label="Work Authorization">
              <Select
                selectedOption={data.workAuth || null}
                onChange={({ detail }) => onChange('workAuth', detail.selectedOption)}
                options={[
                  { label: 'US Citizen', value: 'us_citizen' },
                  { label: 'Green Card / PR', value: 'green_card' },
                  { label: 'H-1B Visa', value: 'h1b' },
                  { label: 'OPT / CPT', value: 'opt_cpt' },
                  { label: 'TN Visa', value: 'tn' },
                  { label: 'Other Work Visa', value: 'other_visa' },
                  { label: 'Canadian Citizen', value: 'ca_citizen' },
                  { label: 'UK / EU Citizen', value: 'eu_citizen' },
                  { label: 'No Authorization', value: 'none' },
                ]}
                placeholder="Select authorization"
              />
            </FormField>
          </ColumnLayout>
          <ColumnLayout columns={2}>
            <FormField label="Willing to Relocate?">
              <Toggle checked={data.willingToRelocate || false} onChange={({ detail }) => onChange('willingToRelocate', detail.checked)}>
                {data.willingToRelocate ? 'Yes' : 'No'}
              </Toggle>
            </FormField>
            <FormField label="Date of Birth (optional)">
              <DatePicker
                value={data.dob || ''}
                onChange={({ detail }) => onChange('dob', detail.value)}
                placeholder="YYYY/MM/DD"
              />
            </FormField>
          </ColumnLayout>
        </SpaceBetween>
      </Container>

      <Container header={<Header variant="h2">Professional Summary</Header>}>
        <FormField label="Elevator Pitch / Summary" constraintText="2–4 sentences about who you are professionally">
          <Textarea
            value={data.summary || ''}
            onChange={({ detail }) => onChange('summary', detail.value)}
            placeholder="Experienced software engineer with 5+ years building scalable distributed systems at high-growth startups. Passionate about ML infrastructure and developer tooling..."
            rows={5}
          />
        </FormField>
      </Container>
    </SpaceBetween>
  );
}

// ─── Step 2: Work Experience ──────────────────────────────────────────────────
function WorkExperience({ data, onChange }) {
  const exps = data.experiences || [];

  const addExp = () => {
    onChange('experiences', [...exps, {
      id: Date.now(), company: '', title: '', startDate: '', endDate: '',
      current: false, location: '', description: '', achievements: '', employmentType: null,
    }]);
  };

  const updateExp = (idx, key, val) => {
    const updated = exps.map((e, i) => i === idx ? { ...e, [key]: val } : e);
    onChange('experiences', updated);
  };

  const removeExp = (idx) => onChange('experiences', exps.filter((_, i) => i !== idx));

  return (
    <SpaceBetween size="l">
      <Alert type="info">
        Add all your work experiences. The AI will use these to intelligently fill job application forms.
        Be as detailed as possible with descriptions and achievements.
      </Alert>
      {exps.map((exp, idx) => (
        <Container
          key={exp.id}
          header={
            <Header
              variant="h2"
              actions={<Button variant="icon" iconName="remove" onClick={() => removeExp(idx)} />}
            >
              {exp.company || `Experience ${idx + 1}`}
            </Header>
          }
        >
          <SpaceBetween size="m">
            <ColumnLayout columns={2}>
              <FormField label="Company Name">
                <Input value={exp.company} onChange={({ detail }) => updateExp(idx, 'company', detail.value)} placeholder="Google" />
              </FormField>
              <FormField label="Job Title / Role">
                <Input value={exp.title} onChange={({ detail }) => updateExp(idx, 'title', detail.value)} placeholder="Senior Software Engineer" />
              </FormField>
            </ColumnLayout>
            <ColumnLayout columns={2}>
              <FormField label="Employment Type">
                <Select
                  selectedOption={exp.employmentType}
                  onChange={({ detail }) => updateExp(idx, 'employmentType', detail.selectedOption)}
                  options={[
                    { label: 'Full-time', value: 'full_time' },
                    { label: 'Part-time', value: 'part_time' },
                    { label: 'Contract', value: 'contract' },
                    { label: 'Internship', value: 'internship' },
                    { label: 'Freelance', value: 'freelance' },
                  ]}
                  placeholder="Select type"
                />
              </FormField>
              <FormField label="Location">
                <Input value={exp.location} onChange={({ detail }) => updateExp(idx, 'location', detail.value)} placeholder="San Francisco, CA / Remote" />
              </FormField>
            </ColumnLayout>
            <ColumnLayout columns={3}>
              <FormField label="Start Date">
                <DatePicker value={exp.startDate} onChange={({ detail }) => updateExp(idx, 'startDate', detail.value)} placeholder="YYYY/MM/DD" />
              </FormField>
              <FormField label="End Date">
                <DatePicker value={exp.endDate} onChange={({ detail }) => updateExp(idx, 'endDate', detail.value)} placeholder="YYYY/MM/DD" disabled={exp.current} />
              </FormField>
              <FormField label="Currently Working Here">
                <Toggle checked={exp.current} onChange={({ detail }) => updateExp(idx, 'current', detail.checked)}>
                  {exp.current ? 'Yes' : 'No'}
                </Toggle>
              </FormField>
            </ColumnLayout>
            <FormField label="Role Description" constraintText="What did you do? Key responsibilities">
              <Textarea
                value={exp.description}
                onChange={({ detail }) => updateExp(idx, 'description', detail.value)}
                placeholder="Led the design and implementation of a microservices architecture serving 10M+ daily active users..."
                rows={4}
              />
            </FormField>
            <FormField label="Key Achievements" constraintText="Quantify impact wherever possible">
              <Textarea
                value={exp.achievements}
                onChange={({ detail }) => updateExp(idx, 'achievements', detail.value)}
                placeholder="• Reduced API latency by 40% through caching layer&#10;• Mentored 3 junior engineers&#10;• Shipped 0-to-1 product in 6 months"
                rows={4}
              />
            </FormField>
          </SpaceBetween>
        </Container>
      ))}
      <Button iconName="add-plus" onClick={addExp}>Add Work Experience</Button>
    </SpaceBetween>
  );
}

// ─── Step 3: Education ────────────────────────────────────────────────────────
function Education({ data, onChange }) {
  const edus = data.education || [];

  const addEdu = () => {
    onChange('education', [...edus, {
      id: Date.now(), institution: '', degree: null, field: '', startDate: '', endDate: '',
      gpa: '', activities: '', coursework: '',
    }]);
  };

  const updateEdu = (idx, key, val) => {
    onChange('education', edus.map((e, i) => i === idx ? { ...e, [key]: val } : e));
  };

  const removeEdu = (idx) => onChange('education', edus.filter((_, i) => i !== idx));

  return (
    <SpaceBetween size="l">
      {edus.map((edu, idx) => (
        <Container
          key={edu.id}
          header={
            <Header variant="h2" actions={<Button variant="icon" iconName="remove" onClick={() => removeEdu(idx)} />}>
              {edu.institution || `Education ${idx + 1}`}
            </Header>
          }
        >
          <SpaceBetween size="m">
            <ColumnLayout columns={2}>
              <FormField label="Institution Name">
                <Input value={edu.institution} onChange={({ detail }) => updateEdu(idx, 'institution', detail.value)} placeholder="University of California, Berkeley" />
              </FormField>
              <FormField label="Degree Level">
                <Select
                  selectedOption={edu.degree}
                  onChange={({ detail }) => updateEdu(idx, 'degree', detail.selectedOption)}
                  options={[
                    { label: "Bachelor's (B.S. / B.A.)", value: 'bachelors' },
                    { label: "Master's (M.S. / M.A.)", value: 'masters' },
                    { label: 'PhD / Doctorate', value: 'phd' },
                    { label: 'Associate\'s', value: 'associates' },
                    { label: 'Diploma / Certificate', value: 'diploma' },
                    { label: 'Bootcamp', value: 'bootcamp' },
                    { label: 'High School', value: 'high_school' },
                  ]}
                  placeholder="Select degree"
                />
              </FormField>
            </ColumnLayout>
            <ColumnLayout columns={2}>
              <FormField label="Field of Study / Major">
                <Input value={edu.field} onChange={({ detail }) => updateEdu(idx, 'field', detail.value)} placeholder="Computer Science" />
              </FormField>
              <FormField label="GPA (optional)">
                <Input value={edu.gpa} onChange={({ detail }) => updateEdu(idx, 'gpa', detail.value)} placeholder="3.8 / 4.0" />
              </FormField>
            </ColumnLayout>
            <ColumnLayout columns={2}>
              <FormField label="Start Date">
                <DatePicker value={edu.startDate} onChange={({ detail }) => updateEdu(idx, 'startDate', detail.value)} placeholder="YYYY/MM/DD" />
              </FormField>
              <FormField label="Graduation Date">
                <DatePicker value={edu.endDate} onChange={({ detail }) => updateEdu(idx, 'endDate', detail.value)} placeholder="YYYY/MM/DD" />
              </FormField>
            </ColumnLayout>
            <FormField label="Relevant Coursework">
              <Input value={edu.coursework} onChange={({ detail }) => updateEdu(idx, 'coursework', detail.value)} placeholder="Data Structures, Algorithms, ML, Distributed Systems" />
            </FormField>
            <FormField label="Clubs / Activities / Honors">
              <Textarea value={edu.activities} onChange={({ detail }) => updateEdu(idx, 'activities', detail.value)} placeholder="ACM Club President, Dean's List, Research Assistant at HCI Lab" rows={3} />
            </FormField>
          </SpaceBetween>
        </Container>
      ))}
      <Button iconName="add-plus" onClick={addEdu}>Add Education</Button>
    </SpaceBetween>
  );
}

// ─── Step 4: Skills & Technologies ───────────────────────────────────────────
const SKILL_OPTIONS = [
  'Python','JavaScript','TypeScript','Java','Go','Rust','C++','C#','Ruby','Swift',
  'Kotlin','React','Next.js','Vue.js','Angular','Node.js','FastAPI','Django','Spring Boot',
  'PostgreSQL','MySQL','MongoDB','Redis','Elasticsearch','OpenSearch','Kafka','RabbitMQ',
  'Docker','Kubernetes','Terraform','AWS','GCP','Azure','CI/CD','Git','Linux',
  'PyTorch','TensorFlow','Scikit-learn','Pandas','Spark','Hadoop','dbt','Airflow',
  'GraphQL','REST','gRPC','Microservices','LLMs','LangChain','Playwright','Selenium',
].map(s => ({ label: s, value: s.toLowerCase().replace(/[.\s]/g, '_') }));

function Skills({ data, onChange }) {
  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h2">Technical Skills</Header>}>
        <SpaceBetween size="m">
          <FormField label="Primary Programming Languages" constraintText="Languages you are most proficient in">
            <Multiselect
              selectedOptions={data.primaryLangs || []}
              onChange={({ detail }) => onChange('primaryLangs', detail.selectedOptions)}
              options={SKILL_OPTIONS.filter(s => ['python','javascript','typescript','java','go','rust','c++','c#','ruby','swift','kotlin'].includes(s.value))}
              placeholder="Select languages"
              filteringType="auto"
            />
          </FormField>
          <FormField label="Frameworks & Libraries">
            <Multiselect
              selectedOptions={data.frameworks || []}
              onChange={({ detail }) => onChange('frameworks', detail.selectedOptions)}
              options={SKILL_OPTIONS}
              placeholder="Select frameworks"
              filteringType="auto"
            />
          </FormField>
          <FormField label="Databases & Data Stores">
            <Multiselect
              selectedOptions={data.databases || []}
              onChange={({ detail }) => onChange('databases', detail.selectedOptions)}
              options={SKILL_OPTIONS.filter(s => ['postgresql','mysql','mongodb','redis','elasticsearch','opensearch','kafka','rabbitmq'].includes(s.value))}
              placeholder="Select databases"
              filteringType="auto"
            />
          </FormField>
          <FormField label="Cloud & DevOps">
            <Multiselect
              selectedOptions={data.cloudDevops || []}
              onChange={({ detail }) => onChange('cloudDevops', detail.selectedOptions)}
              options={SKILL_OPTIONS.filter(s => ['docker','kubernetes','terraform','aws','gcp','azure','ci_cd','git','linux'].includes(s.value))}
              placeholder="Select tools"
              filteringType="auto"
            />
          </FormField>
          <FormField label="AI / ML Tools">
            <Multiselect
              selectedOptions={data.aiMl || []}
              onChange={({ detail }) => onChange('aiMl', detail.selectedOptions)}
              options={SKILL_OPTIONS.filter(s => ['pytorch','tensorflow','scikit-learn','pandas','spark','hadoop','dbt','airflow','llms','langchain'].includes(s.value.replace(/_/g,'-')))}
              placeholder="Select AI/ML tools"
              filteringType="auto"
            />
          </FormField>
          <FormField label="Other Skills (comma-separated)">
            <Input value={data.otherSkills || ''} onChange={({ detail }) => onChange('otherSkills', detail.value)} placeholder="System Design, Agile/Scrum, Technical Writing, Public Speaking" />
          </FormField>
        </SpaceBetween>
      </Container>

      <Container header={<Header variant="h2">Years of Total Experience</Header>}>
        <FormField label={`Total Professional Experience: ${data.totalYears || 0} years`}>
          <Slider
            value={data.totalYears || 0}
            onChange={({ detail }) => onChange('totalYears', detail.value)}
            min={0} max={25} step={1}
            referenceValues={[0, 5, 10, 15, 20, 25]}
          />
        </FormField>
      </Container>

      <Container header={<Header variant="h2">Languages Spoken</Header>}>
        <AttributeEditor
          items={data.languages || []}
          onAddButtonClick={() => onChange('languages', [...(data.languages || []), { language: '', proficiency: null }])}
          onRemoveButtonClick={({ detail: { itemIndex } }) =>
            onChange('languages', (data.languages || []).filter((_, i) => i !== itemIndex))
          }
          addButtonText="Add Language"
          definition={[
            {
              label: 'Language',
              control: (item, itemIndex) => (
                <Input
                  value={item.language}
                  onChange={({ detail }) => {
                    const updated = [...(data.languages || [])];
                    updated[itemIndex] = { ...item, language: detail.value };
                    onChange('languages', updated);
                  }}
                  placeholder="Spanish"
                />
              ),
            },
            {
              label: 'Proficiency',
              control: (item, itemIndex) => (
                <Select
                  selectedOption={item.proficiency}
                  onChange={({ detail }) => {
                    const updated = [...(data.languages || [])];
                    updated[itemIndex] = { ...item, proficiency: detail.selectedOption };
                    onChange('languages', updated);
                  }}
                  options={[
                    { label: 'Native', value: 'native' },
                    { label: 'Fluent', value: 'fluent' },
                    { label: 'Professional', value: 'professional' },
                    { label: 'Conversational', value: 'conversational' },
                    { label: 'Basic', value: 'basic' },
                  ]}
                  placeholder="Select level"
                />
              ),
            },
          ]}
          empty="No languages added"
        />
      </Container>
    </SpaceBetween>
  );
}

// ─── Step 5: Certifications & Projects ───────────────────────────────────────
function CertsAndProjects({ data, onChange }) {
  const certs = data.certifications || [];
  const projects = data.projects || [];

  const addCert = () => onChange('certifications', [...certs, { id: Date.now(), name: '', issuer: '', date: '', credentialId: '', url: '' }]);
  const updateCert = (idx, key, val) => onChange('certifications', certs.map((c, i) => i === idx ? { ...c, [key]: val } : c));
  const removeCert = (idx) => onChange('certifications', certs.filter((_, i) => i !== idx));

  const addProject = () => onChange('projects', [...projects, { id: Date.now(), name: '', description: '', techStack: '', url: '', impact: '' }]);
  const updateProject = (idx, key, val) => onChange('projects', projects.map((p, i) => i === idx ? { ...p, [key]: val } : p));
  const removeProject = (idx) => onChange('projects', projects.filter((_, i) => i !== idx));

  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h2">Certifications</Header>}>
        <SpaceBetween size="m">
          {certs.map((cert, idx) => (
            <ExpandableSection
              key={cert.id}
              headerText={cert.name || `Certification ${idx + 1}`}
              headerActions={<Button variant="icon" iconName="remove" onClick={() => removeCert(idx)} />}
            >
              <SpaceBetween size="m">
                <ColumnLayout columns={2}>
                  <FormField label="Certification Name">
                    <Input value={cert.name} onChange={({ detail }) => updateCert(idx, 'name', detail.value)} placeholder="AWS Solutions Architect" />
                  </FormField>
                  <FormField label="Issuing Organization">
                    <Input value={cert.issuer} onChange={({ detail }) => updateCert(idx, 'issuer', detail.value)} placeholder="Amazon Web Services" />
                  </FormField>
                </ColumnLayout>
                <ColumnLayout columns={3}>
                  <FormField label="Issue Date">
                    <DatePicker value={cert.date} onChange={({ detail }) => updateCert(idx, 'date', detail.value)} placeholder="YYYY/MM/DD" />
                  </FormField>
                  <FormField label="Credential ID">
                    <Input value={cert.credentialId} onChange={({ detail }) => updateCert(idx, 'credentialId', detail.value)} placeholder="ABC123XYZ" />
                  </FormField>
                  <FormField label="Credential URL">
                    <Input value={cert.url} onChange={({ detail }) => updateCert(idx, 'url', detail.value)} placeholder="https://..." />
                  </FormField>
                </ColumnLayout>
              </SpaceBetween>
            </ExpandableSection>
          ))}
          <Button iconName="add-plus" onClick={addCert}>Add Certification</Button>
        </SpaceBetween>
      </Container>

      <Container header={<Header variant="h2">Projects</Header>}>
        <SpaceBetween size="m">
          {projects.map((proj, idx) => (
            <ExpandableSection
              key={proj.id}
              headerText={proj.name || `Project ${idx + 1}`}
              headerActions={<Button variant="icon" iconName="remove" onClick={() => removeProject(idx)} />}
            >
              <SpaceBetween size="m">
                <ColumnLayout columns={2}>
                  <FormField label="Project Name">
                    <Input value={proj.name} onChange={({ detail }) => updateProject(idx, 'name', detail.value)} placeholder="AI AutoFill Bot" />
                  </FormField>
                  <FormField label="Project URL / Repo">
                    <Input value={proj.url} onChange={({ detail }) => updateProject(idx, 'url', detail.value)} placeholder="https://github.com/..." />
                  </FormField>
                </ColumnLayout>
                <FormField label="Tech Stack Used">
                  <Input value={proj.techStack} onChange={({ detail }) => updateProject(idx, 'techStack', detail.value)} placeholder="Python, Playwright, OpenSearch, LangChain" />
                </FormField>
                <FormField label="Description">
                  <Textarea value={proj.description} onChange={({ detail }) => updateProject(idx, 'description', detail.value)} placeholder="Built an AI-powered tool that automatically fills job applications..." rows={3} />
                </FormField>
                <FormField label="Impact / Results">
                  <Input value={proj.impact} onChange={({ detail }) => updateProject(idx, 'impact', detail.value)} placeholder="Saved 10+ hours/week, 200+ GitHub stars" />
                </FormField>
              </SpaceBetween>
            </ExpandableSection>
          ))}
          <Button iconName="add-plus" onClick={addProject}>Add Project</Button>
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
}

// ─── Step 6: Job Preferences ──────────────────────────────────────────────────
function JobPreferences({ data, onChange }) {
  const f = (k) => ({ value: data[k] || '', onChange: ({ detail }) => onChange(k, detail.value) });
  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h2">Target Roles</Header>}>
        <SpaceBetween size="m">
          <FormField label="Desired Job Titles" constraintText="Comma-separated list">
            <Input {...f('desiredRoles')} placeholder="Software Engineer, Backend Engineer, Platform Engineer" />
          </FormField>
          <FormField label="Target Industries">
            <Multiselect
              selectedOptions={data.targetIndustries || []}
              onChange={({ detail }) => onChange('targetIndustries', detail.selectedOptions)}
              options={[
                { label: 'Technology / Software', value: 'tech' },
                { label: 'Fintech / Finance', value: 'fintech' },
                { label: 'Healthcare / Biotech', value: 'health' },
                { label: 'AI / ML', value: 'ai_ml' },
                { label: 'E-Commerce / Retail', value: 'ecommerce' },
                { label: 'Cybersecurity', value: 'security' },
                { label: 'Gaming', value: 'gaming' },
                { label: 'Education / EdTech', value: 'edtech' },
                { label: 'Government / Defense', value: 'gov' },
                { label: 'Consulting', value: 'consulting' },
                { label: 'Startup', value: 'startup' },
              ]}
              placeholder="Select industries"
            />
          </FormField>
          <FormField label="Work Mode Preference">
            <Select
              selectedOption={data.workMode || null}
              onChange={({ detail }) => onChange('workMode', detail.selectedOption)}
              options={[
                { label: 'Remote Only', value: 'remote' },
                { label: 'Hybrid', value: 'hybrid' },
                { label: 'On-site / In-office', value: 'onsite' },
                { label: 'Flexible', value: 'flexible' },
              ]}
              placeholder="Select work mode"
            />
          </FormField>
        </SpaceBetween>
      </Container>

      <Container header={<Header variant="h2">Compensation Expectations</Header>}>
        <SpaceBetween size="m">
          <ColumnLayout columns={2}>
            <FormField label="Minimum Expected Salary (USD/yr)">
              <Input {...f('salaryMin')} placeholder="120000" />
            </FormField>
            <FormField label="Target / Ideal Salary (USD/yr)">
              <Input {...f('salaryMax')} placeholder="160000" />
            </FormField>
          </ColumnLayout>
          <FormField label="Employment Type Preference">
            <Multiselect
              selectedOptions={data.empTypes || []}
              onChange={({ detail }) => onChange('empTypes', detail.selectedOptions)}
              options={[
                { label: 'Full-time', value: 'full_time' },
                { label: 'Contract', value: 'contract' },
                { label: 'Part-time', value: 'part_time' },
                { label: 'Internship', value: 'internship' },
              ]}
              placeholder="Select types"
            />
          </FormField>
          <FormField label="Earliest Start Date (Notice Period)">
            <Select
              selectedOption={data.noticePeriod || null}
              onChange={({ detail }) => onChange('noticePeriod', detail.selectedOption)}
              options={[
                { label: 'Immediately', value: 'immediate' },
                { label: '2 weeks', value: '2w' },
                { label: '1 month', value: '1m' },
                { label: '2 months', value: '2m' },
                { label: '3 months', value: '3m' },
              ]}
              placeholder="Select notice period"
            />
          </FormField>
        </SpaceBetween>
      </Container>

      <Container header={<Header variant="h2">AutoFill Behaviour</Header>}>
        <SpaceBetween size="m">
          <FormField label="Cover Letter Style">
            <Select
              selectedOption={data.coverLetterStyle || null}
              onChange={({ detail }) => onChange('coverLetterStyle', detail.selectedOption)}
              options={[
                { label: 'Professional & Formal', value: 'formal' },
                { label: 'Conversational & Friendly', value: 'conversational' },
                { label: 'Technical & Detail-oriented', value: 'technical' },
                { label: 'Brief & Punchy', value: 'brief' },
              ]}
              placeholder="Select style"
            />
          </FormField>
          <FormField label="Custom AutoFill Notes" constraintText="Extra instructions for the AI when filling forms">
            <Textarea
              value={data.autofillNotes || ''}
              onChange={({ detail }) => onChange('autofillNotes', detail.value)}
              placeholder="Always mention my open-source contributions. Skip diversity survey questions. Use my GitHub profile for portfolio links."
              rows={4}
            />
          </FormField>
          <ColumnLayout columns={2}>
            <FormField label="Pause Before Submission?">
              <Toggle checked={data.pauseBeforeSubmit !== false} onChange={({ detail }) => onChange('pauseBeforeSubmit', detail.checked)}>
                {data.pauseBeforeSubmit !== false ? 'Yes – let me review first' : 'No – auto-submit'}
              </Toggle>
            </FormField>
            <FormField label="Generate Cover Letter Automatically?">
              <Toggle checked={data.autoCoverLetter || false} onChange={({ detail }) => onChange('autoCoverLetter', detail.checked)}>
                {data.autoCoverLetter ? 'Yes' : 'No'}
              </Toggle>
            </FormField>
          </ColumnLayout>
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
}

// ─── Step 7: Review ───────────────────────────────────────────────────────────
function Review({ profileData }) {
  const p = profileData;
  return (
    <SpaceBetween size="l">
      <Alert type="success" header="Almost done!">
        Review your profile below before saving. Your data will be stored securely in OpenSearch and used by the AI AutoFill engine.
      </Alert>
      <Container header={<Header variant="h2">👤 Personal</Header>}>
        <ColumnLayout columns={2} variant="text-grid">
          <div><Box variant="awsui-key-label">Name</Box><div>{p.personal?.firstName} {p.personal?.lastName}</div></div>
          <div><Box variant="awsui-key-label">Email</Box><div>{p.personal?.email || '—'}</div></div>
          <div><Box variant="awsui-key-label">Phone</Box><div>{p.personal?.phone || '—'}</div></div>
          <div><Box variant="awsui-key-label">Location</Box><div>{[p.personal?.city, p.personal?.state, p.personal?.country].filter(Boolean).join(', ') || '—'}</div></div>
          <div><Box variant="awsui-key-label">Work Auth</Box><div>{p.personal?.workAuth?.label || '—'}</div></div>
          <div><Box variant="awsui-key-label">LinkedIn</Box><div>{p.personal?.linkedin || '—'}</div></div>
        </ColumnLayout>
      </Container>
      <Container header={<Header variant="h2">💼 Experience</Header>}>
        <SpaceBetween size="s">
          {(p.workExp?.experiences || []).map((e, i) => (
            <div key={i}><Badge color="blue">{e.employmentType?.label || 'Full-time'}</Badge>{' '}<strong>{e.title}</strong> @ {e.company} ({e.startDate} – {e.current ? 'Present' : e.endDate})</div>
          ))}
          {!(p.workExp?.experiences?.length) && <Box color="text-status-inactive">No experience added</Box>}
        </SpaceBetween>
      </Container>
      <Container header={<Header variant="h2">🎓 Education</Header>}>
        <SpaceBetween size="s">
          {(p.education?.education || []).map((e, i) => (
            <div key={i}><strong>{e.degree?.label || ''}</strong> in {e.field} — {e.institution} {e.gpa ? `(GPA: ${e.gpa})` : ''}</div>
          ))}
          {!(p.education?.education?.length) && <Box color="text-status-inactive">No education added</Box>}
        </SpaceBetween>
      </Container>
      <Container header={<Header variant="h2">⚡ Skills</Header>}>
        <SpaceBetween size="xs">
          {(p.skills?.primaryLangs || []).map(s => <Badge key={s.value} color="green">{s.label}</Badge>)}
          {(p.skills?.frameworks || []).map(s => <Badge key={s.value} color="blue">{s.label}</Badge>)}
          {(p.skills?.cloudDevops || []).map(s => <Badge key={s.value} color="severity-medium">{s.label}</Badge>)}
        </SpaceBetween>
      </Container>
      <Container header={<Header variant="h2">🎯 Job Preferences</Header>}>
        <ColumnLayout columns={2} variant="text-grid">
          <div><Box variant="awsui-key-label">Target Roles</Box><div>{p.preferences?.desiredRoles || '—'}</div></div>
          <div><Box variant="awsui-key-label">Work Mode</Box><div>{p.preferences?.workMode?.label || '—'}</div></div>
          <div><Box variant="awsui-key-label">Salary Range</Box><div>{p.preferences?.salaryMin && p.preferences?.salaryMax ? `$${p.preferences.salaryMin} – $${p.preferences.salaryMax}` : '—'}</div></div>
          <div><Box variant="awsui-key-label">Pause Before Submit</Box><div>{p.preferences?.pauseBeforeSubmit !== false ? 'Yes' : 'No'}</div></div>
        </ColumnLayout>
      </Container>
    </SpaceBetween>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────
export default function ProfileSetupPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [status, setStatus] = useState(null); // 'saving' | 'success' | 'error'

  const [personal, setPersonal] = useState({});
  const [workExp, setWorkExp] = useState({});
  const [education, setEducation] = useState({});
  const [skills, setSkills] = useState({});
  const [certsProjects, setCertsProjects] = useState({});
  const [preferences, setPreferences] = useState({ pauseBeforeSubmit: true });

  const profileData = { personal, workExp, education, skills, certsProjects, preferences };

  const updateSection = (setter) => (key, val) => setter(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    setStatus('saving');
    try {
      await axios.post(`${API}/profile`, profileData);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <>
      {status === 'success' && (
        <Alert type="success" header="Profile saved!" dismissible onDismiss={() => setStatus(null)}>
          Your profile has been saved to OpenSearch. The AI AutoFill engine is ready to use.
        </Alert>
      )}
      {status === 'error' && (
        <Alert type="error" header="Save failed" dismissible onDismiss={() => setStatus(null)}>
          Could not connect to the backend. Make sure the server is running on port 4000.
        </Alert>
      )}
      <Wizard
        i18nStrings={{
          stepNumberLabel: (n) => `Step ${n}`,
          collapsedStepsLabel: (c, t) => `Step ${c} of ${t}`,
          navigationAriaLabel: 'Steps',
          cancelButton: 'Cancel',
          previousButton: 'Previous',
          nextButton: 'Next',
          submitButton: status === 'saving' ? 'Saving…' : '💾 Save Profile',
          optional: 'optional',
        }}
        onCancel={() => window.history.back()}
        onNavigate={({ detail }) => setActiveStep(detail.requestedStepIndex)}
        onSubmit={handleSubmit}
        activeStepIndex={activeStep}
        steps={[
          {
            title: 'Personal Information',
            description: 'Your identity, contact details and location',
            content: <PersonalInfo data={personal} onChange={updateSection(setPersonal)} />,
          },
          {
            title: 'Work Experience',
            description: 'Jobs, roles, and achievements',
            content: <WorkExperience data={workExp} onChange={updateSection(setWorkExp)} />,
          },
          {
            title: 'Education',
            description: 'Degrees, institutions, and coursework',
            content: <Education data={education} onChange={updateSection(setEducation)} />,
          },
          {
            title: 'Skills & Technologies',
            description: 'Technical stack, languages spoken, and experience level',
            content: <Skills data={skills} onChange={updateSection(setSkills)} />,
          },
          {
            title: 'Certifications & Projects',
            description: 'Credentials and notable work',
            content: <CertsAndProjects data={certsProjects} onChange={updateSection(setCertsProjects)} />,
          },
          {
            title: 'Job Preferences',
            description: 'Target roles, salary, and AutoFill behaviour',
            content: <JobPreferences data={preferences} onChange={updateSection(setPreferences)} />,
          },
          {
            title: 'Review & Save',
            description: 'Confirm your profile before saving',
            content: <Review profileData={profileData} />,
          },
        ]}
      />
    </>
  );
}
