import { useEffect, useState, type FormEvent } from 'react';
import type { Person, Tree, TreeSummary } from '../types';
import { api } from '../api';
import { Status } from './Status';
import { TreeView } from './TreeView';
import { PersonDetails } from './PersonDetails';
import { PersonEditor } from './PersonEditor';
import { Settings } from './Settings';
import { GedcomImportButton } from './GedcomImportButton';

export function KinfolkApp({
  username,
  onLogout,
  logoutBusy,
}: {
  username: string;
  onLogout: () => void;
  logoutBusy: boolean;
}) {
  const [trees, setTrees] = useState<TreeSummary[]>([]);
  const [tree, setTree] = useState<Tree | null>(null);
  const [viewer, setViewer] = useState<Person | false>(false);
  const [editor, setEditor] = useState<Person | null | false>(false);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState('');
  const [importError, setImportError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  async function load() {
    setLoading(true);
    setError('');
    try {
      setTrees(await api<TreeSummary[]>('/api/trees'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const d = new FormData(e.currentTarget);
    try {
      const created = await api<Tree>('/api/trees', {
        method: 'POST',
        body: JSON.stringify({
          name: d.get('treeName'),
          firstPerson: { name: d.get('personName'), birthDate: d.get('birthDate') || undefined },
        }),
      });
      setTrees((current) => [
        { id: created.id, name: created.name, _count: { people: created.people.length } },
        ...current.filter((item) => item.id !== created.id),
      ]);
      setTree(created);
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    setBusy(true);
    setError('');
    setViewer(false);
    try {
      setTree(await api<Tree>(`/api/trees/${id}`));
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!tree)
    return (
      <main className="home">
        <div className="welcome">
          <div>
            <small>YOUR STORIES, YOUR FAMILY</small>
            <h1>
              Keep your family <em>close.</em>
            </h1>
            <p>Private family trees, stored on your own server.</p>
          </div>
          <section className="card">
            <h2>Create a tree</h2>
            <form onSubmit={create}>
              <input name="treeName" required placeholder="Tree name" disabled={busy} />
              <input name="personName" required placeholder="First person's name" disabled={busy} />
              <input name="birthDate" type="date" disabled={busy} />
              <button disabled={busy}>{busy ? 'Working…' : 'Create tree'}</button>
            </form>
            <hr />
            <h3>Existing trees</h3>
            {loading ? (
              <div className="loading-state">
                <span />
                <p>Connecting to your server…</p>
              </div>
            ) : error ? (
              <Status message={error} onRetry={() => void load()} />
            ) : trees.length ? (
              trees.map((t) => (
                <button
                  className="tree-row"
                  key={t.id}
                  onClick={() => void open(t.id)}
                  disabled={busy}
                >
                  <span>{t.name}</span>
                  <small>{t._count.people} people</small>
                </button>
              ))
            ) : (
              <div className="empty-message">
                <strong>No trees yet</strong>
                <p>Create your first tree using the form above.</p>
              </div>
            )}
            <hr />
            <h3>Import a tree</h3>
            <p className="relationship-empty">
              Have a GEDCOM (.ged) file from Kinfolk or another genealogy app? Import it as a new
              tree.
            </p>
            <GedcomImportButton
              label="Import GEDCOM file…"
              className="secondary"
              disabled={busy}
              onImported={(imported) => {
                setTree(imported);
                void load();
              }}
              onError={setImportError}
            />
            {importError && <Status message={importError} />}
          </section>
        </div>
      </main>
    );
  const treeChoices = trees.some((item) => item.id === tree.id)
    ? trees
    : [{ id: tree.id, name: tree.name, _count: { people: tree.people.length } }, ...trees];
  return (
    <main>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            setViewer(false);
            setTree(null);
            void load();
          }}
        >
          <i>K</i> Kinfolk
        </button>
        <nav>
          <label className="tree-switcher">
            <span>Tree</span>
            <select
              aria-label="Open or create a family tree"
              value={tree.id}
              disabled={busy}
              onChange={(event) => {
                const id = event.target.value;
                if (id === 'new') {
                  setViewer(false);
                  setTree(null);
                  void load();
                } else void open(id);
              }}
            >
              <option value="new">＋ Create a new tree</option>
              {treeChoices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => setEditor(null)}>＋ Add person</button>
          <button className="auth-logout secondary" onClick={onLogout} disabled={logoutBusy}>
            Sign out · {username}
          </button>
          <button className="secondary" onClick={() => setSettings(true)}>
            ⚙ Settings
          </button>
        </nav>
      </header>
      <section className="hero">
        <div>
          <small>FAMILY TREE</small>
          <h1>{tree.name}</h1>
          <p>Every branch holds a memory.</p>
        </div>
        <strong>
          {tree.people.length}
          <span> people</span>
        </strong>
      </section>
      {tree.people.length ? (
        <TreeView tree={tree} onEdit={(p) => setViewer(p)} />
      ) : (
        <section className="tree-space empty-tree">
          <strong>This tree is ready to grow</strong>
          <p>Add its first person to begin.</p>
          <button onClick={() => setEditor(null)}>Add first person</button>
        </section>
      )}
      {viewer && (
        <PersonDetails
          tree={tree}
          person={viewer}
          onClose={() => setViewer(false)}
          onEdit={() => {
            setEditor(viewer);
            setViewer(false);
          }}
        />
      )}
      {editor !== false && (
        <PersonEditor
          tree={tree}
          person={editor}
          onSaved={setTree}
          onClose={() => setEditor(false)}
        />
      )}{' '}
      {settings && (
        <Settings
          tree={tree}
          onSaved={setTree}
          onClose={() => setSettings(false)}
          onImported={(imported) => {
            setSettings(false);
            setViewer(false);
            setEditor(false);
            setTree(imported);
            void load();
          }}
        />
      )}
    </main>
  );
}
