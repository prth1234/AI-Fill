import React from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import Select from '@cloudscape-design/components/select';
import Multiselect from '@cloudscape-design/components/multiselect';
import Toggle from '@cloudscape-design/components/toggle';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Alert from '@cloudscape-design/components/alert';
import DatePicker from '@cloudscape-design/components/date-picker';
import RadioGroup from '@cloudscape-design/components/radio-group';

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
  const { type, value, options = [] } = field;
  const selectOptions = options.map(o => ({ label: o, value: o }));

  switch (type) {
    case 'text':
      return <Input value={value || ''} onChange={({ detail }) => onChange('value', detail.value)} placeholder="Enter value" />;
    case 'textarea':
      return <Textarea value={value || ''} onChange={({ detail }) => onChange('value', detail.value)} placeholder="Enter value" rows={3} />;
    case 'number':
      return <Input value={value || ''} onChange={({ detail }) => onChange('value', detail.value)} type="number" placeholder="0" />;
    case 'date':
      return <DatePicker value={value || ''} onChange={({ detail }) => onChange('value', detail.value)} placeholder="YYYY/MM/DD" />;
    case 'toggle':
      return (
        <Toggle checked={!!value} onChange={({ detail }) => onChange('value', detail.checked)}>
          {value ? 'Yes' : 'No'}
        </Toggle>
      );
    case 'select':
      return (
        <Select
          selectedOption={value ? { label: value, value } : null}
          onChange={({ detail }) => onChange('value', detail.selectedOption?.value || '')}
          options={selectOptions}
          placeholder={options.length ? 'Select an option' : 'Add options below first'}
          disabled={!options.length}
        />
      );
    case 'radio':
      return options.length
        ? <RadioGroup
            value={value || ''}
            onChange={({ detail }) => onChange('value', detail.value)}
            items={options.map(o => ({ value: o, label: o }))}
          />
        : <Box color="text-status-inactive" variant="small">Add options below to enable</Box>;
    case 'multiselect':
      return (
        <Multiselect
          selectedOptions={Array.isArray(value) ? value.map(v => ({ label: v, value: v })) : []}
          onChange={({ detail }) => onChange('value', detail.selectedOptions.map(o => o.value))}
          options={selectOptions}
          placeholder={options.length ? 'Select options' : 'Add options below first'}
          disabled={!options.length}
        />
      );
    default:
      return null;
  }
}

export default function CustomFieldBuilder({ fields = [], onChange, sectionTitle = 'Custom Fields' }) {
  const addField = () => {
    onChange([
      ...fields,
      { id: Date.now(), key: '', type: 'text', options: [], value: null },
    ]);
  };

  const updateField = (idx, prop, val) => {
    const next = fields.map((f, i) => {
      if (i !== idx) return f;
      const updated = { ...f, [prop]: val };
      // Reset value when type changes
      if (prop === 'type') updated.value = null;
      return updated;
    });
    onChange(next);
  };

  const removeField = idx => onChange(fields.filter((_, i) => i !== idx));

  const updateOptions = (idx, raw) => {
    const opts = raw.split(',').map(s => s.trim()).filter(Boolean);
    updateField(idx, 'options', opts);
  };

  return (
    <Container
      header={
        <Header
          variant="h3"
          description="Add your own fields — the AI will include them when filling forms"
          actions={
            <Button iconName="add-plus" variant="normal" onClick={addField}>
              Add custom field
            </Button>
          }
        >
          {sectionTitle}
        </Header>
      }
    >
      <SpaceBetween size="m">
        {!fields.length && (
          <Box color="text-status-inactive" textAlign="center" padding="l">
            No custom fields yet. Click "Add custom field" to build your own.
          </Box>
        )}
        {fields.map((field, idx) => (
          <Container
            key={field.id}
            header={
              <Header
                variant="h3"
                actions={
                  <Button variant="icon" iconName="remove" onClick={() => removeField(idx)} />
                }
              >
                {field.key || `Field ${idx + 1}`}
              </Header>
            }
            variant="stacked"
          >
            <SpaceBetween size="s">
              <ColumnLayout columns={2}>
                <FormField label="Field label / key">
                  <Input
                    value={field.key}
                    onChange={({ detail }) => updateField(idx, 'key', detail.value)}
                    placeholder="e.g. Preferred timezone"
                  />
                </FormField>
                <FormField label="Field type">
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
                  constraintText="Comma-separated list of choices"
                >
                  <Input
                    value={(field.options || []).join(', ')}
                    onChange={({ detail }) => updateOptions(idx, detail.value)}
                    placeholder="Option A, Option B, Option C"
                  />
                </FormField>
              )}

              <FormField label="Value">
                <FieldValue field={field} onChange={(prop, val) => updateField(idx, prop, val)} />
              </FormField>
            </SpaceBetween>
          </Container>
        ))}
      </SpaceBetween>
    </Container>
  );
}
