import { useState } from 'react';
import type { PartnershipDraft, Person } from '../types';

const partnershipStatusOptions = [
  ['partnered', 'Partners'],
  ['married', 'Married'],
  ['divorced', 'Divorced'],
  ['widowed', 'Widowed'],
];
export function PartnershipManager({
  people,
  value,
  onChange,
}: {
  people: Person[];
  value: PartnershipDraft[];
  onChange: (value: PartnershipDraft[]) => void;
}) {
  const [nextId, setNextId] = useState('');
  const available = people.filter(
    (person) => !value.some((partnership) => partnership.personId === person.id),
  );
  function add() {
    if (!nextId) return;
    onChange([
      ...value,
      { personId: nextId, status: 'partnered', marriageDate: '', divorceDate: '' },
    ]);
    setNextId('');
  }
  function update(personId: string, change: Partial<PartnershipDraft>) {
    onChange(
      value.map((partnership) =>
        partnership.personId === personId ? { ...partnership, ...change } : partnership,
      ),
    );
  }
  return (
    <section className="partnership-manager full">
      <h3>Spouses and partners</h3>
      {value.length ? (
        <div className="event-edit-list">
          {value.map((partnership) => {
            const person = people.find((item) => item.id === partnership.personId);
            return (
              <fieldset className="event-edit-row" key={partnership.personId}>
                <legend>{person?.name || 'Unknown person'}</legend>
                <label>
                  Status
                  <select
                    value={partnership.status}
                    onChange={(event) =>
                      update(partnership.personId, {
                        status: event.target.value,
                        ...(event.target.value === 'divorced' ? {} : { divorceDate: '' }),
                      })
                    }
                  >
                    {partnershipStatusOptions.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Marriage date
                  <input
                    type="date"
                    value={partnership.marriageDate}
                    onChange={(event) =>
                      update(partnership.personId, { marriageDate: event.target.value })
                    }
                  />
                </label>
                <label>
                  Divorce date
                  <input
                    type="date"
                    value={partnership.divorceDate}
                    disabled={partnership.status !== 'divorced'}
                    onChange={(event) =>
                      update(partnership.personId, { divorceDate: event.target.value })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="danger"
                  onClick={() =>
                    onChange(value.filter((item) => item.personId !== partnership.personId))
                  }
                >
                  Remove
                </button>
              </fieldset>
            );
          })}
        </div>
      ) : (
        <p className="relationship-empty">No spouses or partners saved.</p>
      )}
      <div className="sibling-add">
        <select
          aria-label="Person to add as a spouse or partner"
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
          Add partnership
        </button>
      </div>
    </section>
  );
}
