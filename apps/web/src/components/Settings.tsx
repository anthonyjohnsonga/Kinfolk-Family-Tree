import { useState, type FormEvent } from 'react';
import type { SessionUser, Tree } from '../types';
import { api } from '../api';
import { Status } from './Status';
import { GedcomImportButton } from './GedcomImportButton';
import { UserManager } from './UserManager';
import { AccountPanel } from './AccountPanel';

type SettingsTab = 'design' | 'data' | 'account' | 'users';

export function Settings({
  tree,
  user,
  onSaved,
  onImported,
  onPrint,
  onClose,
}: {
  tree: Tree;
  user: SessionUser;
  onSaved: (tree: Tree) => void;
  onImported: (tree: Tree) => void;
  onPrint: () => void;
  onClose: () => void;
}) {
  const canEdit = user.role !== 'viewer';
  const isAdmin = user.role === 'admin';
  const [tab, setTab] = useState<SettingsTab>(canEdit ? 'design' : 'data');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  function open(next: SettingsTab) {
    setTab(next);
    setError('');
    setNotice('');
  }
  async function submitDesign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const d = new FormData(e.currentTarget);
    try {
      onSaved(
        await api<Tree>(`/api/trees/${tree.id}`, {
          method: 'PATCH',
          body: JSON.stringify(Object.fromEntries(d)),
        }),
      );
      onClose();
    } catch (x) {
      setError((x as Error).message);
      setBusy(false);
    }
  }
  async function exportGedcom() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const file = await api<{ filename: string; gedcom: string }>(`/api/trees/${tree.id}/gedcom`);
      const url = URL.createObjectURL(new Blob([file.gedcom], { type: 'text/plain' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice(`Exported ${file.filename}.`);
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay">
      <div className="modal settings">
        <header>
          <div>
            <small>TREE SETTINGS</small>
            <h2>Settings</h2>
          </div>
          <button type="button" className="close" onClick={onClose} disabled={busy}>
            ×
          </button>
        </header>
        <div className="settings-tabs" role="tablist">
          {canEdit && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'design'}
              className={tab === 'design' ? '' : 'secondary'}
              onClick={() => open('design')}
            >
              Design
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'data'}
            className={tab === 'data' ? '' : 'secondary'}
            onClick={() => open('data')}
          >
            {canEdit ? 'Export & import' : 'Export'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'account'}
            className={tab === 'account' ? '' : 'secondary'}
            onClick={() => open('account')}
          >
            Account
          </button>
          {isAdmin && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'users'}
              className={tab === 'users' ? '' : 'secondary'}
              onClick={() => open('users')}
            >
              Users
            </button>
          )}
        </div>
        {tab === 'users' ? (
          <UserManager me={user} />
        ) : tab === 'account' ? (
          <AccountPanel />
        ) : tab === 'design' ? (
          <form onSubmit={submitDesign}>
            <div className="form-grid">
              <label className="full">
                Style
                <select name="backgroundStyle" defaultValue={tree.backgroundStyle} disabled={busy}>
                  <option value="botanical">Botanical</option>
                  <option value="classic">Classic</option>
                  <option value="minimal">Minimal</option>
                </select>
              </label>
              <label>
                Background
                <input
                  name="backgroundColor"
                  type="color"
                  defaultValue={tree.backgroundColor}
                  disabled={busy}
                />
              </label>
              <label>
                Tree and links
                <input
                  name="treeColor"
                  type="color"
                  defaultValue={tree.treeColor}
                  disabled={busy}
                />
              </label>
              <label>
                Couple accent
                <input
                  name="accentColor"
                  type="color"
                  defaultValue={tree.accentColor}
                  disabled={busy}
                />
              </label>
            </div>
            {error && <Status message={error} />}
            <footer>
              <span />
              <button type="button" className="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button disabled={busy}>{busy ? 'Saving…' : 'Save design'}</button>
            </footer>
          </form>
        ) : (
          <div className="data-panel">
            <section>
              <h3>Export this tree</h3>
              <p>
                Download “{tree.name}” as a GEDCOM (.ged) file, the standard genealogy exchange
                format. It includes people, relationships, marriages, divorces, and life events.
              </p>
              <button type="button" onClick={exportGedcom} disabled={busy}>
                {busy ? 'Working…' : 'Download GEDCOM file'}
              </button>
            </section>
            <section>
              <h3>Print a poster</h3>
              <p>
                Print the tree — or save it as a PDF — scaled to fit one landscape page. Focus the
                tree on a person first to print just their branch.
              </p>
              <button
                type="button"
                className="secondary"
                onClick={onPrint}
                disabled={busy || !tree.people.length}
              >
                Print or save as PDF…
              </button>
            </section>
            {canEdit && (
              <section>
                <h3>Import a tree</h3>
                <p>
                  Import a GEDCOM file as a new tree. Existing trees are never changed by an import.
                </p>
                <GedcomImportButton
                  label="Choose GEDCOM file…"
                  className="secondary"
                  disabled={busy}
                  onImported={onImported}
                  onError={(message) => {
                    setError(message);
                    setNotice('');
                  }}
                />
              </section>
            )}
            {error && <Status message={error} />}
            {notice && <p className="notice">{notice}</p>}
            <footer>
              <span />
              <button type="button" className="secondary" onClick={onClose} disabled={busy}>
                Close
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
