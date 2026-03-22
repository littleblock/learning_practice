import { RouteLoading } from "@/shared/components/route-loading";

export default function MobileLoading() {
  return (
    <RouteLoading
      title="正在加载学习页面"
      description="系统正在同步当前学习数据，请稍候。"
      compact
    />
  );
}
