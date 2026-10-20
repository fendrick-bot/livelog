import { Feather } from 'lucide-react';
import { useState } from 'react';
import { useLogs } from '../api/logs';
import { ButtonLink } from '../components/diary/Button';
import { EmptyState, InkLoader, Pagination, SectionTitle } from '../components/diary/Feedback';
import { Paper } from '../components/diary/Paper';
import { LogGrid } from '../components/logs/LogCard';

export default function CommunityPage() {
  const [page, setPage] = useState(1);
  const logs = useLogs({ kind: 'community', page, pageSize: 12 });

  return (
    <div>
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <SectionTitle eyebrow="Community" title="Pages from other diaries">
          Readers wrote these and trusted me to share them. Every like and note reaches the person
          who wrote it.
        </SectionTitle>
        <ButtonLink
          to="/share-your-story"
          variant="wax"
          icon={<Feather className="size-4" />}
          className="mb-6 self-start md:self-auto"
        >
          Share yours
        </ButtonLink>
      </div>
      {logs.isPending ? (
        <InkLoader className="text-paper/70" />
      ) : !logs.data || logs.data.items.length === 0 ? (
        <Paper className="mx-auto max-w-xl">
          <EmptyState
            title="No stories yet"
            action={<ButtonLink to="/share-your-story">Be the first</ButtonLink>}
          >
            When a reader's story is accepted, it will be pinned here.
          </EmptyState>
        </Paper>
      ) : (
        <>
          <LogGrid logs={logs.data.items} variant="note" />
          <div className="text-paper/80 [&_*]:text-paper/80">
            <Pagination
              page={logs.data.page}
              totalPages={logs.data.totalPages}
              onChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
