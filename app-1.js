/*****************************************************
 * app-1.js
 * Sección COBRAR: login, carrito, cobro
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
      total += item.precio * item.cantidad;
      const tr = document.createElement("tr");
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

    try {
      const snap = await window.get(window.ref(window.db, `cajeros/${nro}`));
      if (snap.exists()) {
        const cajero = snap.val();
        if (cajero.pass === pass) {
          usuarioActual = cajero;
          loginModal.classList.add("hidden");
          cobroControles.classList.remove("hidden");
          loginMsg.textContent = "";
        } else {
          loginMsg.textContent = "Contraseña incorrecta";
        }
      } else {
        loginMsg.textContent = "Cajero no encontrado";
      }
    } catch (err) {
      loginMsg.textContent = "Error al conectar con Firebase";
      console.error(err);
    }
  });

  // === GENERAR SELECT DE CANTIDADES (01–99) ===
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

    try {
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
    } catch (err) {
      console.error("Error al buscar producto:", err);
    }

    codigoInput.value = "";
  });

  // === COBRAR ===
  btnCobrar.addEventListener("click", async () => {
    if (!usuarioActual || carrito.length === 0) return;

    try {
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
            cantidad: Math.max(0, (prod.cantidad || 0) - item.cantidad)
          });
        }
      }

      carrito = [];
      actualizarTablaCobro();
      alert("Venta registrada ✅");
    } catch (err) {
      console.error("Error al registrar venta:", err);
      alert("Error al registrar venta ❌");
    }
  });

  console.log("✅ app-1.js cargado correctamente");
})();
