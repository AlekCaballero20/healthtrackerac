import { initApp } from "./app.js";
import {
  setBooting,
  setAuthState,
  clearAuthState,
  setDataLoading,
  setDataError,
  hydrateData,
  clearData,
  setToast
} from "./state/store.js";
import {
  observeAuthState,
  signInWithGoogle,
  signOutCurrentUser,
  isAllowedEmail
} from "./services/auth.service.js";
import { loadAppData } from "./services/firestore.service.js";

const boot = {
  started: false,
  appInitialized: false,
  sessionVersion: 0,
  authUnsubscribe: null
};

bootstrap();

function bootstrap() {
  if (boot.started) return;
  boot.started = true;

  ensureAppInitialized();
  bindGlobalAuthActions();

  setBooting(true);
  setDataLoading(true);

  boot.authUnsubscribe = observeAuthState(handleSessionChange);
}

function ensureAppInitialized() {
  if (boot.appInitialized) return;
  initApp();
  boot.appInitialized = true;
}

function bindGlobalAuthActions() {
  document.addEventListener("click", handleGlobalClick);
}

async function handleGlobalClick(event) {
  const trigger = event.target.closest("[data-auth-action]");
  if (!trigger) return;

  const { authAction } = trigger.dataset;

  switch (authAction) {
    case "login":
      await handleLogin(trigger);
      break;
    case "logout":
      await handleLogout();
      break;
    default:
      break;
  }
}

async function handleLogin(trigger) {
  if (trigger instanceof HTMLButtonElement) {
    trigger.disabled = true;
  }

  try {
    await signInWithGoogle();
  } catch (error) {
    console.error("[main] Error iniciando sesión:", error);
    setToast({
      title: "No se pudo iniciar sesión",
      message: "Firebase decidió ponerse creativo. Inténtenlo otra vez.",
      type: "error"
    });
  } finally {
    if (trigger instanceof HTMLButtonElement) {
      trigger.disabled = false;
    }
  }
}

async function handleLogout() {
  try {
    await signOutCurrentUser();
    setToast({
      title: "Sesión cerrada",
      message: "Todo bien, la app quedó cerrada.",
      type: "success"
    });
  } catch (error) {
    console.error("[main] Error cerrando sesión:", error);
    setToast({
      title: "No se pudo cerrar sesión",
      message: "Algo falló al salir. Raro, pero pasa.",
      type: "error"
    });
  }
}

async function handleSessionChange(user) {
  const currentSessionVersion = ++boot.sessionVersion;

  try {
    if (!user) {
      clearData();
      clearAuthState();
      setDataLoading(false);
      setBooting(false);
      return;
    }

    const allowed = isAllowedEmail(user.email);

    setAuthState({
      user,
      isReady: true,
      isAllowed: allowed
    });

    if (!allowed) {
      clearData();
      setDataLoading(false);
      setBooting(false);

      setToast({
        title: "Acceso no autorizado",
        message: "Esa cuenta no tiene permiso para entrar a esta app.",
        type: "error"
      });

      await signOutCurrentUser();
      return;
    }

    setDataLoading(true);

    const appData = await loadAppData();

    if (currentSessionVersion !== boot.sessionVersion) {
      return;
    }

    hydrateData(appData);
    setBooting(false);
  } catch (error) {
    if (currentSessionVersion !== boot.sessionVersion) {
      return;
    }

    console.error("[main] Error cargando sesión o datos:", error);

    setDataError(error?.message || "No se pudo cargar la información.");
    setBooting(false);

    setToast({
      title: "Error cargando datos",
      message: "La sesión existe, pero los datos no cargaron bien.",
      type: "error"
    });
  }
}