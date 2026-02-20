const supabaseClient = window.dbhsSupabase;

const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");

const signupEmailInput = document.getElementById("signupEmail");
const signupPasswordInput = document.getElementById("signupPassword");
const signupMembershipIdInput = document.getElementById("signupMembershipId");
const signupConfirmPasswordInput = document.getElementById("signupConfirmPassword");

const loginEmailInput = document.getElementById("loginEmail");
const loginPasswordInput = document.getElementById("loginPassword");
const rememberMeInput = document.getElementById("rememberMe");

const showSignupBtn = document.getElementById("showSignupBtn");
const showLoginBtn = document.getElementById("showLoginBtn");
const statusBox = document.getElementById("status");

function getFriendlyAuthError(error, fallback = "Authentication failed.") {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("invalid login credentials")) return "Invalid email or password.";
  if (message.includes("email not confirmed")) return "Your email is not confirmed yet. Check your inbox for the verification link.";
  if (message.includes("network")) return "Network error. Check your connection and try again.";
  return error?.message || fallback;
}

function showStatus(message, type = "success") {
  statusBox.textContent = message;
  statusBox.className = `status show ${type}`;
}

function clearStatus() {
  statusBox.textContent = "";
  statusBox.className = "status";
}

function showOnly(activeForm) {
  [signupForm, loginForm].forEach((form) => {
    form.classList.toggle("hidden", form !== activeForm);
  });
}

function setModeSignup() {
  showSignupBtn.classList.add("active");
  showLoginBtn.classList.remove("active");
  showSignupBtn.setAttribute("aria-selected", "true");
  showLoginBtn.setAttribute("aria-selected", "false");
  showOnly(signupForm);
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

async function attemptImmediateSignIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return false;
  if (!data?.session) return false;

  persistAuthSession(email);
  await supabaseClient.auth.getSession();
  window.location.href = "./Merch.html";
  return true;
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const email = signupEmailInput.value.trim().toLowerCase();
    const password = signupPasswordInput.value;
    const membershipId = signupMembershipIdInput.value.trim().toUpperCase();
    const confirmPassword = signupConfirmPasswordInput.value;

    if (!email) {
      showStatus("Enter an email address.", "error");
      return;
    }

    if (password.length < 8) {
      showStatus("Password must be at least 8 characters.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showStatus("Passwords do not match.", "error");
      return;
    }

    if (!membershipId || membershipId.length < 5) {
      showStatus("Enter a valid Membership ID from your certificate.", "error");
      return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          membership_id: membershipId
        }
      }
    });

    if (error) throw error;

    if (data?.session) {
      persistAuthSession(email);
      await supabaseClient.auth.getSession();
      window.location.href = "./Merch.html";
      return;
    }

    const signedIn = await attemptImmediateSignIn(email, password);
    if (signedIn) return;

    showStatus("Signup complete. Check your email if confirmation is required, then login.", "success");
    setModeLogin();
    loginEmailInput.value = email;
  } catch (error) {
    showStatus(getFriendlyAuthError(error, "Could not complete signup."), "error");
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const email = loginEmailInput.value.trim().toLowerCase();
    const password = loginPasswordInput.value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.session) throw new Error("Login failed. Please try again.");

    persistAuthSession(email);
    await supabaseClient.auth.getSession();
    window.location.href = "./Merch.html";
  } catch (error) {
    showStatus(getFriendlyAuthError(error, "Sign in failed."), "error");
  }
});

showSignupBtn.addEventListener("click", () => {
  clearStatus();
  setModeSignup();
});

showLoginBtn.addEventListener("click", () => {
  clearStatus();
  setModeLogin();
});

setModeLogin();
if (!supabaseClient || window.DBHS_SUPABASE_URL.includes("YOUR-PROJECT-REF")) {
  showStatus("Configure Supabase in supabase-config.js first.", "error");
}
