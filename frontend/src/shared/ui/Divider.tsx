import { cx } from '../lib/cx';
export function Divider({ inset = false, className }: { inset?: boolean; className?: string }) { return <hr className={cx('ui-divider', inset && 'ui-divider--inset', className)} />; }
