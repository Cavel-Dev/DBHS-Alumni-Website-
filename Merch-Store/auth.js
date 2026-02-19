const supabaseClient = window.dbhsSupabase;

const emailForm = document.getElementById("emailForm");
const codeForm = document.getElementById("codeForm");
const passwordForm = document.getElementById("passwordForm");
const loginForm = document.getElementById("loginForm");

const emailInput = document.getElementById("email");
const codeInput = document.getElementById("code");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const loginEmailInput = document.getElementById("loginEmail");
const loginPasswordInput = document.getElementById("loginPassword");
const rememberMeInput = document.getElementById("rememberMe");
const statusBox = document.getElementById("status");
const showSignupBtn = document.getElementById("showSignupBtn");
const showLoginBtn = document.getElementById("showLoginBtn");
const socialButtons = document.querySelectorAll(".social-btn[data-provider]");

const DEFAULT_TEST_EMAIL = "chapter.jamaica@dbhsalumni.org";
const DEFAULT_TEST_PASSWORD = "12345678";

let workingEmail = "";
let firstTime = false;

function showStatus(message, type = "success") {
  statusBox.textContent = message;
  statusBox.className = `status show ${type}`;
}

function showOnly(form) {
  [emailForm, codeForm, passwordForm, loginForm].forEach((node) => {
    node.classList.toggle("hidden", node !== form);
  });
}

function setModeSignup() {
  showSignupBtn.classList.add("active");
  showLoginBtn.classList.remove("active");
  showSignupBtn.setAttribute("aria-selected", "true");
  showLoginBtn.setAttribute("aria-selected", "false");
  showOnly(emailForm);
}

function setModeLogin() {
  showLoginBtn.classList.add("active");
  showSignupBtn.classList.remove("active");
  showLoginBtn.setAttribute("aria-selected", "true");
  showSignupBtn.setAttribute("aria-selected", "false");
  showOnly(loginForm);
}

function persistAuthSession(email) {
  const sessionRecord = JSON.stringify({
    email,
    loggedInAt: new Date().toISOString()
  });

  if (rememberMeInput?.checked ?? true) {
    localStorage.setItem("dbhs_auth_session", sessionRecord);
    sessionStorage.removeItem("dbhs_auth_session");
  } else {
    sessionStorage.setItem("dbhs_auth_session", sessionRecord);
    localStorage.removeItem("dbhs_auth_session");
  }
}

async function checkAlumniEmail(email) {
  const { data, error } = await supabaseClient
    .from("alumni_records")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.email);
}

async function checkMemberAccount(email) {
  const { data, error } = await supabaseClient
    .from("member_accounts")
    .select("email,password_set")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return data;
}

emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const email = emailInput.value.trim().toLowerCase();
    if (!email) return;

    workingEmail = email;
    loginEmailInput.value = email;

    const inRecords = await checkAlumniEmail(email);
    if (!inRecords) {
      showStatus("This email is not found in alumni records.", "error");
      return;
    }

    const member = await checkMemberAccount(email);
    if (member?.password_set) {
      firstTime = false;
      showStatus("Email verified in alumni records. Please sign in.", "success");
      setModeLogin();
      return;
    }

    firstTime = true;

    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true }
    });

    if (error) throw error;

    showStatus("Verified. A code was sent to your email. Enter the code to continue.", "success");
    showOnly(codeForm);
  } catch (error) {
    showStatus(error.message || "Unable to continue. Try again.", "error");
  }
});

codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const token = codeInput.value.trim();
    if (!token || !workingEmail) return;

    const { error } = await supabaseClient.auth.verifyOtp({
      email: workingEmail,
      token,
      type: "email"
    });

    if (error) throw error;

    showStatus("Code verified. Create your password.", "success");
    showOnly(passwordForm);
  } catch (error) {
    showStatus(error.message || "Invalid code.", "error");
  }
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const password = passwordInput.value;
    const confirm = confirmPasswordInput.value;

    if (password.length < 8) {
      showStatus("Password must be at least 8 characters.", "error");
      return;
    }

    if (password !== confirm) {
      showStatus("Passwords do not match.", "error");
      return;
    }

    const { error: updateError } = await supabaseClient.auth.updateUser({ password });
    if (updateError) throw updateError;

    const { error: upsertError } = await supabaseClient
      .from("member_accounts")
      .upsert({ email: workingEmail, password_set: true });

    if (upsertError) throw upsertError;

    await supabaseClient.auth.signOut();

    showStatus("Password saved. Please sign in with your email and password.", "success");
    setModeLogin();
  } catch (error) {
    showStatus(error.message || "Could not save password.", "error");
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const email = loginEmailInput.value.trim().toLowerCase();
    const password = loginPasswordInput.value;

    const inRecords = await checkAlumniEmail(email);
    if (!inRecords) {
      showStatus("Email is not in alumni records.", "error");
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (!data?.user?.email_confirmed_at) {
      showStatus("Please verify your email first before signing in.", "error");
      return;
    }

    persistAuthSession(email);

    window.location.href = "./Merch.html";
  } catch (error) {
    showStatus(error.message || "Sign in failed.", "error");
  }
});

async function startOAuth(provider) {
  try {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo
      }
    });
    if (error) throw error;
  } catch (error) {
    showStatus(error.message || `Unable to start ${provider} sign in.`, "error");
  }
}

async function handleOAuthReturn() {
  const url = new URL(window.location.href);
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (oauthError) {
    showStatus(oauthError, "error");
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data?.session?.user) return;

  const email = data.session.user.email?.trim().toLowerCase();
  if (!email) {
    await supabaseClient.auth.signOut();
    showStatus("Social sign in failed because no email was returned.", "error");
    return;
  }

  const inRecords = await checkAlumniEmail(email);
  if (!inRecords) {
    await supabaseClient.auth.signOut();
    showStatus("This Google/Apple email is not in alumni membership records.", "error");
    setModeLogin();
    return;
  }

  const { error: upsertError } = await supabaseClient
    .from("member_accounts")
    .upsert({ email, password_set: false });

  if (upsertError) {
    showStatus("Verified alumni email, but could not complete membership sync.", "error");
    return;
  }

  persistAuthSession(email);
  window.location.href = "./Merch.html";
}

showSignupBtn.addEventListener("click", setModeSignup);
showLoginBtn.addEventListener("click", setModeLogin);
socialButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const provider = button.dataset.provider;
    if (provider) startOAuth(provider);
  });
});

if (loginEmailInput && !loginEmailInput.value) loginEmailInput.value = DEFAULT_TEST_EMAIL;
if (loginPasswordInput && !loginPasswordInput.value) loginPasswordInput.value = DEFAULT_TEST_PASSWORD;
if (emailInput && !emailInput.value) emailInput.value = DEFAULT_TEST_EMAIL;

setModeSignup();
if (!supabaseClient || window.DBHS_SUPABASE_URL.includes("YOUR-PROJECT-REF")) {
  showStatus("Configure Supabase in supabase-config.js first.", "error");
} else {
  handleOAuthReturn().catch((error) => {
    showStatus(error.message || "Unable to complete social sign in.", "error");
  });
}
