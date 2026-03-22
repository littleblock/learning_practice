import { BankStatus, QuestionType } from "@prisma/client";

export function BankFilters({
  keyword,
  status,
  pageSize,
}: {
  keyword?: string;
  status?: string;
  pageSize?: string;
}) {
  return (
    <form
      action="/admin/banks"
      className="admin-filter-form admin-bank-filter-form"
    >
      <input type="hidden" name="page" value="1" />
      {pageSize ? (
        <input type="hidden" name="pageSize" value={pageSize} />
      ) : null}
      <input
        name="keyword"
        defaultValue={keyword}
        placeholder="搜索名称或编码"
      />
      <select name="status" defaultValue={status ?? ""}>
        <option value="">全部状态</option>
        <option value={BankStatus.ACTIVE}>已启用</option>
        <option value={BankStatus.INACTIVE}>已停用</option>
      </select>
      <button type="submit">筛选</button>
    </form>
  );
}

export function QuestionFilters({
  bankId,
  keyword,
  type,
  lawSource,
  pageSize,
  preservedQuery = {},
}: {
  bankId: string;
  keyword?: string;
  type?: string;
  lawSource?: string;
  pageSize?: string;
  preservedQuery?: Record<string, string | undefined>;
}) {
  return (
    <form
      action={`/admin/banks/${bankId}/questions`}
      className="admin-filter-form admin-question-filter-form"
    >
      <input type="hidden" name="page" value="1" />
      {Object.entries(preservedQuery).map(([key, value]) =>
        value ? (
          <input key={key} type="hidden" name={key} value={value} />
        ) : null,
      )}
      {pageSize ? (
        <input type="hidden" name="pageSize" value={pageSize} />
      ) : null}
      <input
        name="keyword"
        defaultValue={keyword}
        placeholder="按题干关键词搜索"
      />
      <select name="type" defaultValue={type ?? ""}>
        <option value="">全部题型</option>
        <option value={QuestionType.SINGLE}>单选题</option>
        <option value={QuestionType.MULTIPLE}>多选题</option>
        <option value={QuestionType.JUDGE}>判断题</option>
      </select>
      <input
        name="lawSource"
        defaultValue={lawSource}
        placeholder="按答案来源筛选"
      />
      <button type="submit">筛选</button>
    </form>
  );
}
