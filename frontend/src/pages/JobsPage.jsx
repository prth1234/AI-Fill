import React, { useEffect, useState } from 'react';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import TextFilter from '@cloudscape-design/components/text-filter';
import Pagination from '@cloudscape-design/components/pagination';
import axios from 'axios';

const API = 'http://localhost:4000/api';

const STATUS_COLOR = { submitted: 'green', paused: 'severity-medium', error: 'red', running: 'blue' };

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    axios.get(`${API}/jobs`)
      .then(r => setJobs(r.data || []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = jobs.filter(j =>
    j.companyName?.toLowerCase().includes(filter.toLowerCase()) ||
    j.jobTitle?.toLowerCase().includes(filter.toLowerCase()) ||
    j.url?.includes(filter)
  );
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <ContentLayout header={<Header variant="h1" description="History of all AutoFill sessions">Job Application History</Header>}>
      <Table
        loading={loading}
        loadingText="Loading job history…"
        items={paginated}
        empty={
          <Box textAlign="center" color="inherit">
            <Box variant="strong">No applications yet</Box>
            <Box variant="p">Launch your first AutoFill session to see history here.</Box>
          </Box>
        }
        filter={
          <TextFilter
            filteringText={filter}
            onChange={({ detail }) => { setFilter(detail.filteringText); setPage(1); }}
            filteringPlaceholder="Search by company, title, or URL"
          />
        }
        pagination={
          <Pagination
            currentPageIndex={page}
            pagesCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
            onChange={({ detail }) => setPage(detail.currentPageIndex)}
          />
        }
        columnDefinitions={[
          { id: 'company', header: 'Company', cell: j => j.companyName || '—' },
          { id: 'title', header: 'Job Title', cell: j => j.jobTitle || '—' },
          { id: 'platform', header: 'Platform', cell: j => j.platform || '—' },
          { id: 'status', header: 'Status', cell: j => <Badge color={STATUS_COLOR[j.status] || 'grey'}>{j.status}</Badge> },
          { id: 'date', header: 'Date', cell: j => j.createdAt ? new Date(j.createdAt).toLocaleDateString() : '—' },
          { id: 'actions', header: '', cell: j => <Button variant="icon" iconName="external" href={j.url} target="_blank" /> },
        ]}
        header={<Header counter={`(${filtered.length})` } variant='h3'>Applications</Header>}
      />
    </ContentLayout>
  );
}
