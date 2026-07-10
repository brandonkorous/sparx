import * as React from 'react';
import { cn } from '../../utils/cn';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden
      className={cn('bg-base-300 animate-pulse rounded-md', className)}
      {...props}
    />
  )
);
Skeleton.displayName = 'Skeleton';
