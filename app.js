/*****************************************************
 * app.js (COMPLETO)
 * Funcional: Cobrar, Stock, Cajeros, Movimientos, Config
 * Historial en Firebase que se limpia automáticamente cada mes
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
  const filtroCajero = document.getElementById("filtroCajero");

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
  let movimientosCache = {};
  let cajerosCache = {};
  let configCache = null;

  // -----------------------
  // Utilidades
  // -----------------------
  const escapeHtml = str =>
    String(str || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  const formatoPrecio = num => `$${(Number(num) || 0).toFixed(2).replace(".", ",")}`;
  const ahoraISO = () => new Date().toISOString();

  const formatoFechaIso = iso => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${d.getFullYear()} (${d.getHours().toString().padStart(2, "0")}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")})`;
  };

  const mostrarModal = html => {
    modalOverlay.innerHTML = html;
    modalOverlay.classList.remove("hidden");
  };
  const cerrarModal = () => {
    modalOverlay.innerHTML = "";
    modalOverlay.classList.add("hidden");
  };

  const verificarPassAdmin = async pass => {
    const snap = await window.get(window.ref(window.db, "config"));
    if (!snap.exists()) return false;
    configCache = snap.val();
    return pass === configCache.passAdmin;
  };

  const requireAdminConfirm = cb => {
    mostrarModal(`
      <h3>Contraseña Administrador</h3>
      <input type="password" id="__admin_input" placeholder="Contraseña admin">
      <div><button id="__admin_ok">Aceptar</button><button id="__admin_cancel">Cancelar</button></div>
    `);
    document.getElementById("__admin_ok").onclick = async () => {
      const v = document.getElementById("__admin_input").value.trim();
      if (await verificarPassAdmin(v)) {
        cerrarModal();
        cb();
      } else alert("Contraseña incorrecta");
    };
    document.getElementById("__admin_cancel").onclick = cerrarModal;
  };

  // -----------------------
  // AUTO LIMPIEZA HISTORIAL MENSUAL
  // -----------------------
  (async () => {
    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    const refMeta = window.ref(window.db, "meta/ultimoMesHistorial");
    const snap = await window.get(refMeta);
    if (!snap.exists() || snap.val() !== mesActual) {
      await window.set(window.ref(window.db, "movimientos"), {});
      await window.set(refMeta, mesActual);
      console.log("🧹 Historial reseteado para mes:", mesActual);
    }
  })();

  // -----------------------
  // Navegación
  // -----------------------
  (() => {
    function showSection(id) {
      sections.forEach(s => s.classList.add("hidden"));
      navBtns.forEach(b => b.classList.remove("active"));
      document.getElementById(id)?.classList.remove("hidden");
      document.querySelector(`.nav-btn[data-section="${id}"]`)?.classList.add("active");
    }
    navBtns.forEach(btn => btn.addEventListener("click", () => showSection(btn.dataset.section)));
    document.querySelector('.nav-btn[data-section="cobro"]')?.click();
  })();

  // -----------------------
  // Cajeros
  // -----------------------
  const cargarCajeros = () => {
    window.onValue(window.ref(window.db, "cajeros"), snap => {
      cajerosCache = snap.exists() ? snap.val() : {};
      loginUsuario.innerHTML = Object.keys(cajerosCache)
        .map(n => `<option value="${n}">${escapeHtml(cajerosCache[n].nombre || n)}</option>`)
        .join("");
      cajeroNroSelect.innerHTML =
        `<option value="">Nuevo</option>` +
        Object.keys(cajerosCache)
          .map(n => `<option value="${n}">${n}</option>`)
          .join("");
      filtroCajero.innerHTML = `<option value="TODOS">TODOS</option>` + Object.keys(cajerosCache).map(n => `<option>${n}</option>`).join("");
      tablaCajerosBody.innerHTML = Object.keys(cajerosCache)
        .map(
          n => `
        <tr>
          <td>${n}</td><td>${escapeHtml(cajerosCache[n].nombre)}</td><td>${escapeHtml(cajerosCache[n].dni)}</td>
          <td><button data-nro="${n}" class="del-cajero">Eliminar</button></td>
        </tr>`
        )
        .join("");
      document.querySelectorAll(".del-cajero").forEach(btn =>
        btn.addEventListener("click", () => requireAdminConfirm(() => window.remove(window.ref(window.db, "cajeros/" + btn.dataset.nro))))
      );
    });
  };
  cargarCajeros();

  btnAgregarCajero.onclick = () => {
    requireAdminConfirm(async () => {
      const nro = cajeroNroSelect.value || Date.now().toString();
      const cajero = { nombre: inputCajeroNombre.value, dni: inputCajeroDni.value, pass: inputCajeroPass.value };
      await window.update(window.ref(window.db, "cajeros/" + nro), cajero);
    });
  };

  // -----------------------
  // Login / Cobrar
  // -----------------------
  btnLogin.onclick = () => {
    const user = cajerosCache[loginUsuario.value];
    if (user && user.pass === loginPass.value) {
      cajeroActivo = loginUsuario.value;
      loginModal.classList.add("hidden");
      cobroControles.classList.remove("hidden");
    } else loginMsg.textContent = "Error de login";
  };

  cobroCantidadSelect.innerHTML = Array.from({ length: 10 }, (_, i) => `<option>${i + 1}</option>`).join("");

  cobroCodigo.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const codigo = cobroCodigo.value.trim();
      if (!codigo) return;
      window.get(window.ref(window.db, "stock/" + codigo)).then(snap => {
        if (!snap.exists()) return alert("No existe en stock");
        const prod = snap.val();
        const cant = Number(cobroCantidadSelect.value);
        carrito.push({ codigo, nombre: prod.nombre, precio: Number(prod.precio), cantidad: cant });
        renderCarrito();
      });
      cobroCodigo.value = "";
    }
  });

  const renderCarrito = () => {
    total = carrito.reduce((s, p) => s + p.precio * p.cantidad, 0);
    tablaCobroBody.innerHTML = carrito
      .map(
        (p, i) => `
      <tr>
        <td>${p.cantidad}</td><td>${escapeHtml(p.nombre)}</td><td>${formatoPrecio(p.precio)}</td><td>${formatoPrecio(p.precio * p.cantidad)}</td>
        <td><button data-i="${i}" class="del-item">X</button></td>
      </tr>`
      )
      .join("");
    totalDiv.textContent = `TOTAL: ${formatoPrecio(total)}`;
    btnCobrar.classList.toggle("hidden", carrito.length === 0);
    document.querySelectorAll(".del-item").forEach(btn =>
      btn.addEventListener("click", () => {
        carrito.splice(btn.dataset.i, 1);
        renderCarrito();
      })
    );
  };

  btnCobrar.onclick = async () => {
    const id = Date.now().toString();
    const movimiento = { id, cajero: cajeroActivo, total, items: carrito, fecha: ahoraISO(), tipo: "VENTA" };
    await window.set(window.ref(window.db, "movimientos/" + id), movimiento);
    carrito = [];
    renderCarrito();
  };

  // -----------------------
  // Stock
  // -----------------------
  stockCantidadSelect.innerHTML = Array.from({ length: 50 }, (_, i) => `<option>${i + 1}</option>`).join("");

  const cargarStock = () => {
    window.onValue(window.ref(window.db, "stock"), snap => {
      const stock = snap.exists() ? snap.val() : {};
      tablaStockBody.innerHTML = Object.keys(stock)
        .map(
          c => `
        <tr>
          <td>${c}</td><td>${escapeHtml(stock[c].nombre || "PRODUCTO NUEVO")}</td><td>${stock[c].cantidad}</td><td>${formatoFechaIso(stock[c].fecha)}</td><td>${formatoPrecio(stock[c].precio)}</td>
          <td><button data-c="${c}" class="edit-stock">Editar</button><button data-c="${c}" class="del-stock">Eliminar</button></td>
        </tr>`
        )
        .join("");
      document.querySelectorAll(".edit-stock").forEach(btn =>
        btn.addEventListener("click", () => {
          const prod = stock[btn.dataset.c];
          mostrarModal(`
            <h3>Editar producto</h3>
            <input id="ed-nombre" value="${escapeHtml(prod.nombre)}">
            <input id="ed-precio" type="number" value="${prod.precio}">
            <button id="ed-ok">Guardar</button>
          `);
          document.getElementById("ed-ok").onclick = async () => {
            await window.update(window.ref(window.db, "stock/" + btn.dataset.c), {
              nombre: document.getElementById("ed-nombre").value,
              precio: Number(document.getElementById("ed-precio").value)
            });
            cerrarModal();
          };
        })
      );
      document.querySelectorAll(".del-stock").forEach(btn =>
        btn.addEventListener("click", () => requireAdminConfirm(() => window.remove(window.ref(window.db, "stock/" + btn.dataset.c))))
      );
    });
  };
  cargarStock();

  btnAgregarStock.onclick = async () => {
    const codigo = inputStockCodigo.value.trim();
    if (!codigo) return;
    const cant = Number(stockCantidadSelect.value);
    const refProd = window.ref(window.db, "stock/" + codigo);
    const snap = await window.get(refProd);
    if (snap.exists()) {
      const prod = snap.val();
      await window.update(refProd, { cantidad: (Number(prod.cantidad) || 0) + cant });
    } else {
      await window.set(refProd, { nombre: "PRODUCTO NUEVO", cantidad: cant, fecha: ahoraISO(), precio: 0 });
    }
  };

  // -----------------------
  // Movimientos
  // -----------------------
  const cargarMovimientos = () => {
    window.onValue(window.ref(window.db, "movimientos"), snap => {
      movimientosCache = snap.exists() ? snap.val() : {};
      renderMovimientos();
    });
  };
  cargarMovimientos();

  const renderMovimientos = () => {
    const filtro = filtroCajero.value;
    tablaMovimientosBody.innerHTML = Object.values(movimientosCache)
      .filter(m => filtro === "TODOS" || m.cajero === filtro)
      .map(
        m => `
      <tr>
        <td>${m.id}</td><td>${formatoPrecio(m.total)}</td><td>${escapeHtml(m.tipo)}</td>
        <td><button data-id="${m.id}" class="del-mov">Eliminar</button></td>
      </tr>`
      )
      .join("");
    document.querySelectorAll(".del-mov").forEach(btn =>
      btn.addEventListener("click", () => requireAdminConfirm(() => window.remove(window.ref(window.db, "movimientos/" + btn.dataset.id))))
    );
  };

  filtroCajero.onchange = renderMovimientos;

  btnTirarZ.onclick = () =>
    requireAdminConfirm(() => {
      window.set(window.ref(window.db, "movimientos"), {});
    });

  // -----------------------
  // Configuración
  // -----------------------
  window.onValue(window.ref(window.db, "config"), snap => {
    if (!snap.exists()) return;
    configCache = snap.val();
    inputConfigNombre.value = configCache.shopName || "";
  });

  btnGuardarConfig.onclick = async () => {
    const ok = await verificarPassAdmin(inputConfigPassActual.value);
    if (!ok) return (configMsg.textContent = "Contraseña admin incorrecta");
    await window.update(window.ref(window.db, "config"), { shopName: inputConfigNombre.value, passAdmin: inputConfigPassNueva.value });
    configMsg.textContent = "Guardado!";
  };

  btnRestaurar.onclick = async () => {
    const snap = await window.get(window.ref(window.db, "config"));
    if (!snap.exists()) return;
    const conf = snap.val();
    if (inputMasterPass.value !== conf.masterPass) return (configMsg.textContent = "Contraseña maestra incorrecta");
    await window.update(window.ref(window.db, "config"), { passAdmin: "0123456789" });
    configMsg.textContent = "Contraseña restaurada";
  };

  console.log("✅ app.js cargado completamente");
})();
