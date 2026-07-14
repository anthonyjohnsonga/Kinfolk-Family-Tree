export const date = (value?: string) => (value ? new Date(`${value}T00:00:00Z`) : null);
export const ordered = (a: string, b: string) => (a < b ? [a, b] : [b, a]);
