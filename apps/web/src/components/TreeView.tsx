import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Person, Tree } from '../types';
import { displayDate, inputDate, year } from '../format';
import { buildConnectorPath, computeGenerations, groupFamilies, type Point } from '../layout';

export function TreeView({ tree, onEdit }: { tree: Tree; onEdit: (person: Person) => void }) {
  const treeRef = useRef<HTMLElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const generations = useMemo(() => computeGenerations(tree.people), [tree]);
  useEffect(() => {
    const draw = () => {
      const root = treeRef.current;
      if (!root) return;
      const box = root.getBoundingClientRect();
      const next: string[] = [];
      groupFamilies(tree.people).forEach((family) => {
        const parents = family.parentIds
          .map((id) => root.querySelector<HTMLElement>(`[data-person="${CSS.escape(id)}"]`))
          .filter(Boolean) as HTMLElement[];
        const children = family.children
          .map((child) =>
            root.querySelector<HTMLElement>(`[data-person="${CSS.escape(child.id)}"]`),
          )
          .filter(Boolean) as HTMLElement[];
        if (parents.length !== family.parentIds.length || !children.length) return;
        const parentPoints = parents.map((parent) => {
          const rect = parent.getBoundingClientRect();
          return { x: rect.left - box.left + rect.width / 2, y: rect.bottom - box.top };
        });
        const childPoints = children.map((child) => {
          const rect = child.getBoundingClientRect();
          return { x: rect.left - box.left + rect.width / 2, y: rect.top - box.top };
        });
        const couple = parents.length === 2 ? parents[0].closest<HTMLElement>('.couple') : null;
        const coupleLine =
          couple && parents[1].closest('.couple') === couple
            ? couple.querySelector<HTMLElement>(':scope > span')
            : null;
        let coupleAnchor: Point | null = null;
        if (coupleLine) {
          const line = coupleLine.getBoundingClientRect();
          coupleAnchor = {
            x: line.left - box.left + line.width / 2,
            y: line.top - box.top + line.height / 2,
          };
        }
        next.push(buildConnectorPath(parentPoints, childPoints, coupleAnchor));
      });
      setPaths(next);
    };
    requestAnimationFrame(draw);
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [tree]);
  const card = (p: Person) => {
    const siblingLinks = [...p.siblingLinksA, ...p.siblingLinksB];
    const siblingNames = siblingLinks
      .map(
        (link) =>
          tree.people
            .find((x) => x.id === (link.siblingAId === p.id ? link.siblingBId : link.siblingAId))
            ?.name.split(' ')[0],
      )
      .filter(Boolean);
    return (
      <button className="person-card" data-person={p.id} key={p.id} onClick={() => onEdit(p)}>
        <b>
          {p.name
            .split(/\s+/)
            .slice(0, 2)
            .map((x) => x[0])
            .join('')}
        </b>
        <h3>{p.name}</h3>
        {p.maidenName && <em>Born {p.maidenName}</em>}
        <p>
          {year(p.birthDate)} — {p.deathDate ? year(p.deathDate) : 'present'}
        </p>
        {p.parentLinks.length > 0 && (
          <small>
            Child of{' '}
            {p.parentLinks
              .map((l) => tree.people.find((x) => x.id === l.parentId)?.name.split(' ')[0])
              .filter(Boolean)
              .join(' & ')}
          </small>
        )}
        {siblingNames.length > 0 && <small>Sibling of {siblingNames.join(' & ')}</small>}
      </button>
    );
  };
  return (
    <section
      ref={treeRef}
      className={`tree-space ${tree.backgroundStyle}`}
      style={
        {
          '--tree-bg': tree.backgroundColor,
          '--tree-color': tree.treeColor,
          '--accent': tree.accentColor,
        } as CSSProperties
      }
    >
      <div className="tree-art" />
      <svg
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        {paths.map((path, index) => (
          <path
            d={path}
            key={index}
            fill="none"
            stroke={tree.treeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      {generations.map(([n, people]) => {
        const rendered = new Set<string>();
        return (
          <div className="generation" key={n}>
            {people.map((p) => {
              if (rendered.has(p.id)) return null;
              const link = [...p.partnershipsA, ...p.partnershipsB].find(
                (x) => x.status === 'married' || x.status === 'partnered',
              );
              const partner =
                link &&
                people.find(
                  (x) => x.id === (link.partnerAId === p.id ? link.partnerBId : link.partnerAId),
                );
              rendered.add(p.id);
              if (partner) {
                rendered.add(partner.id);
                const married = link.status === 'married' || Boolean(link.marriageDate);
                return (
                  <div className="couple" key={p.id}>
                    {card(p)}
                    <span className="couple-connection">
                      <span className="couple-label">
                        <strong>{married ? 'Married' : 'Partners'}</strong>
                        {link.marriageDate && (
                          <time dateTime={inputDate(link.marriageDate)}>
                            {displayDate(link.marriageDate)}
                          </time>
                        )}
                      </span>
                    </span>
                    {card(partner)}
                  </div>
                );
              }
              return card(p);
            })}
          </div>
        );
      })}
    </section>
  );
}
