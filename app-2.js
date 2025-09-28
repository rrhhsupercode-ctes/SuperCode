/*****************************************************
 * app-2.js
 * Funciones de:
 * - Movimientos (listar, eliminar, tirar Z)
 * - Stock (agregar, editar, eliminar, tabla en tiempo real)
 * - Cajeros (agregar, eliminar, tabla en tiempo real)
 * - Configuración (guardar, restaurar pass admin)
 *****************************************************/

(() => {
  // === REFERENCIAS DOM ===
  // Movimientos
  const tablaMovimientos = document.querySelector("#tabla-movimientos tbody");
  const btnTirarZ = document.getElementById("btn-tirar-z");

  // Stock
  const inputStockCodigo = document.getElementById("stock-codigo");
  const inputStockCantidad = document.getElementById("stock-cantidad");
  const btnAgregarStock = document.getElementById("agregar-stock");
  const tablaStock = document.querySelector("#tabla-stock tbody");

  // Cajeros
  const selectCajeroNro = document.getElementById("cajero-nro");
  const inputCajeroNombre = document.getElementById("cajero-nombre");
  const inputCajeroDni = document.getElementById("cajero-dni");
  const inputCajeroPass = document.getElementById("cajero-pass");
  const btnAgregarCajero = document.getElementById("agregar-cajero");
  const tablaCajeros = document.querySelector("#tabla-cajeros tbody");

  // Config
  const inputConfigNombre = document.getElementById("config-nombre");
  const inputConfigPass = document.getElementById("config-pass");
  const btnGuardarConfig = document.getElementById("guardar-config");
  const btnRestaurar = document.getElementById("btn-restaurar");
  const inputMasterPass = document.getElementById("master-pass");
  const configMsg = document.getElementById("config-msg");

  // Modal
  const modalEditar = document.getElementById("modal-editar");

  // === VARIABLES ===
  const ADMIN_PASS_DEFAULT = "0123456789";
  const MASTER_PASS = "9999";

  // ======================================================
  // MOVIMIENTOS
  // ======================================================
  function cargarMovimientos() {
    const refMov = window.ref(window.db, "movimientos");
    window.onValue(refMov, snap => {
      tablaMovimientos.innerHTML = "";
      if (snap.exists()) {
        Object.values(snap.val()).forEach(mov => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${mov.id}</td>
            <td>$${mov.total.toFixed(2)}</td>
            <td>${mov.tipo}</td>
            <td>${mov.fecha}</td>
            <td><button class="btn-eliminar-mov" data-id="${mov.id}">Eliminar</button></td>
          `;
          tablaMovimientos.appendChild(tr);
        });

        document.querySelectorAll(".btn-eliminar-mov").forEach(btn => {
          btn.onclick = () => eliminarMovimiento(btn.dataset.id);
        });
      }
    });
  }

  async function eliminarMovimiento(id) {
    const pass = prompt("Ingrese contraseña admin:");
    const snapConfig = await window.get(window.ref(window.db, "config/passAdmin"));
    const adminPass = snapConfig.exists() ? snapConfig.val() : ADMIN_PASS_DEFAULT;

    if (pass === adminPass) {
      await window.remove(window.ref(window.db, `movimientos/${id}`));
    } else {
      alert("Contraseña incorrecta");
    }
  }

  btnTirarZ.addEventListener("click", async () => {
    const pass = prompt("Contraseña admin para TIRAR Z:");
    const snapConfig = await window.get(window.ref(window.db, "config/passAdmin"));
    const adminPass = snapConfig.exists() ? snapConfig.val() : ADMIN_PASS_DEFAULT;

    if (pass === adminPass) {
      await window.remove(window.ref(window.db, "movimientos"));
      alert("Movimientos eliminados ✅");
    } else {
      alert("Contraseña incorrecta");
    }
  });

  // ======================================================
  // STOCK
  // ======================================================
  btnAgregarStock.addEventListener("click", async () => {
    const codigo = inputStockCodigo.value.trim();
    const cantidad = parseInt(inputStockCantidad.value, 10) || 0;
    if (!codigo || cantidad <= 0) return;

    const prodRef = window.ref(window.db, `stock/${codigo}`);
    const snap = await window.get(prodRef);
    const fecha = new Date().toLocaleString();

    if (snap.exists()) {
      const prod = snap.val();
      await window.update(prodRef, {
        cantidad: prod.cantidad + cantidad,
        fechaIngreso: fecha
      });
    } else {
      await window.set(prodRef, {
        nombre: "EDITAR NUEVO PRODUCTO",
        cantidad,
        precio: 0,
        fechaIngreso: fecha
      });
    }

    inputStockCodigo.value = "";
  });

  function cargarStock() {
    const refStock = window.ref(window.db, "stock");
    window.onValue(refStock, snap => {
      tablaStock.innerHTML = "";
      if (snap.exists()) {
        Object.entries(snap.val()).forEach(([codigo, prod]) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${codigo}</td>
            <td>${prod.nombre}</td>
            <td>${prod.cantidad}</td>
            <td>${prod.fechaIngreso}</td>
            <td>$${prod.precio.toFixed(2)}</td>
            <td>
              <button class="btn-editar" data-codigo="${codigo}">Editar</button>
              <button class="btn-eliminar" data-codigo="${codigo}">Eliminar</button>
            </td>
          `;
          tablaStock.appendChild(tr);
        });

        document.querySelectorAll(".btn-editar").forEach(btn => {
          btn.onclick = () => editarStock(btn.dataset.codigo);
        });
        document.querySelectorAll(".btn-eliminar").forEach(btn => {
          btn.onclick = () => eliminarStock(btn.dataset.codigo);
        });
      }
    });
  }

  function editarStock(codigo) {
    modalEditar.innerHTML = `
      <h3>Editar producto ${codigo}</h3>
      <input type="text" id="edit-nombre" placeholder="Nombre">
      <input type="number" id="edit-precio" placeholder="Precio">
      <button id="btn-guardar-edit">Guardar</button>
    `;
    modalEditar.classList.remove("hidden");

    document.getElementById("btn-guardar-edit").onclick = async () => {
      const nombre = document.getElementById("edit-nombre").value;
      const precio = parseFloat(document.getElementById("edit-precio").value) || 0;
      await window.update(window.ref(window.db, `stock/${codigo}`), { nombre, precio });
      modalEditar.classList.add("hidden");
    };
  }

  async function eliminarStock(codigo) {
    const pass = prompt("Ingrese contraseña admin:");
    const snapConfig = await window.get(window.ref(window.db, "config/passAdmin"));
    const adminPass = snapConfig.exists() ? snapConfig.val() : ADMIN_PASS_DEFAULT;

    if (pass === adminPass) {
      await window.remove(window.ref(window.db, `stock/${codigo}`));
    } else {
      alert("Contraseña incorrecta");
    }
  }

  // ======================================================
  // CAJEROS
  // ======================================================
  function cargarCajeros() {
    const refCaj = window.ref(window.db, "cajeros");
    window.onValue(refCaj, snap => {
      tablaCajeros.innerHTML = "";
      let usados = {};
      if (snap.exists()) {
        usados = snap.val();
        Object.values(usados).forEach(caj => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${caj.nro}</td>
            <td>${caj.nombre}</td>
            <td>${caj.dni}</td>
            <td><button class="btn-eliminar-caj" data-nro="${caj.nro}">Eliminar</button></td>
          `;
          tablaCajeros.appendChild(tr);
        });

        document.querySelectorAll(".btn-eliminar-caj").forEach(btn => {
          btn.onclick = () => eliminarCajero(btn.dataset.nro);
        });
      }
      llenarOpcionesCajero(usados);
    });
  }

  function llenarOpcionesCajero(cajerosObj = {}) {
    selectCajeroNro.innerHTML = "";
    for (let i = 1; i <= 99; i++) {
      const nro = i.toString().padStart(2, "0");
      if (!cajerosObj[nro]) {
        const opt = document.createElement("option");
        opt.value = nro;
        opt.textContent = nro;
        selectCajeroNro.appendChild(opt);
      }
    }
  }

  btnAgregarCajero.addEventListener("click", async () => {
    const nro = selectCajeroNro.value;
    const nombre = inputCajeroNombre.value.trim();
    const dni = inputCajeroDni.value.trim();
    const pass = inputCajeroPass.value.trim();

    if (!nro || !nombre || !dni || !pass) {
      alert("Complete todos los campos");
      return;
    }

    await window.set(window.ref(window.db, `cajeros/${nro}`), { nro, nombre, dni, pass });

    inputCajeroNombre.value = "";
    inputCajeroDni.value = "";
    inputCajeroPass.value = "";
  });

  async function eliminarCajero(nro) {
    const pass = prompt("Ingrese contraseña admin:");
    const snapConfig = await window.get(window.ref(window.db, "config/passAdmin"));
    const adminPass = snapConfig.exists() ? snapConfig.val() : ADMIN_PASS_DEFAULT;

    if (pass === adminPass) {
      await window.remove(window.ref(window.db, `cajeros/${nro}`));
    } else {
      alert("Contraseña incorrecta");
    }
  }

  // ======================================================
  // CONFIG
  // ======================================================
  btnGuardarConfig.addEventListener("click", async () => {
    const nombre = inputConfigNombre.value.trim();
    const pass = inputConfigPass.value.trim();

    if (!nombre || !pass) {
      configMsg.textContent = "Complete todos los campos";
      return;
    }

    await window.set(window.ref(window.db, "config"), { nombre, passAdmin: pass });
    configMsg.textContent = "Configuración guardada ✅";
  });

  btnRestaurar.addEventListener("click", async () => {
    if (inputMasterPass.value === MASTER_PASS) {
      await window.update(window.ref(window.db, "config"), { passAdmin: ADMIN_PASS_DEFAULT });
      configMsg.textContent = "Contraseña admin restaurada ✅";
    } else {
      configMsg.textContent = "Clave maestra incorrecta ❌";
    }
  });

  // ======================================================
  // AUTO-CARGA EN TIEMPO REAL
  // ======================================================
  cargarMovimientos();
  cargarStock();
  cargarCajeros();

  console.log("✅ app-2.js cargado correctamente");
})();
