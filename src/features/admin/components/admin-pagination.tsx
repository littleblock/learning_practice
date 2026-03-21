import Link from "next/link";

interface AdminPaginationProps {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  query?: Record<string, string | undefined>;
  pageParam?: string;
  pageSizeParam?: string;
}

function buildHref(
  basePath: string,
  targetPage: number,
  pageSize: number,
  query: Record<string, string | undefined>,
  pageParam: string,
  pageSizeParam: string,
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  searchParams.set(pageParam, String(targetPage));
  searchParams.set(pageSizeParam, String(pageSize));

  return `${basePath}?${searchParams.toString()}`;
}

function getPageWindow(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  const pages: number[] = [];

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  return pages;
}

export function AdminPagination({
  basePath,
  page,
  pageSize,
  total,
  query = {},
  pageParam = "page",
  pageSizeParam = "pageSize",
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  if (totalPages <= 1) {
    return null;
  }

  const pageWindow = getPageWindow(safePage, totalPages);

  return (
    <div className="admin-pagination">
      <span>
        第 {safePage} / {totalPages} 页，共 {total} 条
      </span>
      <div className="inline-actions">
        {safePage > 1 ? (
          <Link
            href={buildHref(
              basePath,
              1,
              pageSize,
              query,
              pageParam,
              pageSizeParam,
            )}
          >
            首页
          </Link>
        ) : null}
        {safePage > 1 ? (
          <Link
            href={buildHref(
              basePath,
              safePage - 1,
              pageSize,
              query,
              pageParam,
              pageSizeParam,
            )}
          >
            上一页
          </Link>
        ) : null}
        {pageWindow.map((item) =>
          item === safePage ? (
            <span key={item} className="admin-pagination-current">
              {item}
            </span>
          ) : (
            <Link
              key={item}
              href={buildHref(
                basePath,
                item,
                pageSize,
                query,
                pageParam,
                pageSizeParam,
              )}
            >
              {item}
            </Link>
          ),
        )}
        {safePage < totalPages ? (
          <Link
            href={buildHref(
              basePath,
              safePage + 1,
              pageSize,
              query,
              pageParam,
              pageSizeParam,
            )}
          >
            下一页
          </Link>
        ) : null}
        {safePage < totalPages ? (
          <Link
            href={buildHref(
              basePath,
              totalPages,
              pageSize,
              query,
              pageParam,
              pageSizeParam,
            )}
          >
            末页
          </Link>
        ) : null}
      </div>
    </div>
  );
}
