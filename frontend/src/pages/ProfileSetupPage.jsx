import React, { useState, useEffect } from 'react';
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
import Toggle from '@cloudscape-design/components/toggle';
import Slider from '@cloudscape-design/components/slider';
import DatePicker from '@cloudscape-design/components/date-picker';
import AttributeEditor from '@cloudscape-design/components/attribute-editor';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import FileUpload from '@cloudscape-design/components/file-upload';
import FileDropzone from '@cloudscape-design/components/file-dropzone';
import TokenGroup from '@cloudscape-design/components/token-group';
import Grid from '@cloudscape-design/components/grid';
import axios from 'axios';
import CustomFieldBuilder from '../components/CustomFieldBuilder';
import { STANDARD_FIELDS, TEMPLATES } from '../fieldSchema';

const API = 'http://localhost:4000/api';

// ─── Utility Components & Context ──────────────────────────────────────────────
export const EditModeContext = React.createContext({ editMode: false, onRemove: () => {} });

function DismissibleField({ id, activeFields, children }) {
  const { editMode, onRemove } = React.useContext(EditModeContext);
  const isActive = activeFields.includes(id);

  // If not active and not in edit mode, hide completely for a clean UI
  if (!isActive && !editMode) return null;

  return (
    <div style={{
      position: 'relative',
      opacity: isActive ? 1 : 0.4,
      pointerEvents: isActive ? 'auto' : 'none',
      marginTop: 8,
      padding: editMode ? '4px' : '0'
    }}>
      {children}
      {editMode && isActive && (
        <div style={{ position: 'absolute', top: -4, right: -4, pointerEvents: 'auto', zIndex: 10 }}>
           <Button variant="inline-icon" iconName="close" onClick={() => onRemove(id)} />
        </div>
      )}
    </div>
  );
}

function StepWrapper({ title, sections, activeFields, onAdd, onRemove, children }) {
  const [editMode, setEditMode] = useState(() => {
    return localStorage.getItem(`profile_edit_mode_${sections.join('_')}`) === 'true';
  });
  
  useEffect(() => {
    localStorage.setItem(`profile_edit_mode_${sections.join('_')}`, editMode);
  }, [editMode, sections]);
  
  // Collect all inactive fields for the allowed sections
  const inactive = STANDARD_FIELDS.filter(f => sections.includes(f.section) && !activeFields.includes(f.id));

  return (
    <SpaceBetween size="l">
      <Box float="right">
        <Button 
          iconName={editMode ? "check" : "edit"} 
          onClick={() => setEditMode(!editMode)}
          variant={editMode ? "primary" : "normal"}
        >
          {editMode ? "Done Editing" : "Customize Layout"}
        </Button>
      </Box>
      <div style={{ clear: 'both' }} />

      {editMode && (
        <Alert 
          type="info" 
          header="Field Customization Mode"
        >
          Click the 'X' on any field below to remove it. You can re-enable hidden fields here:
          {inactive.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
              {inactive.map(f => (
                <button
                  key={f.id} type="button" onClick={() => onAdd(f.id)}
                  style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', color: '#0284c7', padding: '6px 14px', borderRadius: '9999px', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  {f.label} (Recommended)
                </button>
              ))}
            </div>
          ) : (
            <Box margin={{ top: 'xs' }} color="text-status-success">All available template fields are currently active!</Box>
          )}
        </Alert>
      )}

      <EditModeContext.Provider value={{ editMode, onRemove }}>
        {children}
      </EditModeContext.Provider>
    </SpaceBetween>
  );
}

// ─── Step 1: Personal Info ────────────────────────────────────────────────────
function PersonalInfo({ data, onChange, activeFields, onAdd, onRemove, customFields, onCustomFieldsChange }) {
  const [files, setFiles] = useState([]);
  const fileInputRef = React.useRef(null);
  const f = (k) => ({ value: data[k] || '', onChange: ({ detail }) => onChange(k, detail.value) });

  const handleFileDropzoneChange = ({ detail }) => setFiles(detail.value);
  const handleNativeInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) setFiles(Array.from(e.target.files));
  };

  return (
    <StepWrapper sections={['personal']} activeFields={activeFields} onAdd={onAdd} onRemove={onRemove}>
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">Resume Auto-Fill</Header>}>
          <SpaceBetween size="m">
            <Alert type="info">Upload your resume to automatically extract and populate these fields using AI.</Alert>
            <FormField label="Upload Resume (PDF, DOCX)">
              <div onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>
                <FileDropzone onChange={handleFileDropzoneChange} value={files}>
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <strong>Drop your resume here (Click or Drag)</strong>
                    <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px' }}>PDF or DOCX documents</div>
                  </div>
                </FileDropzone>
              </div>
              <input type="file" ref={fileInputRef} hidden accept=".pdf,.docx" onChange={handleNativeInputChange} />
              
              {files.length > 0 && (
                <Box margin={{ top: 's' }}>
                  <TokenGroup
                    items={files.map(f => ({ label: f.name }))}
                    onDismiss={({ detail }) => setFiles(files.filter((_, i) => i !== detail.itemIndex))}
                  />
                </Box>
              )}
            </FormField>
            <FormField label="Auto-fill with AI">
              <Toggle disabled checked={false}>Enable AI Extraction (Coming Soon)</Toggle>
            </FormField>
          </SpaceBetween>
        </Container>

      <Container header={<Header variant="h2">Basic Details</Header>}>
        <SpaceBetween size="m">
          <ColumnLayout columns={2}>
            <DismissibleField id="firstName" activeFields={activeFields}><FormField label="First Name"><Input {...f('firstName')} placeholder="e.g. John" /></FormField></DismissibleField>
            <DismissibleField id="lastName" activeFields={activeFields}><FormField label="Last Name"><Input {...f('lastName')} placeholder="e.g. Doe" /></FormField></DismissibleField>
          </ColumnLayout>
          <ColumnLayout columns={2}>
            <DismissibleField id="email" activeFields={activeFields}><FormField label="Email Address"><Input {...f('email')} type="email" placeholder="john@example.com" /></FormField></DismissibleField>
            <DismissibleField id="phone" activeFields={activeFields}>
              <FormField label="Phone Number">
                <Grid gridDefinition={[{ colspan: 4 }, { colspan: 5 }, { colspan: 3 }]}>
                  <Select
                    selectedOption={data.phoneCode ? { label: data.phoneCode, value: data.phoneCode } : null}
                    onChange={({ detail }) => onChange('phoneCode', detail.selectedOption.value)}
                    options={[{ label: '+1 (US)', value: '+1 (US)' }, { label: '+44 (UK)', value: '+44 (UK)' }, { label: '+91 (IN)', value: '+91 (IN)' }]}
                    placeholder="Code"
                  />
                  <Input value={data.phone || ''} onChange={({ detail }) => onChange('phone', detail.value)} placeholder="Phone number" />
                  <Select
                    selectedOption={data.phoneType ? { label: data.phoneType, value: data.phoneType } : null}
                    onChange={({ detail }) => onChange('phoneType', detail.selectedOption.value)}
                    options={[{ label: 'Mobile', value: 'Mobile' }, { label: 'Home', value: 'Home' }, { label: 'Work', value: 'Work' }]}
                    placeholder="Type"
                  />
                </Grid>
              </FormField>
            </DismissibleField>
          </ColumnLayout>
          <ColumnLayout columns={2}>
            <DismissibleField id="linkedin" activeFields={activeFields}><FormField label="LinkedIn URL"><Input {...f('linkedin')} placeholder="https://linkedin.com/in/johndoe" /></FormField></DismissibleField>
            <DismissibleField id="github" activeFields={activeFields}><FormField label="GitHub / Portfolio URL"><Input {...f('github')} placeholder="https://github.com/johndoe" /></FormField></DismissibleField>
          </ColumnLayout>
          <DismissibleField id="website" activeFields={activeFields}><FormField label="Personal Website"><Input {...f('website')} placeholder="https://johndoe.com" /></FormField></DismissibleField>
        </SpaceBetween>
      </Container>

      <Container header={<Header variant="h2">Location & Eligibility</Header>}>
        <SpaceBetween size="m">
          <ColumnLayout columns={3}>
            <DismissibleField id="city" activeFields={activeFields}><FormField label="City"><Input {...f('city')} placeholder="San Francisco" /></FormField></DismissibleField>
            <DismissibleField id="state" activeFields={activeFields}><FormField label="State / Province"><Input {...f('state')} placeholder="CA" /></FormField></DismissibleField>
            <DismissibleField id="country" activeFields={activeFields}><FormField label="Country"><Input {...f('country')} placeholder="United States" /></FormField></DismissibleField>
          </ColumnLayout>
          <ColumnLayout columns={2}>
            <DismissibleField id="zipcode" activeFields={activeFields}><FormField label="ZIP / Postal Code"><Input {...f('zipcode')} placeholder="12345" /></FormField></DismissibleField>
            <DismissibleField id="workAuth" activeFields={activeFields}>
              <FormField label="Work Authorization">
                <Select
                  placeholder="Select Authorization"
                  selectedOption={data.workAuth || null}
                  onChange={({ detail }) => onChange('workAuth', detail.selectedOption)}
                  options={[{ label: 'US Citizen', value: 'us' }, { label: 'Green Card', value: 'gc' }, { label: 'H1B Visa', value: 'h1b' }, { label: 'No Auth', value: 'none' }]}
                />
              </FormField>
            </DismissibleField>
          </ColumnLayout>
          <ColumnLayout columns={2}>
            <DismissibleField id="willingToRelocate" activeFields={activeFields}>
              <FormField label="Willing to Relocate?">
                <Toggle checked={data.willingToRelocate || false} onChange={({ detail }) => onChange('willingToRelocate', detail.checked)}>
                  {data.willingToRelocate ? 'Yes' : 'No'}
                </Toggle>
              </FormField>
            </DismissibleField>
            <DismissibleField id="dob" activeFields={activeFields}>
              <FormField label="Date of Birth"><DatePicker value={data.dob || ''} onChange={({ detail }) => onChange('dob', detail.value)} /></FormField>
            </DismissibleField>
          </ColumnLayout>
        </SpaceBetween>
      </Container>

      <Container header={<Header variant="h2">Professional Summary</Header>}>
        <DismissibleField id="summary" activeFields={activeFields}>
          <FormField label="Elevator Pitch / Summary">
            <Textarea placeholder="Brief overview of your background..." value={data.summary || ''} onChange={({ detail }) => onChange('summary', detail.value)} rows={5} />
          </FormField>
        </DismissibleField>
      </Container>

      <CustomFieldBuilder fields={customFields} onChange={onCustomFieldsChange} sectionTitle="Additional Personal Info" />
      </SpaceBetween>
    </StepWrapper>
  );
}

// ─── Step 2: Work Experience ──────────────────────────────────────────────────
function WorkExperience({ data, onChange, activeFields, onAdd, onRemove, customFields, onCustomFieldsChange }) {
  const exps = data.experiences || [];

  const updateExp = (idx, key, val) => onChange('experiences', exps.map((e, i) => i === idx ? { ...e, [key]: val } : e));
  const removeExp = (idx) => onChange('experiences', exps.filter((_, i) => i !== idx));

  return (
    <StepWrapper sections={['work']} activeFields={activeFields} onAdd={onAdd} onRemove={onRemove}>
      <SpaceBetween size="l">
        {exps.map((exp, idx) => (
        <Container key={exp.id} header={<Header variant="h2" actions={<Button variant="icon" iconName="remove" onClick={() => removeExp(idx)} />}>{exp.company || `Experience ${idx + 1}`}</Header>}>
          <SpaceBetween size="m">
            <ColumnLayout columns={2}>
              <DismissibleField id="work_company" activeFields={activeFields}><FormField label="Company Name"><Input placeholder="E.g. Apple" value={exp.company} onChange={({ detail }) => updateExp(idx, 'company', detail.value)} /></FormField></DismissibleField>
              <DismissibleField id="work_title" activeFields={activeFields}><FormField label="Job Title / Role"><Input placeholder="Software Engineer" value={exp.title} onChange={({ detail }) => updateExp(idx, 'title', detail.value)} /></FormField></DismissibleField>
            </ColumnLayout>
            <ColumnLayout columns={2}>
              <DismissibleField id="work_empType" activeFields={activeFields}>
                <FormField label="Employment Type">
                  <Select placeholder="Select type" selectedOption={exp.employmentType} onChange={({ detail }) => updateExp(idx, 'employmentType', detail.selectedOption)} options={[{ label: 'Full-time', value: 'ft' }, { label: 'Contract', value: 'c' }]} />
                </FormField>
              </DismissibleField>
              <DismissibleField id="work_location" activeFields={activeFields}><FormField label="Location"><Input placeholder="City, State" value={exp.location} onChange={({ detail }) => updateExp(idx, 'location', detail.value)} /></FormField></DismissibleField>
            </ColumnLayout>
            <ColumnLayout columns={3}>
              <DismissibleField id="work_start" activeFields={activeFields}><FormField label="Start Date"><DatePicker placeholder="YYYY/MM" value={exp.startDate} onChange={({ detail }) => updateExp(idx, 'startDate', detail.value)} /></FormField></DismissibleField>
              <DismissibleField id="work_end" activeFields={activeFields}><FormField label="End Date"><DatePicker placeholder="YYYY/MM" value={exp.endDate} onChange={({ detail }) => updateExp(idx, 'endDate', detail.value)} disabled={exp.current} /></FormField></DismissibleField>
              <DismissibleField id="work_current" activeFields={activeFields}><FormField label="Current?"><Toggle checked={exp.current} onChange={({ detail }) => updateExp(idx, 'current', detail.checked)}>Currently working here</Toggle></FormField></DismissibleField>
            </ColumnLayout>
            <DismissibleField id="work_desc" activeFields={activeFields}><FormField label="Role Description"><Textarea placeholder="Describe your responsibilities..." value={exp.description} onChange={({ detail }) => updateExp(idx, 'description', detail.value)} rows={3} /></FormField></DismissibleField>
            <DismissibleField id="work_achievements" activeFields={activeFields}><FormField label="Key Achievements"><Textarea placeholder="- Increased revenue by 25%..." value={exp.achievements} onChange={({ detail }) => updateExp(idx, 'achievements', detail.value)} rows={3} /></FormField></DismissibleField>
          </SpaceBetween>
        </Container>
      ))}
        <Button iconName="add-plus" onClick={() => onChange('experiences', [...exps, { id: Date.now() }])}>Add Work Experience</Button>
        <CustomFieldBuilder fields={customFields} onChange={onCustomFieldsChange} sectionTitle="Additional Work Experience Fields" />
      </SpaceBetween>
    </StepWrapper>
  );
}

// ─── Step 3: Education ────────────────────────────────────────────────────────
function Education({ data, onChange, activeFields, onAdd, onRemove, customFields, onCustomFieldsChange }) {
  const edus = data.education || [];
  
  const updateEdu = (idx, key, val) => onChange('education', edus.map((e, i) => i === idx ? { ...e, [key]: val } : e));
  const removeEdu = (idx) => onChange('education', edus.filter((_, i) => i !== idx));

  return (
    <StepWrapper sections={['education']} activeFields={activeFields} onAdd={onAdd} onRemove={onRemove}>
      <SpaceBetween size="l">
        {edus.map((edu, idx) => (
        <Container key={edu.id} header={<Header variant="h2" actions={<Button variant="icon" iconName="remove" onClick={() => removeEdu(idx)} />}>{edu.institution || `Education ${idx + 1}`}</Header>}>
          <SpaceBetween size="m">
            <ColumnLayout columns={2}>
              <DismissibleField id="edu_inst" activeFields={activeFields}><FormField label="Institution"><Input placeholder="E.g. Stanford University" value={edu.institution} onChange={({ detail }) => updateEdu(idx, 'institution', detail.value)} /></FormField></DismissibleField>
              <DismissibleField id="edu_degree" activeFields={activeFields}><FormField label="Degree Level"><Select placeholder="Select degree" selectedOption={edu.degree} onChange={({ detail }) => updateEdu(idx, 'degree', detail.selectedOption)} options={[{label:'Bachelors',value:'bs'},{label:'Masters',value:'ms'}]} /></FormField></DismissibleField>
            </ColumnLayout>
            <ColumnLayout columns={2}>
              <DismissibleField id="edu_field" activeFields={activeFields}><FormField label="Field of Study"><Input placeholder="Computer Science" value={edu.field} onChange={({ detail }) => updateEdu(idx, 'field', detail.value)} /></FormField></DismissibleField>
              <DismissibleField id="edu_gpa" activeFields={activeFields}><FormField label="GPA"><Input placeholder="3.8 / 4.0" value={edu.gpa} onChange={({ detail }) => updateEdu(idx, 'gpa', detail.value)} /></FormField></DismissibleField>
            </ColumnLayout>
            <ColumnLayout columns={2}>
              <DismissibleField id="edu_start" activeFields={activeFields}><FormField label="Start Date"><DatePicker placeholder="YYYY/MM" value={edu.startDate} onChange={({ detail }) => updateEdu(idx, 'startDate', detail.value)} /></FormField></DismissibleField>
              <DismissibleField id="edu_end" activeFields={activeFields}><FormField label="Graduation Date"><DatePicker placeholder="YYYY/MM" value={edu.endDate} onChange={({ detail }) => updateEdu(idx, 'endDate', detail.value)} /></FormField></DismissibleField>
            </ColumnLayout>
            <DismissibleField id="edu_coursework" activeFields={activeFields}><FormField label="Relevant Coursework"><Input placeholder="Algorithms, Data Structures..." value={edu.coursework} onChange={({ detail }) => updateEdu(idx, 'coursework', detail.value)} /></FormField></DismissibleField>
            <DismissibleField id="edu_activities" activeFields={activeFields}><FormField label="Clubs / Honors"><Textarea placeholder="Dean's List, Robotics Club..." value={edu.activities} onChange={({ detail }) => updateEdu(idx, 'activities', detail.value)} rows={2} /></FormField></DismissibleField>
          </SpaceBetween>
        </Container>
      ))}
        <Button iconName="add-plus" onClick={() => onChange('education', [...edus, { id: Date.now() }])}>Add Education</Button>
        <CustomFieldBuilder fields={customFields} onChange={onCustomFieldsChange} sectionTitle="Additional Education Fields" />
      </SpaceBetween>
    </StepWrapper>
  );
}

// ─── Step 4: Skills ───────────────────────────────────────────────────────────
function Skills({ data, onChange, activeFields, onAdd, customFields, onCustomFieldsChange, onRemove }) {
  return (
    <StepWrapper sections={['skills']} activeFields={activeFields} onAdd={onAdd} onRemove={onRemove}>
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">Technical Skills & Profile</Header>}>
        <SpaceBetween size="m">
          <DismissibleField id="skills_langs" activeFields={activeFields}><FormField label="Primary Languages"><Multiselect placeholder="Select languages..." selectedOptions={data.langs||[]} onChange={({detail})=>onChange('langs',detail.selectedOptions)} options={[{label:'Python',value:'py'},{label:'JavaScript',value:'js'}]}/></FormField></DismissibleField>
          <DismissibleField id="skills_frameworks" activeFields={activeFields}><FormField label="Frameworks"><Multiselect placeholder="Select frameworks..." selectedOptions={data.frameworks||[]} onChange={({detail})=>onChange('frameworks',detail.selectedOptions)} options={[{label:'React',value:'react'},{label:'Node.js',value:'node'}]}/></FormField></DismissibleField>
          <DismissibleField id="skills_db" activeFields={activeFields}><FormField label="Databases"><Multiselect placeholder="Select databases..." selectedOptions={data.dbs||[]} onChange={({detail})=>onChange('dbs',detail.selectedOptions)} options={[{label:'Postgres',value:'pg'}]}/></FormField></DismissibleField>
          <DismissibleField id="skills_cloud" activeFields={activeFields}><FormField label="Cloud & DevOps"><Multiselect placeholder="Select tools..." selectedOptions={data.cloud||[]} onChange={({detail})=>onChange('cloud',detail.selectedOptions)} options={[{label:'AWS',value:'aws'}]}/></FormField></DismissibleField>
          <DismissibleField id="skills_aiml" activeFields={activeFields}><FormField label="AI/ML Tools"><Multiselect placeholder="Select AI defaults..." selectedOptions={data.aiml||[]} onChange={({detail})=>onChange('aiml',detail.selectedOptions)} options={[{label:'PyTorch',value:'pt'}]}/></FormField></DismissibleField>
          <DismissibleField id="skills_other" activeFields={activeFields}><FormField label="Other Skills"><Input placeholder="HTML, CSS, Git..." value={data.other||''} onChange={({detail})=>onChange('other',detail.value)}/></FormField></DismissibleField>
          <DismissibleField id="skills_yoe" activeFields={activeFields}><FormField label={`Total Experience: ${data.yoe||0} yrs`}><Slider value={data.yoe||0} onChange={({detail})=>onChange('yoe',detail.value)} max={25}/></FormField></DismissibleField>
        </SpaceBetween>
      </Container>
        <CustomFieldBuilder fields={customFields} onChange={onCustomFieldsChange} sectionTitle="Additional Skills" />
      </SpaceBetween>
    </StepWrapper>
  );
}

// ─── Step 5: Certs & Projects ──────────────────────────────────────────────────
function CertsAndProjects({ data, onChange, activeFields, onAdd, onRemove, customFields, onCustomFieldsChange }) {
  const certs = data.certs || [];
  const projs = data.projs || [];

  const update = (arr, list, idx, key, val) => onChange(arr, list.map((x, i) => i === idx ? {...x, [key]: val} : x));
  const remove = (arr, list, idx) => onChange(arr, list.filter((_, i) => i !== idx));

  return (
    <StepWrapper sections={['certs', 'projects']} activeFields={activeFields} onAdd={onAdd} onRemove={onRemove}>
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">Certifications</Header>}>
        <SpaceBetween size="m">
          {certs.map((c, idx) => (
            <ExpandableSection key={c.id} headerText={c.name||`Cert ${idx+1}`} headerActions={<Button variant="icon" iconName="remove" onClick={()=>remove('certs',certs,idx)}/>}>
              <ColumnLayout columns={2}>
                <DismissibleField id="cert_name" activeFields={activeFields}><FormField label="Name"><Input value={c.name} onChange={({detail})=>update('certs',certs,idx,'name',detail.value)}/></FormField></DismissibleField>
                <DismissibleField id="cert_issuer" activeFields={activeFields}><FormField label="Issuer"><Input value={c.issuer} onChange={({detail})=>update('certs',certs,idx,'issuer',detail.value)}/></FormField></DismissibleField>
              </ColumnLayout>
              <ColumnLayout columns={3}>
                <DismissibleField id="cert_date" activeFields={activeFields}><FormField label="Date"><DatePicker value={c.date} onChange={({detail})=>update('certs',certs,idx,'date',detail.value)}/></FormField></DismissibleField>
                <DismissibleField id="cert_credId" activeFields={activeFields}><FormField label="Credential ID"><Input value={c.credId} onChange={({detail})=>update('certs',certs,idx,'credId',detail.value)}/></FormField></DismissibleField>
                <DismissibleField id="cert_url" activeFields={activeFields}><FormField label="URL"><Input value={c.url} onChange={({detail})=>update('certs',certs,idx,'url',detail.value)}/></FormField></DismissibleField>
              </ColumnLayout>
            </ExpandableSection>
          ))}
          <Button iconName="add-plus" onClick={()=>onChange('certs', [...certs, {id: Date.now()}])}>Add Cert</Button>
        </SpaceBetween>
      </Container>

      <Container header={<Header variant="h2">Projects</Header>}>
        <SpaceBetween size="m">
          {projs.map((p, idx) => (
            <ExpandableSection key={p.id} headerText={p.name||`Project ${idx+1}`} headerActions={<Button variant="icon" iconName="remove" onClick={()=>remove('projs',projs,idx)}/>}>
              <ColumnLayout columns={2}>
                <DismissibleField id="proj_name" activeFields={activeFields}><FormField label="Name"><Input placeholder="E.g. AI Workflow" value={p.name} onChange={({detail})=>update('projs',projs,idx,'name',detail.value)}/></FormField></DismissibleField>
                <DismissibleField id="proj_url" activeFields={activeFields}><FormField label="URL"><Input placeholder="https://github.com/..." value={p.url} onChange={({detail})=>update('projs',projs,idx,'url',detail.value)}/></FormField></DismissibleField>
              </ColumnLayout>
              <DismissibleField id="proj_stack" activeFields={activeFields}><FormField label="Tech Stack"><Input placeholder="React, Node.js..." value={p.stack} onChange={({detail})=>update('projs',projs,idx,'stack',detail.value)}/></FormField></DismissibleField>
              <DismissibleField id="proj_desc" activeFields={activeFields}><FormField label="Description"><Textarea placeholder="Built a responsive app..." value={p.desc} onChange={({detail})=>update('projs',projs,idx,'desc',detail.value)}/></FormField></DismissibleField>
              <DismissibleField id="proj_impact" activeFields={activeFields}><FormField label="Impact"><Input placeholder="Improved perf by 20%" value={p.impact} onChange={({detail})=>update('projs',projs,idx,'impact',detail.value)}/></FormField></DismissibleField>
            </ExpandableSection>
          ))}
          <Button iconName="add-plus" onClick={()=>onChange('projs', [...projs, {id: Date.now()}])}>Add Project</Button>
        </SpaceBetween>
      </Container>

        <CustomFieldBuilder fields={customFields} onChange={onCustomFieldsChange} sectionTitle="Additional Certs & Projects" />
      </SpaceBetween>
    </StepWrapper>
  );
}

// ─── Step 6: Preferences ──────────────────────────────────────────────────────
function JobPreferences({ data, onChange, activeFields, onAdd, customFields, onCustomFieldsChange, onRemove }) {
  const f = (k) => ({ value: data[k] || '', onChange: ({ detail }) => onChange(k, detail.value) });

  return (
    <StepWrapper sections={['preferences']} activeFields={activeFields} onAdd={onAdd} onRemove={onRemove}>
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">Target Profile Properties</Header>}>
        <SpaceBetween size="m">
          <DismissibleField id="pref_roles" activeFields={activeFields}><FormField label="Desired Job Titles"><Input {...f('desiredRoles')} /></FormField></DismissibleField>
          <DismissibleField id="pref_industries" activeFields={activeFields}><FormField label="Target Industries"><Multiselect onChange={({detail})=>onChange('industries', detail.selectedOptions)} selectedOptions={data.industries||[]} options={[{label:'Tech',value:'tech'}]} /></FormField></DismissibleField>
          <DismissibleField id="pref_workMode" activeFields={activeFields}><FormField label="Work Mode"><Select onChange={({detail})=>onChange('workMode', detail.selectedOption)} selectedOption={data.workMode||null} options={[{label:'Remote',value:'remote'},{label:'Hybrid',value:'hybrid'}]} /></FormField></DismissibleField>
          
          <ColumnLayout columns={2}>
            <DismissibleField id="pref_salaryMin" activeFields={activeFields}><FormField label="Min Salary"><Input {...f('salaryMin')} /></FormField></DismissibleField>
            <DismissibleField id="pref_salaryMax" activeFields={activeFields}><FormField label="Max Salary"><Input {...f('salaryMax')} /></FormField></DismissibleField>
          </ColumnLayout>
          
          <DismissibleField id="pref_empTypes" activeFields={activeFields}><FormField label="Employment Type Preference"><Multiselect onChange={({detail})=>onChange('empTypes', detail.selectedOptions)} selectedOptions={data.empTypes||[]} options={[{label:'Full-time',value:'ft'}]} /></FormField></DismissibleField>
          <DismissibleField id="pref_notice" activeFields={activeFields}><FormField label="Notice Period"><Select onChange={({detail})=>onChange('notice', detail.selectedOption)} selectedOption={data.notice||null} options={[{label:'Immediate',value:'imm'}]} /></FormField></DismissibleField>
          <DismissibleField id="pref_cover" activeFields={activeFields}><FormField label="Cover Letter Style"><Select onChange={({detail})=>onChange('cover', detail.selectedOption)} selectedOption={data.cover||null} options={[{label:'Formal',value:'formal'}]} /></FormField></DismissibleField>
          <DismissibleField id="pref_notes" activeFields={activeFields}><FormField label="Custom AutoFill Notes"><Textarea value={data.notes||''} onChange={({detail})=>onChange('notes',detail.value)} rows={3} /></FormField></DismissibleField>
          
          <ColumnLayout columns={2}>
            <DismissibleField id="pref_pause" activeFields={activeFields}><FormField label="Pause Before Submission?"><Toggle checked={data.pause!==false} onChange={({detail})=>onChange('pause',detail.checked)}>Yes</Toggle></FormField></DismissibleField>
            <DismissibleField id="pref_autoCover" activeFields={activeFields}><FormField label="Gen Cover Letter?"><Toggle checked={data.autoCover||false} onChange={({detail})=>onChange('autoCover',detail.checked)}>Yes</Toggle></FormField></DismissibleField>
          </ColumnLayout>
        </SpaceBetween>
      </Container>
        <CustomFieldBuilder fields={customFields} onChange={onCustomFieldsChange} sectionTitle="Additional Preferences" />
      </SpaceBetween>
    </StepWrapper>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProfileSetupPage() {
  // Utility for persistent state
  function usePersistedState(key, defaultValue) {
    const [state, setState] = useState(() => {
      try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : defaultValue;
      } catch { return defaultValue; }
    });
    useEffect(() => {
      localStorage.setItem(key, JSON.stringify(state));
    }, [key, state]);
    return [state, setState];
  }

  const [activeStep, setActiveStep] = usePersistedState('profile_active_step', 0);
  const [status, setStatus] = useState(null);

  // Field configurations
  const [activeFields, setActiveFields] = usePersistedState('autofill_active_fields', STANDARD_FIELDS.map(f => f.id));

  const removeField = (id) => setActiveFields(prev => prev.filter(f => f !== id));
  const addField = (id) => setActiveFields(prev => [...prev, id]);

  const updateSection = (setter) => (key, val) => setter(prev => ({ ...prev, [key]: val }));

  // Data states
  const [personal, setPersonal] = usePersistedState('profile_personal', {});
  const [workExp, setWorkExp] = usePersistedState('profile_work', { experiences: [{ id: 1 }] });
  const [education, setEducation] = usePersistedState('profile_edu', { education: [{ id: 1 }] });
  const [skills, setSkills] = usePersistedState('profile_skills', {});
  const [certsProjects, setCertsProjects] = usePersistedState('profile_certs_projs', { certs: [], projs: [] });
  const [preferences, setPreferences] = usePersistedState('profile_prefs', { pause: true });

  // Custom Fields initialized from LocalStorage (What are you automating? setup)
  useEffect(() => {
    try {
      const keys = JSON.parse(localStorage.getItem('autofill_custom_keys') || '[]');
      if (keys.length > 0) {
        setCustomPersonal(prev => {
          if (prev.length === 0) {
            return keys.map(k => ({ id: Date.now()+Math.random(), key: k, type: 'text', options: [], value: null }));
          }
          return prev;
        });
      }
    } catch(e) {}
  }, []);

  const [customPersonal, setCustomPersonal] = usePersistedState('profile_custom_personal', []);
  const [customWork, setCustomWork] = usePersistedState('profile_custom_work', []);
  const [customEducation, setCustomEducation] = usePersistedState('profile_custom_edu', []);
  const [customSkills, setCustomSkills] = usePersistedState('profile_custom_skills', []);
  const [customCerts, setCustomCerts] = usePersistedState('profile_custom_certs', []);
  const [customPrefs, setCustomPrefs] = usePersistedState('profile_custom_prefs', []);

  const profileData = {
    personal, workExp, education, skills, certsProjects, preferences,
    customFields: { personal: customPersonal, work: customWork, education: customEducation, skills: customSkills, certs: customCerts, preferences: customPrefs },
  };

  const handleSubmit = async () => {
    setStatus('saving');
    try { await axios.post(`${API}/profile`, profileData); setStatus('success'); } 
    catch(err) { setStatus('error'); }
  };

  const stepProps = { activeFields, onAdd: addField, onRemove: removeField };

  return (
    <>
      {status === 'success' && <Alert type="success" header="Saved!" dismissible onDismiss={() => setStatus(null)}>Profile saved</Alert>}
      {status === 'error' && <Alert type="error" header="Failed!" dismissible onDismiss={() => setStatus(null)}>Error saving</Alert>}
      <Wizard
        allowSkipTo={true}
        i18nStrings={{
          stepNumberLabel: n => `Step ${n}`,
          collapsedStepsLabel: (c, t) => `Step ${c} of ${t}`,
          navigationAriaLabel: 'Steps',
          cancelButton: 'Cancel',
          previousButton: 'Previous',
          nextButton: 'Next',
          submitButton: 'Save Profile',
          optional: 'optional',
        }}
        onNavigate={({ detail }) => setActiveStep(detail.requestedStepIndex)}
        onSubmit={handleSubmit}
        activeStepIndex={activeStep}
        steps={[
          { title: 'Personal Information', content: <PersonalInfo data={personal} onChange={updateSection(setPersonal)} customFields={customPersonal} onCustomFieldsChange={setCustomPersonal} {...stepProps} /> },
          { title: 'Work Experience', content: <WorkExperience data={workExp} onChange={updateSection(setWorkExp)} customFields={customWork} onCustomFieldsChange={setCustomWork} {...stepProps} /> },
          { title: 'Education', content: <Education data={education} onChange={updateSection(setEducation)} customFields={customEducation} onCustomFieldsChange={setCustomEducation} {...stepProps} /> },
          { title: 'Skills & Technologies', content: <Skills data={skills} onChange={updateSection(setSkills)} customFields={customSkills} onCustomFieldsChange={setCustomSkills} {...stepProps} /> },
          { title: 'Certifications & Projects', content: <CertsAndProjects data={certsProjects} onChange={updateSection(setCertsProjects)} customFields={customCerts} onCustomFieldsChange={setCustomCerts} {...stepProps} /> },
          { title: 'Job Preferences', content: <JobPreferences data={preferences} onChange={updateSection(setPreferences)} customFields={customPrefs} onCustomFieldsChange={setCustomPrefs} {...stepProps} /> },
          { title: 'Review & Save', content: <Alert type="success">Review your profile configuration above. Your selections and custom fields define the structure of what the AI learns about you.</Alert> },
        ]}
      />
    </>
  );
}
