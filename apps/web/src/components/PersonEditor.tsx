import { useState, type FormEvent } from 'react';
import type { LifeEvent, Person, SiblingDraft, Tree } from '../types';
import { api } from '../api';
import { inputDate } from '../format';
import { SiblingManager } from './SiblingManager';
import { LifeEventManager } from './LifeEventManager';

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
  const partnership = person ? [...person.partnershipsA, ...person.partnershipsB][0] : undefined;
  const partnerId = partnership
    ? partnership.partnerAId === person?.id
      ? partnership.partnerBId
      : partnership.partnerAId
    : '';
  const [selectedPartner, setSelectedPartner] = useState(partnerId);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const others = tree.people.filter((p) => p.id !== person?.id);
  const [siblings, setSiblings] = useState<SiblingDraft[]>(() =>
    person
      ? [...person.siblingLinksA, ...person.siblingLinksB].map((link) => ({
          personId: link.siblingAId === person.id ? link.siblingBId : link.siblingAId,
          type: link.type,
        }))
      : [],
  );
  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>(() =>
    person ? person.lifeEvents.map((event) => ({ ...event, date: inputDate(event.date) })) : [],
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const d = new FormData(e.currentTarget);
    const body = {
      name: d.get('name'),
      maidenName: d.get('maidenName') || undefined,
      birthDate: d.get('birthDate') || undefined,
      birthPlace: d.get('birthPlace') || undefined,
      deathDate: d.get('deathDate') || undefined,
      deathPlace: d.get('deathPlace') || undefined,
      bio: d.get('bio') || undefined,
      parentIds: [d.get('parent1'), d.get('parent2')].filter(Boolean),
      partnerId: d.get('partnerId') || undefined,
      partnershipStatus: selectedPartner ? d.get('partnershipStatus') || 'partnered' : undefined,
      marriageDate: d.get('marriageDate') || undefined,
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
          <label>
            Birth date
            <input
              name="birthDate"
              type="date"
              defaultValue={inputDate(person?.birthDate || null)}
            />
          </label>
          <label>
            Birth place
            <input name="birthPlace" maxLength={160} defaultValue={person?.birthPlace || ''} />
          </label>
          <label>
            Death date
            <input
              name="deathDate"
              type="date"
              defaultValue={inputDate(person?.deathDate || null)}
            />
          </label>
          <label>
            Death place
            <input name="deathPlace" maxLength={160} defaultValue={person?.deathPlace || ''} />
          </label>
          <h3 className="full">Parents</h3>
          <label>
            Parent 1
            <select name="parent1" defaultValue={person?.parentLinks[0]?.parentId || ''}>
              <option value="">Unknown</option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Parent 2
            <select name="parent2" defaultValue={person?.parentLinks[1]?.parentId || ''}>
              <option value="">Unknown</option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <h3 className="full">Couple</h3>
          <label>
            Spouse or partner
            <select
              name="partnerId"
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
            >
              <option value="">None</option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              name="partnershipStatus"
              defaultValue={partnership?.status || 'partnered'}
              disabled={!selectedPartner}
            >
              <option value="partnered">Partners</option>
              <option value="married">Married</option>
            </select>
          </label>
          <label>
            Marriage date
            <input
              name="marriageDate"
              type="date"
              defaultValue={inputDate(partnership?.marriageDate || null)}
              disabled={!selectedPartner}
            />
          </label>
          <span />
          <SiblingManager people={others} value={siblings} onChange={setSiblings} />
          <LifeEventManager value={lifeEvents} onChange={setLifeEvents} />
          <label className="full">
            About
            <textarea name="bio" rows={3} maxLength={2000} defaultValue={person?.bio || ''} />
          </label>
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
