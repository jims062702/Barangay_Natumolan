/**
 * Which census form a page is — see CensusRecord in App.tsx.
 *
 * A form opened by id is that census. A brand-new form is new each time it
 * is arrived at (the location's own key), and keeps that key when its first
 * draft is saved and the address moves to the draft's id — the key rides
 * along in the navigation state, so the page is not reopened mid-typing.
 */
export function censusFormKey(id: string | undefined, locationKey: string, carried?: string | null): string {
  return carried ?? (id ? `census:${id}` : `new:${locationKey}`);
}
