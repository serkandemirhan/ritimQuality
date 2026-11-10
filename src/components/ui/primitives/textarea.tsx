import * as React from 'react';
import { cn } from '@/src/lib/utils';

export const PrimitiveTextarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} data-slot="textarea" className={cn('min-h-20 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[var(--color-destructive)]', className)} {...props} />
  ),
);
PrimitiveTextarea.displayName = 'PrimitiveTextarea';
