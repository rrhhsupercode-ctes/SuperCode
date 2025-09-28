/* =========================================================
   SuperCode - APP-2.js
   Parte 2: Cobros, Movimientos, Stock, Cajeros, Configuración
   ========================================================= */

import {
  getDatabase,
  ref,
  set,
  get,
  update,
  push,
  remove,
  child
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* =========================================================
   VARIABLES Y CONFIGURACIÓN
   ========================================================= */
const db = getDatabase();
let carrito = []; // Productos actuales en la venta
let totalVenta = 0;
const ADMIN_PASS = "0123456789"; // se puede editar desde CONFIGURACIÓN

/* =========================================================
   FUNCIONES DE UTILIDAD
   ========================================================= */
function generarIDTicket() {
  return "ID" + Date.now().toString().slice(-6);
}

function formatearPrecio(num) {
  return `$${num.toFixed(2).replace(".", ",")}`;
}

/* =========================================================
   COBRAR: ESCANEO Y TABLA DE PRODUCTOS
   ========================================================= */
const scanInput = document.getElementById("scan-producto");
const qtySelect = document.getElementById("cantidad-select");
const tablaCobrar = document.querySelector("#tabla-cobrar tbody");
const totalDiv = document.getElementById("total-cobro");
const cobrarBtn = document.getElementById("btn-cobrar");

scanInput.addEventListener("keypress", async (e) => {
  if (e.key === "Enter") {
    const codigo = scanInput.value.trim();
    const cantidad = parseInt(qtySelect.value);

    if (!codigo || isNaN(cantidad) || cantidad <= 0) return;

    const snapshot = await get(child(ref(db), `stock/${codigo}`));
    if (!snapshot.exists()) {
      alert("Producto no encontrado en stock");
      scanInput.value = "";
      return;
    }

    const producto = snapshot.val();

    if (producto.cantidad < cantidad) {
      alert(`Ingrese menos unidades: ${producto.cantidad}`);
      return;
    }

    // Si ya existe en carrito, sumar
    let item = carrito.find(p => p.codigo === codigo);
    if (item) {
      if (item.cantidad + cantidad > producto.cantidad) {
        alert(`Stock insuficiente. Máx: ${producto.cantidad}`);
        return;
      }
      item.cantidad += cantidad;
    } else {
      carrito.push({
        codigo,
        nombre: producto.nombre,
        precio: parseFloat(producto.precio),
        cantidad
      });
    }

    renderCarrito();
    scanInput.value = "";
    qtySelect.value = "1";
  }
});

function renderCarrito() {
  tablaCobrar.innerHTML = "";
  totalVenta = 0;

  carrito.forEach((p, index) => {
    const totalItem = p.precio * p.cantidad;
    totalVenta += totalItem;

    const row = `
      <tr>
        <td>${p.cantidad}</td>
        <td>${p.nombre}</td>
        <td>${formatearPrecio(p.precio)} (${formatearPrecio(totalItem)})</td>
        <td>
          <button class="eliminar-btn" data-index="${index}">ELIMINAR</button>
        </td>
      </tr>
    `;
    tablaCobrar.insertAdjacentHTML("beforeend", row);
  });

  totalDiv.textContent = `TOTAL: ${formatearPrecio(totalVenta)}`;

  // Asignar eventos a botones eliminar
  document.querySelectorAll(".eliminar-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const index = btn.dataset.index;
      const pass = prompt("Ingrese contraseña admin para eliminar");
      if (pass === ADMIN_PASS) {
        carrito.splice(index, 1);
        renderCarrito();
      } else {
        alert("Contraseña incorrecta");
      }
    });
  });
}

/* =========================================================
   COBRAR: PROCESAR PAGO Y GENERAR TICKET
   ========================================================= */
cobrarBtn.addEventListener("click", () => {
  if (carrito.length === 0) return;

  const modal = document.getElementById("modal-cobro");
  modal.classList.remove("hidden");

  document.getElementById("btn-efectivo").onclick = () => finalizarCobro("efectivo");
  document.getElementById("btn-tarjeta").onclick = () => finalizarCobro("tarjeta");
});

async function finalizarCobro(metodo) {
  const ticketId = generarIDTicket();
  const fecha = new Date().toLocaleString();

  // Guardar ticket en Firebase
  await set(ref(db, `movimientos/${ticketId}`), {
    id: ticketId,
    cajero: currentCashier.nro,
    nombreCajero: currentCashier.nombre,
    productos: carrito,
    total: totalVenta,
    metodo,
    fecha
  });

  // Actualizar stock
  for (let p of carrito) {
    const productoRef = child(ref(db), `stock/${p.codigo}`);
    const snapshot = await get(productoRef);
    if (snapshot.exists()) {
      const prod = snapshot.val();
      await update(productoRef, { cantidad: prod.cantidad - p.cantidad });
    }
  }

  alert(`Se cobrará con ${metodo.toUpperCase()}, está seguro?`);

  imprimirTicket(ticketId, carrito, totalVenta, metodo, fecha);

  carrito = [];
  renderCarrito();

  document.getElementById("modal-cobro").classList.add("hidden");
}

function imprimirTicket(id, productos, total, metodo, fecha) {
  let contenido = `
    <div style="width:5cm; font-family: monospace;">
      <h3 style="text-align:center;">SUPERCODE</h3>
      <p>ID: ${id}<br>
      Cajero: ${currentCashier.nro} - ${currentCashier.nombre}<br>
      Fecha: ${fecha}</p>
      <hr>
  `;

  productos.forEach(p => {
    contenido += `<p>${p.nombre} x${p.cantidad} - ${formatearPrecio(p.precio * p.cantidad)}</p>`;
  });

  contenido += `
      <hr>
      <p><strong>TOTAL: ${formatearPrecio(total)}</strong></p>
      <p>Método: ${metodo.toUpperCase()} (${id})</p>
      <p style="text-align:center;">Gracias por su compra<br>www.supercode.com.ar</p>
    </div>
  `;

  const ventana = window.open("", "PRINT", "width=600,height=800");
  ventana.document.write(contenido);
  ventana.print();
  ventana.close();
}
