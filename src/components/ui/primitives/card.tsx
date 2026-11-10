import * as React from 'react';
import { cn } from '@/src/lib/utils';

export const PrimitiveCard = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => <div ref={ref} data-slot="card" className={cn('rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-sm', className)} {...props} />,
);
PrimitiveCard.displayName = 'PrimitiveCard';
