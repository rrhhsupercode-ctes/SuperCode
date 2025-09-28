/* =========================================================
   SuperCode - APP-1.js
   Parte 1: Inicialización, Login de Cajeros y Navegación
   ========================================================= */

// Importar Firebase SDK (asegúrate de tener <script type="module"> en index.html)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// --- Inicializar Firebase con tu configuración ---
const firebaseConfig = {
  apiKey: "AIzaSyAzbtibp4-myG8SNY6Irrb7-nuoyP1535g",
  authDomain: "supercode-ctes.firebaseapp.com",
  databaseURL: "https://supercode-ctes-default-rtdb.firebaseio.com",
  projectId: "supercode-ctes",
  storageBucket: "supercode-ctes.firebasestorage.app",
  messagingSenderId: "1034642261455",
  appId: "1:1034642261455:web:f60232b259997fd0e5feba"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* =========================================================
   VARIABLES GLOBALES
   ========================================================= */
let currentCashier = null; // Guardará el cajero logueado

/* =========================================================
   NAVEGACIÓN ENTRE SECCIONES
   ========================================================= */
const sections = document.querySelectorAll(".section");
const navButtons = document.querySelectorAll("header nav button");

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-section");

    // Ocultar todas las secciones
    sections.forEach(sec => sec.classList.remove("active"));

    // Mostrar la sección seleccionada
    document.getElementById(target).classList.add("active");

    // Si es COBRAR, abrir modal de login si aún no hay cajero logueado
    if (target === "cobrar" && !currentCashier) {
      document.getElementById("login-modal").classList.remove("hidden");
    }
  });
});

/* =========================================================
   LOGIN DE CAJEROS
   ========================================================= */
const loginBtn = document.getElementById("login-btn");
const loginUsuario = document.getElementById("login-usuario");
const loginPassword = document.getElementById("login-password");
const loginMsg = document.getElementById("login-msg");
const loginModal = document.getElementById("login-modal");
const btnCerrarLogin = document.getElementById("btn-cerrar-login");

// Cerrar modal de login
btnCerrarLogin.addEventListener("click", () => {
  loginModal.classList.add("hidden");
});

// Acción al presionar ACCEDER
loginBtn.addEventListener("click", async () => {
  const usuario = loginUsuario.value.trim();
  const pass = loginPassword.value.trim();

  // Validar que el usuario tenga 2 dígitos y el pass 4 dígitos
  if (!/^\d{2}$/.test(usuario) || !/^\d{4}$/.test(pass)) {
    loginMsg.textContent = "Formato inválido (usuario 2 dígitos, pass 4 dígitos)";
    loginMsg.className = "text-red-600 mt-2";
    return;
  }

  try {
    // Consultar en Firebase si existe el cajero
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `cajeros/${usuario}`));

    if (snapshot.exists()) {
      const cajero = snapshot.val();

      if (cajero.password === pass) {
        // ✅ Login correcto
        currentCashier = { nro: usuario, nombre: cajero.nombre };
        loginMsg.textContent = `Bienvenido ${cajero.nombre}`;
        loginMsg.className = "text-green-600 mt-2";

        // Cerrar modal después de 1s
        setTimeout(() => {
          loginModal.classList.add("hidden");
          loginUsuario.value = "";
          loginPassword.value = "";
          loginMsg.textContent = "";
        }, 1000);
      } else {
        // ❌ Contraseña incorrecta
        loginMsg.textContent = "Usuario incorrecto";
        loginMsg.className = "text-red-600 mt-2";
      }
    } else {
      // ❌ Usuario no existe
      loginMsg.textContent = "Usuario incorrecto";
      loginMsg.className = "text-red-600 mt-2";
    }
  } catch (error) {
    console.error("Error al consultar Firebase:", error);
    loginMsg.textContent = "Error de conexión con Firebase";
    loginMsg.className = "text-red-600 mt-2";
  }
});
