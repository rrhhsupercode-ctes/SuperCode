/* =========================================================
   SuperCode - APP-3.js
   Completa: MOVIMIENTOS, TIRAR Z, STOCK (CRUD), CAJEROS (CRUD), CONFIGURACIÓN
   - Conecta completamente con Firebase Realtime Database
   - Protegido por contraseña administrativa almacenada en /config/adminPass
   - Usa /cajeros/{nro}, /stock/{codigo}, /movimientos/{ticketId}, /zreports/{yyyy-mm-dd}/{part}
   - Asume que `db` y `currentCashier` (o window.currentCashier) existen (definidos en app-1/app-2)
   - Comprueba elementos del DOM antes de operar (para evitar errores si tu HTML tiene ids distintos)
   ========================================================= */

import {
  getDatabase,
  ref,
  get,
  child,
  set,
  update,
  push,
  remove,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* -------------------------
   UTIL / SETUP
   ------------------------- */
const db = (() => {
  try {
    return getDatabase(); // debería existir por app-1/app-2
  } catch (e) {
    console.error("Firebase DB no inicializada. Asegúrate de cargar app-1.js antes de app-3.js", e);
    throw e;
  }
})();

function logMissing(id) { console.warn(`Elemento DOM no encontrado: ${id}`); }
function byId(id) { const el = document.getElementById(id); if(!el) logMissing(id); return el; }

// Obtener cajero actual (intenta variable global o window)
let currentCashier = window.currentCashier || (typeof currentCashier !== 'undefined' && currentCashier) || null;

/* ============================
   CONFIG: adminPass y comercio
   ============================ */
const CONFIG_REF = ref(db, 'config');

async function ensureConfigDefaults() {
  try {
    const snap = await get(child(ref(db), 'config'));
    if (!snap.exists()) {
      await set(ref(db, 'config'), {
        adminPass: "0123456789",
        masterPass: "9999",
        shopName: "SUPERCODE"
      });
      console.info("Config por defecto creada en Firebase.");
    }
  } catch (err) {
    console.error("Error leyendo/creando config:", err);
  }
}

async function getAdminPass() {
  const snap = await get(child(ref(db), 'config/adminPass'));
  return snap.exists() ? String(snap.val()) : "0123456789";
}

async function getMasterPass() {
  const snap = await get(child(ref(db), 'config/masterPass'));
  return snap.exists() ? String(snap.val()) : "9999";
}

async function getShopName() {
  const snap = await get(child(ref(db), 'config/shopName'));
  return snap.exists() ? String(snap.val()) : "SUPERCODE";
}

/* Inicializar valores por defecto si no existen */
ensureConfigDefaults();

/* ============================
   MOVIMIENTOS: Listar, Reimprimir, Eliminar (restaura stock)
   ============================ */

const movimientosTableBody = byId('movimientos-table') ? byId('movimientos-table').querySelector('tbody') : byId('tabla-movimientos') ? byId('tabla-movimientos').querySelector('tbody') : null;
// Soporta ambos nombres de tabla: 'movimientos-table' o 'tabla-movimientos'

async function refreshMovimientos() {
  if (!movimientosTableBody) return;
  movimientosTableBody.innerHTML = "<tr><td colspan='4'>Cargando...</td></tr>";

  try {
    const snap = await get(child(ref(db), 'movimientos'));
    movimientosTableBody.innerHTML = "";
    if (!snap.exists()) {
      movimientosTableBody.innerHTML = "<tr><td colspan='4'>No hay movimientos</td></tr>";
      return;
    }
    const all = snap.val();
    // Mostrar en orden descendente por fecha (si el ticket tiene fecha)
    const rows = Object.values(all).sort((a,b) => {
      const ta = a.fecha ? new Date(a.fecha) : 0;
      const tb = b.fecha ? new Date(b.fecha) : 0;
      return tb - ta;
    });

    for (const mv of rows) {
      const tr = document.createElement('tr');
      const idTd = document.createElement('td');
      const totalTd = document.createElement('td');
      const tipoTd = document.createElement('td');
      const accTd = document.createElement('td');

      // ID clickeable para ver detalle
      const idLink = document.createElement('a');
      idLink.href = '#';
      idLink.textContent = mv.id || '—';
      idLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        abrirDetalleTicket(mv.id);
      });
      idTd.appendChild(idLink);

      totalTd.textContent = formatMoney(mv.total || 0);
      tipoTd.textContent = (mv.metodo || '').toUpperCase();
      // Acciones: REIMPRIMIR, ELIMINAR
      const btnReimprimir = document.createElement('button');
      btnReimprimir.textContent = 'REIMPRIMIR';
      btnReimprimir.addEventListener('click', () => imprimirTicketDesdeMovimiento(mv.id));

      const btnEliminar = document.createElement('button');
      btnEliminar.textContent = 'ELIMINAR';
      btnEliminar.style.marginLeft = '8px';
      btnEliminar.addEventListener('click', () => eliminarMovimientoConConfirm(mv.id));

      accTd.appendChild(btnReimprimir);
      accTd.appendChild(btnEliminar);

      tr.appendChild(idTd);
      tr.appendChild(totalTd);
      tr.appendChild(tipoTd);
      tr.appendChild(accTd);

      movimientosTableBody.appendChild(tr);
    }
  } catch (err) {
    console.error("Error cargando movimientos:", err);
    movimientosTableBody.innerHTML = "<tr><td colspan='4'>Error al cargar</td></tr>";
  }
}

async function abrirDetalleTicket(ticketId) {
  if (!ticketId) return alert("ID inválido");
  const snap = await get(child(ref(db), `movimientos/${ticketId}`));
  if (!snap.exists()) return alert("Ticket no encontrado");
  const mv = snap.val();

  // Generar modal con detalle (usa #ticket-preview o crea uno rápido)
  let modal = byId('ticket-preview');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.zIndex = 9999;
    modal.innerHTML = `<div class="modal-inner" id="ticket-preview-inner"></div>`;
    document.body.appendChild(modal);
  }
  const inner = modal.querySelector('.modal-inner') || modal;

  let html = `<h3>Ticket ${mv.id}</h3>`;
  html += `<p>Cajero: ${mv.cajero} - ${mv.nombreCajero}<br>Fecha: ${mv.fecha}</p>`;
  html += `<hr>`;
  mv.productos.forEach(p => {
    html += `<p>${p.nombre} x${p.cantidad} — ${formatMoney(p.precio * p.cantidad)}</p>`;
  });
  html += `<hr><p><b>TOTAL: ${formatMoney(mv.total)}</b></p>`;
  html += `<div style="display:flex;gap:8px;margin-top:8px"><button id="reimprimir-ticket">REIMPRIMIR</button><button id="cerrar-detalle">CERRAR</button></div>`;

  inner.innerHTML = html;
  modal.classList.remove('hidden');
  modal.classList.add('active');

  byId('reimprimir-ticket')?.addEventListener('click', () => imprimirTicketDesdeMovimiento(ticketId));
  byId('cerrar-detalle')?.addEventListener('click', () => {
    modal.classList.remove('active');
    modal.classList.add('hidden');
  });
}

function imprimirTicketDesdeMovimiento(ticketId) {
  get(child(ref(db), `movimientos/${ticketId}`)).then(snap => {
    if (!snap.exists()) return alert("Movimiento no encontrado");
    const mv = snap.val();
    // Generar misma vista que en app-2 imprimirTicket
    let contenido = `<div style="width:5cm;font-family:monospace;">`;
    contenido += `<h3 style="text-align:center;">${(mv.shopName || 'SUPERCODE')}</h3>`;
    contenido += `<p>ID: ${mv.id}<br>Cajero: ${mv.cajero} - ${mv.nombreCajero}<br>Fecha: ${mv.fecha}</p><hr>`;
    mv.productos.forEach(p => contenido += `<p>${p.nombre} x${p.cantidad} - ${formatMoney(p.precio * p.cantidad)}</p>`);
    contenido += `<hr><p><strong>TOTAL: ${formatMoney(mv.total)}</strong></p>`;
    contenido += `<p>Método: ${mv.metodo}</p>`;
    contenido += `<p style="text-align:center;">Gracias por su compra<br>www.supercode.com.ar</p>`;
    contenido += `</div>`;

    const w = window.open('', 'PRINT', 'width=400,height=600');
    w.document.write(contenido);
    w.print();
    w.close();
  }).catch(err => {
    console.error("Imprimir ticket error:", err);
  });
}

async function eliminarMovimientoConConfirm(ticketId) {
  const adminPass = await getAdminPass();
  const pass = prompt("Ingrese contraseña administrativa para eliminar ticket:");
  if (pass !== adminPass) return alert("Contraseña incorrecta");

  if (!confirm("¿Está seguro de eliminar este ticket? Esta acción devolverá el stock correspondiente.")) return;

  const snap = await get(child(ref(db), `movimientos/${ticketId}`));
  if (!snap.exists()) return alert("Movimiento no encontrado");

  const mv = snap.val();
  // Restaurar stock según productos del ticket
  for (const p of mv.productos) {
    const stockSnap = await get(child(ref(db), `stock/${p.codigo}`));
    if (stockSnap.exists()) {
      const prod = stockSnap.val();
      await set(ref(db, `stock/${p.codigo}/cantidad`), (parseInt(prod.cantidad || 0) + parseInt(p.cantidad || 0)));
    } else {
      // Si no existe, crearlo con la cantidad que devuelve
      await set(ref(db, `stock/${p.codigo}`), {
        nombre: p.nombre || "PRODUCTO",
        cantidad: p.cantidad,
        precio: p.precio || 0,
        fechaIngreso: new Date().toISOString()
      });
    }
  }

  // Eliminar movimiento
  await remove(ref(db, `movimientos/${ticketId}`));
  alert("Movimiento eliminado y stock restaurado.");
  refreshMovimientos();
}

/* ============================
   TIRAR Z (CIERRE DE CAJA)
   - Requiere contraseña admin
   - Agrupa movimientos del día y genera 3 partes (efectivo, tarjeta, resumen)
   - Guarda en /zreports/{fecha}/{part} y permite consulta por 60 días
   ============================ */
async function tirarZ() {
  const adminPass = await getAdminPass();
  const pass = prompt("Ingrese contraseña administrativa para TIRAR Z:");
  if (pass !== adminPass) return alert("Contraseña incorrecta");

  if (!confirm("¿Está seguro que desea tirar Z ahora? Esta acción no se podrá revertir.")) return;

  // Obtener fecha de hoy (yyyy-mm-dd)
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const fechaKey = `${yyyy}-${mm}-${dd}`;

  // Obtener todos los movimientos del día (filtrar por fecha que contenga yyyy-mm-dd)
  const snap = await get(child(ref(db), 'movimientos'));
  const all = snap.exists() ? snap.val() : {};

  const movimientosDelDia = Object.values(all).filter(m => m.fecha && m.fecha.includes(`${dd}/${mm}/${yyyy}`) || (m.fecha && m.fecha.includes(`${yyyy}-${mm}-${dd}`)));
  // Nota: tolerancia a formatos de fecha: si tu app guarda fecha en otro formato, adaptar filtro.

  // Separar por método
  const efectivo = movimientosDelDia.filter(m => (m.metodo || '').toLowerCase() === 'efectivo');
  const tarjeta = movimientosDelDia.filter(m => (m.metodo || '').toLowerCase() === 'tarjeta');

  const sum = arr => arr.reduce((s, x) => s + (parseFloat(x.total) || 0), 0);

  const efectivoTotal = sum(efectivo);
  const tarjetaTotal = sum(tarjeta);
  const total = efectivoTotal + tarjetaTotal;

  // Partes: 1) todos los efectivos 2) todos tarjeta 3) resumen
  const part1 = { tipo: 'efectivo', items: efectivo, total: efectivoTotal };
  const part2 = { tipo: 'tarjeta', items: tarjeta, total: tarjetaTotal };
  const part3 = { tipo: 'resumen', efectivo: efectivoTotal, tarjeta: tarjetaTotal, total };

  // Guardar Z en Firebase bajo /zreports/{fecha}/{timestamp}
  const timestamp = Date.now();
  await set(ref(db, `zreports/${fechaKey}/${timestamp}`), {
    part1,
    part2,
    part3,
    cajero: (currentCashier && currentCashier.nro) || 'N/A',
    fecha: new Date().toISOString()
  });

  // Generar impresión A4 con tres secciones y campos de firma
  let contenido = `<div style="width:100%;font-family:Arial;">`;
  contenido += `<h2 style="text-align:center;">${await getShopName()}</h2>`;
  contenido += `<h3 style="text-align:center;">Z Report - ${fechaKey} (ID${timestamp})</h3>`;
  contenido += `<hr>`;
  contenido += `<h4>Parte 1 - Cobros en Efectivo</h4>`;
  part1.items.forEach(i => contenido += `<p>${i.id} - ${formatMoney(i.total)}</p>`);
  contenido += `<p><b>Total efectivo: ${formatMoney(efectivoTotal)}</b></p><hr>`;
  contenido += `<h4>Parte 2 - Cobros en Tarjeta</h4>`;
  part2.items.forEach(i => contenido += `<p>${i.id} - ${formatMoney(i.total)}</p>`);
  contenido += `<p><b>Total tarjeta: ${formatMoney(tarjetaTotal)}</b></p><hr>`;
  contenido += `<h4>Parte 3 - Resumen</h4>`;
  contenido += `<p>Cobros en efectivo: ${formatMoney(efectivoTotal)}</p>`;
  contenido += `<p>Cobros con tarjeta: ${formatMoney(tarjetaTotal)}</p>`;
  contenido += `<p><b>TOTAL: ${formatMoney(total)}</b></p>`;
  contenido += `<hr style="margin:20px 0">`;

  // Espacios de firma (2x2)
  contenido += `<table style="width:100%;border-collapse:collapse;margin-top:10px;">`;
  contenido += `<tr><td style="width:50%;height:80px;border:1px solid #000;padding:6px">Efectivo real - Firma de encargado</td><td style="width:50%;height:80px;border:1px solid #000;padding:6px">Tarjeta real - Firma de encargado</td></tr>`;
  contenido += `<tr><td style="width:50%;height:80px;border:1px solid #000;padding:6px">Firma de Cajero</td><td style="width:50%;height:80px;border:1px solid #000;padding:6px">Número de Cajero: ${(currentCashier && currentCashier.nro) || 'N/A'}</td></tr>`;
  contenido += `</table>`;
  contenido += `<p>Fecha y hora de cierre de caja: ${new Date().toLocaleString()}</p>`;
  contenido += `</div>`;

  const w = window.open('', 'ZPRINT', 'width=900,height=1000');
  w.document.write(contenido);
  w.print();
  w.close();

  // Logout del cajero tras tirar Z
  if (window.currentCashier) window.currentCashier = null;
  currentCashier = null;
  alert("Z ejecutado. Sesión cerrada.");
  // NOTA: El enunciado pedía que el table impreso esté disponible 60 días — los datos quedan en /zreports para consulta; si quieres, podemos eliminar pasado 60 días mediante función cron / cloud function.
}

/* ============================
   STOCK: Alta, Editar (requiere admin), sobrescribir fecha si mismo código
   ============================ */
const stockTableBody = byId('stock-table') ? byId('stock-table').querySelector('tbody') : byId('tabla-stock') ? byId('tabla-stock').querySelector('tbody') : null;
const stockCodigoInput = byId('stock-scan') || byId('stock-codigo') || null;
const stockCantidadSelect = byId('stock-cantidad') || null;
const stockAgregarBtn = byId('stock-agregar') || null;
const modalEditProduct = byId('modal-edit-product') || null;

async function refreshStockTable() {
  if (!stockTableBody) return;
  stockTableBody.innerHTML = "<tr><td colspan='6'>Cargando stock...</td></tr>";
  try {
    const snap = await get(child(ref(db), 'stock'));
    stockTableBody.innerHTML = "";
    if (!snap.exists()) {
      stockTableBody.innerHTML = "<tr><td colspan='6'>No hay productos</td></tr>";
      return;
    }
    const all = snap.val();
    // Ordenar por fecha de ingreso (si existe)
    const rows = Object.entries(all).sort((a,b) => {
      const fa = a[1].fechaIngreso ? new Date(a[1].fechaIngreso).getTime() : 0;
      const fb = b[1].fechaIngreso ? new Date(b[1].fechaIngreso).getTime() : 0;
      return fb - fa;
    });
    for (const [codigo, p] of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${codigo}</td>
        <td>${p.nombre || '<i>EDITAR PRODUCTO NUEVO</i>'}</td>
        <td>${p.cantidad || 0}</td>
        <td>${p.fechaIngreso || '-'}</td>
        <td>${p.precio ? formatMoney(parseFloat(p.precio)) : '<i>EDITAR $0,00</i>'}</td>
        <td>
          <button class="editar-prod" data-codigo="${codigo}">EDITAR</button>
        </td>`;
      stockTableBody.appendChild(tr);
    }
    // Asignar eventos editar
    document.querySelectorAll('.editar-prod').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const codigo = e.currentTarget.dataset.codigo;
        abrirModalEditarProducto(codigo);
      });
    });
  } catch (err) {
    console.error("Error cargando stock:", err);
    stockTableBody.innerHTML = "<tr><td colspan='6'>Error al cargar stock</td></tr>";
  }
}

async function abrirModalEditarProducto(codigo) {
  // Pedir contraseña admin
  const adminPass = await getAdminPass();
  const pass = prompt("Contraseña administrativa para editar producto:");
  if (pass !== adminPass) return alert("Contraseña incorrecta");

  const snap = await get(child(ref(db), `stock/${codigo}`));
  const existing = snap.exists() ? snap.val() : null;
  // Usamos modalEditProduct si existe, sino prompt fallback
  if (!modalEditProduct) {
    // Fallback rápido por prompts (no ideal, pero funcional)
    const nombre = prompt("Nombre producto:", (existing && existing.nombre) || "");
    const cantidad = prompt("Cantidad:", (existing && existing.cantidad) || "0");
    const precio = prompt("Precio (formato 1234.56):", (existing && existing.precio) || "0");
    await set(ref(db, `stock/${codigo}`), {
      nombre,
      cantidad: parseInt(cantidad || 0),
      precio: parseFloat(precio || 0),
      fechaIngreso: new Date().toISOString()
    });
    await refreshStockTable();
    return;
  }

  // Si modal existe, llenarlo y mostrar
  byId('edit-barcode')?.setAttribute('value', codigo);
  byId('edit-name')?.setAttribute('value', (existing && existing.nombre) || '');
  byId('edit-qty')?.setAttribute('value', (existing && existing.cantidad) || 0);
  byId('edit-price')?.setAttribute('value', (existing && existing.precio) || '');

  modalEditProduct.classList.remove('hidden');
  modalEditProduct.classList.add('active');

  // Guardar evento
  const saveBtn = byId('edit-save');
  if (saveBtn) {
    const handler = async () => {
      const nombre = byId('edit-name').value.trim();
      const cantidad = parseInt(byId('edit-qty').value) || 0;
      const precio = parseFloat(byId('edit-price').value) || 0;
      await set(ref(db, `stock/${codigo}`), {
        nombre,
        cantidad,
        precio,
        fechaIngreso: new Date().toISOString() // sobrescribe fecha de ingreso si se reingresa
      });
      modalEditProduct.classList.add('hidden');
      modalEditProduct.classList.remove('active');
      saveBtn.removeEventListener('click', handler);
      await refreshStockTable();
    };
    saveBtn.addEventListener('click', handler);
  }
}

/* Agregar / actualizar stock desde inputs (escaneo + cantidad select) */
if (stockAgregarBtn && stockCodigoInput && stockCantidadSelect) {
  stockAgregarBtn.addEventListener('click', async () => {
    const codigo = stockCodigoInput.value.trim();
    const cantidad = parseInt(stockCantidadSelect.value) || 0;
    if (!codigo || isNaN(cantidad)) return alert("Código y cantidad válidos");

    const snap = await get(child(ref(db), `stock/${codigo}`));
    if (snap.exists()) {
      // si existe, actualizar cantidad (sumar)
      const producto = snap.val();
      const nuevaCant = (parseInt(producto.cantidad || 0) + cantidad);
      await update(ref(db, `stock/${codigo}`), {
        cantidad: nuevaCant,
        fechaIngreso: new Date().toISOString()
      });
    } else {
      // Crear producto nuevo con nombre vacío (editable por admin)
      await set(ref(db, `stock/${codigo}`), {
        nombre: '',
        cantidad,
        precio: 0,
        fechaIngreso: new Date().toISOString()
      });
    }
    await refreshStockTable();
    stockCodigoInput.value = '';
    stockCantidadSelect.value = '1';
  });
}

/* ============================
   CAJEROS: Alta, Editar (pass admin o pass cajero), Eliminar, Imprimir tarjeta
   - Guardamos en /cajeros/{nro}
   ============================ */
const cajeroFormNro = byId('cajero-nro');
const cajeroFormNombre = byId('cajero-nombre');
const cajeroFormDNI = byId('cajero-dni');
const cajeroFormPass = byId('cajero-pass');
const cajeroAgregarBtn = byId('cajero-agregar');
const cajerosTableBody = byId('cajeros-table') ? byId('cajeros-table').querySelector('tbody') : byId('tabla-cajeros') ? byId('tabla-cajeros').querySelector('tbody') : null;

async function refreshCajerosTable() {
  if (!cajerosTableBody) return;
  cajerosTableBody.innerHTML = "<tr><td colspan='4'>Cargando...</td></tr>";
  const snap = await get(child(ref(db), 'cajeros'));
  cajerosTableBody.innerHTML = "";
  if (!snap.exists()) {
    cajerosTableBody.innerHTML = "<tr><td colspan='4'>No hay cajeros</td></tr>";
    return;
  }
  const all = snap.val();
  for (const [nro, data] of Object.entries(all)) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${nro}</td><td>${data.nombre}</td><td>${data.dni}</td><td>
      <button class="editar-cajero" data-nro="${nro}">EDITAR</button>
      <button class="eliminar-cajero" data-nro="${nro}">ELIMINAR</button>
      <button class="imprimir-cajero" data-nro="${nro}">IMPRIMIR</button>
    </td>`;
    cajerosTableBody.appendChild(tr);
  }
  // Asignar eventos
  document.querySelectorAll('.editar-cajero').forEach(b => b.addEventListener('click', async (e) => {
    const nro = e.currentTarget.dataset.nro;
    await editarCajeroModal(nro);
  }));
  document.querySelectorAll('.eliminar-cajero').forEach(b => b.addEventListener('click', async (e) => {
    const nro = e.currentTarget.dataset.nro;
    const adminPass = await getAdminPass();
    const pass = prompt("Ingrese contraseña admin para eliminar cajero:");
    if (pass !== adminPass) return alert("Contraseña incorrecta");
    if (confirm("¿Eliminar cajero? Esta acción es irreversible.")) {
      await remove(ref(db, `cajeros/${nro}`));
      await refreshCajerosTable();
      alert("Cajero eliminado.");
    }
  }));
  document.querySelectorAll('.imprimir-cajero').forEach(b => b.addEventListener('click', async (e) => {
    const nro = e.currentTarget.dataset.nro;
    const snap = await get(child(ref(db), `cajeros/${nro}`));
    if (!snap.exists()) return alert("Cajero no encontrado");
    const data = snap.val();
    imprimirTarjetaCajero(nro, data.nombre);
  }));
}

if (cajeroAgregarBtn && cajeroFormNro && cajeroFormNombre && cajeroFormDNI && cajeroFormPass) {
  cajeroAgregarBtn.addEventListener('click', async () => {
    const nro = String(cajeroFormNro.value).padStart(3, '0');
    const nombre = cajeroFormNombre.value.trim();
    const dni = cajeroFormDNI.value.trim();
    const pass = cajeroFormPass.value.trim();

    if (!/^\d{1,3}$/.test(cajeroFormNro.value) || nombre.length === 0 || !/^\d{8}$/.test(dni) || !/^\d{4}$/.test(pass)) {
      return alert("Verifique: Nro 1-999, Nombre <=15 letras, DNI 8 dígitos, pass 4 dígitos.");
    }

    await set(ref(db, `cajeros/${nro}`), { nombre, dni, password: pass });
    await refreshCajerosTable();
    alert("Cajero guardado.");
  });
}

async function editarCajeroModal(nro) {
  // Pide contraseña admin o contraseña del cajero para editar
  const snap = await get(child(ref(db), `cajeros/${nro}`));
  if (!snap.exists()) return alert("Cajero no encontrado");
  const data = snap.val();

  const adminPass = await getAdminPass();
  const pass = prompt("Ingrese contraseña (admin o contraseña del cajero) para editar:");
  if (pass !== adminPass && pass !== data.password) return alert("Contraseña incorrecta");

  const nuevoNombre = prompt("Nombre completo (max 15):", data.nombre);
  const nuevoDni = prompt("DNI (8 dígitos):", data.dni);
  const nuevaPass = prompt("Contraseña (4 dígitos):", data.password);

  if (!nuevoNombre || !/^\d{8}$/.test(nuevoDni) || !/^\d{4}$/.test(nuevaPass)) return alert("Datos inválidos");

  await update(ref(db, `cajeros/${nro}`), { nombre: nuevoNombre, dni: nuevoDni, password: nuevaPass });
  await refreshCajerosTable();
  alert("Cajero actualizado.");
}

function imprimirTarjetaCajero(nro, nombre) {
  // Tarjeta 5cm x 13cm en A4
  const contenido = `<div style="width:13cm;height:5cm;border:8px solid #${Math.floor(Math.random()*16777215).toString(16)};background:linear-gradient(90deg,#fff,#eee);padding:10px;font-family:Arial;">
    <h2 style="text-align:center;margin:0">${(getShopName())}</h2>
    <p style="text-align:center;margin:4px 0">Nro: ${nro}</p>
    <p style="text-align:center;margin:4px 0">Nombre: ${nombre}</p>
  </div>`;
  const w = window.open('', 'TARJETA', 'width=600,height=400');
  w.document.write(contenido);
  w.print();
  w.close();
}

/* ============================
   CONFIGURACIÓN: Cambiar adminPass, shopName, Restaurar con masterPass
   ============================ */
const configNombreInput = byId('config-nombre');
const configAdminPassInput = byId('config-admin-pass') || byId('config-pass');
const configGuardarBtn = byId('config-guardar');
const configRestaurarBtn = byId('config-restaurar') || byId('btn-restaurar');
const masterPassInput = byId('master-pass');

if (configGuardarBtn && configNombreInput) {
  configGuardarBtn.addEventListener('click', async () => {
    const nombre = configNombreInput.value.trim();
    const adminPass = configAdminPassInput ? configAdminPassInput.value.trim() : null;
    const updates = {};
    if (nombre) updates['config/shopName'] = nombre;
    if (adminPass && /^\d{1,10}$/.test(adminPass)) updates['config/adminPass'] = adminPass;
    if (Object.keys(updates).length === 0) return alert("No hay cambios válidos para guardar");
    // Guardar en Firebase (usamos update por caminos)
    for (const [k, v] of Object.entries(updates)) {
      await set(ref(db, k), v);
    }
    alert("Configuración guardada.");
  });
}

if (configRestaurarBtn && masterPassInput) {
  configRestaurarBtn.addEventListener('click', async () => {
    const master = masterPassInput.value.trim();
    const masterReal = await getMasterPass();
    if (master !== masterReal) return alert("Contraseña maestra incorrecta");
    if (!confirm("¿Seguro que desea continuar? Esta acción restablece la contraseña de administración a 0123456789")) return;
    await set(ref(db, 'config/adminPass'), '0123456789');
    alert("Ahora la contraseña administrativa es 0123456789");
  });
}

/* ============================
   UTIL: FORMATO MONEDA
   ============================ */
function formatMoney(v) {
  // Mostrar $XXXX,XX con coma decimal
  const n = Number(v) || 0;
  return `$${n.toFixed(2).replace(".", ",")}`;
}

/* ============================
   INICIALIZAR Y ENLAZAR BOTONES (si existen)
   ============================ */
async function initApp3() {
  // refrescar tablas
  await refreshMovimientos();
  await refreshStockTable();
  await refreshCajerosTable();

  // enlazar Tirar Z
  const btnTirarZ = byId('btn-tirar-z') || byId('btn-tirarz') || null;
  if (btnTirarZ) btnTirarZ.addEventListener('click', tirarZ);

  // Exponer funciones para debugging si es necesario
  window._supercode = window._supercode || {};
  window._supercode.refreshMovimientos = refreshMovimientos;
  window._supercode.refreshStockTable = refreshStockTable;
  window._supercode.refreshCajerosTable = refreshCajerosTable;
  window._supercode.tirarZ = tirarZ;

  console.info("app-3 cargado: Movimientos/Stock/Cajeros/Config listos (si los elementos existen en el DOM).");
}

// Ejecutar init al cargar
initApp3().catch(err => console.error("Error inicializando app-3:", err));
