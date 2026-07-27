import type { DateQualifier } from '../types';
import { buildToken, parseToken, type DateParts } from '../partialDate';

// Structured control for a partial date: a qualifier plus year, and optional
// month and day. It reads and writes a canonical date token, so month/day stay
// optional and "circa / before / after" travel with the date.
const QUALIFIERS: [DateQualifier, string][] = [
  ['exact', 'Exact'],
  ['about', 'Circa'],
  ['before', 'Before'],
  ['after', 'After'],
];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));

export function DateField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (token: string) => void;
  disabled?: boolean;
}) {
  const parts = parseToken(value);
  const set = (change: Partial<DateParts>) => onChange(buildToken({ ...parts, ...change }));
  const hasYear = /^\d{4}$/.test(parts.year);
  return (
    <label className="date-field">
      {label}
      <div className="date-field-controls">
        <select
          aria-label={`${label} qualifier`}
          value={parts.qualifier}
          disabled={disabled || !hasYear}
          onChange={(event) => set({ qualifier: event.target.value as DateQualifier })}
        >
          {QUALIFIERS.map(([id, text]) => (
            <option key={id} value={id}>
              {text}
            </option>
          ))}
        </select>
        <input
          className="date-field-year"
          inputMode="numeric"
          placeholder="Year"
          aria-label={`${label} year`}
          value={parts.year}
          disabled={disabled}
          onChange={(event) => set({ year: event.target.value.replace(/\D/g, '').slice(0, 4) })}
        />
        <select
          aria-label={`${label} month`}
          value={parts.month}
          disabled={disabled || !hasYear}
          onChange={(event) =>
            set(event.target.value ? { month: event.target.value } : { month: '', day: '' })
          }
        >
          <option value="">Month</option>
          {MONTHS.map((month, index) => (
            <option key={month} value={String(index + 1).padStart(2, '0')}>
              {month}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} day`}
          value={parts.day}
          disabled={disabled || !parts.month}
          onChange={(event) => set({ day: event.target.value })}
        >
          <option value="">Day</option>
          {DAYS.map((day) => (
            <option key={day} value={day}>
              {Number(day)}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
