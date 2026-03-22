import Link from "next/link";

const pageSizeOptions = [10, 20, 50, 100];

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

  for (let current = start; current <= end; current += 1) {
    pages.push(current);
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
  if (total <= 0) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pageWindow = getPageWindow(safePage, totalPages);

  return (
    <div className="admin-pagination">
      <div className="admin-pagination-summary">
        <span>
          第 {safePage} / {totalPages} 页，共 {total} 条
        </span>
        <div className="admin-pagination-size-options">
          <span>每页显示</span>
          {pageSizeOptions.map((option) =>
            option === pageSize ? (
              <span
                key={option}
                className="admin-pagination-size-chip is-active"
              >
                {option}
              </span>
            ) : (
              <Link
                key={option}
                href={buildHref(
                  basePath,
                  1,
                  option,
                  query,
                  pageParam,
                  pageSizeParam,
                )}
                className="admin-pagination-size-chip"
                prefetch={false}
              >
                {option}
              </Link>
            ),
          )}
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="admin-pagination-links">
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
              prefetch={false}
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
              prefetch={false}
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
                prefetch={false}
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
              prefetch={false}
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
              prefetch={false}
            >
              末页
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
