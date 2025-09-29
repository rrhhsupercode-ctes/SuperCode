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
  let carrito = []; // {codigo, nombre, precio (number), cantidad}
  let total = 0;
  let passAdminCache = null; // cache de config.passAdmin

  // -----------------------
  // Utilidades
  // -----------------------
  function formatoPrecioNumeroToString(num) {
    // num as number, return "00000,00" style with no $ here
    const n = Number(num) || 0;
    // ensure two decimals, comma as decimal separator
    const parts = n.toFixed(2).split(".");
    let int = parts[0];
    let dec = parts[1];
    // pad int to up to 5 digits (not strictly necessary)
    int = int.padStart(1, "0");
    return `${int},${dec}`;
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
    // produce dd/mm/yyyy (HH:MM) exact for ticket header
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
    // obtiene config desde DB y compara
    const snap = await window.get(window.ref(window.db, "config"));
    if (!snap.exists()) return false;
    const conf = snap.val();
    return pass === conf.passAdmin;
  }

  function requireAdminConfirm(actionCallback) {
    // muestra modal pidiendo contraseña admin, si OK ejecuta callback
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
        actionCallback();
      } else {
        alert("Contraseña incorrecta");
      }
    };
    document.getElementById("__admin_cancel").onclick = cerrarModal;
  }

  function safeNumber(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }

  // -----------------------
  // NAVIGATION
  // -----------------------
  (function initNavigation() {
    if (!navBtns.length || !sections.length) {
      console.warn("Navigation init: no buttons or sections found");
      return;
    }
    function showSection(id) {
      sections.forEach(s => s.classList.add("hidden"));
      navBtns.forEach(b => b.classList.remove("active"));
      const sec = document.getElementById(id);
      if (sec) sec.classList.remove("hidden");
      const btn = Array.from(navBtns).find(b => b.dataset.section === id);
      if (btn) btn.classList.add("active");
      console.log("Navegación: mostrando ->", id);
    }
    navBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.section;
        if (!target) return;
        showSection(target);
      });
    });
    // default open 'cobro' if exists, else first
    const defaultBtn = document.querySelector('.nav-btn[data-section="cobro"]') || navBtns[0];
    if (defaultBtn) defaultBtn.click();
  })();

  // -----------------------
  // INICIALIZACIÓN DE SELECTS
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
    // cajero nro 1..99
    if (cajeroNroSelect) {
      cajeroNroSelect.innerHTML = "";
      for (let i = 1; i <= 99; i++) {
        const o = document.createElement("option");
        o.value = i.toString().padStart(2, "0");
        o.textContent = i.toString().padStart(2, "0");
        cajeroNroSelect.appendChild(o);
      }
    }
  })();

  // -----------------------
  // COBRAR (login + cart)
  // -----------------------
  btnLogin && btnLogin.addEventListener("click", async () => {
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
    document.getElementById("app-title").textContent = `SUPERCODE - Cajero ${cajeroActivo.nro}`;
  });

  // add product on Enter
  cobroCodigo && cobroCodigo.addEventListener("keydown", async (e) => {
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
    // price expected stored maybe as "00000,00" or number; normalize priceNumber
    const precioNumber = (typeof prod.precio === "number") ? prod.precio : Number(String(prod.precio).replace(",", "."));
    if (prod.cantidad < cantidad) {
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
    await window.update(window.ref(window.db, `stock/${codigo}`), { cantidad: Math.max(0, prod.cantidad - cantidad) });

    renderCarrito();
    cobroCodigo.value = "";
  });

  function renderCarrito() {
    tablaCobro.innerHTML = "";
    total = 0;
    carrito.forEach((it, i) => {
      const tr = document.createElement("tr");
      const rowTotal = Number(it.precio) * Number(it.cantidad);
      total += rowTotal;
      tr.innerHTML = `
  <td>${it.cantidad}</td>
  <td>${it.nombre}</td>
  <td>${formatoPrecioParaPantalla(it.precio)}</td>
  <td>${formatoPrecioParaPantalla(rowTotal)}</td>
  <td><button class="btn-delete-cart" data-i="${i}">Eliminar</button></td>
`;
      tablaCobro.appendChild(tr);
    });
    totalDiv.textContent = `TOTAL: ${formatoPrecioParaPantalla(total)}`;
    btnCobrar.classList.toggle("hidden", carrito.length === 0);

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
            await window.update(window.ref(window.db, `stock/${it.codigo}`), { cantidad: prod.cantidad + it.cantidad });
          }
          carrito.splice(i, 1);
          renderCarrito();
        });
      };
    });
  }

  // cobrar button - open modal for payment type
  btnCobrar && btnCobrar.addEventListener("click", () => {
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

  async function finalizarCobro(tipoPago) {
    cerrarModal();
    const movId = `mov_${Date.now()}`; // id string
    // prepare movement object
    const mov = {
      id: movId,
      cajero: cajeroActivo.nro || cajeroActivo.nombre || "N/A",
      total,
      tipo: tipoPago,
      fecha: ahoraISO(),
      items: carrito.map(it => ({ codigo: it.codigo, nombre: it.nombre, precio: it.precio, cantidad: it.cantidad }))
    };
    await window.set(window.ref(window.db, `movimientos/${movId}`), mov);

    // print ticket — handle pagination if items too many
    imprimirTicketMov(mov);

    // clear carrito
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
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${codigo}</td>
        <td>${prod.nombre}</td>
        <td>${prod.cantidad}</td>
        <td>${prod.fecha ? formatoFechaIsoToDisplay(prod.fecha) : ""}</td>
        <td>${typeof prod.precio === "number" ? formatoPrecioParaPantalla(prod.precio) : ('$' + String(prod.precio).replace('.',','))}</td>
        <td>
          <button class="btn-edit-stock" data-id="${codigo}">Editar</button>
          <button class="btn-del-stock" data-id="${codigo}">Eliminar</button>
        </td>
      `;
      tablaStock.appendChild(tr);
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
      btn.onclick = () => {
        requireAdminConfirm(() => editarStockModal(btn.dataset.id));
      };
    });
  });

  btnAgregarStock && btnAgregarStock.addEventListener("click", async () => {
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
      // nuevo producto sin historial -> default values
      await window.set(refProd, {
        nombre: "PRODUCTO NUEVO",
        cantidad,
        precio: "00000,00",
        fecha: ahoraISO()
      });
    }
    inputStockCodigo.value = "";
  });

  function editarStockModal(codigo) {
    (async () => {
      const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
      if (!snap.exists()) {
        alert("Producto no encontrado");
        return;
      }
      const prod = snap.val();
      // show modal with fields except codigo
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
        // price validation: 1-5 digits, comma, 2 digits
        if (!/^\d{1,5},\d{2}$/.test(precio)) {
          alert("Precio inválido. Formato: 00000,00");
          return;
        }
        // update DB (fecha updated)
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
    tablaCajeros.innerHTML = "";
    if (!snap.exists()) return;
    const data = snap.val();
    Object.entries(data).forEach(([nro, caj]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${nro}</td>
        <td>${caj.nombre}</td>
        <td>${caj.dni}</td>
        <td>
          <button class="btn-edit-caj" data-id="${nro}">Editar</button>
          <button class="btn-del-caj" data-id="${nro}">Eliminar</button>
        </td>
      `;
      tablaCajeros.appendChild(tr);
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

  btnAgregarCajero && btnAgregarCajero.addEventListener("click", async () => {
    const nro = cajeroNroSelect.value;
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
  // MOVIMIENTOS
  // -----------------------
  window.onValue(window.ref(window.db, "movimientos"), snap => {
    tablaMovimientos.innerHTML = "";
    if (!snap.exists()) return;
    const data = snap.val();
    Object.values(data).forEach(mov => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${mov.id}</td>
        <td>${formatoPrecioParaPantalla(mov.total)}</td>
        <td>${mov.tipo}</td>
        <td>
          <button class="btn-ver-mov" data-id="${mov.id}">Ver</button>
          <button class="btn-del-mov" data-id="${mov.id}">Eliminar</button>
        </td>
      `;
      tablaMovimientos.appendChild(tr);
    });

    document.querySelectorAll(".btn-del-mov").forEach(btn => {
      btn.onclick = () => requireAdminConfirm(async () => {
        await window.remove(window.ref(window.db, `movimientos/${btn.dataset.id}`));
      });
    });
    document.querySelectorAll(".btn-ver-mov").forEach(btn => {
      btn.onclick = () => verMovimientoModal(btn.dataset.id);
    });
  });

  function verMovimientoModal(id) {
    (async () => {
      const snap = await window.get(window.ref(window.db, `movimientos/${id}`));
      if (!snap.exists()) return alert("Movimiento no encontrado");
      const mov = snap.val();
      let html = `<h3>Ticket ${mov.id}</h3>`;
      html += `<p>${formatFechaParaHeader(mov.fecha)}</p>`;
      html += `<p>Cajero: ${mov.cajero}</p><hr>`;
      mov.items.forEach(it => {
        html += `<p>${it.nombre} - ${it.cantidad} - ${formatoPrecioParaPantalla(it.precio)} - ${formatoPrecioParaPantalla(it.precio * it.cantidad)}</p>`;
      });
      html += `<hr><p><b>TOTAL: ${formatoPrecioParaPantalla(mov.total)}</b></p><p>Pago: ${mov.tipo}</p>`;
      html += `<div style="margin-top:10px"><button id="__print_copy">Imprimir Copia</button><button id="__close_mov">Cerrar</button></div>`;
      mostrarModal(html);
      document.getElementById("__close_mov").onclick = cerrarModal;
      document.getElementById("__print_copy").onclick = () => {
        imprimirTicketMov(mov);
      };
    })();
  }

  // Print ticket with pagination into print-area elements.
  function imprimirTicketMov(mov) {
    // mov: object with items array
    // We'll paginate by itemsPerPage depending on length. Choose conservative 20 per page.
    const itemsPerPage = 20;
    const items = mov.items || [];
    const totalParts = Math.max(1, Math.ceil(items.length / itemsPerPage));
    const printAreas = [];

    for (let p = 0; p < totalParts; p++) {
      const slice = items.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
      const header = `<div style="text-align:center"><h3>SUPERCODE</h3><p>ID:${mov.id} - Parte ${p + 1}/${totalParts} - ${formatFechaParaHeader(mov.fecha)} - Cajero:${mov.cajero}</p><hr></div>`;
      let body = "";
      slice.forEach(it => {
        body += `<p>${it.nombre} - ${it.cantidad} - ${formatoPrecioParaPantalla(it.precio)} - ${formatoPrecioParaPantalla(it.precio * it.cantidad)}</p>`;
      });
      const footer = `<hr><p><b>TOTAL: ${formatoPrecioParaPantalla(mov.total)}</b></p><p>Pago: ${mov.tipo}</p><p>ID:${mov.id} - Parte ${p + 1}/${totalParts} - ${formatFechaParaHeader(mov.fecha)} - Cajero:${mov.cajero}</p>`;
      const area = document.createElement("div");
      area.className = "print-area";
      area.style.width = "5cm";
      area.innerHTML = header + body + footer;
      printAreas.push(area);
    }

    // append all to body, print, then remove
    printAreas.forEach(a => document.body.appendChild(a));
    window.print();
    printAreas.forEach(a => document.body.removeChild(a));
  }

  // Tirar Z: print summary grouped by cajero and type, then delete all movimientos
  btnTirarZ && btnTirarZ.addEventListener("click", async () => {
    const snap = await window.get(window.ref(window.db, "movimientos"));
    if (!snap.exists()) return alert("No hay movimientos para tirar Z");
    const data = Object.values(snap.val());
    // group by cajero and type
    const grouped = {}; // { cajero: {Efectivo: [mov], Tarjeta: [mov]} }
    data.forEach(m => {
      const caj = m.cajero || "N/A";
      if (!grouped[caj]) grouped[caj] = { Efectivo: [], Tarjeta: [], otros: [] };
      if (m.tipo === "Efectivo") grouped[caj].Efectivo.push(m);
      else if (m.tipo === "Tarjeta") grouped[caj].Tarjeta.push(m);
      else grouped[caj].otros.push(m);
    });

    // build html
    let html = `<h2>Reporte Z - ${new Date().toLocaleString()}</h2>`;
    let grandTotal = 0;
    Object.keys(grouped).forEach(caj => {
      html += `<h3>Cajero: ${caj}</h3>`;
      let totalEf = 0, totalTar = 0;
      html += `<h4>Efectivo</h4>`;
      grouped[caj].Efectivo.forEach(m => { html += `<p>ID ${m.id} - ${formatoPrecioParaPantalla(m.total)}</p>`; totalEf += Number(m.total); });
      html += `<p><b>Total Efectivo Cajero: ${formatoPrecioParaPantalla(totalEf)}</b></p>`;
      html += `<h4>Tarjeta</h4>`;
      grouped[caj].Tarjeta.forEach(m => { html += `<p>ID ${m.id} - ${formatoPrecioParaPantalla(m.total)}</p>`; totalTar += Number(m.total); });
      html += `<p><b>Total Tarjeta Cajero: ${formatoPrecioParaPantalla(totalTar)}</b></p>`;
      html += `<p><b>Subtotal Cajero: ${formatoPrecioParaPantalla(totalEf + totalTar)}</b></p>`;
      grandTotal += totalEf + totalTar;
    });

    html += `<h2>Total General: ${formatoPrecioParaPantalla(grandTotal)}</h2>`;

    // empty signature tables
    html += `<br><table border="1" style="width:100%; margin-top:20px"><tr><th>Efectivo Cobrado</th><th>Firma de Cajero</th><th>Firma de Encargado</th></tr><tr><td></td><td></td><td></td></tr></table>`;
    html += `<br><table border="1" style="width:100%; margin-top:10px"><tr><th>Tarjeta Cobrada</th><th>Firma Cajero</th><th>Firma Encargado</th></tr><tr><td></td><td></td><td></td></tr></table>`;

    const area = document.createElement("div");
    area.className = "print-area";
    area.style.width = "21cm"; // A4 landscape-ish so it prints okay
    area.innerHTML = html;
    document.body.appendChild(area);
    window.print();
    document.body.removeChild(area);

    // delete movimientos
    await window.set(window.ref(window.db, "movimientos"), {});
    alert("Tirar Z completado: movimientos impresos y eliminados");
  });

  // -----------------------
  // CONFIG
  // -----------------------
  window.onValue(window.ref(window.db, "config"), snap => {
    if (!snap.exists()) return;
    const conf = snap.val();
    inputConfigNombre.value = conf.shopName || "";
    passAdminCache = conf.passAdmin || null;
  });

  btnGuardarConfig && btnGuardarConfig.addEventListener("click", async () => {
    const shopName = (inputConfigNombre.value || "").trim();
    const actual = (inputConfigPassActual.value || "").trim();
    const nueva = (inputConfigPassNueva.value || "").trim();
    if (!shopName) return alert("Ingrese nombre de tienda");
    if (!actual || !nueva) return alert("Complete contraseña actual y nueva");
    // validate current password
    const confSnap = await window.get(window.ref(window.db, "config"));
    if (!confSnap.exists()) return alert("Error leyendo configuración");
    const conf = confSnap.val();
    if (actual !== conf.passAdmin) return alert("Contraseña actual incorrecta");
    if (nueva.length < 4 || nueva.length > 10) return alert("La nueva contraseña debe tener entre 4 y 10 caracteres");
    await window.update(window.ref(window.db, "config"), { shopName, passAdmin: nueva });
    configMsg.textContent = "Configuración guardada ✅";
    inputConfigPassActual.value = "";
    inputConfigPassNueva.value = "";
  });

  btnRestaurar && btnRestaurar.addEventListener("click", async () => {
    const m = (inputMasterPass.value || "").trim();
    const snap = await window.get(window.ref(window.db, "config"));
    if (!snap.exists()) return alert("No hay configuración");
    const conf = snap.val();
    if (m === conf.masterPass) {
      await window.update(window.ref(window.db, "config"), { passAdmin: "0123456789" });
      configMsg.textContent = "Contraseña restaurada ✅";
      inputMasterPass.value = "";
    } else {
      configMsg.textContent = "Contraseña maestra incorrecta";
    }
  });

  // -----------------------
  // Helpers: escape HTML
  // -----------------------
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]; });
  }

  // -----------------------
  // Final logging
  // -----------------------
  console.log("✅ app.js cargado correctamente");
})();
