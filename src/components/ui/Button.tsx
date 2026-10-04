import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

type Variant = 'primary' | 'ghost'
type Size = 'sm' | 'md' | 'xl'

type Common = { variant?: Variant; size?: Size; block?: boolean; arrow?: boolean; children: ReactNode }

function classes({ variant = 'primary', size = 'md', block }: Omit<Common, 'children'>, extra?: string) {
  return ['btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', extra]
    .filter(Boolean)
    .join(' ')
}

function Content({ arrow, children }: Pick<Common, 'arrow' | 'children'>) {
  return (
    <>
      {children}
      {arrow && (
        <span className="arr" aria-hidden="true">
          →
        </span>
      )}
    </>
  )
}

export function ButtonLink({
  variant,
  size,
  block,
  arrow,
  children,
  className,
  ...rest
}: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={classes({ variant, size, block }, className)} {...rest}>
      <Content arrow={arrow}>{children}</Content>
    </Link>
  )
}

export function Button({
  variant,
  size,
  block,
  arrow,
  children,
  className,
  type = 'button',
  ...rest
}: Common & ComponentProps<'button'>) {
  return (
    <button type={type} className={classes({ variant, size, block }, className)} {...rest}>
      <Content arrow={arrow}>{children}</Content>
    </button>
  )
}
