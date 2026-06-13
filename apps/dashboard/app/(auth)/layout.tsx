// Auth pages render their own full-screen split-panel chrome (see AuthScreen).
// The (auth) group sits outside (dashboard), so there's no sidebar/topbar here.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
