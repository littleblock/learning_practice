import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/shared/constants/app";

export function resolvePagination(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const safePage = Math.max(page, 1);
  const safePageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);

  return {
    page: safePage,
    pageSize: safePageSize,
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  };
}
