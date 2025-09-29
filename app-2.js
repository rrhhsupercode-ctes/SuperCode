/*****************************************************
 * app-2.js
 * Funciones de Movimientos, Stock, Cajeros y Configuración
 *****************************************************/
(() => {
  // === REFERENCIAS ===
  const tablaMov = document.querySelector("#tabla-movimientos tbody");
  const btnTirarZ = document.getElementById("btn-tirar-z");
  const tablaStock = document.querySelector("#tabla-stock tbody");
  const btnAgregarStock = document.getElementById("agregar-stock");
  const inputStockCodigo = document.getElementById("stock-codigo");
  const stockCantidadSelect = document.getElementById("stock-cantidad");
  const tablaCajeros = document.querySelector("#tabla-cajeros tbody");
  const btnAgregarCajero = document.getElementById("agregar-cajero");
  const cajeroNroSelect = document.getElementById("cajero-nro");
  const inputCajeroNombre = document.getElementById("cajero-nombre");
  const inputCajeroDni = document.getElementById("cajero-dni");
  const inputCajeroPass = document.getElementById("cajero-pass");
  const inputConfigNombre = document.getElementById("config-nombre");
  const inputConfigPassActual = document.getElementById("config-pass-actual");
  const inputConfigPassNueva = document.getElementById("config-pass-nueva");
  const btnGuardarConfig = document.getElementById("guardar-config");
  const btnRestaurar = document.getElementById("btn-restaurar");
  const inputMasterPass = document.getElementById("master-pass");
  const configMsg = document.getElementById("config-msg");
  const modalOverlay = document.getElementById("modal-overlay");

  let passAdminCache = null;

  // === UTILS ===
  function pedirPassAdmin(callback) {
    modalOverlay.className = "modal";
    modalOverlay.innerHTML = `
      <h3>Contraseña de Administrador</h3>
      <input type="password" id="admin-pass-input" placeholder="Ingrese contraseña">
      <div>
        <button id="btn-ok">Aceptar</button>
        <button id="btn-cancel">Cancelar</button>
      </div>
    `;
    document.getElementById("btn-ok").onclick = async () => {
      const pass = document.getElementById("admin-pass-input").value;
      const snap = await window.get(window.ref(window.db, "config"));
      if (snap.exists() && pass === snap.val().passAdmin) {
        modalOverlay.className = "modal hidden";
        modalOverlay.innerHTML = "";
        callback();
      } else {
        alert("Contraseña incorrecta");
      }
    };
    document.getElementById("btn-cancel").onclick = () => {
      modalOverlay.className = "modal hidden";
      modalOverlay.innerHTML = "";
    };
  }

  function formatoFecha(fechaIso) {
    const d = new Date(fechaIso);
    const dd = d.getDate().toString().padStart(2, "0");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = d.getHours().toString().padStart(2, "0");
    const mi = d.getMinutes().toString().padStart(2, "0");
    return `${dd}/${mm}/${yyyy} (${hh}:${mi})`;
  }

  // === STOCK ===
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
        <td>${prod.fecha ? formatoFecha(prod.fecha) : ""}</td>
        <td>$${prod.precio}</td>
        <td>
          <button data-id="${codigo}" class="btn-edit-stock">Editar</button>
          <button data-id="${codigo}" class="btn-del-stock">Eliminar</button>
        </td>
      `;
      tablaStock.appendChild(tr);
    });
    document.querySelectorAll(".btn-del-stock").forEach(btn => {
      btn.onclick = () => {
        pedirPassAdmin(async () => {
          await window.remove(window.ref(window.db, `stock/${btn.dataset.id}`));
        });
      };
    });
    document.querySelectorAll(".btn-edit-stock").forEach(btn => {
      btn.onclick = () => {
        pedirPassAdmin(() => editarStock(btn.dataset.id));
      };
    });
  });

  btnAgregarStock.addEventListener("click", async () => {
    const codigo = inputStockCodigo.value.trim();
    const cant = parseInt(stockCantidadSelect.value, 10);
    if (!codigo) return;
    const refProd = window.ref(window.db, `stock/${codigo}`);
    const snap = await window.get(refProd);
    if (snap.exists()) {
      const prod = snap.val();
      await window.update(refProd, { cantidad: prod.cantidad + cant });
    } else {
      await window.set(refProd, {
        nombre: "PRODUCTO NUEVO",
        cantidad: cant,
        precio: "00000,00",
        fecha: new Date().toISOString()
      });
    }
    inputStockCodigo.value = "";
  });

  function editarStock(codigo) {
    (async () => {
      const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
      if (!snap.exists()) return;
      const prod = snap.val();
      modalOverlay.className = "modal";
      modalOverlay.innerHTML = `
        <h3>Editar Producto</h3>
        <label>Nombre</label><input id="edit-nombre" value="${prod.nombre}">
        <label>Precio (00000,00)</label><input id="edit-precio" value="${prod.precio}">
        <label>Cantidad</label><input id="edit-cant" type="number" value="${prod.cantidad}">
        <div>
          <button id="btn-save">Guardar</button>
          <button id="btn-cancel">Cancelar</button>
        </div>
      `;
      document.getElementById("btn-save").onclick = async () => {
        const nombre = document.getElementById("edit-nombre").value.trim();
        const precio = document.getElementById("edit-precio").value.trim();
        const cant = parseInt(document.getElementById("edit-cant").value, 10);
        if (!/^\d{1,5},\d{2}$/.test(precio)) {
          alert("Precio inválido. Use formato 00000,00");
          return;
        }
        await window.update(window.ref(window.db, `stock/${codigo}`), {
          nombre,
          precio,
          cantidad: cant,
          fecha: new Date().toISOString()
        });
        cerrarModal();
      };
      document.getElementById("btn-cancel").onclick = cerrarModal;
    })();
  }

  function cerrarModal() {
    modalOverlay.className = "modal hidden";
    modalOverlay.innerHTML = "";
  }

  // === CAJEROS ===
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
          <button data-id="${nro}" class="btn-edit-caj">Editar</button>
          <button data-id="${nro}" class="btn-del-caj">Eliminar</button>
        </td>
      `;
      tablaCajeros.appendChild(tr);
    });
    document.querySelectorAll(".btn-del-caj").forEach(btn => {
      btn.onclick = () => pedirPassAdmin(async () => {
        await window.remove(window.ref(window.db, `cajeros/${btn.dataset.id}`));
      });
    });
    document.querySelectorAll(".btn-edit-caj").forEach(btn => {
      btn.onclick = () => pedirPassAdmin(() => editarCajero(btn.dataset.id));
    });
  });

  btnAgregarCajero.addEventListener("click", async () => {
    const nro = cajeroNroSelect.value;
    const nombre = inputCajeroNombre.value.trim();
    const dni = inputCajeroDni.value.trim();
    const pass = inputCajeroPass.value.trim();
    if (!nombre || !dni || !pass) return alert("Complete todos los campos");
    if (!/^\d{8}$/.test(dni)) return alert("DNI inválido (8 dígitos numéricos)");
    await window.set(window.ref(window.db, `cajeros/${nro}`), { nro, nombre, dni, pass });
    inputCajeroNombre.value = "";
    inputCajeroDni.value = "";
    inputCajeroPass.value = "";
  });

  function editarCajero(nro) {
    (async () => {
      const snap = await window.get(window.ref(window.db, `cajeros/${nro}`));
      if (!snap.exists()) return;
      const caj = snap.val();
      modalOverlay.className = "modal";
      modalOverlay.innerHTML = `
        <h3>Editar Cajero</h3>
        <label>Nombre</label><input id="edit-nombre" value="${caj.nombre}">
        <label>DNI</label><input id="edit-dni" value="${caj.dni}">
        <label>Pass</label><input id="edit-pass" value="${caj.pass}">
        <div>
          <button id="btn-save">Guardar</button>
          <button id="btn-cancel">Cancelar</button>
        </div>
      `;
      document.getElementById("btn-save").onclick = async () => {
        const nombre = document.getElementById("edit-nombre").value.trim();
        const dni = document.getElementById("edit-dni").value.trim();
        const pass = document.getElementById("edit-pass").value.trim();
        if (!/^\d{8}$/.test(dni)) {
          alert("DNI inválido (8 dígitos)");
          return;
        }
        await window.update(window.ref(window.db, `cajeros/${nro}`), { nombre, dni, pass });
        cerrarModal();
      };
      document.getElementById("btn-cancel").onclick = cerrarModal;
    })();
  }

  // === MOVIMIENTOS ===
  window.onValue(window.ref(window.db, "movimientos"), snap => {
    tablaMov.innerHTML = "";
    if (!snap.exists()) return;
    const data = snap.val();
    Object.values(data).forEach(mov => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${mov.id}</td>
        <td>$${mov.total}</td>
        <td>${mov.tipo}</td>
        <td>
          <button data-id="${mov.id}" class="btn-ver-mov">Ver</button>
          <button data-id="${mov.id}" class="btn-del-mov">Eliminar</button>
        </td>
      `;
      tablaMov.appendChild(tr);
    });
    document.querySelectorAll(".btn-del-mov").forEach(btn => {
      btn.onclick = () => pedirPassAdmin(async () => {
        await window.remove(window.ref(window.db, `movimientos/${btn.dataset.id}`));
      });
    });
    document.querySelectorAll(".btn-ver-mov").forEach(btn => {
      btn.onclick = () => verMovimiento(btn.dataset.id);
    });
  });

  function verMovimiento(id) {
    (async () => {
      const snap = await window.get(window.ref(window.db, `movimientos/${id}`));
      if (!snap.exists()) return;
      const mov = snap.val();
      modalOverlay.className = "modal";
      let html = `<h3>Ticket ${mov.id}</h3>`;
      mov.items.forEach(it => {
        html += `<p>${it.cantidad} x ${it.nombre} - $${it.precio * it.cantidad}</p>`;
      });
      html += `<hr><p><b>TOTAL: $${mov.total}</b></p><p>Pago: ${mov.tipo}</p>`;
      html += `
        <div>
          <button id="btn-print">Imprimir Copia</button>
          <button id="btn-close">Cerrar</button>
        </div>
      `;
      modalOverlay.innerHTML = html;
      document.getElementById("btn-print").onclick = () => {
        imprimirTicket(mov);
      };
      document.getElementById("btn-close").onclick = cerrarModal;
    })();
  }

  function imprimirTicket(mov) {
    const area = document.createElement("div");
    area.className = "print-area";
    const fecha = new Date().toLocaleString();
    let html = `
      <h3>SUPERCODE</h3>
      <p>${fecha}</p>
      <p>Cajero: ${mov.cajero}</p>
      <hr>
    `;
    mov.items.forEach(it => {
      html += `<p>${it.cantidad} x ${it.nombre} - $${it.precio * it.cantidad}</p>`;
    });
    html += `<hr><p><b>TOTAL: $${mov.total}</b></p><p>Pago: ${mov.tipo}</p><p>ID: ${mov.id}</p>`;
    area.innerHTML = html;
    document.body.appendChild(area);
    window.print();
    document.body.removeChild(area);
  }

  btnTirarZ.addEventListener("click", async () => {
    const snap = await window.get(window.ref(window.db, "movimientos"));
    if (!snap.exists()) return;
    const data = Object.values(snap.val());
    // Imprimir resumen
    let html = `<h3>Reporte Z</h3>`;
    let totalEf = 0, totalTar = 0;
    html += `<h4>Efectivo</h4>`;
    data.filter(m => m.tipo === "Efectivo").forEach(m => {
      html += `<p>ID ${m.id} - $${m.total}</p>`;
      totalEf += m.total;
    });
    html += `<p>Total Efectivo: $${totalEf}</p>`;
    html += `<h4>Tarjeta</h4>`;
    data.filter(m => m.tipo === "Tarjeta").forEach(m => {
      html += `<p>ID ${m.id} - $${m.total}</p>`;
      totalTar += m.total;
    });
    html += `<p>Total Tarjeta: $${totalTar}</p>`;
    html += `<h3>Gran Total: $${totalEf + totalTar}</h3>`;
    html += `
      <table border="1" style="margin-top:20px">
        <tr><th>Efectivo Cobrado</th><th>Firma Cajero</th><th>Firma Encargado</th></tr>
        <tr><td></td><td></td><td></td></tr>
      </table>
      <br><br>
      <table border="1">
        <tr><th>Tarjeta Cobrada</th><th>Firma Cajero</th><th>Firma Encargado</th></tr>
        <tr><td></td><td></td><td></td></tr>
      </table>
    `;
    const area = document.createElement("div");
    area.className = "print-area";
    area.innerHTML = html;
    document.body.appendChild(area);
    window.print();
    document.body.removeChild(area);

    // Eliminar movimientos
    await window.set(window.ref(window.db, "movimientos"), {});
  });

  // === CONFIG ===
  window.onValue(window.ref(window.db, "config"), snap => {
    if (!snap.exists()) return;
    const conf = snap.val();
    inputConfigNombre.value = conf.shopName || "";
    passAdminCache = conf.passAdmin;
  });

  btnGuardarConfig.addEventListener("click", async () => {
    const shopName = inputConfigNombre.value.trim();
    const actual = inputConfigPassActual.value.trim();
    const nueva = inputConfigPassNueva.value.trim();
    if (!shopName) return alert("Ingrese nombre de tienda");
    if (!actual || !nueva) return alert("Complete contraseñas");
    if (actual !== passAdminCache) return alert("Contraseña actual incorrecta");
    if (nueva.length < 4 || nueva.length > 10) return alert("La contraseña debe tener entre 4 y 10 caracteres");
    await window.update(window.ref(window.db, "config"), { shopName, passAdmin: nueva });
    configMsg.textContent = "Configuración guardada ✅";
    inputConfigPassActual.value = "";
    inputConfigPassNueva.value = "";
  });

  btnRestaurar.addEventListener("click", async () => {
    const pass = inputMasterPass.value.trim();
    const snap = await window.get(window.ref(window.db, "config"));
    if (!snap.exists()) return;
    const conf = snap.val();
    if (pass === conf.masterPass) {
      await window.update(window.ref(window.db, "config"), { passAdmin: "0123456789" });
      configMsg.textContent = "Contraseña restaurada ✅";
    } else {
      configMsg.textContent = "Contraseña maestra incorrecta";
    }
  });

  console.log("✅ app-2.js cargado correctamente");
})();
