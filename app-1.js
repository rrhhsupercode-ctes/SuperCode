/*****************************************************
 * app-1.js
 * Funciones principales: 
 * - Navegación entre secciones
 * - Login de cajeros (Firebase Realtime Database)
 * - Inicialización de combos dinámicos
 *****************************************************/

// === NAVEGACIÓN ENTRE SECCIONES ===
const navBtns = document.querySelectorAll(".nav-btn");
const sections = document.querySelectorAll("main section");

navBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-section");

    // Ocultar todas las secciones
    sections.forEach(sec => sec.classList.add("hidden"));

    // Mostrar la seleccionada
    document.getElementById(target).classList.remove("hidden");
  });
});

// === LOGIN DE CAJEROS ===
const usuarioInput = document.getElementById("login-usuario");
const passInput = document.getElementById("login-pass");
const btnLogin = document.getElementById("btn-login");
const loginMsg = document.getElementById("login-msg");

const loginModal = document.getElementById("login-modal");
const cobroControles = document.getElementById("cobro-controles");
const btnCobrar = document.getElementById("btn-cobrar");

let cajeroActivo = null; // se guarda el cajero logueado

btnLogin.addEventListener("click", async () => {
  const usuario = usuarioInput.value.padStart(2, "0"); // siempre 2 dígitos
  const pass = passInput.value;

  if (usuario.length !== 2 || pass.length !== 4) {
    loginMsg.textContent = "Formato de usuario o contraseña inválido";
    loginMsg.style.color = "red";
    return;
  }

  try {
    const snapshot = await window.get(
      window.child(window.ref(window.db), `cajeros/${usuario}`)
    );

    if (snapshot.exists()) {
      const cajero = snapshot.val();

      if (cajero.pass === pass) {
        // Login correcto
        cajeroActivo = { nro: usuario, ...cajero };
        loginMsg.textContent = `Bienvenido ${cajero.nombre}`;
        loginMsg.style.color = "green";

        // Mostrar controles de cobro
        loginModal.classList.add("hidden");
        cobroControles.classList.remove("hidden");
        btnCobrar.classList.remove("hidden");
      } else {
        loginMsg.textContent = "Contraseña incorrecta";
        loginMsg.style.color = "red";
      }
    } else {
      loginMsg.textContent = "Usuario no encontrado";
      loginMsg.style.color = "red";
    }
  } catch (err) {
    console.error("Error al iniciar sesión:", err);
    loginMsg.textContent = "Error de conexión con Firebase";
    loginMsg.style.color = "red";
  }
});

// === COMBOS DINÁMICOS ===

// Cantidades 01–99 para sección COBRAR
const cantidadSelect = document.getElementById("cobro-cantidad");
for (let i = 1; i <= 99; i++) {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = i.toString().padStart(2, "0");
  cantidadSelect.appendChild(opt);
}

// Cantidades 01–999 para sección STOCK
const stockCantidadSelect = document.getElementById("stock-cantidad");
for (let i = 1; i <= 999; i++) {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = i.toString().padStart(3, "0");
  stockCantidadSelect.appendChild(opt);
}

// === CARGAR NROS DE CAJEROS DESDE FIREBASE ===
const cajeroNroSelect = document.getElementById("cajero-nro");

async function cargarSelectCajeros() {
  cajeroNroSelect.innerHTML = ""; // limpiar antes

  const snap = await window.get(window.ref(window.db, "cajeros"));
  if (snap.exists()) {
    const datos = snap.val();
    Object.keys(datos).forEach(nro => {
      // Asegurar que siempre sean 2 dígitos
      const nro2 = nro.toString().padStart(2, "0");
      const opt = document.createElement("option");
      opt.value = nro2;
      opt.textContent = nro2;
      cajeroNroSelect.appendChild(opt);
    });
  }
}

cargarSelectCajeros();

console.log("✅ app-1.js cargado correctamente");
