import { Fragment, useState } from 'react';
import type { Person, Tree } from '../types';
import { formatToken } from '../partialDate';
import { ancestryLeavesTree, describeRelationship } from '../relationship';
import { photoUrl, primaryPhoto } from '../photo';
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
  const profile = primaryPhoto(person.photos);
  const gallery = person.photos.filter((photo) => photo.id !== profile?.id);
  const siblings = names(
    [...person.siblingLinksA, ...person.siblingLinksB].map((link) =>
      link.siblingAId === person.id ? link.siblingBId : link.siblingAId,
    ),
  );
  // Each entry keeps the resolved ISO date for chronological sorting and the
  // original token for display, so partial dates read as entered.
  const timeline = [
    ...(person.birthDateToken || person.birthPlace
      ? [
          {
            type: 'Birth',
            sort: person.birthDate,
            token: person.birthDateToken,
            place: person.birthPlace,
            description: null,
          },
        ]
      : []),
    ...partnerships.flatMap(({ partnership, partner }) => [
      ...(partnership.marriageDateToken
        ? [
            {
              type: 'Marriage',
              sort: partnership.marriageDate,
              token: partnership.marriageDateToken,
              place: null,
              description: `Married ${partner!.name}`,
            },
          ]
        : []),
      ...(partnership.divorceDateToken
        ? [
            {
              type: 'Divorce',
              sort: partnership.divorceDate,
              token: partnership.divorceDateToken,
              place: null,
              description: `Divorced ${partner!.name}`,
            },
          ]
        : []),
    ]),
    ...person.lifeEvents.map((event) => ({
      type: eventLabel(event.type),
      sort: event.date,
      token: event.dateToken ?? null,
      place: event.place,
      description: event.description,
    })),
    ...(person.deathDateToken || person.deathPlace
      ? [
          {
            type: 'Death',
            sort: person.deathDate,
            token: person.deathDateToken,
            place: person.deathPlace,
            description: null,
          },
        ]
      : []),
  ].sort((left, right) => (left.sort || '9999').localeCompare(right.sort || '9999'));
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
        {profile && (
          <figure className="detail-portrait">
            <img src={photoUrl(profile)} alt={profile.caption || person.name} />
            {profile.caption && <figcaption>{profile.caption}</figcaption>}
          </figure>
        )}
        <div className="detail-facts">
          <div>
            <span>Born</span>
            <strong>
              {person.birthDateToken ? formatToken(person.birthDateToken) : 'Unknown date'}
            </strong>
            {person.birthPlace && <p>{person.birthPlace}</p>}
          </div>
          <div>
            <span>Died</span>
            <strong>
              {person.deathDateToken ? formatToken(person.deathDateToken) : 'Living or unknown'}
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
                  {partnership.marriageDateToken
                    ? ` · Married ${formatToken(partnership.marriageDateToken)}`
                    : ''}
                  {partnership.divorceDateToken
                    ? ` · Divorced ${formatToken(partnership.divorceDateToken)}`
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
                <li key={`${event.type}-${event.sort || index}-${index}`}>
                  <time>{event.token ? formatToken(event.token) : 'Date unknown'}</time>
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
        {gallery.length > 0 && (
          <section className="detail-section">
            <h3>Photos</h3>
            <ul className="detail-gallery">
              {gallery.map((photo) => (
                <li key={photo.id}>
                  <img src={photoUrl(photo)} alt={photo.caption || person.name} loading="lazy" />
                  {photo.caption && <span>{photo.caption}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
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
              <>
                <p className="relationship-result">
                  {describeRelationship(tree.people, person.id, relativeId)}
                </p>
                {ancestryLeavesTree(tree.people, person.id, relativeId) && (
                  <p className="caveat">
                    One of these family lines continues in another tree. This answer is worked out
                    from “{tree.name}” alone, so a relationship that runs through someone in another
                    tree is not counted.
                  </p>
                )}
              </>
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
