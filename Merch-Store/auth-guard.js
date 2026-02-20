(async function authGuard() {
  const path = (window.location.pathname || "").toLowerCase();
  const onAuthPage = path.endsWith("/auth.html") || path.endsWith("auth.html");
  const localSession = localStorage.getItem("dbhs_auth_session") || sessionStorage.getItem("dbhs_auth_session");

  if (!window.dbhsSupabase) {
    if (!onAuthPage) window.location.href = "./Auth.html";
    return;
  }

  const { data } = await window.dbhsSupabase.auth.getSession();
  const session = data?.session;

  if (!onAuthPage && !session && !localSession) {
    window.location.href = "./Auth.html";
    return;
  }

  if (onAuthPage && (session || localSession)) {
    window.location.href = "./Merch.html";
  }
})();
