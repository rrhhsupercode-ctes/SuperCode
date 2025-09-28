/*****************************************************
 * app-1.js
 * Funciones de COBRAR (cajeros, cobro, tabla de cobro)
 *****************************************************/
(() => {
  // === REFERENCIAS DOM ===
  const loginModal = document.getElementById("login-modal");
  const loginUsuario = document.getElementById("login-usuario");
  const loginPass = document.getElementById("login-pass");
  const btnLogin = document.getElementById("btn-login");
  const loginMsg = document.getElementById("login-msg");

  const cobroControles = document.getElementById("cobro-controles");
  const cantidadSelect = document.getElementById("cobro-cantidad");
  const codigoInput = document.getElementById("cobro-codigo");
  const tablaCobro = document.querySelector("#tabla-cobro tbody");
  const totalDiv = document.getElementById("total-div");
  const btnCobrar = document.getElementById("btn-cobrar");

  // === VARIABLES ===
  let usuarioActual = null;
  let carrito = [];
  let total = 0;

  // === FUNCIONES AUXILIARES ===
  function formatoPrecio(num) {
    return `$${parseFloat(num).toFixed(2).replace(".", ",")}`;
  }

  function actualizarTablaCobro() {
    tablaCobro.innerHTML = "";
    total = 0;

    carrito.forEach((item, idx) => {
      const tr = document.createElement("tr");
      total += item.precio * item.cantidad;

      tr.innerHTML = `
        <td>${item.cantidad}</td>
        <td>${item.nombre}</td>
        <td>${formatoPrecio(item.precio * item.cantidad)}</td>
        <td><button data-idx="${idx}" class="btn-eliminar-item">X</button></td>
      `;
      tablaCobro.appendChild(tr);
    });

    totalDiv.textContent = `TOTAL: ${formatoPrecio(total)}`;
    btnCobrar.classList.toggle("hidden", carrito.length === 0);

    document.querySelectorAll(".btn-eliminar-item").forEach(btn => {
      btn.onclick = () => {
        carrito.splice(btn.dataset.idx, 1);
        actualizarTablaCobro();
      };
    });
  }

  // === LOGIN DE CAJERO ===
  btnLogin.addEventListener("click", async () => {
    const nro = loginUsuario.value.trim().padStart(2, "0");
    const pass = loginPass.value.trim();

    if (!nro || !pass) {
      loginMsg.textContent = "Complete usuario y contraseña";
      return;
    }

    const snap = await window.get(window.ref(window.db, `cajeros/${nro}`));
    if (snap.exists()) {
      const cajero = snap.val();
      if (cajero.pass === pass) {
        usuarioActual = cajero;
        loginModal.classList.add("hidden");
        cobroControles.classList.remove("hidden");
      } else {
        loginMsg.textContent = "Contraseña incorrecta";
      }
    } else {
      loginMsg.textContent = "Cajero no encontrado";
    }
  });

  // === GENERAR SELECT DE CANTIDADES ===
  for (let i = 1; i <= 99; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i.toString().padStart(2, "0");
    cantidadSelect.appendChild(opt);
  }

  // === ESCANEAR PRODUCTO ===
  codigoInput.addEventListener("change", async () => {
    const codigo = codigoInput.value.trim();
    const cantidad = parseInt(cantidadSelect.value, 10);
    if (!codigo) return;

    const snap = await window.get(window.ref(window.db, `stock/${codigo}`));
    if (snap.exists()) {
      const prod = snap.val();
      carrito.push({
        codigo,
        nombre: prod.nombre,
        precio: prod.precio,
        cantidad
      });
      actualizarTablaCobro();
    } else {
      alert("Producto no encontrado en stock");
    }
    codigoInput.value = "";
  });

  // === COBRAR ===
  btnCobrar.addEventListener("click", async () => {
    if (!usuarioActual || carrito.length === 0) return;

    const movRef = window.push(window.ref(window.db, "movimientos"));
    await window.set(movRef, {
      id: movRef.key,
      cajero: usuarioActual.nro,
      total,
      tipo: "venta",
      fecha: new Date().toISOString(),
      items: carrito
    });

    // Actualizar stock
    for (const item of carrito) {
      const snap = await window.get(window.ref(window.db, `stock/${item.codigo}`));
      if (snap.exists()) {
        const prod = snap.val();
        await window.update(window.ref(window.db, `stock/${item.codigo}`), {
          cantidad: Math.max(0, prod.cantidad - item.cantidad)
        });
      }
    }

    carrito = [];
    actualizarTablaCobro();
    alert("Venta registrada ✅");
  });

  // === AUTO-CREAR ESTRUCTURA BÁSICA EN FIREBASE ===
  async function inicializarEstructura() {
    const ramas = ["cajeros", "stock", "movimientos", "config"];
    for (const rama of ramas) {
      const snap = await window.get(window.ref(window.db, rama));
      if (!snap.exists()) {
        if (rama === "config") {
          await window.set(window.ref(window.db, rama), {
            shopName: "SUPERCODE",
            passAdmin: "0123456789",
            masterPass: "9999"
          });
        } else {
          await window.set(window.ref(window.db, rama), {});
        }
      }
    }
  }

  inicializarEstructura();

  console.log("✅ app-1.js cargado correctamente");
})();
