/** Route group layouts: `(public)` login/bootstrap vs `(protected)` staff console. */
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
