import { partnershipStatuses, siblingTypes } from './contract.js';

// GEDCOM 5.5.1 export and import. Standard tags cover people, parent/child
// families, marriages, and divorces; Kinfolk-specific details ride in custom
// underscore tags (_MAIDEN, _SIB, _STAT) so they survive a round trip while
// remaining ignorable by other genealogy software. Design colors are not part
// of GEDCOM and are not exported.
//
// Photos export as OBJE (multimedia) records with the image embedded as base64
// in a custom _DATA sub-tag, so a single .ged file stays self-contained across
// a Kinfolk round trip. Other software ignores the unknown embedded data.

const PHOTO_FORMS: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const FORM_CONTENT_TYPES: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};
const photoForm = (contentType: string) => PHOTO_FORMS[contentType] || 'jpeg';
const contentTypeForForm = (form: string) => FORM_CONTENT_TYPES[form] || 'image/jpeg';

type PartnershipRecord = {
  partnerAId: string;
  partnerBId: string;
  status: string;
  marriageDateToken: string | null;
  divorceDateToken: string | null;
};
type SiblingRecord = { siblingAId: string; siblingBId: string; type: string };
export type GedcomPerson = {
  id: string;
  name: string;
  maidenName: string | null;
  birthDateToken: string | null;
  birthPlace: string | null;
  deathDateToken: string | null;
  deathPlace: string | null;
  bio: string | null;
  parentLinks: { parentId: string; childId: string }[];
  partnershipsA: PartnershipRecord[];
  partnershipsB: PartnershipRecord[];
  siblingLinksA: SiblingRecord[];
  lifeEvents: {
    type: string;
    dateToken: string | null;
    place: string | null;
    description: string | null;
  }[];
  photos: { data: Uint8Array; contentType: string; caption: string | null; isPrimary: boolean }[];
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH_NUMBER = new Map(MONTHS.map((month, index) => [month, index + 1]));
const TOKEN_PARTS = /^([~<>]?)(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/;
const QUALIFIER_GEDCOM: Record<string, string> = { '~': 'ABT ', '<': 'BEF ', '>': 'AFT ' };
// Format a partial-date token as a GEDCOM date, keeping its precision and
// mapping the ~/</> qualifier to ABT/BEF/AFT. Returns '' for a missing date.
const gedcomDate = (token: string | null): string => {
  const match = token && TOKEN_PARTS.exec(token);
  if (!match) return '';
  const [, qualifier, year, month, day] = match;
  const monthName = month ? MONTHS[Number(month) - 1] : '';
  const body =
    day && monthName
      ? `${Number(day)} ${monthName} ${year}`
      : monthName
        ? `${monthName} ${year}`
        : year;
  return (QUALIFIER_GEDCOM[qualifier] || '') + body;
};
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

const lifeEventTag = (type: string): { tag: string; label?: string } =>
  ({
    residence: { tag: 'RESI' },
    burial: { tag: 'BURI' },
    immigration: { tag: 'IMMI' },
    education: { tag: 'EDUC' },
    occupation: { tag: 'OCCU' },
    marriage: { tag: 'EVEN', label: 'Marriage' },
    divorce: { tag: 'EVEN', label: 'Divorce' },
    military: { tag: 'EVEN', label: 'Military service' },
  })[type] || { tag: 'EVEN', label: 'Other' };

export function buildGedcom(treeName: string, people: GedcomPerson[]): string {
  const personXref = new Map(people.map((person, index) => [person.id, `@I${index + 1}@`]));
  const pairKey = (ids: string[]) => [...ids].sort().join('|');
  type Family = { spouses: string[]; children: string[]; partnership: PartnershipRecord | null };
  const families = new Map<string, Family>();
  people.forEach((person) => {
    [...person.partnershipsA, ...person.partnershipsB].forEach((partnership) => {
      const spouses = [partnership.partnerAId, partnership.partnerBId];
      if (!spouses.every((id) => personXref.has(id))) return;
      const key = pairKey(spouses);
      if (!families.has(key)) families.set(key, { spouses, children: [], partnership });
    });
  });
  people.forEach((person) => {
    const parentIds = [...new Set(person.parentLinks.map((link) => link.parentId))]
      .filter((id) => personXref.has(id))
      .sort();
    if (!parentIds.length) return;
    const key = pairKey(parentIds);
    const family = families.get(key);
    if (family) family.children.push(person.id);
    else families.set(key, { spouses: parentIds, children: [person.id], partnership: null });
  });
  const familyXref = new Map([...families.keys()].map((key, index) => [key, `@F${index + 1}@`]));

  const lines = [
    '0 HEAD',
    '1 SOUR KINFOLK',
    '2 NAME Kinfolk Family Tree',
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    `1 FILE ${clean(treeName) || 'Family tree'}`,
  ];
  const pushNote = (level: number, text: string) => {
    const [first, ...rest] = text.split(/\r?\n/);
    lines.push(`${level} NOTE ${clean(first)}`);
    rest.forEach((line) => lines.push(`${level + 1} CONT ${clean(line)}`));
  };
  const pushDatePlace = (token: string | null, place: string | null) => {
    const date = gedcomDate(token);
    if (date) lines.push(`2 DATE ${date}`);
    if (place) lines.push(`2 PLAC ${clean(place)}`);
  };

  people.forEach((person) => {
    lines.push(`0 ${personXref.get(person.id)} INDI`);
    const parts = clean(person.name).split(' ').filter(Boolean);
    lines.push(
      `1 NAME ${
        parts.length > 1
          ? `${parts.slice(0, -1).join(' ')} /${parts[parts.length - 1]}/`
          : parts[0] || 'Unknown'
      }`,
    );
    if (person.maidenName) lines.push(`1 _MAIDEN ${clean(person.maidenName)}`);
    if (person.birthDateToken || person.birthPlace) {
      lines.push('1 BIRT');
      pushDatePlace(person.birthDateToken, person.birthPlace);
    }
    if (person.deathDateToken || person.deathPlace) {
      lines.push('1 DEAT');
      pushDatePlace(person.deathDateToken, person.deathPlace);
    }
    person.lifeEvents.forEach((event) => {
      const { tag, label } = lifeEventTag(event.type);
      lines.push(`1 ${tag}`);
      if (label) lines.push(`2 TYPE ${label}`);
      pushDatePlace(event.dateToken, event.place);
      if (event.description) pushNote(2, event.description);
    });
    if (person.bio) pushNote(1, person.bio);
    person.photos.forEach((photo) => {
      const base64 = Buffer.from(photo.data).toString('base64');
      if (!base64) return;
      lines.push('1 OBJE');
      lines.push(`2 FORM ${photoForm(photo.contentType)}`);
      if (photo.caption) lines.push(`2 TITL ${clean(photo.caption)}`);
      if (photo.isPrimary) lines.push('2 _PRIM Y');
      // GEDCOM lines stay short, so split the base64 across CONC continuations
      // that the parser rejoins with no separator.
      (base64.match(/.{1,200}/g) || []).forEach((chunk, index) =>
        lines.push(`${index === 0 ? '2 _DATA' : '3 CONC'} ${chunk}`),
      );
    });
    families.forEach((family, key) => {
      if (family.spouses.includes(person.id)) lines.push(`1 FAMS ${familyXref.get(key)}`);
      if (family.children.includes(person.id)) lines.push(`1 FAMC ${familyXref.get(key)}`);
    });
    person.siblingLinksA.forEach((link) => {
      if (!personXref.has(link.siblingBId)) return;
      lines.push(`1 _SIB ${personXref.get(link.siblingBId)}`);
      if (link.type !== 'sibling') lines.push(`2 TYPE ${link.type}`);
    });
  });

  families.forEach((family, key) => {
    lines.push(`0 ${familyXref.get(key)} FAM`);
    const [first, second] = family.spouses;
    if (first) lines.push(`1 HUSB ${personXref.get(first)}`);
    if (second) lines.push(`1 WIFE ${personXref.get(second)}`);
    const partnership = family.partnership;
    if (partnership) {
      const marriage = gedcomDate(partnership.marriageDateToken);
      const divorce = gedcomDate(partnership.divorceDateToken);
      if (partnership.status !== 'partnered' || marriage) {
        lines.push('1 MARR');
        if (marriage) lines.push(`2 DATE ${marriage}`);
      }
      if (partnership.status === 'divorced' || divorce) {
        lines.push('1 DIV');
        if (divorce) lines.push(`2 DATE ${divorce}`);
      }
      lines.push(`1 _STAT ${partnership.status}`);
    }
    family.children.forEach((childId) => lines.push(`1 CHIL ${personXref.get(childId)}`));
  });

  lines.push('0 TRLR');
  return lines.join('\n') + '\n';
}

export type ParsedLifeEvent = {
  type: string;
  date?: string;
  place?: string;
  description?: string;
};
export type ParsedPerson = {
  xref: string;
  name: string;
  maidenName?: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  bio?: string;
  lifeEvents: ParsedLifeEvent[];
  siblings: { xref: string; type: string }[];
  photos: { data: string; contentType: string; caption?: string; isPrimary: boolean }[];
};
export type ParsedFamily = {
  spouses: string[];
  children: string[];
  status?: string;
  marriageDate?: string;
  divorceDate?: string;
};
export type ParsedGedcom = { name: string; people: ParsedPerson[]; families: ParsedFamily[] };

type GedcomNode = {
  level: number;
  xref?: string;
  tag: string;
  value: string;
  children: GedcomNode[];
};

const invalid = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

function parseNodes(text: string): GedcomNode[] {
  const roots: GedcomNode[] = [];
  const stack: GedcomNode[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/.exec(line);
    if (!match) throw invalid('This file does not look like a valid GEDCOM file');
    const node: GedcomNode = {
      level: Number(match[1]),
      xref: match[2],
      tag: match[3].toUpperCase(),
      value: match[4] || '',
      children: [],
    };
    while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
    if (node.level === 0) roots.push(node);
    else if (stack.length) stack[stack.length - 1].children.push(node);
    else throw invalid('This file does not look like a valid GEDCOM file');
    stack.push(node);
  }
  if (!roots.some((node) => node.tag === 'INDI'))
    throw invalid('The GEDCOM file does not contain any people');
  return roots;
}

// GEDCOM dates may be partial ("1950", "MAR 1950") or approximate
// ("ABT 12 MAR 1950"). Parsed into a partial-date token, precision and the
// approximate/before/after qualifier are both preserved.
const GEDCOM_QUALIFIER: Record<string, string> = {
  ABT: '~',
  EST: '~',
  CAL: '~',
  BEF: '<',
  AFT: '>',
};
function isoDate(value: string): string | undefined {
  const trimmed = value.trim().toUpperCase();
  const qualifierMatch = /^(ABT|EST|CAL|AFT|BEF)\s+/.exec(trimmed);
  const qualifier = qualifierMatch ? GEDCOM_QUALIFIER[qualifierMatch[1]] : '';
  const cleaned = qualifierMatch ? trimmed.slice(qualifierMatch[0].length) : trimmed;
  const day = /^(\d{1,2})\s+([A-Z]{3})\s+(\d{3,4})$/.exec(cleaned);
  if (day && MONTH_NUMBER.has(day[2]))
    return `${qualifier}${day[3].padStart(4, '0')}-${String(MONTH_NUMBER.get(day[2])).padStart(2, '0')}-${day[1].padStart(2, '0')}`;
  const month = /^([A-Z]{3})\s+(\d{3,4})$/.exec(cleaned);
  if (month && MONTH_NUMBER.has(month[1]))
    return `${qualifier}${month[2].padStart(4, '0')}-${String(MONTH_NUMBER.get(month[1])).padStart(2, '0')}`;
  const year = /^(\d{3,4})$/.exec(cleaned);
  if (year) return `${qualifier}${year[1].padStart(4, '0')}`;
  return undefined;
}

const nodeText = (node: GedcomNode) =>
  node.children.reduce(
    (text, child) =>
      child.tag === 'CONT'
        ? `${text}\n${child.value}`
        : child.tag === 'CONC'
          ? text + child.value
          : text,
    node.value,
  );
const child = (node: GedcomNode, tag: string) => node.children.find((item) => item.tag === tag);

const LIFE_EVENT_TAGS: Record<string, string> = {
  RESI: 'residence',
  BURI: 'burial',
  IMMI: 'immigration',
  EDUC: 'education',
  OCCU: 'occupation',
};
const EVEN_TYPES: Record<string, string> = {
  marriage: 'marriage',
  divorce: 'divorce',
  'military service': 'military',
};

function parsePerson(node: GedcomNode): ParsedPerson {
  const person: ParsedPerson = {
    xref: node.xref || '',
    name: 'Unknown',
    lifeEvents: [],
    siblings: [],
    photos: [],
  };
  node.children.forEach((item) => {
    if (item.tag === 'NAME' && person.name === 'Unknown')
      person.name = clean(item.value.replace(/\//g, '')) || 'Unknown';
    else if (item.tag === '_MAIDEN') person.maidenName = clean(item.value) || undefined;
    else if (item.tag === 'BIRT') {
      person.birthDate = isoDate(child(item, 'DATE')?.value || '');
      person.birthPlace = clean(child(item, 'PLAC')?.value || '') || undefined;
    } else if (item.tag === 'DEAT') {
      person.deathDate = isoDate(child(item, 'DATE')?.value || '');
      person.deathPlace = clean(child(item, 'PLAC')?.value || '') || undefined;
    } else if (item.tag === 'NOTE' && !person.bio) person.bio = nodeText(item).trim() || undefined;
    else if (item.tag === '_SIB' && item.value) {
      const type = clean(child(item, 'TYPE')?.value || '').toLowerCase();
      person.siblings.push({
        xref: item.value,
        type: (siblingTypes as readonly string[]).includes(type) ? type : 'sibling',
      });
    } else if (item.tag in LIFE_EVENT_TAGS || item.tag === 'EVEN') {
      const type =
        item.tag === 'EVEN'
          ? EVEN_TYPES[clean(child(item, 'TYPE')?.value || '').toLowerCase()] || 'other'
          : LIFE_EVENT_TAGS[item.tag];
      const note = child(item, 'NOTE');
      person.lifeEvents.push({
        type,
        date: isoDate(child(item, 'DATE')?.value || ''),
        place: clean(child(item, 'PLAC')?.value || '') || undefined,
        description: note ? nodeText(note).trim() || undefined : undefined,
      });
    } else if (item.tag === 'OBJE') {
      // Only embedded photos (our _DATA base64) are imported; OBJE records that
      // merely point at an external FILE cannot travel inside the .ged file.
      const dataNode = child(item, '_DATA');
      const data = dataNode ? nodeText(dataNode).replace(/\s+/g, '') : '';
      if (!data) return;
      person.photos.push({
        data,
        contentType: contentTypeForForm(clean(child(item, 'FORM')?.value || '').toLowerCase()),
        caption: clean(child(item, 'TITL')?.value || '') || undefined,
        isPrimary: Boolean(child(item, '_PRIM')),
      });
    }
  });
  return person;
}

function parseFamily(node: GedcomNode): ParsedFamily {
  const family: ParsedFamily = { spouses: [], children: [] };
  node.children.forEach((item) => {
    if ((item.tag === 'HUSB' || item.tag === 'WIFE') && item.value) family.spouses.push(item.value);
    else if (item.tag === 'CHIL' && item.value) family.children.push(item.value);
    else if (item.tag === 'MARR') {
      family.status = family.status || 'married';
      family.marriageDate = isoDate(child(item, 'DATE')?.value || '');
    } else if (item.tag === 'DIV') {
      family.status = 'divorced';
      family.divorceDate = isoDate(child(item, 'DATE')?.value || '');
    } else if (item.tag === '_STAT') {
      const status = clean(item.value).toLowerCase();
      if ((partnershipStatuses as readonly string[]).includes(status)) family.status = status;
    }
  });
  family.spouses = [...new Set(family.spouses)];
  family.children = [...new Set(family.children)];
  return family;
}

export function parseGedcom(text: string): ParsedGedcom {
  const roots = parseNodes(text);
  const head = roots.find((node) => node.tag === 'HEAD');
  const name = clean((head && child(head, 'FILE')?.value) || '') || 'Imported family tree';
  const people = roots.filter((node) => node.tag === 'INDI' && node.xref).map(parsePerson);
  const families = roots.filter((node) => node.tag === 'FAM').map(parseFamily);
  return { name, people, families };
}
