import { useRef, useState, type ChangeEvent } from 'react';
import type { PhotoMeta, Tree } from '../types';
import { api } from '../api';
import { photoUrl, preparePhoto } from '../photo';

// Manages one person's photo gallery. Every action calls the API, which returns
// the whole tree; we hand that back through onSaved and refresh the local list
// from it so the gallery stays in step with the rest of the app.
export function PhotoManager({
  personId,
  photos,
  onSaved,
}: {
  personId: string;
  photos: PhotoMeta[];
  onSaved: (tree: Tree) => void;
}) {
  const [items, setItems] = useState<PhotoMeta[]>(photos);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // The API returns the whole tree; propagate it and refresh our own list from
  // it, since the editor keeps showing the person object it opened with.
  const apply = (tree: Tree) => {
    onSaved(tree);
    setItems(tree.people.find((person) => person.id === personId)?.photos ?? []);
  };

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const prepared = await preparePhoto(file);
      apply(
        await api<Tree>(`/api/people/${personId}/photos`, {
          method: 'POST',
          body: JSON.stringify(prepared),
        }),
      );
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, body: { caption?: string | null; isPrimary?: boolean }) {
    setBusy(true);
    setError('');
    try {
      apply(await api<Tree>(`/api/photos/${id}`, { method: 'PATCH', body: JSON.stringify(body) }));
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(photo: PhotoMeta) {
    if (!confirm('Remove this photo?')) return;
    setBusy(true);
    setError('');
    try {
      apply(await api<Tree>(`/api/photos/${photo.id}`, { method: 'DELETE' }));
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="full photo-manager">
      <div className="photo-manager-head">
        <h3>Photos</h3>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? 'Working…' : 'Add photo…'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => void upload(event)}
        />
      </div>
      {error && <p className="error">{error}</p>}
      {items.length === 0 ? (
        <p className="relationship-empty">No photos yet. Add one to show it on the tree.</p>
      ) : (
        <ul className="photo-grid">
          {items.map((photo) => (
            <li key={photo.id} className={photo.isPrimary ? 'photo-item primary' : 'photo-item'}>
              <img src={photoUrl(photo)} alt={photo.caption || 'Family photo'} loading="lazy" />
              {photo.isPrimary && <span className="photo-badge">Profile</span>}
              <input
                type="text"
                defaultValue={photo.caption || ''}
                placeholder="Add a caption"
                maxLength={200}
                disabled={busy}
                onBlur={(event) => {
                  const caption = event.target.value.trim();
                  if (caption !== (photo.caption || '')) void update(photo.id, { caption });
                }}
              />
              <div className="photo-actions">
                {!photo.isPrimary && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void update(photo.id, { isPrimary: true })}
                  >
                    Make profile
                  </button>
                )}
                <button
                  type="button"
                  className="link-danger"
                  disabled={busy}
                  onClick={() => void remove(photo)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
