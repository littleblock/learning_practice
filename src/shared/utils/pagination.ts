import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/shared/constants/app";

export function resolvePagination(
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  total?: number,
) {
  const safePageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const totalPages =
    total === undefined ? undefined : Math.max(1, Math.ceil(total / safePageSize));
  const safePage = totalPages
    ? Math.min(Math.max(page, 1), totalPages)
    : Math.max(page, 1);

  return {
    page: safePage,
    pageSize: safePageSize,
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
    totalPages,
  };
}
