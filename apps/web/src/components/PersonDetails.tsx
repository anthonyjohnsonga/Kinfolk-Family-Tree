import { Fragment, useState } from 'react';
import type { Person, Tree } from '../types';
import { displayDate } from '../format';
import { describeRelationship } from '../relationship';
import { eventLabel } from './LifeEventManager';

export function PersonDetails({
  tree,
  person,
  canEdit,
  onEdit,
  onFocus,
  onClose,
}: {
  tree: Tree;
  person: Person;
  canEdit: boolean;
  onEdit: () => void;
  onFocus: () => void;
  onClose: () => void;
}) {
  const [relativeId, setRelativeId] = useState('');
  const others = [...tree.people]
    .filter((candidate) => candidate.id !== person.id)
    .sort((left, right) => left.name.localeCompare(right.name));
  const names = (ids: string[]) =>
    ids
      .map((id) => tree.people.find((candidate) => candidate.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  const parents = names(person.parentLinks.map((link) => link.parentId));
  const partnerships = [...person.partnershipsA, ...person.partnershipsB]
    .map((partnership) => ({
      partnership,
      partner: tree.people.find(
        (candidate) =>
          candidate.id ===
          (partnership.partnerAId === person.id ? partnership.partnerBId : partnership.partnerAId),
      ),
    }))
    .filter((entry) => entry.partner);
  const partnershipTitle = (status: string) =>
    status === 'married'
      ? 'Spouse'
      : status === 'divorced'
        ? 'Former spouse'
        : status === 'widowed'
          ? 'Late spouse'
          : 'Partner';
  const siblings = names(
    [...person.siblingLinksA, ...person.siblingLinksB].map((link) =>
      link.siblingAId === person.id ? link.siblingBId : link.siblingAId,
    ),
  );
  const timeline = [
    ...(person.birthDate || person.birthPlace
      ? [{ type: 'Birth', date: person.birthDate, place: person.birthPlace, description: null }]
      : []),
    ...partnerships.flatMap(({ partnership, partner }) => [
      ...(partnership.marriageDate
        ? [
            {
              type: 'Marriage',
              date: partnership.marriageDate,
              place: null,
              description: `Married ${partner!.name}`,
            },
          ]
        : []),
      ...(partnership.divorceDate
        ? [
            {
              type: 'Divorce',
              date: partnership.divorceDate,
              place: null,
              description: `Divorced ${partner!.name}`,
            },
          ]
        : []),
    ]),
    ...person.lifeEvents.map((event) => ({
      type: eventLabel(event.type),
      date: event.date,
      place: event.place,
      description: event.description,
    })),
    ...(person.deathDate || person.deathPlace
      ? [{ type: 'Death', date: person.deathDate, place: person.deathPlace, description: null }]
      : []),
  ].sort((left, right) => (left.date || '9999').localeCompare(right.date || '9999'));
  return (
    <div className="overlay">
      <article className="modal person-details">
        <header>
          <div>
            <small>PERSON DETAILS</small>
            <h2>{person.name}</h2>
            {person.maidenName && <p>Born {person.maidenName}</p>}
          </div>
          <button type="button" className="close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="detail-facts">
          <div>
            <span>Born</span>
            <strong>{person.birthDate ? displayDate(person.birthDate) : 'Unknown date'}</strong>
            {person.birthPlace && <p>{person.birthPlace}</p>}
          </div>
          <div>
            <span>Died</span>
            <strong>
              {person.deathDate ? displayDate(person.deathDate) : 'Living or unknown'}
            </strong>
            {person.deathPlace && <p>{person.deathPlace}</p>}
          </div>
        </div>
        {person.bio && (
          <section className="detail-section">
            <h3>About</h3>
            <p>{person.bio}</p>
          </section>
        )}
        <section className="detail-section">
          <h3>Relationships</h3>
          <dl>
            {parents && (
              <>
                <dt>Parents</dt>
                <dd>{parents}</dd>
              </>
            )}
            {partnerships.map(({ partnership, partner }) => (
              <Fragment key={partnership.partnerAId + partnership.partnerBId}>
                <dt>{partnershipTitle(partnership.status)}</dt>
                <dd>
                  {partner!.name}
                  {partnership.marriageDate
                    ? ` · Married ${displayDate(partnership.marriageDate)}`
                    : ''}
                  {partnership.divorceDate
                    ? ` · Divorced ${displayDate(partnership.divorceDate)}`
                    : ''}
                </dd>
              </Fragment>
            ))}
            {siblings && (
              <>
                <dt>Siblings</dt>
                <dd>{siblings}</dd>
              </>
            )}
          </dl>
          {!parents && !partnerships.length && !siblings && <p>No relationships recorded.</p>}
        </section>
        <section className="detail-section">
          <h3>Life timeline</h3>
          {timeline.length ? (
            <ol className="life-timeline">
              {timeline.map((event, index) => (
                <li key={`${event.type}-${event.date || index}-${index}`}>
                  <time>{event.date ? displayDate(event.date) : 'Date unknown'}</time>
                  <div>
                    <strong>{event.type}</strong>
                    {event.place && <p>{event.place}</p>}
                    {event.description && <p>{event.description}</p>}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p>No life events recorded.</p>
          )}
        </section>
        {others.length > 0 && (
          <section className="detail-section">
            <h3>Relationship calculator</h3>
            <label className="relationship-picker">
              How is {person.name} related to…
              <select
                aria-label="Person to compare with"
                value={relativeId}
                onChange={(event) => setRelativeId(event.target.value)}
              >
                <option value="">Select a person</option>
                {others.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
            {relativeId && (
              <p className="relationship-result">
                {describeRelationship(tree.people, person.id, relativeId)}
              </p>
            )}
          </section>
        )}
        <footer>
          <button type="button" className="secondary" onClick={onFocus}>
            Focus tree
          </button>
          <span />
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
          {canEdit && (
            <button type="button" onClick={onEdit}>
              Edit person
            </button>
          )}
        </footer>
      </article>
    </div>
  );
}
