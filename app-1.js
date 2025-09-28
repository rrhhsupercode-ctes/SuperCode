/*****************************************************
 * app-1.js
 * Funciones de:
 * - Navegación
 * - Login de cajeros
 * - Carrito de cobro
 * - Registro de movimientos en Firebase
 *****************************************************/

(() => {
  // === REFERENCIAS DOM ===
  const navBtns = document.querySelectorAll(".nav-btn");
  const secciones = document.querySelectorAll(".seccion");

  // Cobro
  const inputLoginNro = document.getElementById("login-nro");
  const inputLoginPass = document.getElementById("login-pass");
  const btnLogin = document.getElementById("btn-login");

  const inputCodigoProd = document.getElementById("codigo-producto");
  const comboCantidad = document.getElementById("combo-cantidad");
  const btnAgregar = document.getElementById("btn-agregar");
  const tablaCobro = document.querySelector("#tabla-cobro tbody");
  const totalEl = document.getElementById("total");
  const btnCobrar = document.getElementById("btn-cobrar");

  // === VARIABLES ===
  let cajeroActual = null;
  let carrito = {};

  // === NAVEGACIÓN ===
  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      secciones.forEach(sec => sec.classList.add("hidden"));
      document.getElementById(target).classList.remove("hidden");
    });
  });

  // === COMBO CANTIDADES ===
  for (let i = 1; i <= 50; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    comboCantidad.appendChild(opt);
  }

  // === LOGIN ===
  btnLogin.addEventListener("click", async () => {
    const nro = inputLoginNro.value.trim();
    const pass = inputLoginPass.value.trim();

    if (!nro || !pass) {
      alert("Complete los campos");
      return;
    }

    const snap = await window.get(window.ref(window.db, `cajeros/${nro}`));
    if (snap.exists()) {
      const caj = snap.val();
      if (caj.pass === pass) {
        cajeroActual = caj;
        alert(`Bienvenido ${caj.nombre}`);
      } else {
        alert("Contraseña incorrecta");
      }
    } else {
      alert("Cajero no encontrado");
    }
  });

  // === CARRITO ===
  function renderCarrito() {
    tablaCobro.innerHTML = "";
    let total = 0;

    Object.entries(carrito).forEach(([codigo, item]) => {
      const subtotal = item.precio * item.cantidad;
      total += subtotal;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${codigo}</td>
        <td>${item.nombre}</td>
        <td>${item.cantidad}</td>
        <td>$${item.precio.toFixed(2)}</td>
        <td>$${subtotal.toFixed(2)}</td>
        <td><button class="btn-quitar" data-codigo="${codigo}">Quitar</button></td>
      `;
      tablaCobro.appendChild(tr);
    });

    totalEl.textContent = `Total: $${total.toFixed(2)}`;

    document.querySelectorAll(".btn-quitar").forEach(btn => {
      btn.onclick = () => {
        delete carrito[btn.dataset.codigo];
        renderCarrito();
      };
    });
  }

  btnAgregar.addEventListener("click", async () => {
    const codigo = inputCodigoProd.value.trim();
    const cant = parseInt(comboCantidad.value, 10);

    if (!codigo) return;

    const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
    if (snap.exists()) {
      const prod = snap.val();
      if (prod.cantidad >= cant) {
        if (!carrito[codigo]) {
          carrito[codigo] = { ...prod, cantidad: 0 };
        }
        carrito[codigo].cantidad += cant;
        renderCarrito();
      } else {
        alert("Stock insuficiente");
      }
    } else {
      alert("Producto no encontrado");
    }

    inputCodigoProd.value = "";
  });

  // === COBRAR ===
  btnCobrar.addEventListener("click", async () => {
    if (!cajeroActual) {
      alert("Debe iniciar sesión");
      return;
    }
    if (Object.keys(carrito).length === 0) {
      alert("El carrito está vacío");
      return;
    }

    // Calcular total
    let total = 0;
    Object.values(carrito).forEach(item => {
      total += item.precio * item.cantidad;
    });

    // Generar ID de movimiento
    const id = "mov-" + Date.now();

    // Guardar en Firebase
    await window.set(window.ref(window.db, `movimientos/${id}`), {
      id,
      cajero: cajeroActual.nro,
      total,
      tipo: "venta",
      fecha: new Date().toLocaleString()
    });

    // Actualizar stock
    for (const [codigo, item] of Object.entries(carrito)) {
      const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
      if (snap.exists()) {
        const prod = snap.val();
        await window.update(window.ref(window.db, `stock/${codigo}`), {
          cantidad: prod.cantidad - item.cantidad
        });
      }
    }

    carrito = {};
    renderCarrito();
    alert("Venta registrada ✅");
  });

  console.log("✅ app-1.js cargado correctamente");
})();
