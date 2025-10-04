// =======================
// APP.JS v2.1 OPTIMIZADO
// =======================

// -----------------------
// CONFIG / HELPERS
// -----------------------
const tablaStockBody = document.querySelector("#tabla-stock tbody");
const tablaMovimientosBody = document.querySelector("#tabla-movimientos tbody");
const tablaHistorialBody = document.querySelector("#tabla-historial tbody");
const historialInfo = document.getElementById("historial-info");
const tablaCobroBody = document.querySelector("#tabla-cobro tbody");
const totalDiv = document.getElementById("total");
const btnCobrar = document.getElementById("btn-cobrar");
const cobroCodigo = document.getElementById("cobro-codigo");
const cobroCantidadSelect = document.getElementById("cobro-cantidad");
const btnLogin = document.getElementById("btn-login");
const loginUsuario = document.getElementById("login-usuario");
const loginPass = document.getElementById("login-pass");
const loginMsg = document.getElementById("login-msg");
const loginModal = document.getElementById("login-modal");
const cobroControles = document.getElementById("cobro-controles");
const btnAgregarStock = document.getElementById("btn-agregar-stock");
const inputStockCodigo = document.getElementById("stock-codigo");
const stockCantidadSelect = document.getElementById("stock-cantidad");

let cajeroActivo = null;
let carrito = [];
let total = 0;

// Utilidades
const safeNumber = val => Number(val) || 0;
const ahoraISO = () => new Date().toISOString();
const escapeHtml = str => (str || "").replace(/[&<>"']/g, m => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
));
const formatoFechaIsoToDisplay = iso => iso ? new Date(iso).toLocaleString() : "";
const formatoPrecioParaPantalla = n => "$" + (Number(n).toFixed(2)).replace(".", ",");

// -----------------------
// LOGIN DE CAJERO
// -----------------------
if (btnLogin) {
  btnLogin.onclick = async () => {
    const nro = (loginUsuario.value || "").trim();
    const pass = (loginPass.value || "").trim();
    loginMsg.textContent = "";
    if (!nro || !pass) return loginMsg.textContent = "Complete usuario y contraseña";

    const snap = await window.get(window.ref(window.db, `cajeros/${nro}`));
    if (!snap.exists()) return loginMsg.textContent = "Cajero no encontrado";

    const caj = snap.val();
    if (caj.pass !== pass) return loginMsg.textContent = "Contraseña incorrecta";

    cajeroActivo = caj;
    loginModal.classList.add("hidden");
    cobroControles.classList.remove("hidden");
    const appTitle = document.getElementById("app-title");
    if (appTitle) appTitle.textContent = `SUPERCODE - Cajero ${cajeroActivo.nro}`;
  };
}

// -----------------------
// COBRAR
// -----------------------
if (cobroCodigo) {
  cobroCodigo.onkeydown = async e => {
    if (e.key !== "Enter") return;
    const codigo = (cobroCodigo.value || "").trim();
    const cantidad = safeNumber(cobroCantidadSelect.value);
    if (!codigo) return;

    const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
    if (!snap.exists()) {
      alert("Producto no encontrado en stock");
      cobroCodigo.value = "";
      return;
    }

    const prod = snap.val();
    const precio = Number(
      typeof prod.precio === "number" ? prod.precio : String(prod.precio).replace(",", ".")
    );
    if (Number(prod.cantidad) < cantidad) return alert("Stock insuficiente");

    const idx = carrito.findIndex(it => it.codigo === codigo);
    if (idx >= 0) carrito[idx].cantidad += cantidad;
    else carrito.push({ codigo, nombre: prod.nombre, precio, cantidad });

    await window.update(window.ref(window.db, `stock/${codigo}`), {
      cantidad: Math.max(0, Number(prod.cantidad) - cantidad)
    });

    renderCarrito();
    cobroCodigo.value = "";
  };
}

function renderCarrito() {
  if (!tablaCobroBody) return;
  tablaCobroBody.innerHTML = "";
  total = 0;

  carrito.forEach((it, i) => {
    const rowTotal = it.precio * it.cantidad;
    total += rowTotal;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${it.cantidad}</td>
      <td>${escapeHtml(it.nombre)}</td>
      <td>${formatoPrecioParaPantalla(it.precio)}</td>
      <td>${formatoPrecioParaPantalla(rowTotal)}</td>
      <td><button class="btn-delete-cart" data-i="${i}">Eliminar</button></td>
    `;
    tablaCobroBody.appendChild(tr);
  });

  if (totalDiv) totalDiv.textContent = `TOTAL: ${formatoPrecioParaPantalla(total)}`;
  if (btnCobrar) btnCobrar.classList.toggle("hidden", carrito.length === 0);

  document.querySelectorAll(".btn-delete-cart").forEach(btn => {
    btn.onclick = () => {
      const i = Number(btn.dataset.i);
      const it = carrito[i];
      requireAdminConfirm(async () => {
        const snap = await window.get(window.ref(window.db, `stock/${it.codigo}`));
        if (snap.exists()) {
          const prod = snap.val();
          await window.update(window.ref(window.db, `stock/${it.codigo}`), {
            cantidad: Number(prod.cantidad) + it.cantidad
          });
        }
        carrito.splice(i, 1);
        renderCarrito();
      });
    };
  });
}

if (btnCobrar) {
  btnCobrar.onclick = () => {
    if (!cajeroActivo) return alert("Ingrese con un cajero primero");
    if (!carrito.length) return;
    mostrarModal(`
      <h3>¿Efectivo o Tarjeta?</h3>
      <div style="margin-top:10px">
        <button id="__pay_cash">Efectivo</button>
        <button id="__pay_card">Tarjeta</button>
        <button id="__pay_cancel">Cancelar</button>
      </div>
    `);
    document.getElementById("__pay_cancel").onclick = cerrarModal;
    document.getElementById("__pay_cash").onclick = () => finalizarCobro("Efectivo");
    document.getElementById("__pay_card").onclick = () => finalizarCobro("Tarjeta");
  };
}

// Ticket numerado
function generarNumeroTicket() {
  const hoy = new Date().toISOString().slice(0, 10);
  const ultimaFecha = localStorage.getItem("ticket_fecha");
  let contador = parseInt(localStorage.getItem("ticket_contador") || "0", 10);
  if (ultimaFecha !== hoy) contador = 0;
  localStorage.setItem("ticket_fecha", hoy);
  localStorage.setItem("ticket_contador", ++contador);
  return "ID_" + String(contador).padStart(6, "0");
}

async function finalizarCobro(tipoPago) {
  cerrarModal();
  const movId = generarNumeroTicket();
  const mov = {
    id: movId,
    cajero: cajeroActivo ? (cajeroActivo.nro || cajeroActivo.nombre) : "N/A",
    total,
    tipo: tipoPago,
    fecha: ahoraISO(),
    items: carrito.map(it => ({ ...it }))
  };

  await window.push(window.ref(window.db, `movimientos`), mov);
  try {
    const fechaMov = mov.fecha ? new Date(mov.fecha) : new Date();
    const año = fechaMov.getFullYear();
    const mes = String(fechaMov.getMonth() + 1).padStart(2, "0");
    await window.push(window.ref(window.db, `historial/${año}-${mes}`), mov);
  } catch (err) {
    console.error("Error guardando en historial:", err);
  }

  imprimirTicketMov(mov);
  carrito = [];
  renderCarrito();
  alert("Venta registrada ✅");
}

// -----------------------
// STOCK
// -----------------------
window.onValue(window.ref(window.db, "stock"), snap => {
  if (!tablaStockBody) return;
  tablaStockBody.innerHTML = "";
  if (!snap.exists()) return;

  const data = Object.entries(snap.val());
  data.sort(([, a], [, b]) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

  data.forEach(([codigo, prod]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(codigo)}</td>
      <td>${escapeHtml(prod.nombre || "")}</td>
      <td>${Number(prod.cantidad) || 0}</td>
      <td>${prod.fecha ? formatoFechaIsoToDisplay(prod.fecha) : ""}</td>
      <td>${typeof prod.precio === "number"
        ? formatoPrecioParaPantalla(prod.precio)
        : ('$' + String(prod.precio || "").replace('.', ','))}</td>
      <td>
        <button class="btn-edit-stock" data-id="${codigo}">Editar</button>
        <button class="btn-del-stock" data-id="${codigo}">Eliminar</button>
      </td>
    `;
    tablaStockBody.appendChild(tr);
  });

  document.querySelectorAll(".btn-del-stock").forEach(btn => {
    btn.onclick = () => requireAdminConfirm(() =>
      window.remove(window.ref(window.db, `stock/${btn.dataset.id}`))
    );
  });
  document.querySelectorAll(".btn-edit-stock").forEach(btn => {
    btn.onclick = () => requireAdminConfirm(() => editarStockModal(btn.dataset.id));
  });
});

if (btnAgregarStock) {
  btnAgregarStock.onclick = async () => {
    const codigo = (inputStockCodigo.value || "").trim();
    const cantidad = safeNumber(stockCantidadSelect.value);
    if (!codigo) return alert("Ingrese código");

    const refProd = window.ref(window.db, `stock/${codigo}`);
    const snap = await window.get(refProd);
    if (snap.exists()) {
      const prod = snap.val();
      await window.update(refProd, {
        cantidad: (Number(prod.cantidad) || 0) + cantidad,
        fecha: ahoraISO()
      });
    } else {
      await window.set(refProd, {
        nombre: "PRODUCTO NUEVO",
        cantidad,
        precio: "00000,00",
        fecha: ahoraISO()
      });
    }
    inputStockCodigo.value = "";
  };
}

function editarStockModal(codigo) {
  (async () => {
    const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
    if (!snap.exists()) return alert("Producto no encontrado");
    const prod = snap.val();
    mostrarModal(`
      <h3>Editar Producto</h3>
      <label>Nombre</label><input id="__edit_nombre" value="${escapeHtml(prod.nombre || "")}">
      <label>Precio (00000,00)</label><input id="__edit_precio" value="${escapeHtml(String(prod.precio || "00000,00"))}">
      <label>Cantidad</label><input id="__edit_cantidad" type="number" value="${Number(prod.cantidad) || 0}">
      <div style="margin-top:10px">
        <button id="__save_prod">Guardar</button>
        <button id="__cancel_prod">Cancelar</button>
      </div>
    `);
    document.getElementById("__cancel_prod").onclick = cerrarModal;
    document.getElementById("__save_prod").onclick = async () => {
      const nombre = (document.getElementById("__edit_nombre").value || "").trim();
      const precio = (document.getElementById("__edit_precio").value || "").trim();
      const cantidadVal = safeNumber(document.getElementById("__edit_cantidad").value);
      if (!/^\d{1,5},\d{2}$/.test(precio)) return alert("Precio inválido. Formato: 00000,00");
      await window.update(window.ref(window.db, `stock/${codigo}`), {
        nombre: nombre || "PRODUCTO NUEVO",
        precio,
        cantidad: cantidadVal,
        fecha: ahoraISO()
      });
      cerrarModal();
    };
  })();
}

// -----------------------
// MOVIMIENTOS + HISTORIAL
// -----------------------
window.onValue(window.ref(window.db, "movimientos"), snap => {
  if (!tablaMovimientosBody) return;
  tablaMovimientosBody.innerHTML = "";
  if (!snap.exists()) return;
  Object.values(snap.val()).forEach(mov => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${mov.id}</td>
      <td>${mov.cajero}</td>
      <td>${formatoPrecioParaPantalla(mov.total)}</td>
      <td>${mov.tipo}</td>
      <td>${formatoFechaIsoToDisplay(mov.fecha)}</td>
    `;
    tablaMovimientosBody.appendChild(tr);
  });
});

window.onValue(window.ref(window.db, "historial"), snap => {
  if (!tablaHistorialBody) return;
  tablaHistorialBody.innerHTML = "";
  if (!snap.exists()) return;
  const data = snap.val();
  Object.entries(data).forEach(([ym, movs]) => {
    Object.values(movs).forEach(mov => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${mov.id}</td>
        <td>${mov.cajero}</td>
        <td>${formatoPrecioParaPantalla(mov.total)}</td>
        <td>${mov.tipo}</td>
        <td>${formatoFechaIsoToDisplay(mov.fecha)}</td>
      `;
      tablaHistorialBody.appendChild(tr);
    });
  });
  if (historialInfo) historialInfo.textContent = `Registros: ${tablaHistorialBody.children.length}`;
});
