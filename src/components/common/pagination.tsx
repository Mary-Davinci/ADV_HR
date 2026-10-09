import { ChevronLeft, ChevronRight } from "lucide-react";

import { ButtonLink } from "@/components/common/button-link";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /** Costruisce l'URL di una pagina mantenendo gli altri filtri. */
  hrefFor: (page: number) => string;
}

export function Pagination({ page, pageSize, total, hrefFor }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Paginazione" className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <p>
        {from}–{to} di {total}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <ButtonLink variant="outline" size="sm" href={hrefFor(page - 1)}>
            <ChevronLeft aria-hidden="true" />
            Precedente
          </ButtonLink>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft aria-hidden="true" />
            Precedente
          </Button>
        )}
        {page < pages ? (
          <ButtonLink variant="outline" size="sm" href={hrefFor(page + 1)}>
            Successiva
            <ChevronRight aria-hidden="true" />
          </ButtonLink>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Successiva
            <ChevronRight aria-hidden="true" />
          </Button>
        )}
      </div>
    </nav>
  );
}
