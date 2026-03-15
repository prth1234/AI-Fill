import React, { useState } from 'react';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Container from '@cloudscape-design/components/container';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import Select from '@cloudscape-design/components/select';
import Multiselect from '@cloudscape-design/components/multiselect';
import Toggle from '@cloudscape-design/components/toggle';
import DatePicker from '@cloudscape-design/components/date-picker';
import RadioGroup from '@cloudscape-design/components/radio-group';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Badge from '@cloudscape-design/components/badge';
import axios from 'axios';

const API = 'http://localhost:4000/api';

const FIELD_TYPES = [
  { label: 'Short text',      value: 'text' },
  { label: 'Long text',       value: 'textarea' },
  { label: 'Number',          value: 'number' },
  { label: 'Date',            value: 'date' },
  { label: 'Dropdown',        value: 'select' },
  { label: 'Radio buttons',   value: 'radio' },
  { label: 'Yes / No toggle', value: 'toggle' },
  { label: 'Multi-select',    value: 'multiselect' },
];

const needsOptions = t => ['select', 'radio', 'multiselect'].includes(t);

function FieldValue({ field, onChange }) {
  const opts = (field.options || []).map(o => ({ label: o, value: o }));
  switch (field.type) {
    case 'text':
      return <Input value={field.value || ''} onChange={({ detail }) => onChange(detail.value)} placeholder="Enter value" />;
    case 'textarea':
      return <Textarea value={field.value || ''} onChange={({ detail }) => onChange(detail.value)} rows={3} />;
    case 'number':
      return <Input value={field.value || ''} onChange={({ detail }) => onChange(detail.value)} type="number" />;
    case 'date':
      return <DatePicker value={field.value || ''} onChange={({ detail }) => onChange(detail.value)} placeholder="YYYY/MM/DD" />;
    case 'toggle':
      return <Toggle checked={!!field.value} onChange={({ detail }) => onChange(detail.checked)}>{field.value ? 'Yes' : 'No'}</Toggle>;
    case 'select':
      return (
        <Select
          selectedOption={field.value ? { label: field.value, value: field.value } : null}
          onChange={({ detail }) => onChange(detail.selectedOption?.value || '')}
          options={opts}
          placeholder={opts.length ? 'Select an option' : 'Add options below first'}
          disabled={!opts.length}
        />
      );
    case 'radio':
      return opts.length
        ? <RadioGroup value={field.value || ''} onChange={({ detail }) => onChange(detail.value)} items={field.options.map(o => ({ value: o, label: o }))} />
        : <Box color="text-status-inactive" variant="small">Add options first</Box>;
    case 'multiselect':
      return (
        <Multiselect
          selectedOptions={Array.isArray(field.value) ? field.value.map(v => ({ label: v, value: v })) : []}
          onChange={({ detail }) => onChange(detail.selectedOptions.map(o => o.value))}
          options={opts}
          placeholder={opts.length ? 'Select options' : 'Add options below first'}
          disabled={!opts.length}
        />
      );
    default:
      return null;
  }
}

export default function CustomProfilePage() {
  const [fields, setFields] = useState([]);
  const [profileName, setProfileName] = useState('');
  const [status, setStatus] = useState(null);

  const addField = () => {
    setFields(prev => [...prev, { id: Date.now(), key: '', type: 'text', options: [], value: null }]);
  };

  const updateField = (idx, prop, val) => {
    setFields(prev => prev.map((f, i) => {
      if (i !== idx) return f;
      const updated = { ...f, [prop]: val };
      if (prop === 'type') updated.value = null;
      return updated;
    }));
  };

  const updateOptions = (idx, raw) => {
    const opts = raw.split(',').map(s => s.trim()).filter(Boolean);
    updateField(idx, 'options', opts);
  };

  const removeField = idx => setFields(prev => prev.filter((_, i) => i !== idx));

  const moveField = (idx, dir) => {
    const next = [...fields];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setFields(next);
  };

  const handleSave = async () => {
    setStatus('saving');
    try {
      const payload = {
        userId: 'default_user',
        profileType: 'custom',
        profileName: profileName || 'Custom Profile',
        fields: fields.map(({ id, ...rest }) => rest),
      };
      await axios.post(`${API}/profile`, payload);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="Define any fields you need. The AI will use them to fill forms matching your use case."
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button iconName="add-plus" onClick={addField}>Add field</Button>
              <Button
                variant="primary"
                iconName="upload"
                onClick={handleSave}
                loading={status === 'saving'}
                disabled={!fields.length}
              >
                {status === 'saving' ? 'Saving...' : 'Save profile'}
              </Button>
            </SpaceBetween>
          }
        >
          Custom Profile Builder
        </Header>
      }
    >
      <SpaceBetween size="l">
        {status === 'success' && <Alert type="success" dismissible onDismiss={() => setStatus(null)} header="Profile saved">Your custom profile is ready for the AutoFill engine.</Alert>}
        {status === 'error' && <Alert type="error" dismissible onDismiss={() => setStatus(null)} header="Save failed">Check that the backend is running on port 4000.</Alert>}

        <Container header={<Header variant="h3">Profile name</Header>}>
          <FormField label="Give this profile a name" constraintText="Helps you identify it later when you have multiple profiles">
            <Input value={profileName} onChange={({ detail }) => setProfileName(detail.value)} placeholder="e.g. Visa application, Freelance contract, Job application" />
          </FormField>
        </Container>

        <Container
          header={
            <Header
              variant="h3"
              counter={fields.length ? `(${fields.length})` : ''}
              description="Each field you add becomes a piece of context the AI can reference when filling a form"
              actions={<Button iconName="add-plus" onClick={addField}>Add field</Button>}
            >
              Profile fields
            </Header>
          }
        >
          <SpaceBetween size="m">
            {!fields.length && (
              <Box textAlign="center" padding={{ vertical: 'xl' }}>
                <SpaceBetween size="s" alignItems="center">
                  <Box variant="strong" color="text-status-inactive">No fields yet</Box>
                  <Box variant="p" color="text-status-inactive">
                    Click "Add field" to start building your profile. You can add any information — the AI will use it exactly as you specify.
                  </Box>
                  <Button iconName="add-plus" onClick={addField}>Add your first field</Button>
                </SpaceBetween>
              </Box>
            )}

            {fields.map((field, idx) => (
              <Container
                key={field.id}
                header={
                  <Header
                    variant="h3"
                    actions={
                      <SpaceBetween direction="horizontal" size="xs">
                        <Button variant="icon" iconName="angle-up" disabled={idx === 0} onClick={() => moveField(idx, -1)} />
                        <Button variant="icon" iconName="angle-down" disabled={idx === fields.length - 1} onClick={() => moveField(idx, 1)} />
                        <Button variant="icon" iconName="remove" onClick={() => removeField(idx)} />
                      </SpaceBetween>
                    }
                  >
                    <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                      {field.key || `Field ${idx + 1}`}
                      <Badge color="grey">{FIELD_TYPES.find(t => t.value === field.type)?.label || field.type}</Badge>
                    </SpaceBetween>
                  </Header>
                }
                variant="stacked"
              >
                <SpaceBetween size="m">
                  <ColumnLayout columns={2}>
                    <FormField label="Label / key" constraintText="What this piece of information represents">
                      <Input
                        value={field.key}
                        onChange={({ detail }) => updateField(idx, 'key', detail.value)}
                        placeholder="e.g. Preferred timezone, Cover letter tone, Years of experience"
                      />
                    </FormField>
                    <FormField label="Field type" constraintText="Controls how you enter and how the AI reads this value">
                      <Select
                        selectedOption={FIELD_TYPES.find(t => t.value === field.type) || null}
                        onChange={({ detail }) => updateField(idx, 'type', detail.selectedOption.value)}
                        options={FIELD_TYPES}
                        placeholder="Select type"
                      />
                    </FormField>
                  </ColumnLayout>

                  {needsOptions(field.type) && (
                    <FormField
                      label="Options"
                      constraintText="Comma-separated — each item becomes a selectable choice"
                    >
                      <Input
                        value={(field.options || []).join(', ')}
                        onChange={({ detail }) => updateOptions(idx, detail.value)}
                        placeholder="Option A, Option B, Option C"
                      />
                    </FormField>
                  )}

                  <FormField label="Value">
                    <FieldValue field={field} onChange={val => updateField(idx, 'value', val)} />
                  </FormField>
                </SpaceBetween>
              </Container>
            ))}
          </SpaceBetween>
        </Container>

        {fields.length > 0 && (
          <Container header={<Header variant="h2">Preview</Header>}>
            <ColumnLayout columns={2} variant="text-grid">
              {fields.filter(f => f.key).map(f => (
                <div key={f.id}>
                  <Box variant="awsui-key-label">{f.key}</Box>
                  <div>
                    {Array.isArray(f.value)
                      ? f.value.join(', ') || '—'
                      : typeof f.value === 'boolean'
                        ? (f.value ? 'Yes' : 'No')
                        : f.value || '—'}
                  </div>
                </div>
              ))}
            </ColumnLayout>
          </Container>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
}
