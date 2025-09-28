/*****************************************************
 * app-2.js
 * Funciones de Movimientos, Stock, Cajeros y Configuración
 *****************************************************/
(() => {
  // === REFERENCIAS ===
  const tablaMovimientos = document.querySelector("#tabla-movimientos tbody");
  const btnTirarZ = document.getElementById("btn-tirar-z");
  const inputStockCodigo = document.getElementById("stock-codigo");
  const stockCantidadSelect = document.getElementById("stock-cantidad");
  const btnAgregarStock = document.getElementById("agregar-stock");
  const tablaStock = document.querySelector("#tabla-stock tbody");
  const cajeroNroSelect = document.getElementById("cajero-nro");
  const inputCajeroNombre = document.getElementById("cajero-nombre");
  const inputCajeroDni = document.getElementById("cajero-dni");
  const inputCajeroPass = document.getElementById("cajero-pass");
  const btnAgregarCajero = document.getElementById("agregar-cajero");
  const tablaCajeros = document.querySelector("#tabla-cajeros tbody");
  const inputConfigNombre = document.getElementById("config-nombre");
  const inputConfigPass = document.getElementById("config-pass");
  const btnGuardarConfig = document.getElementById("guardar-config");
  const btnRestaurar = document.getElementById("btn-restaurar");
  const inputMasterPass = document.getElementById("master-pass");
  const configMsg = document.getElementById("config-msg");

  // === COMBOS ===
  for (let i = 1; i <= 999; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i.toString().padStart(3, "0");
    stockCantidadSelect.appendChild(opt);
  }
  for (let i = 1; i <= 99; i++) {
    const opt = document.createElement("option");
    opt.value = i.toString().padStart(2, "0");
    opt.textContent = i.toString().padStart(2, "0");
    cajeroNroSelect.appendChild(opt);
  }

  // === MOVIMIENTOS ===
  window.onValue(window.ref(window.db, "movimientos"), snap => {
    tablaMovimientos.innerHTML = "";
    if (snap.exists()) {
      const data = snap.val();
      Object.values(data).forEach(mov => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${mov.id}</td>
          <td>$${mov.total}</td>
          <td>${mov.tipo}</td>
          <td><button data-id="${mov.id}" class="btn-del-mov">X</button></td>
        `;
        tablaMovimientos.appendChild(tr);
      });
      document.querySelectorAll(".btn-del-mov").forEach(btn => {
        btn.onclick = async () => {
          await window.remove(window.ref(window.db, `movimientos/${btn.dataset.id}`));
        };
      });
    }
  });

  btnTirarZ.addEventListener("click", async () => {
    await window.set(window.ref(window.db, "movimientos"), {});
    alert("Movimientos reseteados ✅");
  });

  // === STOCK ===
  window.onValue(window.ref(window.db, "stock"), snap => {
    tablaStock.innerHTML = "";
    if (snap.exists()) {
      const data = snap.val();
      Object.entries(data).forEach(([codigo, prod]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${codigo}</td>
          <td>${prod.nombre}</td>
          <td>${prod.cantidad}</td>
          <td>${prod.fecha || ""}</td>
          <td>$${prod.precio}</td>
          <td><button data-id="${codigo}" class="btn-del-stock">X</button></td>
        `;
        tablaStock.appendChild(tr);
      });
      document.querySelectorAll(".btn-del-stock").forEach(btn => {
        btn.onclick = async () => {
          await window.remove(window.ref(window.db, `stock/${btn.dataset.id}`));
        };
      });
    }
  });

  btnAgregarStock.addEventListener("click", async () => {
    const codigo = inputStockCodigo.value.trim();
    const cantidad = parseInt(stockCantidadSelect.value, 10);
    if (!codigo) return alert("Ingrese un código");
    const prodSnap = await window.get(window.ref(window.db, `stock/${codigo}`));
    if (prodSnap.exists()) {
      const prod = prodSnap.val();
      await window.update(window.ref(window.db, `stock/${codigo}`), {
        cantidad: prod.cantidad + cantidad
      });
    } else {
      await window.set(window.ref(window.db, `stock/${codigo}`), {
        nombre: `Producto ${codigo}`,
        cantidad,
        fecha: new Date().toISOString(),
        precio: 100
      });
    }
    inputStockCodigo.value = "";
  });

  // === CAJEROS ===
  window.onValue(window.ref(window.db, "cajeros"), snap => {
    tablaCajeros.innerHTML = "";
    if (snap.exists()) {
      const data = snap.val();
      Object.entries(data).forEach(([nro, caj]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${nro}</td>
          <td>${caj.nombre}</td>
          <td>${caj.dni}</td>
          <td><button data-id="${nro}" class="btn-del-cajero">X</button></td>
        `;
        tablaCajeros.appendChild(tr);
      });
      document.querySelectorAll(".btn-del-cajero").forEach(btn => {
        btn.onclick = async () => {
          await window.remove(window.ref(window.db, `cajeros/${btn.dataset.id}`));
        };
      });
    }
  });

  btnAgregarCajero.addEventListener("click", async () => {
    const nro = cajeroNroSelect.value;
    const nombre = inputCajeroNombre.value.trim();
    const dni = inputCajeroDni.value.trim();
    const pass = inputCajeroPass.value.trim();
    if (!nombre || !dni || !pass) return alert("Complete todos los campos");
    await window.set(window.ref(window.db, `cajeros/${nro}`), { nro, nombre, dni, pass });
    inputCajeroNombre.value = "";
    inputCajeroDni.value = "";
    inputCajeroPass.value = "";
  });

  // === CONFIGURACIÓN ===
  window.onValue(window.ref(window.db, "config"), snap => {
    if (snap.exists()) {
      const conf = snap.val();
      inputConfigNombre.value = conf.shopName || "";
      inputConfigPass.value = conf.passAdmin || "";
    }
  });

  btnGuardarConfig.addEventListener("click", async () => {
    await window.update(window.ref(window.db, "config"), {
      shopName: inputConfigNombre.value.trim(),
      passAdmin: inputConfigPass.value.trim()
    });
    configMsg.textContent = "Configuración guardada ✅";
    setTimeout(() => (configMsg.textContent = ""), 2000);
  });

  btnRestaurar.addEventListener("click", async () => {
    const master = inputMasterPass.value.trim();
    const confSnap = await window.get(window.ref(window.db, "config"));
    if (confSnap.exists() && confSnap.val().masterPass === master) {
      await window.update(window.ref(window.db, "config"), { passAdmin: "0123456789" });
      configMsg.textContent = "Contraseña restaurada ✅";
    } else {
      configMsg.textContent = "Master incorrecta";
    }
    setTimeout(() => (configMsg.textContent = ""), 2000);
  });

  console.log("✅ app-2.js cargado correctamente");
})();
