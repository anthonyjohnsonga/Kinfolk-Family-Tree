import { useCallback, useEffect, useId, useMemo, useState, type FocusEvent } from 'react';
import type { Person, Tree } from '../types';
import { api } from '../api';
import { formatTokenShort } from '../partialDate';
import { searchPeople } from '../search';
import { buildDirectory, mergeCandidates, toPicked, type PickedPerson } from '../directory';

// A one-letter query would match most of the database on every keystroke, so
// the server is only asked once there is something worth asking about.
const MIN_REMOTE_QUERY = 2;
const SEARCH_DELAY = 250;

// Everyone the editor can offer or name. `people` are the loaded tree's own,
// matched instantly; anyone else arrives from the search endpoint and is
// remembered so the row that now refers to them can still show their name.
export type PersonDirectory = {
  people: Person[];
  treeId: string;
  treeName: string;
  selfId?: string;
  get: (id: string) => PickedPerson | undefined;
  remember: (person: PickedPerson) => void;
};

export function usePersonDirectory(tree: Tree, selfId?: string): PersonDirectory {
  const [known, setKnown] = useState(() => buildDirectory(tree));
  // A save while the editor is open (adding a photo) replaces the tree, so fold
  // the fresh copy over the top; people picked from another tree survive it.
  useEffect(() => setKnown((prev) => new Map([...prev, ...buildDirectory(tree)])), [tree]);
  const remember = useCallback(
    (person: PickedPerson) => setKnown((prev) => new Map(prev).set(person.id, person)),
    [],
  );
  return useMemo(
    () => ({
      people: tree.people.filter((person) => person.id !== selfId),
      treeId: tree.id,
      treeName: tree.name,
      selfId,
      get: (id: string) => known.get(id),
      remember,
    }),
    [tree, selfId, known, remember],
  );
}

// Shown next to anyone who lives outside the tree being edited, because the
// name alone gives no hint that the relationship is about to cross trees.
export function ForeignTag({
  person,
  directory,
}: {
  person: PickedPerson | undefined;
  directory: PersonDirectory;
}) {
  if (!person || person.treeId === directory.treeId) return null;
  return <small className="foreign-badge">in {person.treeName}</small>;
}

// Picks one person for a relationship. Unlike the plain <select> it replaces,
// the list is not limited to the loaded tree: typing searches every tree, which
// is what makes a cross-tree relationship creatable from the UI at all.
export function PersonPicker({
  label,
  labelHidden = false,
  directory,
  value,
  exclude = [],
  onChange,
  placeholder = 'Search by name or place…',
}: {
  label: string;
  // The relationship managers already say what their picker is for, so there
  // the label is for screen readers only — as the <select> aria-label was.
  labelHidden?: boolean;
  directory: PersonDirectory;
  value: string;
  exclude?: string[];
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<PickedPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const term = query.trim();

  useEffect(() => {
    if (term.length < MIN_REMOTE_QUERY) {
      setRemote([]);
      setSearching(false);
      setError('');
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const hits = await api<PickedPerson[]>(`/api/people?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        setRemote(hits);
        setError('');
      } catch (x) {
        // An aborted request is this effect superseding itself, not a failure.
        if (!controller.signal.aborted) setError((x as Error).message);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, SEARCH_DELAY);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const candidates = useMemo(() => {
    const local = searchPeople(directory.people, query).map((person) =>
      toPicked(person, directory.treeId, directory.treeName),
    );
    return mergeCandidates(local, remote, [
      ...exclude,
      ...(directory.selfId ? [directory.selfId] : []),
    ]);
  }, [directory, query, remote, exclude]);

  const chosen = value ? directory.get(value) : undefined;
  function choose(person: PickedPerson) {
    directory.remember(person);
    onChange(person.id);
    setQuery('');
    setOpen(false);
  }
  // Closing on blur has to ignore focus moving to a result button inside the
  // picker, which would otherwise unmount the button before its click lands.
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }

  return (
    <div className="person-picker" onBlur={handleBlur}>
      <label htmlFor={inputId} className={labelHidden ? 'visually-hidden' : undefined}>
        {label}
      </label>
      {chosen || value ? (
        <div className="picker-chosen">
          <strong>{chosen?.name || 'Selected person'}</strong>
          <ForeignTag person={chosen} directory={directory} />
          <button type="button" className="secondary" onClick={() => onChange('')}>
            Change
          </button>
        </div>
      ) : (
        <input
          id={inputId}
          type="search"
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            // The picker lives inside the person form; Enter must take the top
            // result rather than submitting the whole thing half-filled.
            if (event.key === 'Enter') {
              event.preventDefault();
              if (open && candidates.length) choose(candidates[0]);
            }
          }}
        />
      )}
      {!value && open && (
        <div className="picker-results">
          {candidates.length ? (
            <ul className="people-list">
              {candidates.map((person) => (
                <li key={person.id}>
                  <button type="button" onClick={() => choose(person)}>
                    <strong>
                      {person.name}
                      <ForeignTag person={person} directory={directory} />
                    </strong>
                    {person.maidenName && <em>Born {person.maidenName}</em>}
                    <span>
                      {formatTokenShort(person.birthDateToken)} —{' '}
                      {person.deathDateToken ? formatTokenShort(person.deathDateToken) : 'present'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="relationship-empty">
              {searching ? 'Searching…' : 'Nobody matches that yet.'}
            </p>
          )}
          <p className={error ? 'error' : 'relationship-empty'} aria-live="polite">
            {error ||
              (term.length < MIN_REMOTE_QUERY
                ? 'Type a name to search your other trees too.'
                : searching
                  ? 'Searching every tree…'
                  : 'Showing matches from every tree.')}
          </p>
        </div>
      )}
    </div>
  );
}
