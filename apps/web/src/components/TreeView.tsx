import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Person, Tree } from '../types';
import { displayDate, inputDate, year } from '../format';
import {
  buildConnectorPath,
  computeGenerations,
  focusPeople,
  groupFamilies,
  type Point,
} from '../layout';

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

type View = { x: number; y: number; scale: number };
const HOME_VIEW: View = { x: 0, y: 0, scale: 1 };

export function TreeView({
  tree,
  focusId,
  printMode = false,
  onEdit,
  onClearFocus,
}: {
  tree: Tree;
  focusId: string | null;
  printMode?: boolean;
  onEdit: (person: Person) => void;
  onClearFocus: () => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [view, setView] = useState<View>(HOME_VIEW);
  const [printBox, setPrintBox] = useState({ scale: 1, height: 0 });
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const dragged = useRef(false);
  const focusPerson = focusId ? tree.people.find((person) => person.id === focusId) : undefined;
  const visible = useMemo(
    () => (focusPerson ? focusPeople(tree.people, focusPerson.id) : tree.people),
    [tree, focusPerson],
  );
  const generations = useMemo(() => computeGenerations(visible), [visible]);
  useEffect(() => {
    setView(HOME_VIEW);
  }, [tree.id, focusId]);
  // Fit the whole tree into the space left below the heading on common Letter
  // and A4 landscape pages. offsetWidth/Height ignore transforms, so this
  // stays stable once the scale is applied.
  useEffect(() => {
    if (!printMode) {
      setPrintBox({ scale: 1, height: 0 });
      return;
    }
    const frame = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, 960 / canvas.offsetWidth, 600 / canvas.offsetHeight);
      setPrintBox({ scale, height: canvas.offsetHeight * scale });
    });
    return () => cancelAnimationFrame(frame);
  }, [printMode, visible]);
  useEffect(() => {
    const scale = printMode ? printBox.scale : view.scale;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const box = canvas.getBoundingClientRect();
      const next: string[] = [];
      groupFamilies(visible).forEach((family) => {
        const parents = family.parentIds
          .map((id) => canvas.querySelector<HTMLElement>(`[data-person="${CSS.escape(id)}"]`))
          .filter(Boolean) as HTMLElement[];
        const children = family.children
          .map((child) =>
            canvas.querySelector<HTMLElement>(`[data-person="${CSS.escape(child.id)}"]`),
          )
          .filter(Boolean) as HTMLElement[];
        if (parents.length !== family.parentIds.length || !children.length) return;
        const parentPoints = parents.map((parent) => {
          const rect = parent.getBoundingClientRect();
          return {
            x: (rect.left - box.left + rect.width / 2) / scale,
            y: (rect.bottom - box.top) / scale,
          };
        });
        const childPoints = children.map((child) => {
          const rect = child.getBoundingClientRect();
          return {
            x: (rect.left - box.left + rect.width / 2) / scale,
            y: (rect.top - box.top) / scale,
          };
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
            x: (line.left - box.left + line.width / 2) / scale,
            y: (line.top - box.top + line.height / 2) / scale,
          };
        }
        next.push(buildConnectorPath(parentPoints, childPoints, coupleAnchor));
      });
      setPaths(next);
    };
    requestAnimationFrame(draw);
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [visible, view.scale, printMode, printBox.scale]);
  useEffect(() => {
    if (printMode) return;
    const section = sectionRef.current;
    if (!section) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = section.getBoundingClientRect();
      const originX = event.clientX - rect.left;
      const originY = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setView((current) => {
        const scale = clampScale(current.scale * factor);
        const ratio = scale / current.scale;
        return {
          scale,
          x: originX - (originX - current.x) * ratio,
          y: originY - (originY - current.y) * ratio,
        };
      });
    };
    // React registers wheel listeners passively, so zooming attaches natively
    // to be able to call preventDefault and stop the page from scrolling.
    section.addEventListener('wheel', onWheel, { passive: false });
    return () => section.removeEventListener('wheel', onWheel);
  }, [printMode]);
  function zoomFromCenter(factor: number) {
    const rect = sectionRef.current?.getBoundingClientRect();
    if (!rect) return;
    const originX = rect.width / 2;
    const originY = rect.height / 2;
    setView((current) => {
      const scale = clampScale(current.scale * factor);
      const ratio = scale / current.scale;
      return {
        scale,
        x: originX - (originX - current.x) * ratio,
        y: originY - (originY - current.y) * ratio,
      };
    });
  }
  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.tree-controls, .focus-banner')) return;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
    };
    dragged.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) dragged.current = true;
    if (dragged.current)
      setView((current) => ({
        ...current,
        x: state.originX + deltaX,
        y: state.originY + deltaY,
      }));
  }
  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }
  // After a pan, swallow the click so releasing over a person card does not
  // open that person.
  function onClickCapture(event: ReactMouseEvent<HTMLElement>) {
    if (!dragged.current) return;
    event.preventDefault();
    event.stopPropagation();
    dragged.current = false;
  }
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
  const treeVars = {
    '--tree-bg': tree.backgroundColor,
    '--tree-color': tree.treeColor,
    '--accent': tree.accentColor,
  } as CSSProperties;
  const canvasContent = (
    <>
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
    </>
  );
  if (printMode)
    return (
      <section className={`tree-space print-mode ${tree.backgroundStyle}`} style={treeVars}>
        <div className="print-header">
          <h1>{tree.name}</h1>
          <p>
            {focusPerson ? `The family of ${focusPerson.name} · ` : ''}Kinfolk family tree ·{' '}
            {new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}
          </p>
        </div>
        <div style={printBox.height ? { height: printBox.height, overflow: 'hidden' } : undefined}>
          <div
            ref={canvasRef}
            className="tree-canvas"
            style={{ transform: `scale(${printBox.scale})` }}
          >
            {canvasContent}
          </div>
        </div>
      </section>
    );
  return (
    <section
      ref={sectionRef}
      className={`tree-space ${tree.backgroundStyle}`}
      style={treeVars}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
    >
      <div
        ref={canvasRef}
        className="tree-canvas"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      >
        {canvasContent}
      </div>
      <div className="tree-controls">
        <button type="button" aria-label="Zoom in" onClick={() => zoomFromCenter(1.25)}>
          ＋
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomFromCenter(0.8)}>
          −
        </button>
        <button type="button" aria-label="Reset view" onClick={() => setView(HOME_VIEW)}>
          ⌂
        </button>
      </div>
      {focusPerson && (
        <div className="focus-banner">
          <span>
            Showing the family of <strong>{focusPerson.name}</strong>
          </span>
          <button type="button" onClick={onClearFocus}>
            Show everyone
          </button>
        </div>
      )}
    </section>
  );
}
