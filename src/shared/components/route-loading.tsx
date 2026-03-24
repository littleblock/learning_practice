interface RouteLoadingProps {
  title: string;
  description: string;
  compact?: boolean;
}

export function RouteLoading({
  title,
  description,
  compact = false,
}: RouteLoadingProps) {
  return (
    <section
      className={
        compact ? "route-loading-panel is-compact" : "route-loading-panel"
      }
      aria-live="polite"
      aria-busy="true"
    >
      <div className="route-loading-visual" aria-hidden="true">
        <div className="route-loading-orbit">
          <span className="route-loading-ring is-outer" />
          <span className="route-loading-ring is-inner" />
          <span className="route-loading-core" />
        </div>
        <div className="route-loading-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="route-loading-copy">
        <span className="route-loading-badge">页面加载中</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="route-loading-tip">
          <strong>系统正在同步最新内容</strong>
          <span>当前页面不是卡住了，加载完成后会自动显示结果。</span>
        </div>
      </div>
      <div className="route-loading-skeletons">
        <div className="route-loading-skeleton is-wide" />
        <div className="route-loading-skeleton" />
        <div className="route-loading-skeleton is-short" />
      </div>
    </section>
  );
}
