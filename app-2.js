/*****************************************************
 * app-2.js
 * Funciones de:
 * - COBRO (carrito de productos)
 * - Descuento automático en stock
 *****************************************************/

// === REFERENCIAS DOM ===
const inputCodigoCobro = document.getElementById("cobro-codigo");
const cantidadSelectCobro = document.getElementById("cobro-cantidad");
const btnAgregarCobro = document.getElementById("btn-agregar-cobro");
const tablaCobro = document.querySelector("#tabla-cobro tbody");
const totalDiv = document.getElementById("total-div");
const btnCobrar = document.getElementById("btn-cobrar");

// === VARIABLES ===
let carrito = [];

// === AGREGAR PRODUCTO AL CARRITO ===
btnAgregarCobro.addEventListener("click", async () => {
  const codigo = inputCodigoCobro.value.trim();
  const cantidad = parseInt(cantidadSelectCobro.value);

  if (!codigo) {
    alert("Ingrese un código de producto");
    return;
  }

  const prodRef = window.ref(window.db, `productos/${codigo}`);
  const snap = await window.get(prodRef);

  if (!snap.exists()) {
    alert("Producto no encontrado");
    return;
  }

  const producto = snap.val();
  if (producto.stock < cantidad) {
    alert("Stock insuficiente");
    return;
  }

  // Revisar si ya está en carrito
  const idx = carrito.findIndex(p => p.codigo === codigo);
  if (idx >= 0) {
    carrito[idx].cantidad += cantidad;
  } else {
    carrito.push({
      codigo,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad
    });
  }

  renderCarrito();
  inputCodigoCobro.value = "";
});

// === RENDERIZAR TABLA DEL CARRITO ===
function renderCarrito() {
  tablaCobro.innerHTML = "";
  let total = 0;

  carrito.forEach((item, index) => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.codigo}</td>
      <td>${item.nombre}</td>
      <td>${item.cantidad}</td>
      <td>${item.precio.toFixed(2)}</td>
      <td>${subtotal.toFixed(2)}</td>
      <td><button class="btn-quitar" data-index="${index}">❌</button></td>
    `;
    tablaCobro.appendChild(tr);
  });

  totalDiv.textContent = `TOTAL: $${total.toFixed(2)}`;

  // Botones quitar
  document.querySelectorAll(".btn-quitar").forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.index);
      carrito.splice(idx, 1);
      renderCarrito();
    };
  });
}

// === COBRAR ===
btnCobrar.addEventListener("click", async () => {
  if (carrito.length === 0) {
    alert("No hay productos en el carrito");
    return;
  }

  try {
    for (const item of carrito) {
      const prodRef = window.ref(window.db, `productos/${item.codigo}`);
      const snap = await window.get(prodRef);

      if (snap.exists()) {
        const producto = snap.val();
        const nuevoStock = producto.stock - item.cantidad;

        if (nuevoStock < 0) {
          alert(`Stock insuficiente para ${item.nombre}`);
          continue;
        }

        await window.update(prodRef, { stock: nuevoStock });
      }
    }

    alert("✅ Venta realizada con éxito");
    carrito = [];
    renderCarrito();
  } catch (err) {
    console.error("Error en el cobro:", err);
    alert("Error al realizar el cobro");
  }
});

console.log("✅ app-2.js cargado correctamente");
