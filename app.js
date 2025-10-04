/*****************************************************
 * app.js (reemplazo completo)
 * Funcional: Cobrar, Stock, Cajeros, Movimientos, Config
 * Requiere en index.html: elementos con los IDs usados abajo
 * Requiere helpers de Firebase expuestos en window: ref,get,set,update,remove,onValue
 *****************************************************/
(() => {
  "use strict";

  // -----------------------
  // Referencias DOM
  // -----------------------
  const modalOverlay = document.getElementById("modal-overlay");

  // Cobrar / Login
  const loginUsuario = document.getElementById("login-usuario");
  const loginPass = document.getElementById("login-pass");
  const btnLogin = document.getElementById("btn-login");
  const loginMsg = document.getElementById("login-msg");
  const loginModal = document.getElementById("login-modal");
  const cobroControles = document.getElementById("cobro-controles");
  const cobroCantidadSelect = document.getElementById("cobro-cantidad");
  const cobroCodigo = document.getElementById("cobro-codigo");
  const tablaCobroBody = document.querySelector("#tabla-cobro tbody");
  const totalDiv = document.getElementById("total-div");
  const btnCobrar = document.getElementById("btn-cobrar");

  // Stock
  const inputStockCodigo = document.getElementById("stock-codigo");
  const stockCantidadSelect = document.getElementById("stock-cantidad");
  const btnAgregarStock = document.getElementById("agregar-stock");
  const tablaStockBody = document.querySelector("#tabla-stock tbody");

  // Cajeros
  const cajeroNroSelect = document.getElementById("cajero-nro");
  const inputCajeroNombre = document.getElementById("cajero-nombre");
  const inputCajeroDni = document.getElementById("cajero-dni");
  const inputCajeroPass = document.getElementById("cajero-pass");
  const btnAgregarCajero = document.getElementById("agregar-cajero");
  const tablaCajerosBody = document.querySelector("#tabla-cajeros tbody");

  // Movimientos
  const tablaMovimientosBody = document.querySelector("#tabla-movimientos tbody");
  const btnTirarZ = document.getElementById("btn-tirar-z");
  // filtro en el HTML tiene id "filtroCajero"
  const filtroCajero = document.getElementById("filtroCajero");

  // Historial (nuevas referencias)
  const tablaHistorialBody = document.querySelector("#tabla-historial tbody");
  const historialInfo = document.getElementById("historial-info"); // opcional en HTML

  // Config
  const inputConfigNombre = document.getElementById("config-nombre");
  const inputConfigPassActual = document.getElementById("config-pass-actual");
  const inputConfigPassNueva = document.getElementById("config-pass-nueva");
  const btnGuardarConfig = document.getElementById("guardar-config");
  const inputMasterPass = document.getElementById("master-pass");
  const btnRestaurar = document.getElementById("btn-restaurar");
  const configMsg = document.getElementById("config-msg");

  // Navigation
  const navBtns = document.querySelectorAll(".nav-btn");
  const sections = document.querySelectorAll("main section");

  // -----------------------
  // Estado local
  // -----------------------
  let cajeroActivo = null;
  let carrito = []; // {codigo, nombre, precio:number, cantidad:number}
  let total = 0;
  let movimientosCache = {}; // cache para movimientos -> {id: mov}
  let cajerosCache = {}; // cache cajeros -> {nro: caj}
  let configCache = null;

  // -----------------------
  // Utilidades
  // -----------------------
  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);
  }

  function formatoPrecioParaPantalla(num) {
    const n = Number(num) || 0;
    return `$${n.toFixed(2).replace(".", ",")}`;
  }

  function ahoraISO() {
    return new Date().toISOString();
  }

  function formatoFechaIsoToDisplay(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const dd = d.getDate().toString().padStart(2, "0");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = d.getHours().toString().padStart(2, "0");
    const mi = d.getMinutes().toString().padStart(2, "0");
    return `${dd}/${mm}/${yyyy} (${hh}:${mi})`;
  }

  function formatFechaParaHeader(iso) {
    return formatoFechaIsoToDisplay(iso);
  }

  function safeNumber(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }

  // Modal helpers (modalOverlay must exist)
  function mostrarModal(html) {
    if (!modalOverlay) return alert("Modal no disponible");
    modalOverlay.innerHTML = html;
    modalOverlay.classList.remove("hidden");
  }
  function cerrarModal() {
    if (!modalOverlay) return;
    modalOverlay.innerHTML = "";
    modalOverlay.classList.add("hidden");
  }

  // verifica pass admin consultando config en DB
async function verificarPassAdmin(pass) {
  try {
    const snap = await window.get(window.ref(window.db, "config"));
    if (!snap.exists()) return false;
    const conf = snap.val();
    configCache = conf;
    return String(pass).trim() === String(conf.passAdmin).trim();
  } catch (e) {
    console.error("verificarPassAdmin error", e);
    return false;
  }
}

  // require admin via modal input (calls callback only when ok)
  function requireAdminConfirm(actionCallback) {
    mostrarModal(`
      <h3>Contraseña Administrador</h3>
      <input type="password" id="__admin_input" placeholder="Contraseña admin">
      <div style="margin-top:10px">
        <button id="__admin_ok">Aceptar</button>
        <button id="__admin_cancel">Cancelar</button>
      </div>
    `);
    document.getElementById("__admin_ok").onclick = async () => {
      const v = (document.getElementById("__admin_input").value || "").trim();
      const ok = await verificarPassAdmin(v);
      if (ok) {
        cerrarModal();
        actionCallback();
      } else {
        alert("Contraseña incorrecta");
      }
    };
    document.getElementById("__admin_cancel").onclick = cerrarModal;
  }

  // -----------------------
  // NAVIGATION
  // -----------------------
  (function initNavigation() {
    if (!navBtns.length || !sections.length) return;
    function showSection(id) {
      sections.forEach(s => s.classList.add("hidden"));
      navBtns.forEach(b => b.classList.remove("active"));
      const sec = document.getElementById(id);
      if (sec) sec.classList.remove("hidden");
      const btn = Array.from(navBtns).find(b => b.dataset.section === id);
      if (btn) btn.classList.add("active");
    }
    navBtns.forEach(btn => btn.addEventListener("click", () => {
      if (btn.dataset && btn.dataset.section) showSection(btn.dataset.section);
    }));
    // default
    const defaultBtn = document.querySelector('.nav-btn[data-section="cobro"]') || navBtns[0];
    if (defaultBtn) defaultBtn.click();
  })();

  // -----------------------
  // Inicializacion selects
  // -----------------------
  (function initSelects() {
    // cobro cantidad 1..99
    if (cobroCantidadSelect) {
      cobroCantidadSelect.innerHTML = "";
      for (let i = 1; i <= 99; i++) {
        const o = document.createElement("option");
        o.value = i;
        o.textContent = i.toString().padStart(2, "0");
        cobroCantidadSelect.appendChild(o);
      }
    }
    // stock cantidad 1..999
    if (stockCantidadSelect) {
      stockCantidadSelect.innerHTML = "";
      for (let i = 1; i <= 999; i++) {
        const o = document.createElement("option");
        o.value = i;
        o.textContent = i.toString().padStart(3, "0");
        stockCantidadSelect.appendChild(o);
      }
    }
    // cajero nro select used when adding cajero
    if (cajeroNroSelect) {
      cajeroNroSelect.innerHTML = "";
      for (let i = 1; i <= 99; i++) {
        const v = i.toString().padStart(2, "0");
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v;
        cajeroNroSelect.appendChild(o);
      }
    }
    // loginUsuario 01..99
    if (loginUsuario) {
      loginUsuario.innerHTML = "";
      for (let i = 1; i <= 99; i++) {
        const v = i.toString().padStart(2, "0");
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v;
        loginUsuario.appendChild(o);
      }
    }
    // filtroCajero will be filled by DB listener (includes TODOS)
  })();

  // -----------------------
  // COBRAR (login + cart)
  // -----------------------
  if (btnLogin) {
    btnLogin.addEventListener("click", async () => {
      const nro = (loginUsuario.value || "").trim();
      const pass = (loginPass.value || "").trim();
      loginMsg.textContent = "";
      if (!nro || !pass) {
        loginMsg.textContent = "Complete usuario y contraseña";
        return;
      }
      const snap = await window.get(window.ref(window.db, `cajeros/${nro}`));
      if (!snap.exists()) {
        loginMsg.textContent = "Cajero no encontrado";
        return;
      }
      const caj = snap.val();
      if (caj.pass !== pass) {
        loginMsg.textContent = "Contraseña incorrecta";
        return;
      }
      cajeroActivo = caj;
      loginModal.classList.add("hidden");
      cobroControles.classList.remove("hidden");
      const appTitle = document.getElementById("app-title");
      if (appTitle) {
  const shop = configCache?.shopName || "SUPERCODE";
  appTitle.textContent = `${shop} - Cajero ${cajeroActivo.nro}`;
}

    });
  }

  if (cobroCodigo) {
    cobroCodigo.addEventListener("keydown", async (e) => {
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
      // normalize price to number
      const precioNumber = (typeof prod.precio === "number") ? prod.precio : Number(String(prod.precio).replace(",", "."));
      if (Number(prod.cantidad) < cantidad) {
        alert("Stock insuficiente");
        return;
      }

      // If product already in carrito, sum quantities
      const idx = carrito.findIndex(it => it.codigo === codigo);
      if (idx >= 0) {
        carrito[idx].cantidad += cantidad;
      } else {
        carrito.push({
          codigo,
          nombre: prod.nombre,
          precio: Number(precioNumber) || 0,
          cantidad
        });
      }

      // update stock quantity in DB
      await window.update(window.ref(window.db, `stock/${codigo}`), { cantidad: Math.max(0, Number(prod.cantidad) - cantidad) });

      renderCarrito();
      cobroCodigo.value = "";
    });
  }

  function renderCarrito() {
    if (!tablaCobroBody) return;
    tablaCobroBody.innerHTML = "";
    total = 0;
    carrito.forEach((it, i) => {
      const tr = document.createElement("tr");
      const rowTotal = Number(it.precio) * Number(it.cantidad);
      total += rowTotal;
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

    // attach delete handlers (requires admin)
    document.querySelectorAll(".btn-delete-cart").forEach(btn => {
      btn.onclick = () => {
        const i = Number(btn.dataset.i);
        const it = carrito[i];
        requireAdminConfirm(async () => {
          // restore stock
          const snap = await window.get(window.ref(window.db, `stock/${it.codigo}`));
          if (snap.exists()) {
            const prod = snap.val();
            await window.update(window.ref(window.db, `stock/${it.codigo}`), { cantidad: Number(prod.cantidad) + Number(it.cantidad) });
          }
          carrito.splice(i, 1);
          renderCarrito();
        });
      };
    });
  }

  if (btnCobrar) {
    btnCobrar.addEventListener("click", () => {
      if (!cajeroActivo) return alert("Ingrese con un cajero primero");
      if (carrito.length === 0) return;
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
    });
  }

  async function finalizarCobro(tipoPago) {
    cerrarModal();
    const movId = `ID_${Date.now()}`;
    const mov = {
      id: movId,
      cajero: cajeroActivo ? (cajeroActivo.nro || cajeroActivo.nombre) : "N/A",
      total,
      tipo: tipoPago,
      fecha: ahoraISO(),
      items: carrito.map(it => ({ codigo: it.codigo, nombre: it.nombre, precio: it.precio, cantidad: it.cantidad }))
    };

    // Guardar en movimientos
    await window.set(window.ref(window.db, `movimientos/${movId}`), mov);

    // --- NUEVO: Guardar copia en HISTORIAL por año-mes ---
    try {
      const fechaMov = mov.fecha ? new Date(mov.fecha) : new Date();
      const año = fechaMov.getFullYear();
      const mes = String(fechaMov.getMonth() + 1).padStart(2, "0");
      await window.set(window.ref(window.db, `historial/${año}-${mes}/${movId}`), mov);
    } catch (err) {
      console.error("Error guardando en historial:", err);
    }
    // --- fin historial ---

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
    const data = snap.val();
    Object.entries(data).forEach(([codigo, prod]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(codigo)}</td>
        <td>${escapeHtml(prod.nombre || "")}</td>
        <td>${Number(prod.cantidad) || 0}</td>
        <td>${prod.fecha ? formatoFechaIsoToDisplay(prod.fecha) : ""}</td>
        <td>${typeof prod.precio === "number" ? formatoPrecioParaPantalla(prod.precio) : ('$' + String(prod.precio || "").replace('.',','))}</td>
        <td>
          <button class="btn-edit-stock" data-id="${codigo}">Editar</button>
          <button class="btn-del-stock" data-id="${codigo}">Eliminar</button>
        </td>
      `;
      tablaStockBody.appendChild(tr);
    });

    // Attach events
    document.querySelectorAll(".btn-del-stock").forEach(btn => {
      btn.onclick = () => {
        requireAdminConfirm(async () => {
          await window.remove(window.ref(window.db, `stock/${btn.dataset.id}`));
        });
      };
    });
    document.querySelectorAll(".btn-edit-stock").forEach(btn => {
      btn.onclick = () => requireAdminConfirm(() => editarStockModal(btn.dataset.id));
    });
  });

  if (btnAgregarStock) {
    btnAgregarStock.addEventListener("click", async () => {
      const codigo = (inputStockCodigo.value || "").trim();
      const cantidad = safeNumber(stockCantidadSelect.value);
      if (!codigo) {
        alert("Ingrese código");
        return;
      }
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
      inputStockCodigo.value = "";
    });
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
        if (!/^\d{1,5},\d{2}$/.test(precio)) {
          alert("Precio inválido. Formato: 00000,00");
          return;
        }
        await window.update(window.ref(window.db, `stock/${codigo}`), {
          nombre: nombre || "PRODUCTO NUEVO",
          precio: precio,
          cantidad: cantidadVal,
          fecha: ahoraISO()
        });
        cerrarModal();
      };
    })();
  }

  // -----------------------
  // CAJEROS
  // -----------------------
  window.onValue(window.ref(window.db, "cajeros"), snap => {
    cajerosCache = {};
    if (tablaCajerosBody) tablaCajerosBody.innerHTML = "";
    // limpiar y añadir TODOS + cargar filtroCajero
    if (filtroCajero) {
      filtroCajero.innerHTML = `<option value="TODOS">TODOS</option>`;
    }
    if (!snap.exists()) return;
    const data = snap.val();
    Object.entries(data).forEach(([nro, caj]) => {
      cajerosCache[nro] = caj;
      // tabla cajeros
      if (tablaCajerosBody) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(nro)}</td>
          <td>${escapeHtml(caj.nombre || "")}</td>
          <td>${escapeHtml(caj.dni || "")}</td>
          <td>
            <button class="btn-edit-caj" data-id="${nro}">Editar</button>
            <button class="btn-del-caj" data-id="${nro}">Eliminar</button>
          </td>
        `;
        tablaCajerosBody.appendChild(tr);
      }
      // filtroCajero option
      if (filtroCajero) {
        const opt = document.createElement("option");
        opt.value = nro;
        opt.textContent = `${nro} - ${caj.nombre || ""}`;
        filtroCajero.appendChild(opt);
      }
    });

    // attach events to cajeros table actions
    document.querySelectorAll(".btn-del-caj").forEach(btn => {
      btn.onclick = () => {
        requireAdminConfirm(async () => {
          await window.remove(window.ref(window.db, `cajeros/${btn.dataset.id}`));
        });
      };
    });
    document.querySelectorAll(".btn-edit-caj").forEach(btn => {
      btn.onclick = () => requireAdminConfirm(() => editarCajeroModal(btn.dataset.id));
    });
  });

  if (btnAgregarCajero) {
    btnAgregarCajero.addEventListener("click", async () => {
      const nro = (cajeroNroSelect.value || "").trim();
      const nombre = (inputCajeroNombre.value || "").trim();
      const dni = (inputCajeroDni.value || "").trim();
      const pass = (inputCajeroPass.value || "").trim();
      if (!nombre || !dni || !pass) {
        alert("Complete todos los campos");
        return;
      }
      if (!/^\d{8}$/.test(dni)) {
        alert("DNI inválido (debe tener 8 dígitos numéricos)");
        return;
      }
      await window.set(window.ref(window.db, `cajeros/${nro}`), { nro, nombre, dni, pass });
      inputCajeroNombre.value = "";
      inputCajeroDni.value = "";
      inputCajeroPass.value = "";
    });
  }

  function editarCajeroModal(nro) {
    (async () => {
      const snap = await window.get(window.ref(window.db, `cajeros/${nro}`));
      if (!snap.exists()) return;
      const caj = snap.val();
      mostrarModal(`
        <h3>Editar Cajero</h3>
        <label>Nombre</label><input id="__edit_caj_nombre" value="${escapeHtml(caj.nombre || "")}">
        <label>DNI</label><input id="__edit_caj_dni" value="${escapeHtml(caj.dni || "")}">
        <label>Pass</label><input id="__edit_caj_pass" value="${escapeHtml(caj.pass || "")}">
        <div style="margin-top:10px">
          <button id="__save_caj">Guardar</button>
          <button id="__cancel_caj">Cancelar</button>
        </div>
      `);
      document.getElementById("__cancel_caj").onclick = cerrarModal;
      document.getElementById("__save_caj").onclick = async () => {
        const nombre = (document.getElementById("__edit_caj_nombre").value || "").trim();
        const dni = (document.getElementById("__edit_caj_dni").value || "").trim();
        const pass = (document.getElementById("__edit_caj_pass").value || "").trim();
        if (!/^\d{8}$/.test(dni)) {
          alert("DNI inválido (8 dígitos)");
          return;
        }
        await window.update(window.ref(window.db, `cajeros/${nro}`), { nombre, dni, pass });
        cerrarModal();
      };
    })();
  }

  // -----------------------
  // MOVIMIENTOS (render + filtro)
  // -----------------------
  // listen movimientos (cache)
  window.onValue(window.ref(window.db, "movimientos"), snap => {
    movimientosCache = snap.exists() ? snap.val() : {};
    renderMovimientos();
  });

  // filtro change
  if (filtroCajero) {
    filtroCajero.addEventListener("change", () => renderMovimientos());
  }

  function renderMovimientos() {
    if (!tablaMovimientosBody) return;
    tablaMovimientosBody.innerHTML = "";
    const dataArr = Object.values(movimientosCache || {});
    const filtro = (filtroCajero && filtroCajero.value) ? filtroCajero.value : "TODOS";
    const filtrados = filtro === "TODOS" ? dataArr : dataArr.filter(m => (m.cajero || "") === filtro);

    // sort by fecha desc (newer first) if fecha exists
    filtrados.sort((a, b) => {
      const ta = a.fecha ? new Date(a.fecha).getTime() : 0;
      const tb = b.fecha ? new Date(b.fecha).getTime() : 0;
      return tb - ta;
    });

    filtrados.forEach(mov => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(mov.id)}</td>
        <td>${formatoPrecioParaPantalla(mov.total)}</td>
        <td>${escapeHtml(mov.tipo)}</td>
        <td>
          <button class="btn-ver-mov" data-id="${mov.id}">Ver</button>
          <button class="btn-del-mov" data-id="${mov.id}">Eliminar</button>
        </td>
      `;
      tablaMovimientosBody.appendChild(tr);
    });

    // attach actions
document.querySelectorAll(".btn-del-mov").forEach(btn => {
  btn.onclick = () => requireAdminConfirm(async () => {
    const movRef = window.ref(window.db, `movimientos/${btn.dataset.id}`);
    const snap = await window.get(movRef);
    if (!snap.exists()) return;

    const mov = snap.val();

    // 🔥 Restaurar stock antes de eliminar
    if (mov.items && Array.isArray(mov.items)) {
      for (const item of mov.items) {
        const stockRef = window.ref(window.db, `stock/${item.codigo}`);
        const stockSnap = await window.get(stockRef);

        if (stockSnap.exists()) {
          const prod = stockSnap.val();
          const nuevaCantidad = (prod.cantidad || 0) + (item.cantidad || 0);
          await window.update(stockRef, { cantidad: nuevaCantidad });
        } else {
          // Si no existe en stock, lo re-creamos con lo vendido
          await window.set(stockRef, {
            codigo: item.codigo,
            nombre: item.nombre || "PRODUCTO NUEVO",
            cantidad: item.cantidad,
            precio: item.precio || 0,
            fecha: new Date().toLocaleString()
          });
        }
      }
    }

    // Ahora sí, eliminar el movimiento
    await window.remove(movRef);
    console.log(`Movimiento ${btn.dataset.id} eliminado y stock restaurado`);
  });
});

    document.querySelectorAll(".btn-ver-mov").forEach(btn => {
      btn.onclick = () => verMovimientoModal(btn.dataset.id);
    });
  }

  function verMovimientoModal(id) {
    (async () => {
      const snap = await window.get(window.ref(window.db, `movimientos/${id}`));
      if (!snap.exists()) return alert("Movimiento no encontrado");
      const mov = snap.val();
      let html = `<p id="texto-ticket-modal">Ticket ${mov.id}</p>`;
      html += `<p id="texto-ticket-modal">${formatFechaParaHeader(mov.fecha)}</p>`;
      html += `<p id="texto-ticket-modal">Cajero: ${escapeHtml(mov.cajero)}</p>`;
      (mov.items || []).forEach(it => {
        html += `<hr id="hr-ticket"><p id="texto-ticket-modal">${escapeHtml(it.nombre)} </p><span class="linea"></span><p id="texto-ticket-modal">${formatoPrecioParaPantalla(it.precio)} (x${it.cantidad}) = ${formatoPrecioParaPantalla(it.precio * it.cantidad)}</p>`;
      });
      html += `<hr id="hr-ticket"><p id="texto-ticket-modal"><b>TOTAL: ${formatoPrecioParaPantalla(mov.total)}</b></p><p id="texto-ticket-modal">Pago en: ${escapeHtml(mov.tipo)}</p>`;
      html += `<div style="margin-top:10px"><button id="__print_copy">Imprimir Copia</button><button id="__close_mov">Cerrar</button></div>`;
      mostrarModal(html);
      document.getElementById("__close_mov").onclick = cerrarModal;
      document.getElementById("__print_copy").onclick = () => imprimirTicketMov(mov);
    })();
  }

  // Print ticket with pagination
  function imprimirTicketMov(mov) {
    const itemsPerPage = 9999;
    const items = mov.items || [];
    const totalParts = Math.max(1, Math.ceil(items.length / itemsPerPage));
    const printAreas = [];

    for (let p = 0; p < totalParts; p++) {
      const slice = items.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
      const shop = configCache?.shopName || "SUPERCODE";
const header = `<div style="text-align:center"><p id="texto-ticket">${escapeHtml(shop)} <br> ${mov.id} <br> Ticket - Cajero:${escapeHtml(mov.cajero)} <br> ${formatFechaParaHeader(mov.fecha)}</p></div>`;
      let body = "";
      slice.forEach(it => {
        body += `<hr id="hr-ticket"><p id="texto-ticket">${escapeHtml(it.nombre)} <br> ${formatoPrecioParaPantalla(it.precio)} (x${it.cantidad}) = ${formatoPrecioParaPantalla(it.precio * it.cantidad)}</p>`;
      });
      const footer = `<hr id="hr-ticket"><p id="texto-ticket"><b>TOTAL: ${formatoPrecioParaPantalla(mov.total)}</b></p><p id="texto-ticket">(Pago en: ${escapeHtml(mov.tipo)})</p>`;
      const area = document.createElement("div");
      area.className = "print-area";
      area.style.width = "5cm";
      area.innerHTML = header + body + footer;
      printAreas.push(area);
    }

    // append, print, remove
    printAreas.forEach(a => document.body.appendChild(a));
    window.print();
    printAreas.forEach(a => document.body.removeChild(a));
  }

 // -----------------------
 // TIRAR Z (por cajero o TODOS)
 // -----------------------
 if (btnTirarZ) {
   btnTirarZ.addEventListener("click", async () => {
     // Abrir modal para pedir pass admin
     mostrarModal(`
       <h3>Confirmar Tirar Z</h3>
       <p>Contraseña de Encargado:</p>
       <input id="z-pass" type="password" style="width:100%; margin:10px 0; padding:6px">
       <div style="text-align:right">
         <button id="z-cancel">Cancelar</button>
         <button id="z-ok">Aceptar</button>
       </div>
     `);

     document.getElementById("z-cancel").onclick = cerrarModal;
     document.getElementById("z-ok").onclick = async () => {
       const inputPass = document.getElementById("z-pass").value.trim();
       const snapConfig = await window.get(window.ref(window.db, "config"));
       const config = snapConfig.exists() ? snapConfig.val() : {};
       const adminPass = config.passAdmin || "0123456789"; // por defecto

       if (inputPass !== adminPass) {
         alert("Contraseña incorrecta");
         return;
       }
       cerrarModal();

       // === Tirar Z real ===
       const snap = await window.get(window.ref(window.db, "movimientos"));
       if (!snap.exists()) return alert("No hay movimientos para tirar Z");
       const allMovArr = Object.values(snap.val());
       const cajSel = (filtroCajero && filtroCajero.value) ? filtroCajero.value : "TODOS";

       let data = allMovArr;
       if (cajSel !== "TODOS") {
         data = allMovArr.filter(m => (m.cajero || "") === cajSel);
         if (data.length === 0) return alert(`No hay movimientos para el cajero ${cajSel}`);
       }

       // group by cajero y tipo
       const grouped = {};
       data.forEach(m => {
         const caj = m.cajero || "N/A";
         if (!grouped[caj]) grouped[caj] = { Efectivo: [], Tarjeta: [], otros: [] };
         if (m.tipo === "Efectivo") grouped[caj].Efectivo.push(m);
         else if (m.tipo === "Tarjeta") grouped[caj].Tarjeta.push(m);
         else grouped[caj].otros.push(m);
       });

       let html = `<h2>Reporte Z - ${new Date().toLocaleString()}</h2>`;
       let grandTotal = 0;
       Object.keys(grouped).forEach(caj => {
         html += `<h3>Cajero: ${caj}</h3>`;
         let totalEf = 0, totalTar = 0;
         html += `<h4>Efectivo</h4>`;
         grouped[caj].Efectivo.forEach(m => { 
           html += `<p>ID ${m.id} - ${formatoPrecioParaPantalla(m.total)}</p>`;
           totalEf += Number(m.total); 
         });
         html += `<p><b>Total Efectivo Cajero: ${formatoPrecioParaPantalla(totalEf)}</b></p>`;
         html += `<h4>Tarjeta</h4>`;
         grouped[caj].Tarjeta.forEach(m => { 
           html += `<p>ID ${m.id} - ${formatoPrecioParaPantalla(m.total)}</p>`;
           totalTar += Number(m.total); 
         });
         html += `<p><b>Total Tarjeta Cajero: ${formatoPrecioParaPantalla(totalTar)}</b></p>`;
         html += `<p><b>Subtotal Cajero: ${formatoPrecioParaPantalla(totalEf + totalTar)}</b></p>`;
         grandTotal += totalEf + totalTar;
       });

       html += `<h2>Total General: ${formatoPrecioParaPantalla(grandTotal)}</h2>`;
       html += `<br><table border="1" style="width:100%; margin-top:20px"><tr><th>Efectivo Cobrado</th><th>Firma Cajero</th><th>Firma Encargado</th></tr><tr><td></td><td></td><td></td></tr></table>`;
       html += `<br><table border="1" style="width:100%; margin-top:10px"><tr><th>Tarjeta Cobrada</th><th>Firma Cajero</th><th>Firma Encargado</th></tr><tr><td></td><td></td><td></td></tr></table>`;

       const area = document.createElement("div");
       area.className = "print-area";
       area.style.width = "21cm";
       area.innerHTML = html;
       document.body.appendChild(area);
       window.print();
       document.body.removeChild(area);

       // borrar movimientos
       if (cajSel === "TODOS") {
         await window.set(window.ref(window.db, "movimientos"), {});
       } else {
         const updates = {};
         Object.values(snap.val()).forEach(m => {
           if ((m.cajero || "") === cajSel) updates[m.id] = null;
         });
         await window.update(window.ref(window.db, "movimientos"), updates);
       }
       alert(`Tirar Z completado para ${cajSel}`);
     };
   });
 }

  // -----------------------
  // CONFIG
  // -----------------------
  window.onValue(window.ref(window.db, "config"), snap => {
    if (!snap.exists()) return;
    const conf = snap.val();
    configCache = conf;
    if (inputConfigNombre) inputConfigNombre.value = conf.shopName || "";
  });

if (btnGuardarConfig) {
  btnGuardarConfig.addEventListener("click", async () => {
    const shopName = (inputConfigNombre.value || "").trim();
    const actual = (inputConfigPassActual.value || "").trim();
    const nueva = (inputConfigPassNueva.value || "").trim();

    if (!actual || !nueva) return alert("Complete los campos");

    const snap = await window.get(window.ref(window.db, "config"));
    if (!snap.exists()) return alert("Error de lectura");

    const conf = snap.val();
    if (actual !== conf.passAdmin) return alert("Contraseña actual incorrecta");

    if (nueva.length < 4 || nueva.length > 10) {
      return alert("La nueva contraseña debe tener entre 4 y 10 caracteres");
    }

    // 🔥 preparar lo que se actualizará
    const updateData = { passAdmin: nueva };
    if (shopName) updateData.shopName = shopName;

    await window.update(window.ref(window.db, "config"), updateData);

    if (configMsg) configMsg.textContent = "Configuración guardada ✅";

    inputConfigPassActual.value = "";
    inputConfigPassNueva.value = "";
  });
}

btnRestaurar.onclick = async () => {
  const v = (inputMasterPass.value || "").trim();
  if (v === "9999") {
    await window.update(window.ref(window.db, "config"), { passAdmin: "0123456789" });
    configMsg.textContent = "Contraseña restaurada a 0123456789";
  } else {
    configMsg.textContent = "Contraseña maestra incorrecta";
  }
};

  // -----------------------
  // HISTORIAL (render + acciones)
  // -----------------------
  function cargarHistorial() {
    // carga el historial del mes actual
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const pathHistorial = `historial/${año}-${mes}`;
    // mostrar info en header opcional
    if (historialInfo) {
      const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
      historialInfo.textContent = `Historial de ${meses[Number(mes)-1]} ${año} (se elimina el día 15 del mes siguiente)`;
    }

    window.onValue(window.ref(window.db, pathHistorial), snap => {
      if (!tablaHistorialBody) return;
      tablaHistorialBody.innerHTML = "";
      if (!snap.exists()) return;
      const datos = snap.val();
      // convertir a array ordenado por fecha descendente
      const arr = Object.values(datos).sort((a,b) => {
        const ta = a.fecha ? new Date(a.fecha).getTime() : 0;
        const tb = b.fecha ? new Date(b.fecha).getTime() : 0;
        return tb - ta;
      });
      arr.forEach(mov => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(mov.id)}</td>
          <td>${formatoPrecioParaPantalla(mov.total)}</td>
          <td>${escapeHtml(mov.tipo)}</td>
          <td>${escapeHtml(mov.cajero || "")}</td>
          <td>${formatFechaParaHeader(mov.fecha)}</td>
          <td>
            <button class="btn-ver-hist" data-id="${mov.id}">Ver</button>
          </td>
        `;
        tablaHistorialBody.appendChild(tr);
      });

      // attach actions (usar same pathHistorial)
      document.querySelectorAll(".btn-ver-hist").forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          const snapMov = await window.get(window.ref(window.db, `${pathHistorial}/${id}`));
          if (!snapMov.exists()) return alert("Movimiento no encontrado en historial");
          const mov = snapMov.val();
          // reutilizar modal del movimiento
          let html = `<h3>Ticket ${mov.id}</h3>`;
          html += `<p>${formatFechaParaHeader(mov.fecha)}</p>`;
          html += `<p>Cajero: ${escapeHtml(mov.cajero)}</p><hr id="hr-ticket">`;
          (mov.items || []).forEach(it => {
            html += `<p>${escapeHtml(it.nombre)} - ${it.cantidad} - ${formatoPrecioParaPantalla(it.precio)} - ${formatoPrecioParaPantalla(it.precio * it.cantidad)}</p>`;
          });
          html += `<hr id="hr-ticket"><p><b>TOTAL: ${formatoPrecioParaPantalla(mov.total)}</b></p><p>Pago: ${escapeHtml(mov.tipo)}</p>`;
          html += `<div style="margin-top:10px"><button id="__print_copy_hist">Imprimir Copia</button><button id="__close_hist">Cerrar</button></div>`;
          mostrarModal(html);
          document.getElementById("__close_hist").onclick = cerrarModal;
          document.getElementById("__print_copy_hist").onclick = () => imprimirTicketMov(mov);
        };
      });

      document.querySelectorAll(".btn-del-hist").forEach(btn => {
        btn.onclick = () => {
          requireAdminConfirm(async () => {
            try {
              await window.remove(window.ref(window.db, `${pathHistorial}/${btn.dataset.id}`));
            } catch (err) {
              console.error("Error borrando historial item:", err);
            }
          });
        };
      });
    });
  }

  // iniciar carga historial
  cargarHistorial();

  // -----------------------
  // LIMPIAR HISTORIAL EL DÍA 15 (elimina mes anterior)
  // -----------------------
  async function limpiarHistorialMensual() {
    try {
      const hoy = new Date();
      const dia = hoy.getDate();
      if (dia === 15) { // si hoy es 15 -> borrar mes anterior
        const año = hoy.getFullYear();
        const mesAnteriorIndex = hoy.getMonth() - 1; // ayer? mes anterior
        let añoTarget = año;
        let mesTarget;
        if (mesAnteriorIndex < 0) {
          añoTarget = año - 1;
          mesTarget = 12;
        } else {
          mesTarget = mesAnteriorIndex + 1;
        }
        const mesStr = String(mesTarget).padStart(2, "0");
        const pathHistorial = `historial/${añoTarget}-${mesStr}`;
        await window.remove(window.ref(window.db, pathHistorial));
        console.log(`🗑 Historial de ${añoTarget}-${mesStr} eliminado (ejecutado día 15)`);
      }
    } catch (err) {
      console.error("Error en limpiarHistorialMensual:", err);
    }
  }
  // Ejecutar a la carga
  limpiarHistorialMensual();
  // Y programar chequeo diario (por si la app queda abierta)
  try {
    setInterval(() => {
      limpiarHistorialMensual();
    }, 24 * 60 * 60 * 1000); // cada 24h
  } catch (err) {
    // No crítico si falla
  }

/*****************************************************
 * Modal de pérdida de conexión
 *****************************************************/
function mostrarModalOffline() {
  const overlay = document.getElementById("modal-overlay");

  overlay.innerHTML = `
    <div class="modal-container">
      <div class="modal">
        <h3>¡Te quedaste sin internet!</h3>
        <p>Para continuar, conectáte a internet o comunicate al <b>3794 576062</b></p>
      </div>
    </div>
  `;

  overlay.classList.remove("hidden");

  // Aseguramos estilos para centrar
  Object.assign(overlay.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999
  });

  const modal = overlay.querySelector(".modal");
  Object.assign(modal.style, {
    background: "#fff",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    textAlign: "center",
    maxWidth: "400px",
    width: "90%"
  });
}

function cerrarModalOffline() {
  const overlay = document.getElementById("modal-overlay");
  overlay.classList.add("hidden");
  overlay.innerHTML = ""; // limpiar contenido
  overlay.removeAttribute("style"); // limpiar estilos inline
}

// Detectar cambios de conexión
window.addEventListener("offline", () => {
  mostrarModalOffline();
});

window.addEventListener("online", () => {
  cerrarModalOffline();
});

  // -----------------------
  // Final
  // -----------------------
  console.log("✅ app.js cargado y listo");
})();
