import { twMerge } from 'tailwind-merge';

function clsx(...inputs: any[]) {
  return inputs
    .flat()
    .filter(Boolean)
    .join(' ');
}

/**
 * Merges Tailwind CSS classes with a simple clsx-like function and tailwind-merge.
 */
export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}
