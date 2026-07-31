import * as Sentry from '@sentry/react-native';

interface ReportOptions {
  component: string;
  operation: string;
  tags?: Record<string, string>;
  extra?: Record<string, string | number | boolean | null>;
  fingerprint?: string[];
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    // ApiError carries the parsed response body. Report only the diagnostic
    // fields so UGC and personal data cannot be serialized by an SDK update.
    const sanitized = new Error(error.message);
    sanitized.name = error.name;
    sanitized.stack = error.stack;
    return sanitized;
  }
  return new Error(typeof error === 'string' ? error : 'Unknown handled error');
}

/** Reports an unexpected handled failure without attaching UGC or request bodies. */
export function reportHandledError(error: unknown, options: ReportOptions): void {
  Sentry.withScope((scope) => {
    scope.setLevel('error');
    scope.setTag('component', options.component);
    scope.setTag('operation', options.operation);
    for (const [key, value] of Object.entries(options.tags ?? {})) {
      scope.setTag(key, value);
    }
    for (const [key, value] of Object.entries(options.extra ?? {})) {
      scope.setExtra(key, value);
    }
    if (options.fingerprint) scope.setFingerprint(options.fingerprint);
    Sentry.captureException(asError(error));
  });
}

/** Reports an impossible UI state that does not naturally throw an exception. */
export function reportInvariant(message: string, options: ReportOptions): void {
  Sentry.withScope((scope) => {
    scope.setLevel('error');
    scope.setTag('component', options.component);
    scope.setTag('operation', options.operation);
    for (const [key, value] of Object.entries(options.tags ?? {})) {
      scope.setTag(key, value);
    }
    for (const [key, value] of Object.entries(options.extra ?? {})) {
      scope.setExtra(key, value);
    }
    scope.setFingerprint(options.fingerprint ?? ['ui-invariant', options.component, options.operation]);
    Sentry.captureMessage(message, 'error');
  });
}
