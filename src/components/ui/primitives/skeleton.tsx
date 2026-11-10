import * as React from 'react';
import { cn } from '@/src/lib/utils';

export function PrimitiveSkeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn('animate-pulse rounded-md bg-[var(--color-border)]', className)} {...props} />;
}
