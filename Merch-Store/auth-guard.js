(async function authGuard() {
  const path = (window.location.pathname || "").toLowerCase();
  const onAuthPage = path.endsWith("/auth.html") || path.endsWith("auth.html");

  if (!window.dbhsSupabase) {
    if (!onAuthPage) window.location.href = "./Auth.html";
    return;
  }

  const { data } = await window.dbhsSupabase.auth.getSession();
  const session = data?.session;
  const isVerified = Boolean(session?.user?.email_confirmed_at);

  if (!onAuthPage && (!session || !isVerified)) {
    window.location.href = "./Auth.html";
    return;
  }

  if (onAuthPage && session && isVerified) {
    window.location.href = "./Merch.html";
  }
})();
