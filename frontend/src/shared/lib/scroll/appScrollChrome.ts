export type AppScrollMetrics = {
  top: number;
  remaining: number;
};

export type AppScrollMovement = {
  direction: 'up' | 'down';
  distance: number;
};

export type AppScrollChromeState = {
  hidden: boolean;
  direction: AppScrollMovement['direction'] | null;
  travel: number;
};

const MOVEMENT_EPSILON = 1;
const TOP_REVEAL_OFFSET = 12;
const HIDE_TRAVEL = 24;
const REVEAL_TRAVEL = 8;

export const initialAppScrollChromeState: AppScrollChromeState = {
  hidden: false,
  direction: null,
  travel: 0,
};

export function getAppScrollMovement(previous: AppScrollMetrics, current: AppScrollMetrics): AppScrollMovement | null {
  const topDelta = current.top - previous.top;
  const remainingDelta = current.remaining - previous.remaining;

  if (Math.abs(topDelta) <= MOVEMENT_EPSILON || Math.abs(remainingDelta) <= MOVEMENT_EPSILON) return null;
  if (Math.sign(topDelta) === Math.sign(remainingDelta)) return null;

  const direction = topDelta > 0 ? 'down' : 'up';
  const distance = Math.min(Math.abs(topDelta), Math.abs(remainingDelta));
  return distance > MOVEMENT_EPSILON ? { direction, distance } : null;
}

export function reduceAppScrollChrome(
  state: AppScrollChromeState,
  movement: AppScrollMovement | null,
  top: number,
): AppScrollChromeState {
  if (top <= TOP_REVEAL_OFFSET) return initialAppScrollChromeState;
  if (!movement) return state;

  const travel = (state.direction === movement.direction ? state.travel : 0) + movement.distance;
  const threshold = movement.direction === 'down' ? HIDE_TRAVEL : REVEAL_TRAVEL;
  if (travel < threshold) return { ...state, direction: movement.direction, travel };

  return {
    hidden: movement.direction === 'down',
    direction: movement.direction,
    travel: 0,
  };
}
