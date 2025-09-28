/*****************************************************
 * app-1.js
 * Funciones de:
 * - NAVEGACIÓN
 * - LOGIN CAJEROS
 * - TABLA CAJEROS en tiempo real
 *****************************************************/

// === REFERENCIAS DOM ===
const navBtns = document.querySelectorAll(".nav-btn");
const sections = document.querySelectorAll("main section");

// Login
const loginModal = document.getElementById("login-modal");
const inputLoginUsuario = document.getElementById("login-usuario");
const inputLoginPass = document.getElementById("login-pass");
const btnLogin = document.getElementById("btn-login");
const loginMsg = document.getElementById("login-msg");

// Cobrar
const cobroControles = document.getElementById("cobro-controles");
const cantidadSelect = document.getElementById("cobro-cantidad");
const inputCodigoCobro = document.getElementById("cobro-codigo");
const tablaCobro = document.querySelector("#tabla-cobro tbody");
const totalDiv = document.getElementById("total-div");
const btnCobrar = document.getElementById("btn-cobrar");

// Cajeros
const cajeroNroSelect = document.getElementById("cajero-nro");
const inputCajeroNombre = document.getElementById("cajero-nombre");
const inputCajeroDni = document.getElementById("cajero-dni");
const inputCajeroPass = document.getElementById("cajero-pass");
const btnAgregarCajero = document.getElementById("agregar-cajero");
const tablaCajeros = document.querySelector("#tabla-cajeros tbody");

// === VARIABLES ===
let cajeroActivo = null;

// === NAVEGACIÓN ENTRE SECCIONES ===
navBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.section;
    sections.forEach(sec => {
      sec.classList.add("hidden");
      if (sec.id === target) sec.classList.remove("hidden");
    });
  });
});

// === LOGIN DE CAJEROS ===
btnLogin.addEventListener("click", async () => {
  const nro = inputLoginUsuario.value.padStart(2, "0");
  const pass = inputLoginPass.value;

  if (!nro || !pass) {
    loginMsg.textContent = "Complete usuario y contraseña";
    return;
  }

  const snap = await window.get(window.ref(window.db, `cajeros/${nro}`));
  if (snap.exists()) {
    const cajero = snap.val();
    if (cajero.pass === pass) {
      cajeroActivo = cajero;
      loginMsg.textContent = `Bienvenido ${cajero.nombre}`;
      loginModal.classList.add("hidden");
      cobroControles.classList.remove("hidden");
      btnCobrar.classList.remove("hidden");
    } else {
      loginMsg.textContent = "Contraseña incorrecta";
    }
  } else {
    loginMsg.textContent = "Usuario no encontrado";
  }
});

// === CARGA SELECT DE CANTIDADES ===
function cargarCantidades() {
  cantidadSelect.innerHTML = "";
  for (let i = 1; i <= 99; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i.toString().padStart(2, "0");
    cantidadSelect.appendChild(opt);
  }
}
cargarCantidades();

// === CAJEROS: SELECT Y TABLA EN TIEMPO REAL ===
function cargarCajerosTiempoReal() {
  const cajerosRef = window.ref(window.db, "cajeros");

  window.onValue(cajerosRef, snap => {
    const cajeros = snap.exists() ? snap.val() : {};

    // --- Poblar tabla de cajeros ---
    tablaCajeros.innerHTML = "";
    Object.values(cajeros).forEach(caj => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${caj.nro}</td>
        <td>${caj.nombre}</td>
        <td>${caj.dni}</td>
        <td><button class="btn-eliminar-cajero" data-nro="${caj.nro}">Eliminar</button></td>
      `;
      tablaCajeros.appendChild(tr);
    });

    // Botones eliminar
    document.querySelectorAll(".btn-eliminar-cajero").forEach(btn => {
      btn.onclick = async () => {
        const pass = prompt("Ingrese contraseña administrativa:");
        const snapConfig = await window.get(window.ref(window.db, "config/passAdmin"));
        const adminPass = snapConfig.exists() ? snapConfig.val() : "0123456789";

        if (pass === adminPass) {
          await window.remove(window.ref(window.db, `cajeros/${btn.dataset.nro}`));
        } else {
          alert("Contraseña incorrecta");
        }
      };
    });

    // --- Poblar select de Nro disponibles ---
    cajeroNroSelect.innerHTML = "";
    for (let i = 1; i <= 99; i++) {
      const nro = i.toString().padStart(2, "0");
      if (!cajeros[nro]) {
        const opt = document.createElement("option");
        opt.value = nro;
        opt.textContent = nro;
        cajeroNroSelect.appendChild(opt);
      }
    }
  });
}
cargarCajerosTiempoReal();

// === AGREGAR CAJERO ===
btnAgregarCajero.addEventListener("click", async () => {
  const nro = cajeroNroSelect.value;
  const nombre = inputCajeroNombre.value.trim();
  const dni = inputCajeroDni.value.trim();
  const pass = inputCajeroPass.value.trim();

  if (!nro || !nombre || !dni || !pass) {
    alert("Complete todos los campos");
    return;
  }

  await window.set(window.ref(window.db, `cajeros/${nro}`), {
    nro, nombre, dni, pass
  });

  inputCajeroNombre.value = "";
  inputCajeroDni.value = "";
  inputCajeroPass.value = "";
});

console.log("✅ app-1.js cargado correctamente");
