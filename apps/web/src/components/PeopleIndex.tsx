import { useMemo, useState } from 'react';
import type { Person, Tree } from '../types';
import { year } from '../format';
import { searchPeople } from '../search';

export function PeopleIndex({
  tree,
  onSelect,
  onClose,
}: {
  tree: Tree;
  onSelect: (person: Person) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchPeople(tree.people, query), [tree, query]);
  return (
    <div className="overlay">
      <div className="modal people-index">
        <header>
          <div>
            <small>PEOPLE INDEX</small>
            <h2>Find a person</h2>
          </div>
          <button type="button" className="close" onClick={onClose}>
            ×
          </button>
        </header>
        <input
          autoFocus
          type="search"
          placeholder="Search by name, maiden name, or place…"
          aria-label="Search people"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="people-count">
          {results.length} of {tree.people.length} people
        </p>
        {results.length ? (
          <ul className="people-list">
            {results.map((person) => (
              <li key={person.id}>
                <button type="button" onClick={() => onSelect(person)}>
                  <strong>{person.name}</strong>
                  {person.maidenName && <em>Born {person.maidenName}</em>}
                  <span>
                    {year(person.birthDate)} —{' '}
                    {person.deathDate ? year(person.deathDate) : 'present'}
                    {person.birthPlace ? ` · ${person.birthPlace}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="relationship-empty">No people match your search.</p>
        )}
      </div>
    </div>
  );
}
