/*****************************************************
 * app-1.js
 * Funciones de Login y Cobro
 *****************************************************/
(() => {
  // === REFERENCIAS ===
  const loginUsuario = document.getElementById("login-usuario");
  const loginPass = document.getElementById("login-pass");
  const btnLogin = document.getElementById("btn-login");
  const loginMsg = document.getElementById("login-msg");
  const loginModal = document.getElementById("login-modal");
  const cobroControles = document.getElementById("cobro-controles");
  const cobroCantidadSelect = document.getElementById("cobro-cantidad");
  const cobroCodigo = document.getElementById("cobro-codigo");
  const tablaCobro = document.querySelector("#tabla-cobro tbody");
  const totalDiv = document.getElementById("total-div");
  const btnCobrar = document.getElementById("btn-cobrar");

  const modalOverlay = document.getElementById("modal-overlay");

  let cajeroActivo = null;
  let carrito = [];
  let total = 0;

  // === COMBO CANTIDADES ===
  for (let i = 1; i <= 50; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    cobroCantidadSelect.appendChild(opt);
  }

  // === LOGIN ===
  btnLogin.addEventListener("click", async () => {
    const nro = loginUsuario.value.trim();
    const pass = loginPass.value.trim();
    if (!nro || !pass) {
      loginMsg.textContent = "Complete los campos";
      return;
    }
    const snap = await window.get(window.ref(window.db, `cajeros/${nro}`));
    if (!snap.exists()) {
      loginMsg.textContent = "Cajero no existe";
      return;
    }
    const caj = snap.val();
    if (caj.pass !== pass) {
      loginMsg.textContent = "Contraseña incorrecta";
      return;
    }
    cajeroActivo = caj;
    loginModal.classList.add("hidden");
    cobroControles.classList.remove("hidden");
    document.getElementById("app-title").textContent = `SUPERCODE - Cajero ${cajeroActivo.nro}`;
  });

  // === AÑADIR PRODUCTO ===
  cobroCodigo.addEventListener("keydown", async e => {
    if (e.key === "Enter") {
      const codigo = cobroCodigo.value.trim();
      const cant = parseInt(cobroCantidadSelect.value, 10);
      if (!codigo) return;
      const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
      if (!snap.exists()) {
        alert("Producto no encontrado en stock");
        return;
      }
      const prod = snap.val();
      if (prod.cantidad < cant) {
        alert("Stock insuficiente");
        return;
      }
      carrito.push({ codigo, nombre: prod.nombre, precio: prod.precio, cantidad: cant });
      prod.cantidad -= cant;
      await window.update(window.ref(window.db, `stock/${codigo}`), { cantidad: prod.cantidad });

      renderCarrito();
      cobroCodigo.value = "";
    }
  });

  function renderCarrito() {
    tablaCobro.innerHTML = "";
    total = 0;
    carrito.forEach((item, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.cantidad}</td>
        <td>${item.nombre}</td>
        <td>$${item.precio * item.cantidad}</td>
        <td><button data-i="${i}" class="btn-del-item">X</button></td>
      `;
      total += item.precio * item.cantidad;
      tablaCobro.appendChild(tr);
    });
    totalDiv.textContent = `TOTAL: $${total}`;
    btnCobrar.classList.toggle("hidden", carrito.length === 0);

    document.querySelectorAll(".btn-del-item").forEach(btn => {
      btn.onclick = async () => {
        const idx = btn.dataset.i;
        const it = carrito[idx];
        // devolver stock
        const snap = await window.get(window.ref(window.db, `stock/${it.codigo}`));
        if (snap.exists()) {
          const prod = snap.val();
          await window.update(window.ref(window.db, `stock/${it.codigo}`), {
            cantidad: prod.cantidad + it.cantidad
          });
        }
        carrito.splice(idx, 1);
        renderCarrito();
      };
    });
  }

  // === COBRAR ===
  btnCobrar.addEventListener("click", () => {
    if (carrito.length === 0) return;
    abrirModalPago();
  });

  function abrirModalPago() {
    modalOverlay.className = "modal";
    modalOverlay.innerHTML = `
      <h3>Seleccionar forma de pago</h3>
      <button id="btn-efectivo">Efectivo</button>
      <button id="btn-tarjeta">Tarjeta</button>
      <button id="btn-cancelar">Cancelar</button>
    `;
    document.getElementById("btn-efectivo").onclick = () => finalizarCobro("Efectivo");
    document.getElementById("btn-tarjeta").onclick = () => finalizarCobro("Tarjeta");
    document.getElementById("btn-cancelar").onclick = cerrarModal;
  }

  async function finalizarCobro(tipoPago) {
    cerrarModal();
    const id = Date.now();
    await window.set(window.ref(window.db, `movimientos/${id}`), {
      id,
      cajero: cajeroActivo.nombre,
      total,
      tipo: tipoPago,
      items: carrito
    });

    imprimirTicket(id, tipoPago);

    carrito = [];
    renderCarrito();
    alert("Venta registrada con éxito ✅");
  }

  function cerrarModal() {
    modalOverlay.className = "modal hidden";
    modalOverlay.innerHTML = "";
  }

  // === IMPRESIÓN TICKET ===
  function imprimirTicket(id, tipoPago) {
    const area = document.createElement("div");
    area.className = "print-area";
    const fecha = new Date().toLocaleString();
    let html = `
      <h3>SUPERCODE</h3>
      <p>${fecha}</p>
      <p>Cajero: ${cajeroActivo.nombre}</p>
      <hr>
    `;
    carrito.forEach(it => {
      html += `<p>${it.cantidad} x ${it.nombre} - $${it.precio * it.cantidad}</p>`;
    });
    html += `
      <hr>
      <p><b>TOTAL: $${total}</b></p>
      <p>Pago: ${tipoPago}</p>
      <p>Mov ID: ${id}</p>
      <p>Gracias por su compra!</p>
    `;
    area.innerHTML = html;
    document.body.appendChild(area);
    window.print();
    document.body.removeChild(area);
  }

  console.log("✅ app-1.js cargado correctamente");
})();

// === NAVEGACIÓN ENTRE SECCIONES ===
document.querySelectorAll("#header button").forEach(btn => {
  btn.addEventListener("click", () => {
    // Quitar activo de todos
    document.querySelectorAll("#header button").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));

    // Activar el botón y la sección correspondiente
    btn.classList.add("active");
    const targetId = btn.getAttribute("data-target");
    const targetSec = document.getElementById(targetId);
    if (targetSec) {
      targetSec.classList.add("active");
    }
  });
});
