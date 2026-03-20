import Link from "next/link";

interface AdminPaginationProps {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  query?: Record<string, string | undefined>;
}

function buildHref(
  basePath: string,
  targetPage: number,
  pageSize: number,
  query: Record<string, string | undefined>,
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  searchParams.set("page", String(targetPage));
  searchParams.set("pageSize", String(pageSize));

  return `${basePath}?${searchParams.toString()}`;
}

export function AdminPagination({
  basePath,
  page,
  pageSize,
  total,
  query = {},
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="admin-pagination">
      <span>
        第 {page} / {totalPages} 页，共 {total} 条
      </span>
      <div className="inline-actions">
        {page > 1 ? <Link href={buildHref(basePath, page - 1, pageSize, query)}>上一页</Link> : null}
        {page < totalPages ? <Link href={buildHref(basePath, page + 1, pageSize, query)}>下一页</Link> : null}
      </div>
    </div>
  );
}
