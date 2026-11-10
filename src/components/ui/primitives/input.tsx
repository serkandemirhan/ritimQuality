import * as React from 'react';
import { cn } from '@/src/lib/utils';

export const PrimitiveInput = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn('flex h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[var(--color-destructive)]', className)}
      {...props}
    />
  ),
);
PrimitiveInput.displayName = 'PrimitiveInput';
