import { useState } from 'react';
import type { PartnershipDraft } from '../types';
import { DateField } from './DateField';
import { ForeignTag, PersonPicker, type PersonDirectory } from './PersonPicker';

const partnershipStatusOptions = [
  ['partnered', 'Partners'],
  ['married', 'Married'],
  ['divorced', 'Divorced'],
  ['widowed', 'Widowed'],
];
export function PartnershipManager({
  directory,
  value,
  onChange,
}: {
  directory: PersonDirectory;
  value: PartnershipDraft[];
  onChange: (value: PartnershipDraft[]) => void;
}) {
  const [nextId, setNextId] = useState('');
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
            const person = directory.get(partnership.personId);
            return (
              <fieldset className="event-edit-row" key={partnership.personId}>
                <legend>
                  {person?.name || 'Unknown person'}
                  <ForeignTag person={person} directory={directory} />
                </legend>
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
                <DateField
                  label="Marriage date"
                  value={partnership.marriageDate}
                  onChange={(token) => update(partnership.personId, { marriageDate: token })}
                />
                <DateField
                  label="Divorce date"
                  value={partnership.divorceDate}
                  disabled={partnership.status !== 'divorced'}
                  onChange={(token) => update(partnership.personId, { divorceDate: token })}
                />
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
        <PersonPicker
          label="Person to add as a spouse or partner"
          labelHidden
          directory={directory}
          value={nextId}
          exclude={value.map((partnership) => partnership.personId)}
          onChange={setNextId}
        />
        <button type="button" onClick={add} disabled={!nextId}>
          Add partnership
        </button>
      </div>
    </section>
  );
}
