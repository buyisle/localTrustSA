export function southAfricaInput(now = new Date()) {
  return new Date(Math.ceil(now.getTime() / 60000) * 60000 + 120 * 60000).toISOString().slice(0, 16);
}
export function southAfricaDate(value: string) { return new Date(`${value}:00+02:00`); }
