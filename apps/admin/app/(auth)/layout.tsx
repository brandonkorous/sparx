// Auth pages render their own centered card chrome (AuthShell); the (auth) group
// sits outside the (console) shell, so there's no operator nav here.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
