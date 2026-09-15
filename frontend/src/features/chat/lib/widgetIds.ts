/** Ids for the widget's own lines, which the server never sees. */
let nextId = 1;

/** The next id for a line in the widget's thread: 1, 2, 3, … for as long as the page is open. */
export function nextLineId(): number {
  return nextId++;
}
