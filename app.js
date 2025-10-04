/*****************************************************
 * app.js V2.0 Optimizado
 * Código más compacto y editable, sin perder funciones
 *****************************************************/

/* ========== UTILS ========== */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const escapeHtml = str => String(str || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const safeNumber = val => Number(val) || 0;
const formatoPrecioParaPantalla = val => {
  if (typeof val === "number") return "$" + val.toFixed(2).replace(".", ",");
  return "$" + String(val || "0,00").replace(".", ",");
};
const ahoraISO = () => new Date().toISOString();
const formatoFechaIsoToDisplay = iso => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR") + " " + d.toLocaleTimeString("es-AR");
};

function mostrarModal(html) {
  const overlay = $("#modal-overlay");
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.classList.remove("hidden");
}
function cerrarModal() {
  $("#modal-overlay").classList.add("hidden");
  $("#modal-overlay").innerHTML = "";
}
function requireAdminConfirm(fn) {
  const pass = prompt("Contraseña Admin:");
  if (pass === window.passAdmin) fn();
  else alert("Contraseña incorrecta");
}

/* ========== VARIABLES GLOBALES ========== */
let usuarioActual = null;
let passAdmin = "";

/* ========== NAV ========== */
$$(".nav-btn").forEach(btn => {
  btn.onclick = () => {
    $$("main section").forEach(sec => sec.classList.add("hidden"));
    $("#" + btn.dataset.section).classList.remove("hidden");
  };
});

/* ========== COBRAR ========== */
(() => {
  const selectCantidad = $("#cobro-cantidad");
  for (let i = 1; i <= 20; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    selectCantidad.appendChild(opt);
  }

  const loginUsuario = $("#login-usuario");
  const loginPass = $("#login-pass");
  const loginMsg = $("#login-msg");
  const btnLogin = $("#btn-login");
  const cobroControles = $("#cobro-controles");
  const inputCodigo = $("#cobro-codigo");
  const tablaCobroBody = $("#tabla-cobro tbody");
  const btnCobrar = $("#btn-cobrar");
  const totalDiv = $("#total-div");

  let carrito = [];

  // Login cajero
  btnLogin.onclick = async () => {
    const nro = loginUsuario.value;
    const pass = loginPass.value.trim();
    if (!nro) return;

    const snap = await window.get(window.ref(window.db, `cajeros/${nro}`));
    if (!snap.exists() || snap.val().pass !== pass) {
      loginMsg.textContent = "Credenciales incorrectas";
      return;
    }
    usuarioActual = { nro, ...snap.val() };
    $("#login-modal").classList.add("hidden");
    cobroControles.classList.remove("hidden");
  };

  // Agregar producto
  inputCodigo.addEventListener("keydown", async e => {
    if (e.key !== "Enter") return;
    const codigo = inputCodigo.value.trim();
    const cant = safeNumber(selectCantidad.value);
    if (!codigo) return;

    const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
    if (!snap.exists()) {
      alert("Producto no encontrado");
      return;
    }
    const prod = snap.val();
    carrito.push({ codigo, cant, prod });
    renderCarrito();
    inputCodigo.value = "";
  });

  function renderCarrito() {
    tablaCobroBody.innerHTML = "";
    let total = 0;
    carrito.forEach((item, i) => {
      const precioUnit = parseFloat(String(item.prod.precio).replace(",", ".")) || 0;
      const subtotal = precioUnit * item.cant;
      total += subtotal;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.cant}</td>
        <td>${escapeHtml(item.prod.nombre)}</td>
        <td>${formatoPrecioParaPantalla(precioUnit)}</td>
        <td>${formatoPrecioParaPantalla(subtotal)}</td>
        <td><button data-i="${i}" class="btn-eliminar">X</button></td>`;
      tablaCobroBody.appendChild(tr);
    });
    totalDiv.textContent = "TOTAL: " + formatoPrecioParaPantalla(total);
    btnCobrar.classList.toggle("hidden", carrito.length === 0);
    // Evento eliminar
    $$(".btn-eliminar").forEach(btn => {
      btn.onclick = () => {
        carrito.splice(btn.dataset.i, 1);
        renderCarrito();
      };
    });
  }

  // Cobrar
  btnCobrar.onclick = async () => {
    if (!carrito.length) return;
    const total = carrito.reduce((acc, item) => {
      const precioUnit = parseFloat(String(item.prod.precio).replace(",", ".")) || 0;
      return acc + precioUnit * item.cant;
    }, 0);

    const id = "ID_" + Date.now();
    const mov = { total, tipo: "VENTA", cajero: usuarioActual.nro, fecha: ahoraISO() };
    await window.set(window.ref(window.db, `movimientos/${id}`), mov);
    await window.set(window.ref(window.db, `historial/${id}`), mov);

    // Actualizar stock
    for (const item of carrito) {
      const refProd = window.ref(window.db, `stock/${item.codigo}`);
      const snap = await window.get(refProd);
      if (snap.exists()) {
        const prod = snap.val();
        const nuevaCant = (Number(prod.cantidad) || 0) - item.cant;
        await window.update(refProd, { cantidad: nuevaCant, fecha: ahoraISO() });
      }
    }

    alert("Venta realizada. Ticket generado.");
    carrito = [];
    renderCarrito();
  };
})();

/* ========== MOVIMIENTOS ========== */
(() => {
  const tablaBody = $("#tabla-movimientos tbody");
  const filtroCajero = $("#filtroCajero");

  window.onValue(window.ref(window.db, "movimientos"), snap => {
    tablaBody.innerHTML = "";
    if (!snap.exists()) return;
    const data = snap.val();
    Object.entries(data).forEach(([id, mov]) => {
      if (filtroCajero.value !== "TODOS" && mov.cajero !== filtroCajero.value) return;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${id}</td>
        <td>${formatoPrecioParaPantalla(mov.total)}</td>
        <td>${mov.tipo}</td>
        <td><button class="btn-eliminar" data-id="${id}">X</button></td>`;
      tablaBody.appendChild(tr);
    });
  });

  // Delegación: eliminar movimiento
  tablaBody.addEventListener("click", e => {
    if (e.target.classList.contains("btn-eliminar")) {
      requireAdminConfirm(async () => {
        await window.remove(window.ref(window.db, `movimientos/${e.target.dataset.id}`));
      });
    }
  });
})();

/* ========== HISTORIAL ========== */
(() => {
  const tablaBody = $("#tabla-historial tbody");

  window.onValue(window.ref(window.db, "historial"), snap => {
    tablaBody.innerHTML = "";
    if (!snap.exists()) return;
    const data = snap.val();
    Object.entries(data).forEach(([id, mov]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${id}</td>
        <td>${formatoPrecioParaPantalla(mov.total)}</td>
        <td>${mov.tipo}</td>
        <td>${mov.cajero}</td>
        <td>${formatoFechaIsoToDisplay(mov.fecha)}</td>
        <td><button class="btn-ver" data-id="${id}">Ver</button></td>`;
      tablaBody.appendChild(tr);
    });
  });
})();

/* ========== STOCK ========== */
(() => {
  const tablaBody = $("#tabla-stock tbody");
  const btnAgregar = $("#agregar-stock");
  const inputCodigo = $("#stock-codigo");
  const selectCantidad = $("#stock-cantidad");

  for (let i = 1; i <= 50; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    selectCantidad.appendChild(opt);
  }

  window.onValue(window.ref(window.db, "stock"), snap => {
    tablaBody.innerHTML = "";
    if (!snap.exists()) return;

    const data = Object.entries(snap.val() || {});
    // Ordenar por fecha (descendente)
    data.sort(([, a], [, b]) => new Date(b.fecha) - new Date(a.fecha));

    data.forEach(([codigo, prod]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(codigo)}</td>
        <td>${escapeHtml(prod.nombre || "PRODUCTO NUEVO")}</td>
        <td>${safeNumber(prod.cantidad)}</td>
        <td>${formatoFechaIsoToDisplay(prod.fecha)}</td>
        <td>${formatoPrecioParaPantalla(prod.precio)}</td>
        <td>
          <button class="btn-edit-stock" data-id="${codigo}">Editar</button>
          <button class="btn-del-stock" data-id="${codigo}">Eliminar</button>
        </td>`;
      tablaBody.appendChild(tr);
    });
  });

  // Delegación
  tablaBody.addEventListener("click", e => {
    if (e.target.classList.contains("btn-del-stock")) {
      requireAdminConfirm(async () => {
        await window.remove(window.ref(window.db, `stock/${e.target.dataset.id}`));
      });
    }
    if (e.target.classList.contains("btn-edit-stock")) {
      editarStockModal(e.target.dataset.id);
    }
  });

  // Agregar stock
  btnAgregar.onclick = async () => {
    const codigo = inputCodigo.value.trim();
    const cantidad = safeNumber(selectCantidad.value);
    if (!codigo) return alert("Ingrese código");

    const refProd = window.ref(window.db, `stock/${codigo}`);
    const snap = await window.get(refProd);
    if (snap.exists()) {
      const prod = snap.val();
      await window.update(refProd, { cantidad: (Number(prod.cantidad) || 0) + cantidad, fecha: ahoraISO() });
    } else {
      await window.set(refProd, {
        nombre: "PRODUCTO NUEVO",
        cantidad,
        precio: "00000,00",
        fecha: ahoraISO()
      });
    }
    inputCodigo.value = "";
  };

  async function editarStockModal(codigo) {
    const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
    if (!snap.exists()) return alert("Producto no encontrado");
    const prod = snap.val();

    mostrarModal(`
      <h3>Editar Producto</h3>
      <label>Nombre</label><input id="__edit_nombre" value="${escapeHtml(prod.nombre || "")}">
      <label>Precio (00000,00)</label><input id="__edit_precio" value="${escapeHtml(String(prod.precio || "00000,00"))}">
      <label>Cantidad</label><input id="__edit_cantidad" type="number" value="${safeNumber(prod.cantidad)}">
      <div style="margin-top:10px">
        <button id="__save_prod">Guardar</button>
        <button id="__cancel_prod">Cancelar</button>
      </div>
    `);

    $("#__cancel_prod").onclick = cerrarModal;
    $("#__save_prod").onclick = async () => {
      const nombre = $("#__edit_nombre").value.trim();
      const precio = $("#__edit_precio").value.trim();
      const cantidadVal = safeNumber($("#__edit_cantidad").value);
      if (!/^\d{1,5},\d{2}$/.test(precio)) return alert("Precio inválido. Formato: 00000,00");

      await window.update(window.ref(window.db, `stock/${codigo}`), {
        nombre: nombre || "PRODUCTO NUEVO",
        precio,
        cantidad: cantidadVal,
        fecha: ahoraISO()
      });
      cerrarModal();
    };
  }
})();

/* ========== CAJEROS ========== */
(() => {
  const tablaBody = $("#tabla-cajeros tbody");
  const btnAgregar = $("#agregar-cajero");
  const nroSelect = $("#cajero-nro");
  const inputNombre = $("#cajero-nombre");
  const inputDni = $("#cajero-dni");
  const inputPass = $("#cajero-pass");

  // Rellenar nro select
  for (let i = 1; i <= 50; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    nroSelect.appendChild(opt);
  }

  window.onValue(window.ref(window.db, "cajeros"), snap => {
    tablaBody.innerHTML = "";
    if (!snap.exists()) return;
    Object.entries(snap.val()).forEach(([nro, cajero]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${nro}</td>
        <td>${escapeHtml(cajero.nombre)}</td>
        <td>${escapeHtml(cajero.dni)}</td>
        <td><button class="btn-eliminar" data-id="${nro}">X</button></td>`;
      tablaBody.appendChild(tr);
    });
  });

  tablaBody.addEventListener("click", e => {
    if (e.target.classList.contains("btn-eliminar")) {
      requireAdminConfirm(async () => {
        await window.remove(window.ref(window.db, `cajeros/${e.target.dataset.id}`));
      });
    }
  });

  btnAgregar.onclick = async () => {
    const nro = nroSelect.value;
    if (!nro || !inputNombre.value.trim() || !inputPass.value.trim()) return alert("Complete todos los campos");
    await window.set(window.ref(window.db, `cajeros/${nro}`), {
      nombre: inputNombre.value.trim(),
      dni: inputDni.value.trim(),
      pass: inputPass.value.trim()
    });
    inputNombre.value = inputDni.value = inputPass.value = "";
  };
})();

/* ========== CONFIG ========== */
(() => {
  const inputNombre = $("#config-nombre");
  const inputPassActual = $("#config-pass-actual");
  const inputPassNueva = $("#config-pass-nueva");
  const btnGuardar = $("#guardar-config");
  const msg = $("#config-msg");
  const inputMaster = $("#master-pass");
  const btnRestaurar = $("#btn-restaurar");

  window.onValue(window.ref(window.db, "config"), snap => {
    if (!snap.exists()) return;
    const conf = snap.val();
    inputNombre.value = conf.shopName || "";
    passAdmin = conf.passAdmin;
  });

  btnGuardar.onclick = async () => {
    const actual = inputPassActual.value.trim();
    const nueva = inputPassNueva.value.trim();
    if (actual !== passAdmin) {
      msg.textContent = "Contraseña actual incorrecta";
      msg.className = "msg-error";
      return;
    }
    await window.update(window.ref(window.db, "config"), {
      shopName: inputNombre.value.trim() || "SUPERCODE",
      passAdmin: nueva || passAdmin
    });
    msg.textContent = "Configuración guardada";
    msg.className = "msg-exito";
    inputPassActual.value = inputPassNueva.value = "";
  };

  btnRestaurar.onclick = async () => {
    const master = inputMaster.value.trim();
    const snap = await window.get(window.ref(window.db, "config"));
    if (!snap.exists() || snap.val().masterPass !== master) {
      alert("Master incorrecta");
      return;
    }
    await window.update(window.ref(window.db, "config"), { passAdmin: "0123456789" });
    alert("Contraseña restaurada a 0123456789");
  };
})();
