import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLElement> & { as?: 'section' | 'article' | 'div'; padded?: boolean };

/** White rounded card with a hairline border. */
export function Card({ as: Tag = 'section', padded = true, className = '', children, ...rest }: CardProps) {
  return (
    <Tag className={`rounded-3xl border border-line bg-white ${padded ? 'p-5' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, action, id }: { title: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id={id} className="text-base font-bold">{title}</h2>
      {action}
    </div>
  );
}
