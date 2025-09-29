/*****************************************************
 * app.js
 * SuperCode POS - Lógica principal
 *****************************************************/

// -----------------------
// Referencias a elementos del DOM
// -----------------------
const secciones = document.querySelectorAll("main section");
const navBtns = document.querySelectorAll(".nav-btn");

const loginUsuario = document.getElementById("login-usuario");
const loginPass = document.getElementById("login-pass");
const btnLogin = document.getElementById("btn-login");
const loginMsg = document.getElementById("login-msg");
const cobroControles = document.getElementById("cobro-controles");
const cobroCantidad = document.getElementById("cobro-cantidad");
const cobroCodigo = document.getElementById("cobro-codigo");
const tablaCobro = document.getElementById("tabla-cobro").querySelector("tbody");
const totalDiv = document.getElementById("total-div");
const btnCobrar = document.getElementById("btn-cobrar");

const filtroCajero = document.getElementById("filtroCajero");
const tablaMovimientos = document.getElementById("tabla-movimientos").querySelector("tbody");
const btnTirarZ = document.getElementById("btn-tirar-z");

const tablaStock = document.getElementById("tabla-stock").querySelector("tbody");
const stockCodigo = document.getElementById("stock-codigo");
const stockCantidad = document.getElementById("stock-cantidad");
const btnAgregarStock = document.getElementById("agregar-stock");

const tablaCajeros = document.getElementById("tabla-cajeros").querySelector("tbody");
const cajeroNro = document.getElementById("cajero-nro");
const cajeroNombre = document.getElementById("cajero-nombre");
const cajeroDni = document.getElementById("cajero-dni");
const cajeroPass = document.getElementById("cajero-pass");
const btnAgregarCajero = document.getElementById("agregar-cajero");

const inputConfigNombre = document.getElementById("config-nombre");
const inputConfigPassActual = document.getElementById("config-pass-actual");
const inputConfigPassNueva = document.getElementById("config-pass-nueva");
const btnGuardarConfig = document.getElementById("guardar-config");
const configMsg = document.getElementById("config-msg");
const masterPassInput = document.getElementById("master-pass");
const btnRestaurar = document.getElementById("btn-restaurar");

// -----------------------
// Estado global
// -----------------------
let usuarioLogueado = null;
let carrito = [];
let movimientosCache = {};
let stockCache = {};
let cajerosCache = {};
let configCache = {};

// -----------------------
// Helpers
// -----------------------
function switchSection(id) {
  secciones.forEach(sec => sec.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

function actualizarTotal() {
  const total = carrito.reduce((acc, it) => acc + (it.precio * it.cant), 0);
  totalDiv.textContent = `TOTAL: $${total}`;
  btnCobrar.classList.toggle("hidden", total <= 0);
}

function generarID() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// -----------------------
// Navegación
// -----------------------
navBtns.forEach(btn => {
  btn.addEventListener("click", () => switchSection(btn.dataset.section));
});

// -----------------------
// LOGIN
// -----------------------
btnLogin.addEventListener("click", async () => {
  const nro = loginUsuario.value;
  const pass = loginPass.value;
  if (!nro) return (loginMsg.textContent = "Seleccione cajero");
  if (!pass) return (loginMsg.textContent = "Ingrese contraseña");
  const cajero = cajerosCache[nro];
  if (!cajero || cajero.pass !== pass) {
    loginMsg.textContent = "Credenciales inválidas";
    return;
  }
  usuarioLogueado = nro;
  loginMsg.textContent = "";
  cobroControles.classList.remove("hidden");
  document.getElementById("login-modal").classList.add("hidden");
});

// -----------------------
// STOCK
// -----------------------
if (btnAgregarStock) {
  btnAgregarStock.addEventListener("click", async () => {
    const codigo = stockCodigo.value.trim();
    const cantidad = parseInt(stockCantidad.value || "0");
    if (!codigo || cantidad <= 0) return alert("Complete código y cantidad");
    const refProd = window.ref(window.db, `stock/${codigo}`);
    const snap = await window.get(refProd);
    const data = snap.exists() ? snap.val() : {};
    const nuevo = {
      codigo,
      nombre: data.nombre || "PRODUCTO NUEVO",
      cantidad: (data.cantidad || 0) + cantidad,
      precio: data.precio || 0,
      fecha: new Date().toISOString().split("T")[0],
    };
    await window.set(refProd, nuevo);
    stockCodigo.value = "";
    stockCantidad.value = "";
  });
}

// -----------------------
// COBRO
// -----------------------
if (btnCobrar) {
  btnCobrar.addEventListener("click", async () => {
    if (!usuarioLogueado) return alert("Debe iniciar sesión");
    if (carrito.length === 0) return alert("Carrito vacío");

    const id = generarID();
    const total = carrito.reduce((acc, it) => acc + (it.precio * it.cant), 0);
    const movimiento = {
      id,
      cajero: usuarioLogueado,
      items: carrito,
      total,
      fecha: new Date().toISOString(),
      tipo: "VENTA",
    };

    // Guardar en movimientos
    await window.set(window.ref(window.db, `movimientos/${id}`), movimiento);
    // Guardar en historial
    await window.set(window.ref(window.db, `historial/${id}`), movimiento);

    carrito = [];
    tablaCobro.innerHTML = "";
    actualizarTotal();
    alert("Venta registrada");
  });
}

// -----------------------
// MOVIMIENTOS + HISTORIAL
// -----------------------
window.onValue(window.ref(window.db, "movimientos"), snap => {
  movimientosCache = snap.exists() ? snap.val() : {};
  tablaMovimientos.innerHTML = "";
  Object.values(movimientosCache).forEach(mov => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${mov.id}</td>
      <td>$${mov.total}</td>
      <td>${mov.tipo}</td>
      <td><button data-id="${mov.id}" class="ver-ticket">Ver</button></td>
    `;
    tablaMovimientos.appendChild(tr);
  });
});

// -----------------------
// TIRAR Z
// -----------------------
if (btnTirarZ) {
  btnTirarZ.addEventListener("click", async () => {
    const snap = await window.get(window.ref(window.db, "movimientos"));
    if (!snap.exists()) return alert("No hay movimientos para tirar Z");
    await window.set(window.ref(window.db, "movimientos"), {});
    alert("Z tirada, historial se conserva");
  });
}

// -----------------------
// CAJEROS
// -----------------------
if (btnAgregarCajero) {
  btnAgregarCajero.addEventListener("click", async () => {
    const nro = cajeroNro.value;
    const nombre = cajeroNombre.value.trim();
    const dni = cajeroDni.value.trim();
    const pass = cajeroPass.value.trim();
    if (!nro || !nombre || !dni || !pass) return alert("Complete todos los campos");
    await window.set(window.ref(window.db, `cajeros/${nro}`), { nro, nombre, dni, pass });
    cajeroNombre.value = "";
    cajeroDni.value = "";
    cajeroPass.value = "";
  });
}

window.onValue(window.ref(window.db, "cajeros"), snap => {
  cajerosCache = snap.exists() ? snap.val() : {};
  // Login
  loginUsuario.innerHTML = `<option value="">Seleccione</option>`;
  Object.keys(cajerosCache).forEach(nro => {
    loginUsuario.innerHTML += `<option value="${nro}">${nro}</option>`;
  });
  // Tabla
  tablaCajeros.innerHTML = "";
  Object.values(cajerosCache).forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.nro}</td>
      <td>${c.nombre}</td>
      <td>${c.dni}</td>
      <td><button data-nro="${c.nro}" class="del-cajero">Eliminar</button></td>
    `;
    tablaCajeros.appendChild(tr);
  });
});

// -----------------------
// CONFIG
// -----------------------
if (btnGuardarConfig) {
  btnGuardarConfig.addEventListener("click", async () => {
    const shopName = (inputConfigNombre.value || "").trim();
    const actual = (inputConfigPassActual.value || "").trim();
    const nueva = (inputConfigPassNueva.value || "").trim();
    if (!shopName) return alert("Ingrese nombre de tienda");
    if (!actual || !nueva) return alert("Complete contraseña actual y nueva");
    const snap = await window.get(window.ref(window.db, "config"));
    if (!snap.exists()) return alert("Error leyendo configuración");
    const conf = snap.val();
    if (actual !== conf.passAdmin) return alert("Contraseña actual incorrecta");
    if (nueva.length < 4 || nueva.length > 10) return alert("La nueva contraseña debe tener entre 4 y 10 caracteres");
    await window.update(window.ref(window.db, "config"), { shopName, passAdmin: nueva });
    if (configMsg) configMsg.textContent = "Configuración guardada ✅";
    inputConfigPassActual.value = "";
    inputConfigPassNueva.value = "";
  });
}

if (btnRestaurar) {
  btnRestaurar.addEventListener("click", async () => {
    const snap = await window.get(window.ref(window.db, "config"));
    if (!snap.exists()) return alert("Error leyendo configuración");
    const conf = snap.val();
    const input = masterPassInput.value.trim();
    if (input !== conf.masterPass) return alert("Contraseña maestra incorrecta");
    await window.update(window.ref(window.db, "config"), { passAdmin: "0123456789" });
    alert("Contraseña restaurada");
  });
}

// -----------------------
// CRON HISTORIAL (día 15 de cada mes)
// -----------------------
(async () => {
  const hoy = new Date();
  if (hoy.getDate() === 15) {
    await window.set(window.ref(window.db, "historial"), {});
    console.log("🗑️ Historial reseteado automáticamente (día 15)");
  }
})();
