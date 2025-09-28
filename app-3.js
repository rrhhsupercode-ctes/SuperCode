/*****************************************************
 * app-3.js
 * Funciones de:
 * - MOVIMIENTOS
 * - STOCK
 * - CAJEROS
 * - CONFIGURACIÓN
 *****************************************************/
(() => {
  // === REFERENCIAS DOM ===
  // Movimientos
  const tablaMovimientos = document.querySelector("#tabla-movimientos tbody");
  const btnTirarZ = document.getElementById("btn-tirar-z");

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

  // Configuración
  const inputConfigNombre = document.getElementById("config-nombre");
  const inputConfigPass = document.getElementById("config-pass");
  const btnGuardarConfig = document.getElementById("guardar-config");
  const btnRestaurar = document.getElementById("btn-restaurar");
  const inputMasterPass = document.getElementById("master-pass");
  const configMsg = document.getElementById("config-msg");

  // Modales
  const modalEditar = document.getElementById("modal-editar");

  // === VARIABLES ===
  const ADMIN_PASS_DEFAULT = "0123456789";
  const MASTER_PASS = "9999";

  // === FUNCIONES AUXILIARES ===
  function formatoPrecio(num) {
    return `$${parseFloat(num).toFixed(2).replace(".", ",")}`;
  }

  // ======================================================
  // MOVIMIENTOS
  // ======================================================
  function cargarMovimientos() {
    const movRef = window.ref(window.db, "movimientos");
    window.onValue(movRef, snap => {
      tablaMovimientos.innerHTML = "";
      if (snap.exists()) {
        const datos = snap.val();
        Object.values(datos).forEach(mov => {
          const tr = document.createElement("tr");

          tr.innerHTML = `
            <td>${mov.id}</td>
            <td>${formatoPrecio(mov.total)}</td>
            <td>${mov.tipo.toUpperCase()}</td>
            <td><button class="btn-eliminar-mov" data-id="${mov.id}">ELIMINAR</button></td>
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
    const pass = prompt("Ingrese contraseña administrativa:");
    const snapConfig = await window.get(window.ref(window.db, "config/passAdmin"));
    const adminPass = snapConfig.exists() ? snapConfig.val() : ADMIN_PASS_DEFAULT;

    if (pass === adminPass) {
      await window.remove(window.ref(window.db, `movimientos/${id}`));
    } else {
      alert("Contraseña incorrecta");
    }
  }

  btnTirarZ.addEventListener("click", async () => {
    const pass = prompt("Contraseña administrativa para TIRAR Z:");
    const snapConfig = await window.get(window.ref(window.db, "config/passAdmin"));
    const adminPass = snapConfig.exists() ? snapConfig.val() : ADMIN_PASS_DEFAULT;

    if (pass === adminPass) {
      await window.remove(window.ref(window.db, "movimientos"));
      alert("Movimientos eliminados (TIRAR Z)");
    } else {
      alert("Contraseña incorrecta");
    }
  });

  // ======================================================
  // STOCK
  // ======================================================
  btnAgregarStock.addEventListener("click", async () => {
    const codigo = inputStockCodigo.value.trim();
    const cantidad = parseInt(stockCantidadSelect.value, 10);

    if (!codigo) return;

    const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
    const fecha = new Date().toLocaleString();

    if (snap.exists()) {
      const prod = snap.val();
      await window.update(window.ref(window.db, `stock/${codigo}`), {
        cantidad: prod.cantidad + cantidad,
        fechaIngreso: fecha
      });
    } else {
      await window.set(window.ref(window.db, `stock/${codigo}`), {
        nombre: "EDITAR PRODUCTO NUEVO",
        cantidad,
        fechaIngreso: fecha,
        precio: 0
      });
    }

    inputStockCodigo.value = "";
  });

  function cargarStock() {
    const stockRef = window.ref(window.db, "stock");
    window.onValue(stockRef, snap => {
      tablaStock.innerHTML = "";
      if (snap.exists()) {
        const datos = snap.val();
        Object.entries(datos).forEach(([codigo, prod]) => {
          const tr = document.createElement("tr");

          tr.innerHTML = `
            <td>${codigo}</td>
            <td>${prod.nombre}</td>
            <td>${prod.cantidad}</td>
            <td>${prod.fechaIngreso}</td>
            <td>${formatoPrecio(prod.precio)}</td>
            <td>
              <button class="btn-editar-stock" data-codigo="${codigo}">EDITAR</button>
              <button class="btn-eliminar-stock" data-codigo="${codigo}">ELIMINAR</button>
            </td>
          `;

          tablaStock.appendChild(tr);
        });

        document.querySelectorAll(".btn-editar-stock").forEach(btn => {
          btn.onclick = () => editarStock(btn.dataset.codigo);
        });

        document.querySelectorAll(".btn-eliminar-stock").forEach(btn => {
          btn.onclick = () => eliminarStock(btn.dataset.codigo);
        });
      }
    });
  }

  function editarStock(codigo) {
    modalEditar.innerHTML = `
      <h3>Editar producto</h3>
      <input type="text" id="edit-nombre" placeholder="Nombre">
      <input type="number" id="edit-precio" placeholder="Precio">
      <button id="btn-guardar-edit">Guardar</button>
    `;
    modalEditar.classList.remove("hidden");

    document.getElementById("btn-guardar-edit").onclick = async () => {
      const nombre = document.getElementById("edit-nombre").value;
      const precio = parseFloat(document.getElementById("edit-precio").value);
      await window.update(window.ref(window.db, `stock/${codigo}`), {
        nombre, precio
      });
      modalEditar.classList.add("hidden");
    };
  }

  async function eliminarStock(codigo) {
    const pass = prompt("Ingrese contraseña administrativa:");
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
  function llenarOpcionesCajeroNro(cajerosObj = {}) {
    cajeroNroSelect.innerHTML = "";
    for (let i = 1; i <= 99; i++) {
      const nro = i.toString().padStart(2, "0");
      // Si el nro ya existe en Firebase, no se muestra para volver a usar
      if (!cajerosObj[nro]) {
        const opt = document.createElement("option");
        opt.value = nro;
        opt.textContent = nro;
        cajeroNroSelect.appendChild(opt);
      }
    }
  }

  btnAgregarCajero.addEventListener("click", async () => {
    const nro = cajeroNroSelect.value;
    const nombre = inputCajeroNombre.value.trim();
    const dni = inputCajeroDni.value.trim();
    const pass = inputCajeroPass.value.trim();

    if (!nro || !nombre || !dni || !pass) {
      alert("Complete todos los campos");
      return;
    }

    await window.set(window.ref(window.db, `cajeros/${nro}`), {
      nro, nombre, dni, pass
    });

    inputCajeroNombre.value = "";
    inputCajeroDni.value = "";
    inputCajeroPass.value = "";
  });

  function cargarCajeros() {
    const cajRef = window.ref(window.db, "cajeros");
    window.onValue(cajRef, snap => {
      tablaCajeros.innerHTML = "";
      let cajerosObj = {};
      if (snap.exists()) {
        cajerosObj = snap.val();
        Object.values(cajerosObj).forEach(caj => {
          const tr = document.createElement("tr");

          tr.innerHTML = `
            <td>${caj.nro}</td>
            <td>${caj.nombre}</td>
            <td>${caj.dni}</td>
            <td><button class="btn-eliminar-cajero" data-nro="${caj.nro}">ELIMINAR</button></td>
          `;

          tablaCajeros.appendChild(tr);
        });

        document.querySelectorAll(".btn-eliminar-cajero").forEach(btn => {
          btn.onclick = () => eliminarCajero(btn.dataset.nro);
        });
      }
      llenarOpcionesCajeroNro(cajerosObj);
    });
  }

  async function eliminarCajero(nro) {
    const pass = prompt("Ingrese contraseña administrativa:");
    const snapConfig = await window.get(window.ref(window.db, "config/passAdmin"));
    const adminPass = snapConfig.exists() ? snapConfig.val() : ADMIN_PASS_DEFAULT;

    if (pass === adminPass) {
      await window.remove(window.ref(window.db, `cajeros/${nro}`));
    } else {
      alert("Contraseña incorrecta");
    }
  }

  // ======================================================
  // CONFIGURACIÓN
  // ======================================================
  btnGuardarConfig.addEventListener("click", async () => {
    const nombre = inputConfigNombre.value.trim();
    const pass = inputConfigPass.value.trim();

    if (!nombre || !pass) {
      configMsg.textContent = "Complete todos los campos";
      return;
    }

    await window.set(window.ref(window.db, "config"), {
      nombre, passAdmin: pass
    });

    configMsg.textContent = "Configuración guardada ✅";
  });

  btnRestaurar.addEventListener("click", async () => {
    if (inputMasterPass.value === MASTER_PASS) {
      await window.update(window.ref(window.db, "config"), {
        passAdmin: ADMIN_PASS_DEFAULT
      });
      configMsg.textContent = "Contraseña administrativa restaurada ✅";
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

  console.log("✅ app-3.js cargado correctamente");
})();
