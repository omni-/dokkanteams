/**
 * Puts `id` into the team just before `beforeId`, or at the end when `beforeId` is null or not in the team.
 * A unit already in the team is moved rather than duplicated.
 */
export function placeInTeam(ids: readonly number[], id: number, beforeId: number | null): number[] {
  if (beforeId === id) return ids.includes(id) ? [...ids] : [...ids, id];

  const rest = ids.filter(existing => existing !== id);
  const index = beforeId == null ? -1 : rest.indexOf(beforeId);
  if (index < 0) return [...rest, id];
  return [...rest.slice(0, index), id, ...rest.slice(index)];
}
