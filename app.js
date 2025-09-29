/*****************************************************
 * app.js
 * Lógica principal de SuperCode POS
 *****************************************************/
(() => {
  // -----------------------
  // UTILIDADES
  // -----------------------
  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatoPrecioParaPantalla(num) {
    return "$" + Number(num || 0).toFixed(2);
  }

  function formatFechaParaHeader(fechaIso) {
    const d = new Date(fechaIso);
    return d.toLocaleString();
  }

  function mostrarModal(html) {
    const overlay = document.getElementById("modal-overlay");
    overlay.innerHTML = `<div class="modal-content">${html}</div>`;
    overlay.classList.remove("hidden");
  }

  function cerrarModal() {
    const overlay = document.getElementById("modal-overlay");
    overlay.classList.add("hidden");
    overlay.innerHTML = "";
  }

  async function requireAdminConfirm(cb) {
    mostrarModal(`
      <h3>Confirmar Acción</h3>
      <p>Contraseña Encargado:</p>
      <input id="__admin_pass" type="password" style="width:100%; margin:10px 0; padding:6px">
      <div style="text-align:right">
        <button id="__cancel">Cancelar</button>
        <button id="__ok">Aceptar</button>
      </div>
    `);
    document.getElementById("__cancel").onclick = cerrarModal;
    document.getElementById("__ok").onclick = async () => {
      const pass = document.getElementById("__admin_pass").value.trim();
      const snap = await window.get(window.ref(window.db, "config"));
      const conf = snap.exists() ? snap.val() : {};
      if (pass !== conf.passAdmin) {
        alert("Contraseña incorrecta");
        return;
      }
      cerrarModal();
      cb();
    };
  }

  // -----------------------
  // ELEMENTOS
  // -----------------------
  const navBtns = document.querySelectorAll(".nav-btn");
  const sections = document.querySelectorAll("main > section");

  const loginUsuario = document.getElementById("login-usuario");
  const loginPass = document.getElementById("login-pass");
  const btnLogin = document.getElementById("btn-login");
  const loginMsg = document.getElementById("login-msg");
  const cobroControles = document.getElementById("cobro-controles");
  const selectCantidad = document.getElementById("cobro-cantidad");
  const inputCodigo = document.getElementById("cobro-codigo");
  const tablaCobroBody = document.querySelector("#tabla-cobro tbody");
  const totalDiv = document.getElementById("total-div");
  const btnCobrar = document.getElementById("btn-cobrar");

  const tablaStockBody = document.querySelector("#tabla-stock tbody");
  const inputStockCodigo = document.getElementById("stock-codigo");
  const selectStockCantidad = document.getElementById("stock-cantidad");
  const btnAgregarStock = document.getElementById("agregar-stock");

  const tablaCajerosBody = document.querySelector("#tabla-cajeros tbody");
  const cajeroNroSelect = document.getElementById("cajero-nro");
  const inputCajeroNombre = document.getElementById("cajero-nombre");
  const inputCajeroDni = document.getElementById("cajero-dni");
  const inputCajeroPass = document.getElementById("cajero-pass");
  const btnAgregarCajero = document.getElementById("agregar-cajero");

  const filtroCajero = document.getElementById("filtroCajero");
  const tablaMovimientosBody = document.querySelector("#tabla-movimientos tbody");
  const btnTirarZ = document.getElementById("btn-tirar-z");

  const inputConfigNombre = document.getElementById("config-nombre");
  const inputConfigPassActual = document.getElementById("config-pass-actual");
  const inputConfigPassNueva = document.getElementById("config-pass-nueva");
  const btnGuardarConfig = document.getElementById("guardar-config");
  const configMsg = document.getElementById("config-msg");
  const inputMasterPass = document.getElementById("master-pass");
  const btnRestaurar = document.getElementById("btn-restaurar");

  // -----------------------
  // VARIABLES DE ESTADO
  // -----------------------
  let cajerosCache = {};
  let movimientosCache = {};
  let stockCache = {};
  let configCache = {};
  let usuarioActual = null;
  let itemsCobro = [];

  // -----------------------
  // NAV
  // -----------------------
  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      sections.forEach(s => s.classList.add("hidden"));
      document.getElementById(btn.dataset.section).classList.remove("hidden");
    });
  });

  // -----------------------
  // SELECTS DE CANTIDAD
  // -----------------------
  for (let i = 1; i <= 50; i++) {
    const opt1 = document.createElement("option");
    opt1.value = i;
    opt1.textContent = i;
    selectCantidad.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = i;
    opt2.textContent = i;
    selectStockCantidad.appendChild(opt2);
  }

  // -----------------------
  // LOGIN CAJERO
  // -----------------------
  window.onValue(window.ref(window.db, "cajeros"), snap => {
    loginUsuario.innerHTML = "";
    if (!snap.exists()) return;
    const data = snap.val();
    Object.entries(data).forEach(([nro, caj]) => {
      const opt = document.createElement("option");
      opt.value = nro;
      opt.textContent = nro;
      loginUsuario.appendChild(opt);
    });
  });

  if (btnLogin) {
    btnLogin.addEventListener("click", async () => {
      const nro = loginUsuario.value;
      const pass = loginPass.value.trim();
      if (!nro || !pass) {
        loginMsg.textContent = "Complete todos los campos";
        return;
      }
      const snap = await window.get(window.ref(window.db, `cajeros/${nro}`));
      if (!snap.exists()) {
        loginMsg.textContent = "Cajero no encontrado";
        return;
      }
      const caj = snap.val();
      if (pass !== caj.pass) {
        loginMsg.textContent = "Contraseña incorrecta";
        return;
      }
      usuarioActual = caj.nro;
      document.getElementById("login-modal").classList.add("hidden");
      cobroControles.classList.remove("hidden");
      loginMsg.textContent = "";
    });
  }

  // -----------------------
  // COBRAR
  // -----------------------
  function renderCobro() {
    if (!tablaCobroBody) return;
    tablaCobroBody.innerHTML = "";
    let total = 0;
    itemsCobro.forEach((it, idx) => {
      total += it.precio * it.cantidad;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${it.cantidad}</td>
        <td>${escapeHtml(it.nombre)}</td>
        <td>${formatoPrecioParaPantalla(it.precio)}</td>
        <td>${formatoPrecioParaPantalla(it.precio * it.cantidad)}</td>
        <td><button data-idx="${idx}" class="btn-del-item">❌</button></td>
      `;
      tablaCobroBody.appendChild(tr);
    });
    totalDiv.textContent = "TOTAL: " + formatoPrecioParaPantalla(total);
    btnCobrar.classList.toggle("hidden", itemsCobro.length === 0);

    document.querySelectorAll(".btn-del-item").forEach(btn => {
      btn.onclick = () => {
        itemsCobro.splice(Number(btn.dataset.idx), 1);
        renderCobro();
      };
    });
  }

  if (inputCodigo) {
    inputCodigo.addEventListener("keydown", async e => {
      if (e.key === "Enter") {
        const codigo = inputCodigo.value.trim();
        const cantidad = Number(selectCantidad.value || 1);
        if (!codigo) return;
        const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
        if (!snap.exists()) {
          alert("Producto no encontrado en stock");
          return;
        }
        const prod = snap.val();
        if (Number(prod.cantidad) < cantidad) {
          alert("Stock insuficiente");
          return;
        }
        itemsCobro.push({ codigo, nombre: prod.nombre || "PRODUCTO NUEVO", precio: Number(prod.precio || 0), cantidad });
        inputCodigo.value = "";
        renderCobro();
      }
    });
  }

  if (btnCobrar) {
    btnCobrar.addEventListener("click", async () => {
      if (!usuarioActual) {
        alert("Debe loguearse un cajero");
        return;
      }
      if (itemsCobro.length === 0) return;

      mostrarModal(`
        <h3>Seleccione Medio de Pago</h3>
        <button id="pay-ef">Efectivo</button>
        <button id="pay-tar">Tarjeta</button>
      `);

      document.getElementById("pay-ef").onclick = () => finalizarCobro("Efectivo");
      document.getElementById("pay-tar").onclick = () => finalizarCobro("Tarjeta");
    });
  }

  async function finalizarCobro(tipo) {
    cerrarModal();
    const id = "M" + Date.now();
    const total = itemsCobro.reduce((a, b) => a + b.precio * b.cantidad, 0);
    const mov = {
      id,
      fecha: new Date().toISOString(),
      cajero: usuarioActual,
      items: itemsCobro,
      total,
      tipo
    };

    await window.set(window.ref(window.db, `movimientos/${id}`), mov);
    await window.set(window.ref(window.db, `historial/${id}`), mov); // ✅ guardar en historial

    // update stock
    for (let it of itemsCobro) {
      const snap = await window.get(window.ref(window.db, `stock/${it.codigo}`));
      if (snap.exists()) {
        const prod = snap.val();
        const nuevaCant = Math.max(0, Number(prod.cantidad) - it.cantidad);
        await window.update(window.ref(window.db, `stock/${it.codigo}`), { cantidad: nuevaCant });
      }
    }

    itemsCobro = [];
    renderCobro();
    alert("Cobro registrado con éxito");
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
        <label>Contraseña</label><input id="__edit_caj_pass" type="password" value="${escapeHtml(caj.pass || "")}">
        <div style="text-align:right;margin-top:10px">
          <button id="__cancel">Cancelar</button>
          <button id="__save">Guardar</button>
        </div>
      `);
      document.getElementById("__cancel").onclick = cerrarModal;
      document.getElementById("__save").onclick = async () => {
        const nuevo = {
          nro,
          nombre: document.getElementById("__edit_caj_nombre").value.trim(),
          dni: document.getElementById("__edit_caj_dni").value.trim(),
          pass: document.getElementById("__edit_caj_pass").value.trim()
        };
        if (!nuevo.nombre || !nuevo.dni || !nuevo.pass) {
          alert("Todos los campos son obligatorios");
          return;
        }
        if (!/^\d{8}$/.test(nuevo.dni)) {
          alert("DNI inválido (8 dígitos)");
          return;
        }
        await window.set(window.ref(window.db, `cajeros/${nro}`), nuevo);
        cerrarModal();
      };
    })();
  }

  // -----------------------
  // STOCK
  // -----------------------
  window.onValue(window.ref(window.db, "stock"), snap => {
    stockCache = {};
    if (tablaStockBody) tablaStockBody.innerHTML = "";
    if (!snap.exists()) return;
    const data = snap.val();
    Object.entries(data).forEach(([codigo, prod]) => {
      stockCache[codigo] = prod;
      if (tablaStockBody) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(codigo)}</td>
          <td>${escapeHtml(prod.nombre || "PRODUCTO NUEVO")}</td>
          <td>${formatoPrecioParaPantalla(prod.precio || 0)}</td>
          <td>${prod.cantidad || 0}</td>
          <td>
            <button class="btn-edit-stock" data-id="${codigo}">Editar</button>
            <button class="btn-del-stock" data-id="${codigo}">Eliminar</button>
          </td>
        `;
        tablaStockBody.appendChild(tr);
      }
    });

    document.querySelectorAll(".btn-del-stock").forEach(btn => {
      btn.onclick = () => requireAdminConfirm(async () => {
        await window.remove(window.ref(window.db, `stock/${btn.dataset.id}`));
      });
    });

    document.querySelectorAll(".btn-edit-stock").forEach(btn => {
      btn.onclick = () => requireAdminConfirm(() => editarStockModal(btn.dataset.id));
    });
  });

  if (btnAgregarStock) {
    btnAgregarStock.addEventListener("click", async () => {
      const codigo = (inputStockCodigo.value || "").trim();
      const cantidad = Number(selectStockCantidad.value || 1);
      if (!codigo) return;
      const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
      if (!snap.exists()) {
        await window.set(window.ref(window.db, `stock/${codigo}`), {
          codigo,
          nombre: "PRODUCTO NUEVO",
          precio: 0,
          cantidad
        });
      } else {
        const prod = snap.val();
        const nuevaCant = Number(prod.cantidad || 0) + cantidad;
        await window.update(window.ref(window.db, `stock/${codigo}`), { cantidad: nuevaCant });
      }
      inputStockCodigo.value = "";
    });
  }

  function editarStockModal(codigo) {
    (async () => {
      const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
      if (!snap.exists()) return;
      const prod = snap.val();
      mostrarModal(`
        <h3>Editar Producto</h3>
        <label>Nombre</label><input id="__edit_stock_nombre" value="${escapeHtml(prod.nombre || "PRODUCTO NUEVO")}">
        <label>Precio</label><input id="__edit_stock_precio" type="number" value="${prod.precio || 0}">
        <label>Cantidad</label><input id="__edit_stock_cant" type="number" value="${prod.cantidad || 0}">
        <div style="text-align:right;margin-top:10px">
          <button id="__cancel">Cancelar</button>
          <button id="__save">Guardar</button>
        </div>
      `);
      document.getElementById("__cancel").onclick = cerrarModal;
      document.getElementById("__save").onclick = async () => {
        const nuevo = {
          codigo,
          nombre: document.getElementById("__edit_stock_nombre").value.trim() || "PRODUCTO NUEVO",
          precio: Number(document.getElementById("__edit_stock_precio").value || 0),
          cantidad: Number(document.getElementById("__edit_stock_cant").value || 0)
        };
        await window.set(window.ref(window.db, `stock/${codigo}`), nuevo);
        cerrarModal();
      };
    })();
  }

  // -----------------------
  // MOVIMIENTOS
  // -----------------------
  window.onValue(window.ref(window.db, "movimientos"), snap => {
    movimientosCache = {};
    if (tablaMovimientosBody) tablaMovimientosBody.innerHTML = "";
    if (!snap.exists()) return;
    const data = snap.val();
    Object.values(data).forEach(mov => {
      movimientosCache[mov.id] = mov;
      if (tablaMovimientosBody) {
        if (filtroCajero && filtroCajero.value !== "TODOS" && mov.cajero !== filtroCajero.value) return;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${formatFechaParaHeader(mov.fecha)}</td>
          <td>${escapeHtml(mov.cajero)}</td>
          <td>${formatoPrecioParaPantalla(mov.total)}</td>
          <td>${escapeHtml(mov.tipo)}</td>
        `;
        tablaMovimientosBody.appendChild(tr);
      }
    });
  });

  if (filtroCajero) {
    filtroCajero.addEventListener("change", () => {
      window.onValue(window.ref(window.db, "movimientos"), () => {}); // fuerza render
    });
  }

  if (btnTirarZ) {
    btnTirarZ.addEventListener("click", () => {
      requireAdminConfirm(async () => {
        await window.remove(window.ref(window.db, "movimientos"));
        alert("Movimientos borrados (Tirado Z)");
      });
    });
  }

  // -----------------------
  // CONFIGURACIÓN
  // -----------------------
  window.onValue(window.ref(window.db, "config"), snap => {
    if (!snap.exists()) return;
    configCache = snap.val();
    if (inputConfigNombre) inputConfigNombre.value = configCache.shopName || "";
  });

  if (btnGuardarConfig) {
    btnGuardarConfig.addEventListener("click", async () => {
      const actual = inputConfigPassActual.value.trim();
      const nueva = inputConfigPassNueva.value.trim();
      if (actual !== configCache.passAdmin) {
        configMsg.textContent = "Contraseña actual incorrecta";
        return;
      }
      await window.update(window.ref(window.db, "config"), {
        shopName: inputConfigNombre.value.trim() || "SUPERCODE",
        passAdmin: nueva || configCache.passAdmin
      });
      configMsg.textContent = "Configuración guardada";
      inputConfigPassActual.value = "";
      inputConfigPassNueva.value = "";
    });
  }

  if (btnRestaurar) {
    btnRestaurar.addEventListener("click", async () => {
      const pass = inputMasterPass.value.trim();
      if (pass !== configCache.masterPass) {
        alert("Contraseña master incorrecta");
        return;
      }
      await window.remove(window.ref(window.db, "/"));
      alert("Base restaurada");
      location.reload();
    });
  }

  // -----------------------
  // LIMPIEZA AUTOMÁTICA DEL HISTORIAL (DÍA 15)
  // -----------------------
  (async () => {
    const hoy = new Date();
    if (hoy.getDate() === 15) {
      await window.remove(window.ref(window.db, "historial"));
      console.log("🧹 Historial limpiado automáticamente (día 15)");
    }
  })();

})();
