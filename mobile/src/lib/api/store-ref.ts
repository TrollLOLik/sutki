/**
 * A mutable reference to store the session state accessor dynamically.
 * This breaks circular dependencies between client.ts -> session.ts -> auth.ts -> client.ts.
 */
export const storeRef = {
  getState: null as (() => any) | null,
};
