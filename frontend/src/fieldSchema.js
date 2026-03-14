export const STANDARD_FIELDS = [
  // Personal Info
  { id: 'firstName', label: 'First Name', section: 'personal' },
  { id: 'lastName', label: 'Last Name', section: 'personal' },
  { id: 'email', label: 'Email Address', section: 'personal' },
  { id: 'phone', label: 'Phone Number', section: 'personal' },
  { id: 'linkedin', label: 'LinkedIn URL', section: 'personal' },
  { id: 'github', label: 'GitHub / Portfolio URL', section: 'personal' },
  { id: 'website', label: 'Personal Website', section: 'personal' },
  { id: 'city', label: 'City', section: 'personal' },
  { id: 'state', label: 'State / Province', section: 'personal' },
  { id: 'country', label: 'Country', section: 'personal' },
  { id: 'zipcode', label: 'ZIP / Postal Code', section: 'personal' },
  { id: 'workAuth', label: 'Work Authorization', section: 'personal' },
  { id: 'willingToRelocate', label: 'Willing to Relocate', section: 'personal' },
  { id: 'dob', label: 'Date of Birth', section: 'personal' },
  { id: 'summary', label: 'Professional Summary', section: 'personal' },

  // Work Experience (applied to each entry)
  { id: 'work_company', label: 'Company Name', section: 'work' },
  { id: 'work_title', label: 'Job Title / Role', section: 'work' },
  { id: 'work_empType', label: 'Employment Type', section: 'work' },
  { id: 'work_location', label: 'Location', section: 'work' },
  { id: 'work_start', label: 'Start Date', section: 'work' },
  { id: 'work_end', label: 'End Date', section: 'work' },
  { id: 'work_current', label: 'Currently Working Here', section: 'work' },
  { id: 'work_desc', label: 'Role Description', section: 'work' },
  { id: 'work_achievements', label: 'Key Achievements', section: 'work' },

  // Education (applied to each entry)
  { id: 'edu_inst', label: 'Institution Name', section: 'education' },
  { id: 'edu_degree', label: 'Degree Level', section: 'education' },
  { id: 'edu_field', label: 'Field of Study / Major', section: 'education' },
  { id: 'edu_gpa', label: 'GPA', section: 'education' },
  { id: 'edu_start', label: 'Start Date', section: 'education' },
  { id: 'edu_end', label: 'Graduation Date', section: 'education' },
  { id: 'edu_coursework', label: 'Relevant Coursework', section: 'education' },
  { id: 'edu_activities', label: 'Clubs / Honors', section: 'education' },

  // Skills
  { id: 'skills_langs', label: 'Primary Languages', section: 'skills' },
  { id: 'skills_frameworks', label: 'Frameworks / Libraries', section: 'skills' },
  { id: 'skills_db', label: 'Databases / Stores', section: 'skills' },
  { id: 'skills_cloud', label: 'Cloud & DevOps', section: 'skills' },
  { id: 'skills_aiml', label: 'AI / ML Tools', section: 'skills' },
  { id: 'skills_other', label: 'Other Skills', section: 'skills' },
  { id: 'skills_yoe', label: 'Total Years Experience', section: 'skills' },
  { id: 'skills_languages', label: 'Languages Spoken', section: 'skills' },

  // Certs & Projects
  { id: 'cert_name', label: 'Certification Name', section: 'certs' },
  { id: 'cert_issuer', label: 'Issuing Organization', section: 'certs' },
  { id: 'cert_date', label: 'Issue Date', section: 'certs' },
  { id: 'cert_credId', label: 'Credential ID', section: 'certs' },
  { id: 'cert_url', label: 'Credential URL', section: 'certs' },
  { id: 'proj_name', label: 'Project Name', section: 'projects' },
  { id: 'proj_url', label: 'Project URL', section: 'projects' },
  { id: 'proj_stack', label: 'Tech Stack Used', section: 'projects' },
  { id: 'proj_desc', label: 'Description', section: 'projects' },
  { id: 'proj_impact', label: 'Impact / Results', section: 'projects' },

  // Preferences
  { id: 'pref_roles', label: 'Desired Job Titles', section: 'preferences' },
  { id: 'pref_industries', label: 'Target Industries', section: 'preferences' },
  { id: 'pref_workMode', label: 'Work Mode Preference', section: 'preferences' },
  { id: 'pref_salaryMin', label: 'Minimum Expected Salary', section: 'preferences' },
  { id: 'pref_salaryMax', label: 'Target Salary', section: 'preferences' },
  { id: 'pref_empTypes', label: 'Employment Type Preference', section: 'preferences' },
  { id: 'pref_notice', label: 'Notice Period', section: 'preferences' },
  { id: 'pref_cover', label: 'Cover Letter Style', section: 'preferences' },
  { id: 'pref_notes', label: 'Custom AutoFill Notes', section: 'preferences' },
  { id: 'pref_pause', label: 'Pause Before Submitting', section: 'preferences' },
  { id: 'pref_autoCover', label: 'Auto-generate Cover Letter', section: 'preferences' },
];

export const TEMPLATES = {
  general: {
    id: 'general',
    label: 'Standard Job Profile',
    fields: STANDARD_FIELDS.map(f => f.id),
  },
  swe: {
    id: 'swe',
    label: 'Software Engineer',
    fields: [
      'firstName', 'lastName', 'email', 'phone', 'linkedin', 'github', 'city', 'state', 'workAuth',
      'work_company', 'work_title', 'work_start', 'work_current', 'work_end', 'work_desc', 'work_achievements',
      'edu_inst', 'edu_degree', 'edu_field', 'edu_end',
      'skills_langs', 'skills_frameworks', 'skills_db', 'skills_cloud', 'skills_yoe',
      'proj_name', 'proj_url', 'proj_stack', 'proj_desc',
      'pref_roles', 'pref_salaryMin', 'pref_workMode'
    ]
  },
  de: {
    id: 'de',
    label: 'Data Engineer',
    fields: [
      'firstName', 'lastName', 'email', 'phone', 'linkedin', 'github', 'city', 'country', 'workAuth',
      'work_company', 'work_title', 'work_start', 'work_current', 'work_end', 'work_desc', 'work_achievements',
      'edu_inst', 'edu_degree', 'edu_field', 'edu_end',
      'skills_langs', 'skills_db', 'skills_cloud', 'skills_aiml', 'skills_yoe',
      'cert_name', 'cert_issuer', 'cert_date',
      'pref_roles', 'pref_salaryMin', 'pref_workMode'
    ]
  },
  minimal: {
    id: 'minimal',
    label: 'Minimal / Custom Profile',
    fields: ['firstName', 'lastName', 'email', 'phone', 'summary'],
  }
};
