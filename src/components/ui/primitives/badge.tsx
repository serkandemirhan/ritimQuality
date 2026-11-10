import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/src/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      default: 'border-transparent bg-[var(--color-primary)] text-white',
      secondary: 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)]',
      destructive: 'border-transparent bg-[var(--color-destructive)] text-white',
      outline: 'border-[var(--color-border)] text-[var(--color-foreground)]',
      success: 'border-[#cce8d9] bg-[#edf8f2] text-[var(--color-success)]',
      warning: 'border-[#efdfb9] bg-[#fff8e9] text-[var(--color-warning)]',
      info: 'border-[#d3e2f5] bg-[#eff5fc] text-[var(--color-info)]',
    },
  },
  defaultVariants: { variant: 'secondary' },
});

export function PrimitiveBadge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
