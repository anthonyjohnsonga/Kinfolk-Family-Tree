import { useEffect, useState, type FormEvent } from 'react';
import type { SourceRecord } from '../types';
import { api } from '../api';
import { Status } from './Status';

// The library is shared by every tree, so this modal is deliberately not given
// a tree: it opens the same way from the home screen and from inside a tree.

// The fields of a source, in the order they are asked for and displayed.
// Only the title is required — half-known sources are still worth recording.
const fields = [
  ['title', 'Title', 'Ohio, Hamilton County death certificates', 200],
  ['author', 'Author or creator', 'County registrar', 200],
  ['publication', 'Publication or reference', 'FHL microfilm 1234567, vol. 3', 300],
  ['repository', 'Where it is held', 'Cincinnati Public Library', 200],
] as const;

const summaryOf = (source: SourceRecord) =>
  [source.author, source.publication, source.repository].filter(Boolean).join(' · ');

export function SourceLibrary({ canEdit, onClose }: { canEdit: boolean; onClose: () => void }) {
  const [sources, setSources] = useState<SourceRecord[] | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Typing filters the library server-side; the debounce keeps a search from
  // firing on every keystroke. An empty box lists everything, so unlike the
  // person picker there is no minimum length.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        setError('');
        try {
          const path = query.trim()
            ? `/api/sources?q=${encodeURIComponent(query.trim())}`
            : '/api/sources';
          setSources(await api<SourceRecord[]>(path));
        } catch (x) {
          setError((x as Error).message);
        }
      })();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function reload() {
    const path = query.trim()
      ? `/api/sources?q=${encodeURIComponent(query.trim())}`
      : '/api/sources';
    setSources(await api<SourceRecord[]>(path));
  }
  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      await reload();
      setNotice(done);
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  }
  // Create and edit post the same field set; only the method and path differ.
  function submit(event: FormEvent<HTMLFormElement>, source: SourceRecord | null) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = Object.fromEntries(
      fields
        .map(([name]) => [name, String(data.get(name) ?? '').trim()])
        // A blank optional field on create is simply not sent; on edit it is
        // sent as "" so the server clears whatever was there before.
        .filter(([, value]) => source || value),
    );
    body.notes = String(data.get('notes') ?? '').trim();
    if (!source && !body.notes) delete body.notes;
    void run(
      async () => {
        await api(source ? `/api/sources/${source.id}` : '/api/sources', {
          method: source ? 'PATCH' : 'POST',
          body: JSON.stringify(body),
        });
        if (source) setEditing(null);
        else {
          form.reset();
          setAdding(false);
        }
      },
      source ? 'Source updated.' : 'Source added.',
    );
  }
  function remove(source: SourceRecord) {
    if (!confirm(`Delete the source "${source.title}"? This cannot be undone.`)) return;
    void run(async () => {
      await api(`/api/sources/${source.id}`, { method: 'DELETE' });
    }, `Deleted ${source.title}.`);
  }

  const form = (source: SourceRecord | null) => (
    <form className="source-form" onSubmit={(event) => submit(event, source)}>
      {fields.map(([name, label, placeholder, maxLength]) => (
        <label key={name}>
          <span>{label}</span>
          <input
            name={name}
            required={name === 'title'}
            maxLength={maxLength}
            placeholder={placeholder}
            defaultValue={source ? (source[name] ?? '') : ''}
            disabled={busy}
          />
        </label>
      ))}
      <label>
        <span>Notes</span>
        <textarea
          name="notes"
          rows={2}
          maxLength={2000}
          placeholder="What this source shows, and anything doubtful about it"
          defaultValue={source?.notes ?? ''}
          disabled={busy}
        />
      </label>
      <div className="source-form-actions">
        <button disabled={busy}>
          {busy ? 'Working…' : source ? 'Save changes' : 'Add source'}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => (source ? setEditing(null) : setAdding(false))}
        >
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="overlay">
      <div className="modal sources">
        <header>
          <div>
            <small>EVIDENCE</small>
            <h2>Sources</h2>
          </div>
          <button type="button" className="close" onClick={onClose} disabled={busy}>
            ×
          </button>
        </header>
        <p className="relationship-empty">
          Where your facts come from — a census page, a certificate, a headstone, an interview.
          Sources are shared by every tree, because one record often documents more than one family.
        </p>
        <input
          className="source-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search sources…"
          aria-label="Search sources"
        />
        {canEdit &&
          (adding ? (
            form(null)
          ) : (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setAdding(true)}
            >
              ＋ Add a source
            </button>
          ))}
        {error && <Status message={error} onRetry={() => void reload()} />}
        {notice && <p className="notice">{notice}</p>}
        {!sources ? (
          <div className="loading-state">
            <span />
            <p>Loading sources…</p>
          </div>
        ) : sources.length ? (
          <ul className="source-list">
            {sources.map((source) =>
              editing === source.id ? (
                <li key={source.id}>{form(source)}</li>
              ) : (
                <li key={source.id}>
                  <div>
                    <strong>{source.title}</strong>
                    {summaryOf(source) && <small>{summaryOf(source)}</small>}
                    {source.notes && <p>{source.notes}</p>}
                  </div>
                  {canEdit && (
                    <div className="source-actions">
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => setEditing(source.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        disabled={busy}
                        onClick={() => remove(source)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        ) : (
          <div className="empty-message">
            <strong>{query.trim() ? 'No matching sources' : 'No sources yet'}</strong>
            <p>
              {query.trim()
                ? 'Try a shorter search, or a word from the title or notes.'
                : canEdit
                  ? 'Add the first record you have worked from.'
                  : 'Ask an editor or administrator to add one.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
