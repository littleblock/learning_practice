export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-page">
      <main className="admin-main">{children}</main>
    </div>
  );
}
