import type { VariantProps } from "class-variance-authority";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonLinkProps = React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

/**
 * Link di navigazione con l'aspetto di un pulsante. Resta un vero `<a>`
 * (ruolo "link" per le tecnologie assistive): da usare al posto di
 * `<Button render={<Link />}>`, che Base UI espone come ruolo "button".
 */
export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <Link data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
