/*****************************************************
 * app.js
 * Integración completa: Login, Cobrar, Stock, Cajeros,
 * Movimientos, Config + impresión y validaciones.
 *
 * Requiere en index.html:
 *  - modal overlay <div id="modal-overlay" class="modal hidden"></div>
 *  - nav buttons .nav-btn[data-section="..."]
 *  - main sections with matching ids
 *  - helpers de Firebase en window: ref, get, set, update, push, remove, onValue
 *****************************************************/
(() => {
  // -----------------------
  // Referencias DOM
  // -----------------------
  const modal = document.getElementById("modal-overlay");

  // Cobrar / Login
  const loginUsuario = document.getElementById("login-usuario");
  const loginPass = document.getElementById("login-pass");
  const btnLogin = document.getElementById("btn-login");
  const loginMsg = document.getElementById("login-msg");
  const loginModal = document.getElementById("login-modal");
  const cobroControles = document.getElementById("cobro-controles");
  const cobroCantidadSelect = document.getElementById("cobro-cantidad");
  const cobroCodigo = document.getElementById("cobro-codigo");
  const tablaCobro = document.querySelector("#tabla-cobro tbody");
  const totalDiv = document.getElementById("total-div");
  const btnCobrar = document.getElementById("btn-cobrar");

  // Stock
  const inputStockCodigo = document.getElementById("stock-codigo");
  const stockCantidadSelect = document.getElementById("stock-cantidad");
  const btnAgregarStock = document.getElementById("agregar-stock");
  const tablaStock = document.querySelector("#tabla-stock tbody");

  // Cajeros
  const cajeroNroSelect = document.getElementById("cajero-nro");
  const inputCajeroNombre = document.getElementById("cajero-nombre");
  const inputCajeroDni = document.getElementById("cajero-dni");
  const inputCajeroPass = document.getElementById("cajero-pass");
  const btnAgregarCajero = document.getElementById("agregar-cajero");
  const tablaCajeros = document.querySelector("#tabla-cajeros tbody");

  // Movimientos
  const tablaMovimientos = document.querySelector("#tabla-movimientos tbody");
  const btnTirarZ = document.getElementById("btn-tirar-z");
  const filtroCajero = document.getElementById("filtro-cajero"); // 👈 filtro de cajero

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
  let carrito = [];
  let total = 0;
  let passAdminCache = null;

  // -----------------------
  // Utilidades
  // -----------------------
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
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${d.getFullYear()} (${d.getHours()
      .toString()
      .padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")})`;
  }

  function formatFechaParaHeader(iso) {
    return formatoFechaIsoToDisplay(iso);
  }

  function mostrarModal(htmlContent) {
    modal.className = "modal";
    modal.innerHTML = htmlContent;
  }
  function cerrarModal() {
    modal.className = "modal hidden";
    modal.innerHTML = "";
  }

  async function verificarPassAdmin(pass) {
    const snap = await window.get(window.ref(window.db, "config"));
    if (!snap.exists()) return false;
    return pass === snap.val().passAdmin;
  }

  function requireAdminConfirm(cb) {
    mostrarModal(`
      <h3>Contraseña Administrador</h3>
      <input type="password" id="__admin_input" placeholder="Contraseña admin">
      <div style="margin-top:10px">
        <button id="__admin_ok">Aceptar</button>
        <button id="__admin_cancel">Cancelar</button>
      </div>
    `);
    document.getElementById("__admin_ok").onclick = async () => {
      const v = document.getElementById("__admin_input").value || "";
      const ok = await verificarPassAdmin(v);
      if (ok) {
        cerrarModal();
        cb();
      } else alert("Contraseña incorrecta");
    };
    document.getElementById("__admin_cancel").onclick = cerrarModal;
  }

  function safeNumber(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  // -----------------------
  // NAVIGATION
  // -----------------------
  (function initNavigation() {
    function showSection(id) {
      sections.forEach(s => s.classList.add("hidden"));
      navBtns.forEach(b => b.classList.remove("active"));
      const sec = document.getElementById(id);
      if (sec) sec.classList.remove("hidden");
      const btn = Array.from(navBtns).find(b => b.dataset.section === id);
      if (btn) btn.classList.add("active");
    }
    navBtns.forEach(btn => {
      btn.addEventListener("click", () => showSection(btn.dataset.section));
    });
    const defaultBtn = document.querySelector('.nav-btn[data-section="cobro"]') || navBtns[0];
    if (defaultBtn) defaultBtn.click();
  })();

  // -----------------------
  // INICIALIZACIÓN DE SELECTS
  // -----------------------
  (function initSelects() {
    if (cobroCantidadSelect) for (let i = 1; i <= 99; i++) cobroCantidadSelect.append(new Option(i.toString().padStart(2, "0"), i));
    if (stockCantidadSelect) for (let i = 1; i <= 999; i++) stockCantidadSelect.append(new Option(i.toString().padStart(3, "0"), i));
    if (cajeroNroSelect) for (let i = 1; i <= 99; i++) cajeroNroSelect.append(new Option(i.toString().padStart(2, "0"), i.toString().padStart(2, "0")));
    if (loginUsuario) for (let i = 1; i <= 99; i++) loginUsuario.append(new Option(i.toString().padStart(2, "0"), i.toString().padStart(2, "0")));
  })();

  // -----------------------
  // COBRAR (login + cart)
  // -----------------------
  btnLogin &&
    btnLogin.addEventListener("click", async () => {
      const nro = loginUsuario.value.trim();
      const pass = loginPass.value.trim();
      loginMsg.textContent = "";
      if (!nro || !pass) return (loginMsg.textContent = "Complete usuario y contraseña");
      const snap = await window.get(window.ref(window.db, `cajeros/${nro}`));
      if (!snap.exists()) return (loginMsg.textContent = "Cajero no encontrado");
      const caj = snap.val();
      if (caj.pass !== pass) return (loginMsg.textContent = "Contraseña incorrecta");
      cajeroActivo = caj;
      loginModal.classList.add("hidden");
      cobroControles.classList.remove("hidden");
      document.getElementById("app-title").textContent = `SUPERCODE - Cajero ${cajeroActivo.nro}`;
    });

  cobroCodigo &&
    cobroCodigo.addEventListener("keydown", async e => {
      if (e.key !== "Enter") return;
      const codigo = cobroCodigo.value.trim();
      const cantidad = safeNumber(cobroCantidadSelect.value);
      if (!codigo) return;
      const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
      if (!snap.exists()) {
        alert("Producto no encontrado en stock");
        cobroCodigo.value = "";
        return;
      }
      const prod = snap.val();
      const precioNumber = typeof prod.precio === "number" ? prod.precio : Number(String(prod.precio).replace(",", "."));
      if (prod.cantidad < cantidad) return alert("Stock insuficiente");

      const idx = carrito.findIndex(it => it.codigo === codigo);
      if (idx >= 0) carrito[idx].cantidad += cantidad;
      else carrito.push({ codigo, nombre: prod.nombre, precio: Number(precioNumber) || 0, cantidad });

      await window.update(window.ref(window.db, `stock/${codigo}`), { cantidad: Math.max(0, prod.cantidad - cantidad) });
      renderCarrito();
      cobroCodigo.value = "";
    });

  function renderCarrito() {
    tablaCobro.innerHTML = "";
    total = 0;
    carrito.forEach((it, i) => {
      const rowTotal = it.precio * it.cantidad;
      total += rowTotal;
      tablaCobro.innerHTML += `
        <tr>
          <td>${it.cantidad}</td>
          <td>${it.nombre}</td>
          <td>${formatoPrecioParaPantalla(it.precio)}</td>
          <td>${formatoPrecioParaPantalla(rowTotal)}</td>
          <td><button class="btn-delete-cart" data-i="${i}">Eliminar</button></td>
        </tr>`;
    });
    totalDiv.textContent = `TOTAL: ${formatoPrecioParaPantalla(total)}`;
    btnCobrar.classList.toggle("hidden", carrito.length === 0);
    document.querySelectorAll(".btn-delete-cart").forEach(btn => {
      btn.onclick = () => {
        const i = Number(btn.dataset.i);
        const it = carrito[i];
        requireAdminConfirm(async () => {
          const snap = await window.get(window.ref(window.db, `stock/${it.codigo}`));
          if (snap.exists()) await window.update(window.ref(window.db, `stock/${it.codigo}`), { cantidad: snap.val().cantidad + it.cantidad });
          carrito.splice(i, 1);
          renderCarrito();
        });
      };
    });
  }

  btnCobrar &&
    btnCobrar.addEventListener("click", () => {
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
    });

  async function finalizarCobro(tipoPago) {
    cerrarModal();
    const movId = `mov_${Date.now()}`;
    const mov = {
      id: movId,
      cajero: cajeroActivo.nro,
      total,
      tipo: tipoPago,
      fecha: ahoraISO(),
      items: carrito.map(it => ({ ...it })),
    };
    await window.set(window.ref(window.db, `movimientos/${movId}`), mov);
    imprimirTicketMov(mov);
    carrito = [];
    renderCarrito();
    alert("Venta registrada ✅");
  }

  // -----------------------
  // STOCK
  // -----------------------
  window.onValue(window.ref(window.db, "stock"), snap => {
    tablaStock.innerHTML = "";
    if (!snap.exists()) return;
    const data = snap.val();
    Object.entries(data).forEach(([codigo, prod]) => {
      tablaStock.innerHTML += `
        <tr>
          <td>${codigo}</td>
          <td>${prod.nombre}</td>
          <td>${prod.cantidad}</td>
          <td>${prod.fecha ? formatoFechaIsoToDisplay(prod.fecha) : ""}</td>
          <td>${typeof prod.precio === "number" ? formatoPrecioParaPantalla(prod.precio) : "$" + String(prod.precio).replace(".", ",")}</td>
          <td>
            <button class="btn-edit-stock" data-id="${codigo}">Editar</button>
            <button class="btn-del-stock" data-id="${codigo}">Eliminar</button>
          </td>
        </tr>`;
    });
    document.querySelectorAll(".btn-del-stock").forEach(btn => {
      btn.onclick = () => requireAdminConfirm(() => window.remove(window.ref(window.db, `stock/${btn.dataset.id}`)));
    });
    document.querySelectorAll(".btn-edit-stock").forEach(btn => {
      btn.onclick = () => requireAdminConfirm(() => editarStockModal(btn.dataset.id));
    });
  });

  btnAgregarStock &&
    btnAgregarStock.addEventListener("click", async () => {
      const codigo = inputStockCodigo.value.trim();
      const cantidad = safeNumber(stockCantidadSelect.value);
      if (!codigo) return alert("Ingrese código");
      const refProd = window.ref(window.db, `stock/${codigo}`);
      const snap = await window.get(refProd);
      if (snap.exists()) await window.update(refProd, { cantidad: snap.val().cantidad + cantidad, fecha: ahoraISO() });
      else await window.set(refProd, { nombre: "PRODUCTO NUEVO", cantidad, precio: "00000,00", fecha: ahoraISO() });
      inputStockCodigo.value = "";
    });

  function editarStockModal(codigo) {
    (async () => {
      const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
      if (!snap.exists()) return alert("Producto no encontrado");
      const prod = snap.val();
      mostrarModal(`
        <h3>Editar Producto</h3>
        <label>Nombre</label><input id="__edit_nombre" value="${escapeHtml(prod.nombre)}">
        <label>Precio (00000,00)</label><input id="__edit_precio" value="${escapeHtml(String(prod.precio))}">
        <label>Cantidad</label><input id="__edit_cantidad" type="number" value="${prod.cantidad}">
        <div style="margin-top:10px">
          <button id="__save_prod">Guardar</button>
          <button id="__cancel_prod">Cancelar</button>
        </div>
      `);
      document.getElementById("__cancel_prod").onclick = cerrarModal;
      document.getElementById("__save_prod").onclick = async () => {
        const nombre = document.getElementById("__edit_nombre").value.trim();
        const precio = document.getElementById("__edit_precio").value.trim();
        const cantidadVal = safeNumber(document.getElementById("__edit_cantidad").value);
        if (!/^\d{1,5},\d{2}$/.test(precio)) return alert("Precio inválido");
        await window.update(window.ref(window.db, `stock/${codigo}`), { nombre, precio, cantidad: cantidadVal, fecha: ahoraISO() });
        cerrarModal();
      };
    })();
  }

  // -----------------------
  // CAJEROS
  // -----------------------
  window.onValue(window.ref(window.db, "cajeros"), snap => {
    tablaCajeros.innerHTML = "";
    if (!snap.exists()) return;
    Object.entries(snap.val()).forEach(([nro, caj]) => {
      tablaCajeros.innerHTML += `
        <tr>
          <td>${nro}</td>
          <td>${caj.nombre}</td>
          <td>${caj.dni}</td>
          <td>
            <button class="btn-edit-caj" data-id="${nro}">Editar</button>
            <button class="btn-del-caj" data-id="${nro}">Eliminar</button>
          </td>
        </tr>`;
    });
    document.querySelectorAll(".btn-del-caj").forEach(btn => (btn.onclick = () => requireAdminConfirm(() => window.remove(window.ref(window.db, `cajeros/${btn.dataset.id}`)))));
    document.querySelectorAll(".btn-edit-caj").forEach(btn => (btn.onclick = () => requireAdminConfirm(() => editarCajeroModal(btn.dataset.id))));
  });

  btnAgregarCajero &&
    btnAgregarCajero.addEventListener("click", async () => {
      const nro = cajeroNroSelect.value;
      const nombre = inputCajeroNombre.value.trim();
      const dni = inputCajeroDni.value.trim();
      const pass = inputCajeroPass.value.trim();
      if (!nombre || !dni || !pass) return alert("Complete todos los campos");
      if (!/^\d{8}$/.test(dni)) return alert("DNI inválido");
      await window.set(window.ref(window.db, `cajeros/${nro}`), { nro, nombre, dni, pass });
      inputCajeroNombre.value = inputCajeroDni.value = inputCajeroPass.value = "";
    });

  function editarCajeroModal(nro) {
    (async () => {
      const snap = await window.get(window.ref(window.db, `cajeros/${nro}`));
      if (!snap.exists()) return;
      const caj = snap.val();
      mostrarModal(`
        <h3>Editar Cajero</h3>
        <label>Nombre</label><input id="__edit_nombre" value="${escapeHtml(caj.nombre)}">
        <label>DNI</label><input id="__edit_dni" value="${escapeHtml(caj.dni)}">
        <label>Contraseña</label><input id="__edit_pass" value="${escapeHtml(caj.pass)}">
        <div style="margin-top:10px">
          <button id="__save_caj">Guardar</button>
          <button id="__cancel_caj">Cancelar</button>
        </div>
      `);
      document.getElementById("__cancel_caj").onclick = cerrarModal;
      document.getElementById("__save_caj").onclick = async () => {
        const nombre = document.getElementById("__edit_nombre").value.trim();
        const dni = document.getElementById("__edit_dni").value.trim();
        const pass = document.getElementById("__edit_pass").value.trim();
        if (!nombre || !dni || !pass) return alert("Complete todos los campos");
        if (!/^\d{8}$/.test(dni)) return alert("DNI inválido");
        await window.update(window.ref(window.db, `cajeros/${nro}`), { nombre, dni, pass });
        cerrarModal();
      };
    })();
  }

  // -----------------------
  // MOVIMIENTOS
  // -----------------------
  let movimientosCache = {};
  window.onValue(window.ref(window.db, "movimientos"), snap => {
    if (!snap.exists()) {
      movimientosCache = {};
      renderMovimientos("TODOS");
      return;
    }
    movimientosCache = snap.val();
    const filtro = filtroCajero ? filtroCajero.value : "TODOS";
    renderMovimientos(filtro);
  });

  if (filtroCajero) filtroCajero.addEventListener("change", () => renderMovimientos(filtroCajero.value));

  function renderMovimientos(filtro) {
    tablaMovimientos.innerHTML = "";
    const data = Object.values(movimientosCache);
    const filtrados = filtro === "TODOS" ? data : data.filter(m => (m.cajero || "") === filtro);
    filtrados.forEach(mov => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${mov.id}</td>
        <td>${formatoPrecioParaPantalla(mov.total)}</td>
        <td>${mov.tipo}</td>
        <td>
          <button class="btn-ver-mov" data-id="${mov.id}">Ver</button>
          <button class="btn-del-mov" data-id="${mov.id}">Eliminar</button>
        </td>`;
      tablaMovimientos.appendChild(tr);
    });
    document.querySelectorAll(".btn-del-mov").forEach(btn => (btn.onclick = () => requireAdminConfirm(() => window.remove(window.ref(window.db, `movimientos/${btn.dataset.id}`)))));
    document.querySelectorAll(".btn-ver-mov").forEach(btn => (btn.onclick = () => verMovimientoModal(btn.dataset.id)));
  }

  // Tirar Z
  btnTirarZ &&
    btnTirarZ.addEventListener("click", async () => {
      const snap = await window.get(window.ref(window.db, "movimientos"));
      if (!snap.exists()) return alert("No hay movimientos para tirar Z");
      let data = Object.values(snap.val());

      const cajeroSel = filtroCajero ? filtroCajero.value : "TODOS";
      if (cajeroSel !== "TODOS") {
        data = data.filter(m => (m.cajero || "N/A") === cajeroSel);
        if (data.length === 0) return alert(`No hay movimientos para el cajero ${cajeroSel}`);
      }

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
        let totalEf = 0,
          totalTar = 0;
        html += `<h4>Efectivo</h4>`;
        grouped[caj].Efectivo.forEach(m => {
          html += `<p>ID ${m.id} - ${formatoPrecioParaPantalla(m.total)}</p>`;
          totalEf += m.total;
        });
        html += `<strong>Total Efectivo: ${formatoPrecioParaPantalla(totalEf)}</strong>`;
        html += `<h4>Tarjeta</h4>`;
        grouped[caj].Tarjeta.forEach(m => {
          html += `<p>ID ${m.id} - ${formatoPrecioParaPantalla(m.total)}</p>`;
          totalTar += m.total;
        });
        html += `<strong>Total Tarjeta: ${formatoPrecioParaPantalla(totalTar)}</strong>`;
        const totalCaj = totalEf + totalTar;
        html += `<p><strong>Total Cajero ${caj}: ${formatoPrecioParaPantalla(totalCaj)}</strong></p>`;
        grandTotal += totalCaj;
      });
      html += `<h2>GRAN TOTAL: ${formatoPrecioParaPantalla(grandTotal)}</h2>`;

      const div = document.createElement("div");
      div.className = "print-area";
      div.innerHTML = html;
      document.body.appendChild(div);
      window.print();
      div.remove();

      // eliminar movimientos
      if (cajeroSel === "TODOS") {
        await window.set(window.ref(window.db, "movimientos"), {});
      } else {
        const toDelete = data.map(m => window.ref(window.db, `movimientos/${m.id}`));
        for (const refMov of toDelete) await window.remove(refMov);
      }
      alert("Tirar Z completado ✅");
    });

  function verMovimientoModal(id) {
    const m = movimientosCache[id];
    if (!m) return;
    mostrarModal(`
      <h3>Movimiento ${id}</h3>
      <p>Cajero: ${m.cajero}</p>
      <p>Tipo: ${m.tipo}</p>
      <p>Total: ${formatoPrecioParaPantalla(m.total)}</p>
      <p>Fecha: ${formatFechaParaHeader(m.fecha)}</p>
      <h4>Items:</h4>
      <ul>${m.items.map(it => `<li>${it.cantidad} x ${escapeHtml(it.nombre)} - ${formatoPrecioParaPantalla(it.precio)}</li>`).join("")}</ul>
      <div style="margin-top:10px">
        <button id="__close_mov">Cerrar</button>
      </div>
    `);
    document.getElementById("__close_mov").onclick = cerrarModal;
  }

  // -----------------------
  // CONFIG
  // -----------------------
  btnGuardarConfig &&
    btnGuardarConfig.addEventListener("click", async () => {
      const nombre = inputConfigNombre.value.trim();
      const passActual = inputConfigPassActual.value.trim();
      const passNueva = inputConfigPassNueva.value.trim();
      configMsg.textContent = "";
      if (!nombre || !passActual || !passNueva) return (configMsg.textContent = "Complete todos los campos");
      const snap = await window.get(window.ref(window.db, "config"));
      if (!snap.exists()) return (configMsg.textContent = "Config inexistente");
      const cfg = snap.val();
      if (cfg.passAdmin !== passActual) return (configMsg.textContent = "Contraseña actual incorrecta");
      await window.update(window.ref(window.db, "config"), { nombre, passAdmin: passNueva });
      configMsg.textContent = "Configuración guardada ✅";
    });

  btnRestaurar &&
    btnRestaurar.addEventListener("click", async () => {
      const pass = inputMasterPass.value.trim();
      if (pass !== "291295") return alert("Master pass incorrecto");
      await window.set(window.ref(window.db, "config"), { nombre: "SUPERCODE", passAdmin: "admin" });
      alert("Config restaurada");
    });

  // -----------------------
  // IMPRESIÓN DE TICKET
  // -----------------------
  function imprimirTicketMov(m) {
    const div = document.createElement("div");
    div.className = "print-area";
    div.innerHTML = `
      <h3>SUPERCODE</h3>
      <p>Cajero: ${m.cajero}</p>
      <p>Fecha: ${formatFechaParaHeader(m.fecha)}</p>
      <hr>
      ${m.items.map(it => `<p>${it.cantidad} x ${escapeHtml(it.nombre)} - ${formatoPrecioParaPantalla(it.precio)}</p>`).join("")}
      <hr>
      <p><strong>TOTAL: ${formatoPrecioParaPantalla(m.total)}</strong></p>
      <p>Pago: ${m.tipo}</p>
      <hr>
    `;
    document.body.appendChild(div);
    window.print();
    div.remove();
  }
})();
