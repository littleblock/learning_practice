import { RouteLoading } from "@/shared/components/route-loading";

export default function AdminLoading() {
  return (
    <div className="admin-loading-shell">
      <RouteLoading
        title="正在加载后台页面"
        description="系统正在准备题库、题目和法条数据，请稍候。"
      />
    </div>
  );
}
