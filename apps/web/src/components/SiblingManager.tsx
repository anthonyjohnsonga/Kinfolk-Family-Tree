import { useState } from 'react';
import type { SiblingDraft } from '../types';
import { ForeignTag, PersonPicker, type PersonDirectory } from './PersonPicker';

const siblingTypeOptions = [
  ['sibling', 'Sibling'],
  ['full', 'Full sibling'],
  ['half', 'Half sibling'],
  ['step', 'Step-sibling'],
  ['adopted', 'Adopted sibling'],
];
export function SiblingManager({
  directory,
  value,
  onChange,
}: {
  directory: PersonDirectory;
  value: SiblingDraft[];
  onChange: (value: SiblingDraft[]) => void;
}) {
  const [nextId, setNextId] = useState('');
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
            const person = directory.get(sibling.personId);
            return (
              <div className="sibling-row" key={sibling.personId}>
                <strong>
                  {person?.name || 'Unknown person'}
                  <ForeignTag person={person} directory={directory} />
                </strong>
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
        <PersonPicker
          label="Person to add as a sibling"
          labelHidden
          directory={directory}
          value={nextId}
          exclude={value.map((sibling) => sibling.personId)}
          onChange={setNextId}
        />
        <button type="button" onClick={add} disabled={!nextId}>
          Add sibling
        </button>
      </div>
    </section>
  );
}
