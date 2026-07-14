import { useState } from 'react';
import type { Person, SiblingDraft } from '../types';

const siblingTypeOptions = [
  ['sibling', 'Sibling'],
  ['full', 'Full sibling'],
  ['half', 'Half sibling'],
  ['step', 'Step-sibling'],
  ['adopted', 'Adopted sibling'],
];
export function SiblingManager({
  people,
  value,
  onChange,
}: {
  people: Person[];
  value: SiblingDraft[];
  onChange: (value: SiblingDraft[]) => void;
}) {
  const [nextId, setNextId] = useState('');
  const available = people.filter(
    (person) => !value.some((sibling) => sibling.personId === person.id),
  );
  function add() {
    if (!nextId) return;
    onChange([...value, { personId: nextId, type: 'sibling' }]);
    setNextId('');
  }
  return (
    <section className="sibling-manager full">
      <h3>Sibling connections</h3>
      {value.length ? (
        <div className="sibling-list">
          {value.map((sibling) => {
            const person = people.find((item) => item.id === sibling.personId);
            return (
              <div className="sibling-row" key={sibling.personId}>
                <strong>{person?.name || 'Unknown person'}</strong>
                <select
                  aria-label={`Relationship type for ${person?.name || 'sibling'}`}
                  value={sibling.type}
                  onChange={(event) =>
                    onChange(
                      value.map((item) =>
                        item.personId === sibling.personId
                          ? { ...item, type: event.target.value }
                          : item,
                      ),
                    )
                  }
                >
                  {siblingTypeOptions.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="danger"
                  onClick={() =>
                    onChange(value.filter((item) => item.personId !== sibling.personId))
                  }
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="relationship-empty">No sibling connections saved.</p>
      )}
      <div className="sibling-add">
        <select
          aria-label="Person to add as a sibling"
          value={nextId}
          onChange={(event) => setNextId(event.target.value)}
        >
          <option value="">Select a person</option>
          {available.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={add} disabled={!nextId}>
          Add sibling
        </button>
      </div>
    </section>
  );
}
