/*****************************************************
 * app.js (reemplazo completo)
 * Funcional: Cobrar, Stock, Cajeros, Movimientos, Config, Offline
 * Requiere en index.html: elementos con los IDs usados abajo
 * Requiere helpers de Firebase expuestos en window: ref,get,set,update,remove,onValue,push
 *****************************************************/
(() => {
  "use strict";

  // -----------------------
  // Referencias DOM
  // -----------------------
  const modalOverlay = document.getElementById("modal-overlay");
  const modalBody = document.getElementById("modal-body");
  const modalButtons = document.getElementById("modal-buttons");
  const modalOkBtn = document.getElementById("modal-ok");

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
  const filtroCajero = document.getElementById("filtroCajero");

  // Historial
  const tablaHistorialBody = document.querySelector("#tabla-historial tbody");
  const historialInfo = document.getElementById("historial-info");

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
  let movimientosCache = {}; // cache movimientos
  let cajerosCache = {};
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

  // -----------------------
  // MODAL (unificado, acepta HTML)
  // -----------------------
  // mostrarModal(html [, opts])
  // opts can be boolean (blocking) for backward compat, or object:
  // { blocking: boolean, defaultButtons: boolean }
  function mostrarModal(html, opts) {
    let blocking = false;
    let defaultButtons = true;
    if (typeof opts === "boolean") {
      blocking = opts;
    } else if (typeof opts === "object" && opts !== null) {
      blocking = !!opts.blocking;
      if (typeof opts.defaultButtons !== "undefined") defaultButtons = !!opts.defaultButtons;
    }
    if (!modalOverlay || !modalBody || !modalButtons) {
      // fallback: alert
      try {
        const tmp = document.createElement("div");
        tmp.innerHTML = html;
        alert(tmp.textContent || tmp.innerText || "Mensaje");
      } catch (e) {
        alert("Modal no disponible");
      }
      return;
    }
    modalBody.innerHTML = html;
    modalOverlay.classList.remove("hidden");

    if (defaultButtons) {
      modalButtons.style.display = "flex";
      modalOkBtn.style.display = "inline-block";
      modalOkBtn.onclick = () => cerrarModal();
      if (blocking) {
        // if blocking, hide OK so user can't dismiss by default
        modalOkBtn.style.display = "none";
      }
    } else {
      // hide default button area; content must include its own buttons and handlers
      modalButtons.style.display = "none";
    }
  }

  function cerrarModal() {
    if (!modalOverlay || !modalBody) return;
    modalOverlay.classList.add("hidden");
    modalBody.innerHTML = "";
  }

  // -----------------------
  // Password admin verification
  // -----------------------
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

  // -----------------------
  // require admin modal (calls callback only when ok)
  // -----------------------
  function requireAdminConfirm(actionCallback) {
    // Build content with its own buttons so default modal-buttons stay hidden
    const html = `
      <h3>Contraseña Administrador</h3>
      <input type="password" id="__admin_input" placeholder="Contraseña admin" style="width:100%; margin:10px 0; padding:6px">
      <div style="margin-top:10px; text-align:right">
        <button id="__admin_cancel">Cancelar</button>
        <button id="__admin_ok">Aceptar</button>
      </div>
    `;
    // show modal hiding default buttons area
    mostrarModal(html, { blocking: false, defaultButtons: false });

    // attach handlers (elements exist because we just injected HTML)
    const btnOk = document.getElementById("__admin_ok");
    const btnCancel = document.getElementById("__admin_cancel");
    const input = document.getElementById("__admin_input");

    if (btnOk) {
      btnOk.onclick = async () => {
        const v = (input && input.value || "").trim();
        const ok = await verificarPassAdmin(v);
        if (ok) {
          cerrarModal();
          try { actionCallback(); } catch (e) { console.error("actionCallback error", e); }
        } else {
          alert("Contraseña incorrecta");
        }
      };
    }
    if (btnCancel) btnCancel.onclick = cerrarModal;

    // focus the input
    if (input) {
      setTimeout(() => input.focus(), 50);
    }
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
      if (appTitle) appTitle.textContent = `SUPERCODE - Cajero ${cajeroActivo.nro}`;
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

      // update stock quantity in DB (or offline queue via hooked window.update)
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
          } else {
            await window.set(window.ref(window.db, `stock/${it.codigo}`), {
              nombre: it.nombre || "PRODUCTO NUEVO",
              cantidad: it.cantidad,
              precio: it.precio || "00000,00",
              fecha: ahoraISO()
            });
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
      `, { defaultButtons: false });
      // attach handlers inside modal (content created)
      setTimeout(() => {
        const payCancel = document.getElementById("__pay_cancel");
        const payCash = document.getElementById("__pay_cash");
        const payCard = document.getElementById("__pay_card");
        if (payCancel) payCancel.onclick = cerrarModal;
        if (payCash) payCash.onclick = () => finalizarCobro("Efectivo");
        if (payCard) payCard.onclick = () => finalizarCobro("Tarjeta");
      }, 20);
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

    // Guardar en movimientos (this will use hooked window.set -> offline-capable)
    await window.set(window.ref(window.db, `movimientos/${movId}`), mov);

    // Guardar copia en HISTORIAL por año-mes
    try {
      const fechaMov = mov.fecha ? new Date(mov.fecha) : new Date();
      const año = fechaMov.getFullYear();
      const mes = String(fechaMov.getMonth() + 1).padStart(2, "0");
      await window.set(window.ref(window.db, `historial/${año}-${mes}/${movId}`), mov);
    } catch (err) {
      console.error("Error guardando en historial:", err);
    }

    imprimirTicketMov(mov);
    carrito = [];
    renderCarrito();
    alert("Venta registrada ✅");
  }

  // -----------------------
  // STOCK (ordenar por fecha desc)
  // -----------------------
  window.onValue(window.ref(window.db, "stock"), snap => {
    if (!tablaStockBody) return;
    tablaStockBody.innerHTML = "";
    if (!snap.exists()) return;
    const data = snap.val();

    // Convertir a array y ordenar (más recientes primero)
    const productosOrdenados = Object.entries(data).sort((a, b) => {
      const fechaA = a[1].fecha ? new Date(a[1].fecha).getTime() : 0;
      const fechaB = b[1].fecha ? new Date(b[1].fecha).getTime() : 0;
      return fechaB - fechaA; // descendente
    });

    // Renderizar ordenados
    productosOrdenados.forEach(([codigo, prod]) => {
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
      `, { defaultButtons: false });
      // handlers
      setTimeout(() => {
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
      }, 20);
    })();
  }

  // -----------------------
  // CAJEROS
  // -----------------------
  window.onValue(window.ref(window.db, "cajeros"), snap => {
    cajerosCache = {};
    if (tablaCajerosBody) tablaCajerosBody.innerHTML = "";
    if (filtroCajero) filtroCajero.innerHTML = `<option value="TODOS">TODOS</option>`;
    if (!snap.exists()) return;
    const data = snap.val();
    Object.entries(data).forEach(([nro, caj]) => {
      cajerosCache[nro] = caj;
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
      if (filtroCajero) {
        const opt = document.createElement("option");
        opt.value = nro;
        opt.textContent = `${nro} - ${caj.nombre || ""}`;
        filtroCajero.appendChild(opt);
      }
    });

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
      `, { defaultButtons: false });
      setTimeout(() => {
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
      }, 20);
    })();
  }

  // -----------------------
  // MOVIMIENTOS (render + filtro)
  // -----------------------
  window.onValue(window.ref(window.db, "movimientos"), snap => {
    movimientosCache = snap.exists() ? snap.val() : {};
    renderMovimientos();
  });

  if (filtroCajero) {
    filtroCajero.addEventListener("change", () => renderMovimientos());
  }

  function renderMovimientos() {
    if (!tablaMovimientosBody) return;
    tablaMovimientosBody.innerHTML = "";
    const dataArr = Object.values(movimientosCache || {});
    const filtro = (filtroCajero && filtroCajero.value) ? filtroCajero.value : "TODOS";
    const filtrados = filtro === "TODOS" ? dataArr : dataArr.filter(m => (m.cajero || "") === filtro);

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

        // Restaurar stock antes de eliminar
        if (mov.items && Array.isArray(mov.items)) {
          for (const item of mov.items) {
            const stockRef = window.ref(window.db, `stock/${item.codigo}`);
            const stockSnap = await window.get(stockRef);

            if (stockSnap.exists()) {
              const prod = stockSnap.val();
              const nuevaCantidad = (Number(prod.cantidad) || 0) + (Number(item.cantidad) || 0);
              await window.update(stockRef, { cantidad: nuevaCantidad });
            } else {
              // Si no existe en stock, lo re-creamos con lo vendido
              await window.set(stockRef, {
                nombre: item.nombre || "PRODUCTO NUEVO",
                cantidad: Number(item.cantidad) || 0,
                precio: item.precio || "00000,00",
                fecha: ahoraISO()
              });
            }
          }
        }

        // Eliminar movimiento
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
      let html = `<h3>Ticket ${mov.id}</h3>`;
      html += `<p>${formatFechaParaHeader(mov.fecha)}</p>`;
      html += `<p>Cajero: ${escapeHtml(mov.cajero)}</p>`;
      (mov.items || []).forEach(it => {
        html += `<hr><p>${escapeHtml(it.nombre)} <br>Cantidad ${it.cantidad} <br>Precio ${formatoPrecioParaPantalla(it.precio)} <br>Total ${formatoPrecioParaPantalla(it.precio * it.cantidad)}</p><hr>`;
      });
      html += `<p><b>TOTAL: ${formatoPrecioParaPantalla(mov.total)}</b></p><p>Pago: ${escapeHtml(mov.tipo)}</p>`;
      html += `<div style="margin-top:10px"><button id="__print_copy">Imprimir Copia</button><button id="__close_mov">Cerrar</button></div>`;
      mostrarModal(html, { defaultButtons: false });
      setTimeout(() => {
        const closeBtn = document.getElementById("__close_mov");
        const printBtn = document.getElementById("__print_copy");
        if (closeBtn) closeBtn.onclick = cerrarModal;
        if (printBtn) printBtn.onclick = () => imprimirTicketMov(mov);
      }, 20);
    })();
  }

  // Print ticket (legible)
  function imprimirTicketMov(mov) {
    const itemsPerPage = 9999; // effectively no pagination for thermal
    const items = mov.items || [];
    const totalParts = Math.max(1, Math.ceil(items.length / itemsPerPage));
    const printAreas = [];

    for (let p = 0; p < totalParts; p++) {
      const slice = items.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
      const header = `<div style="text-align:center"><h3>WWW.SUPERCODE.COM.AR</h3><p>${escapeHtml(mov.id)} <br> Ticket - Cajero:${escapeHtml(mov.cajero)} <br> ${formatFechaParaHeader(mov.fecha)}</p><hr></div>`;
      let body = "";
      slice.forEach(it => {
        body += `<hr><p>${escapeHtml(it.nombre)}<br>Cantidad: ${it.cantidad}<br>Unidad: ${formatoPrecioParaPantalla(it.precio)}<br>Total: ${formatoPrecioParaPantalla(it.precio * it.cantidad)}</p><hr>`;
      });
      const footer = `<hr><p><b>TOTAL: ${formatoPrecioParaPantalla(mov.total)}</b></p><p>(Pago en: ${escapeHtml(mov.tipo)})</p><hr><p>${escapeHtml(mov.id)} <br> Vuelva Pronto - Cajero:${escapeHtml(mov.cajero)} <br> ${formatFechaParaHeader(mov.fecha)}</p>`;
      const area = document.createElement("div");
      area.className = "print-area";
      area.style.width = "5cm";
      area.innerHTML = header + body + footer;
      printAreas.push(area);
    }

    printAreas.forEach(a => document.body.appendChild(a));
    window.print();
    printAreas.forEach(a => document.body.removeChild(a));
  }

  // -----------------------
  // TIRAR Z
  // -----------------------
  if (btnTirarZ) {
    btnTirarZ.addEventListener("click", async () => {
      mostrarModal(`
        <h3>Confirmar Tirar Z</h3>
        <p>Contraseña de Encargado:</p>
        <input id="z-pass" type="password" style="width:100%; margin:10px 0; padding:6px">
        <div style="text-align:right">
          <button id="z-cancel">Cancelar</button>
          <button id="z-ok">Aceptar</button>
        </div>
      `, { defaultButtons: false });

      setTimeout(() => {
        document.getElementById("z-cancel").onclick = cerrarModal;
        document.getElementById("z-ok").onclick = async () => {
          const inputPass = (document.getElementById("z-pass").value || "").trim();
          const snapConfig = await window.get(window.ref(window.db, "config"));
          const config = snapConfig.exists() ? snapConfig.val() : {};
          const adminPass = config.passAdmin || "0123456789"; // por defecto

          if (inputPass !== adminPass) {
            alert("Contraseña incorrecta");
            return;
          }
          cerrarModal();

          // Tirar Z real
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
      }, 20);
    }));
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

      const updateData = { passAdmin: nueva };
      if (shopName) updateData.shopName = shopName;

      await window.update(window.ref(window.db, "config"), updateData);

      if (configMsg) configMsg.textContent = "Configuración guardada ✅";

      inputConfigPassActual.value = "";
      inputConfigPassNueva.value = "";
    });
  }

  if (btnRestaurar) {
    btnRestaurar.onclick = async () => {
      const v = (inputMasterPass.value || "").trim();
      if (v === "9999") {
        await window.update(window.ref(window.db, "config"), { passAdmin: "0123456789" });
        if (configMsg) configMsg.textContent = "Contraseña restaurada a 0123456789";
      } else {
        if (configMsg) configMsg.textContent = "Contraseña maestra incorrecta";
      }
    };
  }

  // -----------------------
  // HISTORIAL (render + acciones)
  // -----------------------
  function cargarHistorial() {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const pathHistorial = `historial/${año}-${mes}`;
    if (historialInfo) {
      const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
      historialInfo.textContent = `Historial de ${meses[Number(mes)-1]} ${año} (se elimina el día 15 del mes siguiente)`;
    }

    window.onValue(window.ref(window.db, pathHistorial), snap => {
      if (!tablaHistorialBody) return;
      tablaHistorialBody.innerHTML = "";
      if (!snap.exists()) return;
      const datos = snap.val();
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

      document.querySelectorAll(".btn-ver-hist").forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          const snapMov = await window.get(window.ref(window.db, `${pathHistorial}/${id}`));
          if (!snapMov.exists()) return alert("Movimiento no encontrado en historial");
          const mov = snapMov.val();
          let html = `<h3>Ticket ${mov.id}</h3>`;
          html += `<p>${formatFechaParaHeader(mov.fecha)}</p>`;
          html += `<p>Cajero: ${escapeHtml(mov.cajero)}</p><hr>`;
          (mov.items || []).forEach(it => {
            html += `<p>${escapeHtml(it.nombre)} - ${it.cantidad} - ${formatoPrecioParaPantalla(it.precio)} - ${formatoPrecioParaPantalla(it.precio * it.cantidad)}</p>`;
          });
          html += `<hr><p><b>TOTAL: ${formatoPrecioParaPantalla(mov.total)}</b></p><p>Pago: ${escapeHtml(mov.tipo)}</p>`;
          html += `<div style="margin-top:10px"><button id="__print_copy_hist">Imprimir Copia</button><button id="__close_hist">Cerrar</button></div>`;
          mostrarModal(html, { defaultButtons: false });
          setTimeout(() => {
            document.getElementById("__close_hist").onclick = cerrarModal;
            document.getElementById("__print_copy_hist").onclick = () => imprimirTicketMov(mov);
          }, 20);
        };
      });
    });
  }

  cargarHistorial();

  // -----------------------
  // LIMPIAR HISTORIAL EL DÍA 15
  // -----------------------
  async function limpiarHistorialMensual() {
    try {
      const hoy = new Date();
      const dia = hoy.getDate();
      if (dia === 15) {
        const año = hoy.getFullYear();
        const mesAnteriorIndex = hoy.getMonth() - 1;
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
  limpiarHistorialMensual();
  try {
    setInterval(() => limpiarHistorialMensual(), 24 * 60 * 60 * 1000);
  } catch (err) {}

  // -----------------------
  // OFFLINE: mensaje + cola + hooks
  // -----------------------
  let inicioOffline = null;
  let offlineTimer = null;
  let avisoTimer = null;
  const LIMITE_OFFLINE_MS = 4 * 60 * 60 * 1000; // 4 horas
  const OFFLINE_KEY = "supercode_offline_queue";

  function getOfflineQueue() {
    return JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]");
  }
  function setOfflineQueue(q) {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(q));
  }
  function guardarOffline(tipo, path, data) {
    const queue = getOfflineQueue();
    queue.push({ tipo, path, data, timestamp: Date.now() });
    setOfflineQueue(queue);
    console.log("💾 Guardado offline:", tipo, path, data);
  }

  async function sincronizarOffline() {
    const queue = getOfflineQueue();
    if (!queue.length) return;
    console.log("🌐 Sincronizando", queue.length, "operaciones offline...");
    for (const op of queue) {
      try {
        if (op.tipo === "set") {
          const ref = window.ref(window.db, op.path);
          await _set(ref, op.data);
        } else if (op.tipo === "push") {
          const ref = window.push(window.ref(window.db, op.path));
          await _set(ref, op.data);
        }
        console.log("✅ Sincronizado:", op.tipo, op.path);
      } catch (err) {
        console.error("❌ Error sincronizando:", op, err);
      }
    }
    setOfflineQueue([]);
  }

  window.addEventListener("online", () => {
    // cuando vuelve internet, sincronizar
    sincronizarOffline();
    // limpiar timers/estado offline
    cerrarModal();
    clearInterval(offlineTimer);
    clearInterval(avisoTimer);
    inicioOffline = null;
    mostrarModal("¡Ya tenés internet! Podés seguir cobrando sin límite de tiempo, gracias 🙌");
  });

  window.addEventListener("offline", () => {
    if (!inicioOffline) inicioOffline = Date.now();
    mostrarModal("¡Atención! No hay internet disponible. Se podrá seguir cobrando durante 4 horas. Por favor, conéctese cuanto antes.", { defaultButtons: true });
    clearInterval(offlineTimer);
    clearInterval(avisoTimer);

    offlineTimer = setInterval(() => {
      const diff = Date.now() - inicioOffline;
      if (diff > LIMITE_OFFLINE_MS) {
        mostrarModal("Se acabó el tiempo de tolerancia offline. No puede seguir cobrando sin internet ❌", { defaultButtons: true });
        bloquearCobros();
        clearInterval(offlineTimer);
        clearInterval(avisoTimer);
      }
    }, 60 * 1000);

    avisoTimer = setInterval(() => {
      const diff = Date.now() - inicioOffline;
      const restante = Math.max(0, LIMITE_OFFLINE_MS - diff);
      const horas = Math.floor(restante / (1000 * 60 * 60));
      const mins = Math.floor((restante % (1000 * 60 * 60)) / (1000 * 60));
      mostrarModal(`⚠️ Sin internet. Tiempo restante: ${horas}h ${mins}m para seguir cobrando.`, { defaultButtons: true });
    }, 30 * 60 * 1000);
  });

  function bloquearCobros() {
    const botones = document.querySelectorAll("button, input, select");
    botones.forEach(b => b.disabled = true);
  }

  // -----------------------
  // HOOK a window.set y window.push para cola offline
  // -----------------------
  const _set = window.set;
  const _push = window.push;

  function refToPath(ref) {
    try {
      if (!ref) return "";
      // compat with different ref internals
      if (ref._path && Array.isArray(ref._path.pieces_)) return ref._path.pieces_.join("/");
      if (ref.path && ref.path.pieces_) return ref.path.pieces_.join("/");
      if (typeof ref === "string") return ref;
      return "";
    } catch (e) {
      return "";
    }
  }

  window.set = async (ref, val) => {
    if (navigator.onLine) {
      return _set(ref, val);
    } else {
      const path = refToPath(ref) || (typeof ref === "string" ? ref : "");
      guardarOffline("set", path, val);
    }
  };

  window.push = (ref) => {
    if (navigator.onLine) {
      return _push(ref);
    } else {
      // return mock that has set method (used in sincronizar)
      const path = refToPath(ref) || (typeof ref === "string" ? ref : "");
      return {
        _offlinePath: path,
        set: (val) => guardarOffline("push", path, val)
      };
    }
  };

  // -----------------------
  // Final
  // -----------------------
  console.log("✅ app.js cargado y listo");
})();
