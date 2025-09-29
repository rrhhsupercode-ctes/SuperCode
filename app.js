// -----------------------
// VARIABLES GLOBALES
// -----------------------
const tablaMovimientos = document.querySelector("#tabla-movimientos tbody");
const filtroCajero = document.getElementById("filtroCajero");
const btnTirarZ = document.getElementById("btn-tirar-z");

// -----------------------
// FORMATEOS
// -----------------------
function formatoPrecioParaPantalla(v) {
  return "$" + Number(v).toFixed(2);
}
function formatFechaParaHeader(ts) {
  return new Date(ts).toLocaleString();
}

// -----------------------
// LLENAR SELECT DE CAJEROS
// -----------------------
window.onValue(window.ref(window.db, "cajeros"), snap => {
  filtroCajero.innerHTML = `<option value="TODOS">TODOS</option>`;
  if (!snap.exists()) return;
  const data = snap.val();
  Object.values(data).forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.nro;
    opt.textContent = `${c.nro} - ${c.nombre}`;
    filtroCajero.appendChild(opt);
  });
});

// -----------------------
// MOVIMIENTOS
// -----------------------
window.onValue(window.ref(window.db, "movimientos"), snap => {
  renderMovimientos(snap);
});
filtroCajero.addEventListener("change", async () => {
  const snap = await window.get(window.ref(window.db, "movimientos"));
  renderMovimientos(snap);
});

function renderMovimientos(snap) {
  tablaMovimientos.innerHTML = "";
  if (!snap.exists()) return;
  let data = Object.values(snap.val());

  const cajSel = filtroCajero.value;
  if (cajSel !== "TODOS") {
    data = data.filter(m => (m.cajero || "N/A") == cajSel);
  }

  data.forEach(mov => {
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
}

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

function imprimirTicketMov(mov) {
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

  printAreas.forEach(a => document.body.appendChild(a));
  window.print();
  printAreas.forEach(a => document.body.removeChild(a));
}

// -----------------------
// TIRAR Z (POR CAJERO O TODOS)
// -----------------------
btnTirarZ && btnTirarZ.addEventListener("click", async () => {
  const snap = await window.get(window.ref(window.db, "movimientos"));
  if (!snap.exists()) return alert("No hay movimientos para tirar Z");
  let data = Object.values(snap.val());

  const cajSel = filtroCajero.value || "TODOS";
  if (cajSel !== "TODOS") {
    data = data.filter(m => (m.cajero || "N/A") === cajSel);
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
    grouped[caj].Efectivo.forEach(m => { html += `<p>ID ${m.id} - ${formatoPrecioParaPantalla(m.total)}</p>`; totalEf += Number(m.total); });
    html += `<p><b>Total Efectivo Cajero: ${formatoPrecioParaPantalla(totalEf)}</b></p>`;
    html += `<h4>Tarjeta</h4>`;
    grouped[caj].Tarjeta.forEach(m => { html += `<p>ID ${m.id} - ${formatoPrecioParaPantalla(m.total)}</p>`; totalTar += Number(m.total); });
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

  // Borrar movimientos del cajero seleccionado
  if (cajSel === "TODOS") {
    await window.set(window.ref(window.db, "movimientos"), {});
  } else {
    const updates = {};
    Object.values(snap.val()).forEach(m => {
      if ((m.cajero || "N/A") === cajSel) updates[m.id] = null;
    });
    await window.update(window.ref(window.db, "movimientos"), updates);
  }
  alert(`Tirar Z completado para ${cajSel}`);
});

// -----------------------
// FUNCIONES DE MODAL
// -----------------------
function mostrarModal(html) {
  const overlay = document.getElementById("modal-overlay");
  overlay.innerHTML = html;
  overlay.classList.remove("hidden");
}
function cerrarModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}
function requireAdminConfirm(cb) {
  if (confirm("¿Seguro que quieres eliminar?")) cb();
}
