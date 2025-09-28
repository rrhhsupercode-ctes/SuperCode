/*****************************************************
 * app-3.js
 * Funciones de:
 * - STOCK (gestión de productos)
 * - Sincronización en tiempo real con Firebase
 *****************************************************/

// === REFERENCIAS DOM ===
const inputStockCodigo = document.getElementById("stock-codigo");
const selectStockCantidad = document.getElementById("stock-cantidad");
const btnAgregarStock = document.getElementById("agregar-stock");
const tablaStock = document.querySelector("#tabla-stock tbody");

// === GENERAR SELECT 1–999 ===
(function generarOpcionesStock() {
  for (let i = 1; i <= 999; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i.toString().padStart(2, "0");
    selectStockCantidad.appendChild(opt);
  }
})();

// === AGREGAR PRODUCTO AL STOCK ===
btnAgregarStock.addEventListener("click", async () => {
  const codigo = inputStockCodigo.value.trim();
  const cantidad = parseInt(selectStockCantidad.value);

  if (!codigo) {
    alert("Ingrese un código de barras");
    return;
  }

  try {
    const prodRef = window.ref(window.db, `productos/${codigo}`);
    const snap = await window.get(prodRef);

    if (snap.exists()) {
      const producto = snap.val();
      const nuevoStock = (producto.stock || 0) + cantidad;
      await window.update(prodRef, { stock: nuevoStock });
      alert("✅ Stock actualizado");
    } else {
      const nombre = prompt("Ingrese el nombre del producto:");
      const precio = parseFloat(prompt("Ingrese el precio del producto:"));

      if (!nombre || isNaN(precio)) {
        alert("Datos inválidos");
        return;
      }

      await window.set(prodRef, {
        nombre,
        precio,
        stock: cantidad,
        fecha: new Date().toISOString()
      });
      alert("✅ Producto agregado");
    }

    inputStockCodigo.value = "";
  } catch (err) {
    console.error("Error al agregar stock:", err);
    alert("Error al guardar el producto");
  }
});

// === ESCUCHAR STOCK EN TIEMPO REAL ===
function escucharStock() {
  const productosRef = window.ref(window.db, "productos");
  window.onValue(productosRef, snapshot => {
    tablaStock.innerHTML = "";

    snapshot.forEach(child => {
      const producto = child.val();
      const codigo = child.key;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${codigo}</td>
        <td>${producto.nombre}</td>
        <td>${producto.stock}</td>
        <td>${producto.fecha ? producto.fecha.split("T")[0] : "-"}</td>
        <td>${producto.precio.toFixed(2)}</td>
        <td><button class="btn-eliminar" data-codigo="${codigo}">❌</button></td>
      `;
      tablaStock.appendChild(tr);
    });

    // Botones eliminar
    document.querySelectorAll(".btn-eliminar").forEach(btn => {
      btn.onclick = async () => {
        const codigo = btn.dataset.codigo;
        if (confirm("¿Eliminar este producto?")) {
          await window.remove(window.ref(window.db, `productos/${codigo}`));
        }
      };
    });
  });
}

// === INICIAR ESCUCHA ===
escucharStock();

console.log("✅ app-3.js cargado correctamente");
