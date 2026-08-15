import { useState, type FormEvent } from 'react';
import type { LifeEvent, PartnershipDraft, Person, SiblingDraft, Tree } from '../types';
import { api } from '../api';
import { PartnershipManager } from './PartnershipManager';
import { SiblingManager } from './SiblingManager';
import { LifeEventManager } from './LifeEventManager';
import { PhotoManager } from './PhotoManager';
import { DateField } from './DateField';
import { PersonPicker, usePersonDirectory } from './PersonPicker';

export function PersonEditor({
  tree,
  person,
  onSaved,
  onClose,
}: {
  tree: Tree;
  person: Person | null;
  onSaved: (tree: Tree) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const directory = usePersonDirectory(tree, person?.id);
  // Parents are picker state rather than form fields now: the picker can return
  // somebody who lives in another tree, which no <select> over this tree could.
  const [parentIds, setParentIds] = useState<[string, string]>(() => [
    person?.parentLinks[0]?.parentId || '',
    person?.parentLinks[1]?.parentId || '',
  ]);
  const setParent = (slot: 0 | 1, id: string) =>
    setParentIds((prev) => (slot === 0 ? [id, prev[1]] : [prev[0], id]));
  const [birthDate, setBirthDate] = useState(person?.birthDateToken || '');
  const [deathDate, setDeathDate] = useState(person?.deathDateToken || '');
  const [partnerships, setPartnerships] = useState<PartnershipDraft[]>(() =>
    person
      ? [...person.partnershipsA, ...person.partnershipsB].map((link) => ({
          personId: link.partnerAId === person.id ? link.partnerBId : link.partnerAId,
          status: link.status,
          marriageDate: link.marriageDateToken || '',
          divorceDate: link.divorceDateToken || '',
        }))
      : [],
  );
  const [siblings, setSiblings] = useState<SiblingDraft[]>(() =>
    person
      ? [...person.siblingLinksA, ...person.siblingLinksB].map((link) => ({
          personId: link.siblingAId === person.id ? link.siblingBId : link.siblingAId,
          type: link.type,
        }))
      : [],
  );
  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>(() =>
    person ? person.lifeEvents.map((event) => ({ ...event, date: event.dateToken || null })) : [],
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const d = new FormData(e.currentTarget);
    const body = {
      name: d.get('name'),
      maidenName: d.get('maidenName') || undefined,
      birthDate: birthDate || undefined,
      birthPlace: d.get('birthPlace') || undefined,
      deathDate: deathDate || undefined,
      deathPlace: d.get('deathPlace') || undefined,
      bio: d.get('bio') || undefined,
      parentIds: parentIds.filter(Boolean),
      partnerships: partnerships.map(({ personId, status, marriageDate, divorceDate }) => ({
        personId,
        status,
        marriageDate: marriageDate || undefined,
        divorceDate: divorceDate || undefined,
      })),
      siblings,
      lifeEvents: lifeEvents.map(({ type, date, place, description }) => ({
        type,
        date: date || undefined,
        place: place || undefined,
        description: description || undefined,
      })),
    };
    try {
      onSaved(
        await api<Tree>(person ? `/api/people/${person.id}` : `/api/trees/${tree.id}/people`, {
          method: person ? 'PATCH' : 'POST',
          body: JSON.stringify(body),
        }),
      );
      onClose();
    } catch (x) {
      setError((x as Error).message);
      setBusy(false);
    }
  }
  async function remove() {
    if (!person || !confirm(`Remove ${person.name} from this tree?`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/people/${person.id}`, { method: 'DELETE' });
      onSaved(await api<Tree>(`/api/trees/${tree.id}`));
      onClose();
    } catch (x) {
      setError((x as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="overlay">
      <form className="modal" onSubmit={submit}>
        <header>
          <div>
            <small>{person ? 'EDIT RELATIVE' : 'NEW RELATIVE'}</small>
            <h2>{person ? 'Edit person' : 'Add a person'}</h2>
          </div>
          <button type="button" className="close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="form-grid">
          <label className="full">
            Full name *<input name="name" required maxLength={80} defaultValue={person?.name} />
          </label>
          <label className="full">
            Maiden or birth surname
            <input
              name="maidenName"
              maxLength={80}
              defaultValue={person?.maidenName || ''}
              placeholder="Surname before marriage"
            />
          </label>
          <DateField label="Birth date" value={birthDate} onChange={setBirthDate} />
          <label>
            Birth place
            <input name="birthPlace" maxLength={160} defaultValue={person?.birthPlace || ''} />
          </label>
          <DateField label="Death date" value={deathDate} onChange={setDeathDate} />
          <label>
            Death place
            <input name="deathPlace" maxLength={160} defaultValue={person?.deathPlace || ''} />
          </label>
          <h3 className="full">Parents</h3>
          <PersonPicker
            label="Parent 1"
            directory={directory}
            value={parentIds[0]}
            exclude={[parentIds[1]]}
            onChange={(id) => setParent(0, id)}
          />
          <PersonPicker
            label="Parent 2"
            directory={directory}
            value={parentIds[1]}
            exclude={[parentIds[0]]}
            onChange={(id) => setParent(1, id)}
          />
          <PartnershipManager
            directory={directory}
            value={partnerships}
            onChange={setPartnerships}
          />
          <SiblingManager directory={directory} value={siblings} onChange={setSiblings} />
          <LifeEventManager value={lifeEvents} onChange={setLifeEvents} />
          <label className="full">
            About
            <textarea name="bio" rows={3} maxLength={2000} defaultValue={person?.bio || ''} />
          </label>
          {person ? (
            <PhotoManager personId={person.id} photos={person.photos} onSaved={onSaved} />
          ) : (
            <p className="full relationship-empty">Save this person to start adding photos.</p>
          )}
        </div>
        {error && <p className="error">{error}</p>}
        <footer>
          {person && (
            <button type="button" className="danger" onClick={remove}>
              Delete
            </button>
          )}
          <span />
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button>Save person</button>
        </footer>
      </form>
    </div>
  );
}
