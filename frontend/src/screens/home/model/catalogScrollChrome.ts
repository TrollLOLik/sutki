export type CatalogScrollMetrics = {
  top: number;
  remaining: number;
};

export type CatalogScrollMovement = {
  direction: 'up' | 'down';
  distance: number;
};

const MOVEMENT_EPSILON = 1;

export function getCatalogScrollMovement(
  previous: CatalogScrollMetrics,
  current: CatalogScrollMetrics,
): CatalogScrollMovement | null {
  const topDelta = current.top - previous.top;
  const remainingDelta = current.remaining - previous.remaining;

  // Real document scrolling changes both values in opposite directions.
  // Dynamic browser chrome mainly changes the viewport height, so `top` may
  // move while the distance to the document end stays effectively unchanged.
  if (Math.abs(topDelta) <= MOVEMENT_EPSILON || Math.abs(remainingDelta) <= MOVEMENT_EPSILON) return null;
  if (Math.sign(topDelta) === Math.sign(remainingDelta)) return null;

  const direction = topDelta > 0 ? 'down' : 'up';
  const distance = Math.min(Math.abs(topDelta), Math.abs(remainingDelta));
  return distance > MOVEMENT_EPSILON ? { direction, distance } : null;
}
