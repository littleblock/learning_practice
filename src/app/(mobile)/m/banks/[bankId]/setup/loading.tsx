import { RouteLoading } from "@/shared/components/route-loading";

export default function PracticeSetupLoading() {
  return (
    <RouteLoading
      title="正在加载题库设置"
      description="系统正在准备题库信息和练习模式，请稍候。"
      compact
    />
  );
}
