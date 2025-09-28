/*****************************************************
 * app-2.js
 * Funciones de COBRAR:
 * - Escaneo de productos
 * - Tabla de cobros
 * - Cálculo total
 * - Eliminación con contraseña admin
 * - Cobro e impresión de ticket
 * - Actualización de stock y registro de movimientos
 *****************************************************/

// === REFERENCIAS DOM ===
const inputCodigo = document.getElementById("cobro-codigo");
const cantidadSelect = document.getElementById("cobro-cantidad");
const tablaCobro = document.querySelector("#tabla-cobro tbody");
const totalDiv = document.getElementById("total-div");
const btnCobrar = document.getElementById("btn-cobrar");

const modalPago = document.getElementById("modal-pago");
const modalEliminar = document.getElementById("modal-eliminar");

// === VARIABLES GLOBALES ===
let carrito = []; // [{codigo, nombre, precio, cantidad}]
let total = 0;
const ADMIN_PASS = "0123456789";

// === FUNCIONES AUXILIARES ===

// Formato de precios
function formatoPrecio(num) {
  return `$${num.toFixed(2).replace(".", ",")}`;
}

// Recalcular total
function actualizarTotal() {
  total = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  totalDiv.textContent = `TOTAL: ${formatoPrecio(total)}`;
}

// Renderizar tabla de cobros
function renderTabla() {
  tablaCobro.innerHTML = "";
  carrito.forEach((item, index) => {
    const tr = document.createElement("tr");

    // CANTIDAD
    const tdCant = document.createElement("td");
    tdCant.textContent = item.cantidad;
    tr.appendChild(tdCant);

    // PRODUCTO
    const tdProd = document.createElement("td");
    tdProd.textContent = item.nombre;
    tr.appendChild(tdProd);

    // PRECIO
    const tdPrecio = document.createElement("td");
    tdPrecio.textContent =
      `${formatoPrecio(item.precio)} (${formatoPrecio(item.precio * item.cantidad)})`;
    tr.appendChild(tdPrecio);

    // ACCIÓN
    const tdAccion = document.createElement("td");
    const btnEliminar = document.createElement("button");
    btnEliminar.textContent = "ELIMINAR";
    btnEliminar.classList.add("btn-eliminar");
    btnEliminar.addEventListener("click", () => pedirPassEliminar(index));
    tdAccion.appendChild(btnEliminar);
    tr.appendChild(tdAccion);

    tablaCobro.appendChild(tr);
  });

  actualizarTotal();
}

// === ESCANEO DE PRODUCTOS ===
inputCodigo.addEventListener("keypress", async e => {
  if (e.key === "Enter") {
    const codigo = inputCodigo.value.trim();
    const cantidad = parseInt(cantidadSelect.value, 10);

    if (!codigo) return;

    try {
      const snap = await window.get(
        window.child(window.ref(window.db), `stock/${codigo}`)
      );

      if (snap.exists()) {
        const prod = snap.val();

        // Validar stock
        if (prod.cantidad < cantidad) {
          alert(`Ingrese menos unidades: ${prod.cantidad}`);
          return;
        }

        // Buscar si ya está en carrito
        const existente = carrito.find(item => item.codigo === codigo);
        if (existente) {
          existente.cantidad += cantidad;
        } else {
          carrito.push({
            codigo,
            nombre: prod.nombre || "EDITAR PRODUCTO NUEVO",
            precio: parseFloat(prod.precio || 0),
            cantidad
          });
        }

        renderTabla();
        inputCodigo.value = "";
      } else {
        alert("Producto no encontrado en stock");
      }
    } catch (err) {
      console.error("Error al buscar producto:", err);
    }
  }
});

// === ELIMINACIÓN CON CONTRASEÑA ADMIN ===
function pedirPassEliminar(index) {
  modalEliminar.innerHTML = `
    <h3>Eliminar producto</h3>
    <p>Ingrese contraseña administrativa:</p>
    <input type="password" id="admin-pass" maxlength="10">
    <button id="btn-confirmar">Eliminar</button>
    <button id="btn-cancelar">Cancelar</button>
    <p id="msg-eliminar"></p>
  `;
  modalEliminar.classList.remove("hidden");

  document.getElementById("btn-cancelar").onclick = () => {
    modalEliminar.classList.add("hidden");
  };

  document.getElementById("btn-confirmar").onclick = () => {
    const pass = document.getElementById("admin-pass").value;
    if (pass === ADMIN_PASS) {
      carrito.splice(index, 1);
      renderTabla();
      modalEliminar.classList.add("hidden");
    } else {
      document.getElementById("msg-eliminar").textContent = "Contraseña incorrecta";
    }
  };
}

// === COBRAR ===
btnCobrar.addEventListener("click", () => {
  if (carrito.length === 0) {
    alert("No hay productos en el carrito");
    return;
  }

  modalPago.innerHTML = `
    <h3>¿Cómo se cobrará?</h3>
    <button id="btn-efectivo">EFECTIVO</button>
    <button id="btn-tarjeta">TARJETA</button>
  `;
  modalPago.classList.remove("hidden");

  document.getElementById("btn-efectivo").onclick = () => confirmarCobro("efectivo");
  document.getElementById("btn-tarjeta").onclick = () => confirmarCobro("tarjeta");
});

async function confirmarCobro(tipo) {
  const seguro = confirm(`¿Se cobrará con ${tipo.toUpperCase()}, está seguro?`);
  if (!seguro) return;

  // Generar ID aleatorio
  const id = "ID" + Math.floor(Math.random() * 100000).toString().padStart(5, "0");

  // Crear ticket
  const ticket = {
    id,
    cajero: cajeroActivo?.nro || "00",
    fecha: new Date().toLocaleString(),
    productos: carrito,
    total,
    tipo
  };

  try {
    // Guardar en movimientos
    await window.set(window.ref(window.db, `movimientos/${id}`), ticket);

    // Descontar stock
    for (const item of carrito) {
      const snap = await window.get(
        window.child(window.ref(window.db), `stock/${item.codigo}`)
      );
      if (snap.exists()) {
        const prod = snap.val();
        const nuevaCantidad = prod.cantidad - item.cantidad;
        await window.update(
          window.ref(window.db, `stock/${item.codigo}`),
          { cantidad: nuevaCantidad }
        );
      }
    }

    alert("✅ Cobro realizado correctamente");
    carrito = [];
    renderTabla();
    modalPago.classList.add("hidden");
  } catch (err) {
    console.error("Error al cobrar:", err);
    alert("❌ Error al registrar el cobro");
  }
}

console.log("✅ app-2.js cargado correctamente");
