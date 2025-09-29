/*****************************************************
 * app.js
 * Lógica principal de la app POS
 *****************************************************/

// === NAV ===
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("main section").forEach(s => s.classList.add("hidden"));
    document.getElementById(btn.dataset.section).classList.remove("hidden");
  });
});

// === LOGIN ===
let usuarioActivo = null;

const loginUsuario = document.getElementById("login-usuario");
const loginPass = document.getElementById("login-pass");
const loginMsg = document.getElementById("login-msg");
const btnLogin = document.getElementById("btn-login");
const cobroControles = document.getElementById("cobro-controles");

btnLogin.addEventListener("click", async () => {
  const nro = loginUsuario.value;
  const pass = loginPass.value;

  const snap = await window.get(window.ref(window.db, "cajeros/" + nro));
  if (!snap.exists()) {
    loginMsg.textContent = "Cajero no existe";
    return;
  }
  const cajero = snap.val();
  if (cajero.pass !== pass) {
    loginMsg.textContent = "Contraseña incorrecta";
    return;
  }

  usuarioActivo = { nro, ...cajero };
  loginMsg.textContent = "Bienvenido " + cajero.nombre;
  document.getElementById("login-modal").classList.add("hidden");
  cobroControles.classList.remove("hidden");
});

// Cargar lista de cajeros al login
window.onValue(window.ref(window.db, "cajeros"), snap => {
  loginUsuario.innerHTML = "";
  snap.forEach(child => {
    const opt = document.createElement("option");
    opt.value = child.key;
    opt.textContent = `${child.key} - ${child.val().nombre}`;
    loginUsuario.appendChild(opt);
  });
});

// === COBRO ===
const tablaCobro = document.querySelector("#tabla-cobro tbody");
const inputCodigo = document.getElementById("cobro-codigo");
const selectCantidad = document.getElementById("cobro-cantidad");
const btnCobrar = document.getElementById("btn-cobrar");
const totalDiv = document.getElementById("total-div");

let carrito = [];

// llenar cantidades 1–20
for (let i = 1; i <= 20; i++) {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = i;
  selectCantidad.appendChild(opt);
}

inputCodigo.addEventListener("keypress", async e => {
  if (e.key === "Enter") {
    const codigo = inputCodigo.value.trim();
    const cantidad = parseInt(selectCantidad.value);

    if (!codigo) return;

    const snap = await window.get(window.ref(window.db, "stock/" + codigo));
    if (!snap.exists()) {
      alert("Producto no encontrado en stock");
      return;
    }

    const producto = snap.val();
    carrito.push({ codigo, nombre: producto.nombre, precio: producto.precio, cantidad });
    renderCarrito();
    inputCodigo.value = "";
  }
});

function renderCarrito() {
  tablaCobro.innerHTML = "";
  let total = 0;

  carrito.forEach((item, idx) => {
    const tr = document.createElement("tr");
    const subtotal = item.precio * item.cantidad;
    total += subtotal;

    tr.innerHTML = `
      <td>${item.cantidad}</td>
      <td>${item.nombre}</td>
      <td>${item.precio}</td>
      <td>${subtotal}</td>
      <td><button data-idx="${idx}" class="btn-borrar">X</button></td>
    `;

    tablaCobro.appendChild(tr);
  });

  totalDiv.textContent = "TOTAL: $" + total;
  btnCobrar.classList.toggle("hidden", carrito.length === 0);

  tablaCobro.querySelectorAll(".btn-borrar").forEach(b => {
    b.addEventListener("click", () => {
      carrito.splice(b.dataset.idx, 1);
      renderCarrito();
    });
  });
}

btnCobrar.addEventListener("click", async () => {
  if (!usuarioActivo) {
    alert("Debe iniciar sesión");
    return;
  }
  if (carrito.length === 0) return;

  const total = carrito.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
  const movRef = window.push(window.ref(window.db, "movimientos"));
  const id = movRef.key;

  await window.set(movRef, {
    id,
    cajero: usuarioActivo.nro,
    items: carrito,
    total,
    tipo: "VENTA",
    fecha: Date.now()
  });

  // guardar también en historial
  const histRef = window.push(window.ref(window.db, "historial"));
  await window.set(histRef, {
    id,
    cajero: usuarioActivo.nro,
    total,
    fecha: Date.now()
  });

  alert("Venta registrada");
  carrito = [];
  renderCarrito();
});

// === MOVIMIENTOS ===
const tablaMov = document.querySelector("#tabla-movimientos tbody");
const filtroCajero = document.getElementById("filtroCajero");

window.onValue(window.ref(window.db, "cajeros"), snap => {
  filtroCajero.innerHTML = '<option value="TODOS">TODOS</option>';
  snap.forEach(child => {
    const opt = document.createElement("option");
    opt.value = child.key;
    opt.textContent = child.key;
    filtroCajero.appendChild(opt);
  });
});

window.onValue(window.ref(window.db, "movimientos"), snap => {
  tablaMov.innerHTML = "";
  snap.forEach(child => {
    const mov = child.val();
    if (filtroCajero.value !== "TODOS" && filtroCajero.value !== mov.cajero) return;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${mov.id}</td>
      <td>${mov.total}</td>
      <td>${mov.tipo}</td>
      <td><button data-id="${mov.id}" class="btn-borrar-mov">X</button></td>
    `;
    tablaMov.appendChild(tr);
  });

  tablaMov.querySelectorAll(".btn-borrar-mov").forEach(b => {
    b.addEventListener("click", async () => {
      await window.remove(window.ref(window.db, "movimientos/" + b.dataset.id));
    });
  });
});

// === STOCK ===
const stockCodigo = document.getElementById("stock-codigo");
const stockCantidad = document.getElementById("stock-cantidad");
const btnAgregarStock = document.getElementById("agregar-stock");
const tablaStock = document.querySelector("#tabla-stock tbody");

// llenar cantidades 1–50
for (let i = 1; i <= 50; i++) {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = i;
  stockCantidad.appendChild(opt);
}

btnAgregarStock.addEventListener("click", async () => {
  const codigo = stockCodigo.value.trim();
  const cantidad = parseInt(stockCantidad.value);

  if (!codigo) return;

  const prodRef = window.ref(window.db, "stock/" + codigo);
  const snap = await window.get(prodRef);

  if (snap.exists()) {
    const prod = snap.val();
    await window.update(prodRef, { cantidad: (prod.cantidad || 0) + cantidad });
  } else {
    await window.set(prodRef, {
      nombre: "PRODUCTO NUEVO",
      cantidad,
      fecha: new Date().toLocaleDateString(),
      precio: 0
    });
  }

  stockCodigo.value = "";
});

window.onValue(window.ref(window.db, "stock"), snap => {
  tablaStock.innerHTML = "";
  snap.forEach(child => {
    const prod = child.val();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${child.key}</td>
      <td>${prod.nombre}</td>
      <td>${prod.cantidad}</td>
      <td>${prod.fecha || ""}</td>
      <td>${prod.precio || 0}</td>
      <td><button data-id="${child.key}" class="btn-borrar-stock">X</button></td>
    `;
    tablaStock.appendChild(tr);
  });

  tablaStock.querySelectorAll(".btn-borrar-stock").forEach(b => {
    b.addEventListener("click", async () => {
      await window.remove(window.ref(window.db, "stock/" + b.dataset.id));
    });
  });
});

// === CAJEROS ===
const cajeroNro = document.getElementById("cajero-nro");
const cajeroNombre = document.getElementById("cajero-nombre");
const cajeroDni = document.getElementById("cajero-dni");
const cajeroPass = document.getElementById("cajero-pass");
const btnAgregarCajero = document.getElementById("agregar-cajero");
const tablaCajeros = document.querySelector("#tabla-cajeros tbody");

btnAgregarCajero.addEventListener("click", async () => {
  const nro = cajeroNro.value.trim();
  if (!nro) return;

  await window.set(window.ref(window.db, "cajeros/" + nro), {
    nombre: cajeroNombre.value,
    dni: cajeroDni.value,
    pass: cajeroPass.value
  });

  cajeroNro.value = "";
  cajeroNombre.value = "";
  cajeroDni.value = "";
  cajeroPass.value = "";
});

window.onValue(window.ref(window.db, "cajeros"), snap => {
  tablaCajeros.innerHTML = "";
  cajeroNro.innerHTML = "";
  snap.forEach(child => {
    const caj = child.val();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${child.key}</td>
      <td>${caj.nombre}</td>
      <td>${caj.dni}</td>
      <td><button data-id="${child.key}" class="btn-borrar-cajero">X</button></td>
    `;
    tablaCajeros.appendChild(tr);

    const opt = document.createElement("option");
    opt.value = child.key;
    opt.textContent = child.key;
    cajeroNro.appendChild(opt);
  });

  tablaCajeros.querySelectorAll(".btn-borrar-cajero").forEach(b => {
    b.addEventListener("click", async () => {
      await window.remove(window.ref(window.db, "cajeros/" + b.dataset.id));
    });
  });
});

// === CONFIG ===
const configNombre = document.getElementById("config-nombre");
const passActual = document.getElementById("config-pass-actual");
const passNueva = document.getElementById("config-pass-nueva");
const btnGuardarConfig = document.getElementById("guardar-config");
const configMsg = document.getElementById("config-msg");
const masterPass = document.getElementById("master-pass");
const btnRestaurar = document.getElementById("btn-restaurar");

btnGuardarConfig.addEventListener("click", async () => {
  const snap = await window.get(window.ref(window.db, "config"));
  if (!snap.exists()) return;

  const cfg = snap.val();
  if (cfg.passAdmin !== passActual.value) {
    configMsg.textContent = "Contraseña incorrecta";
    return;
  }

  await window.update(window.ref(window.db, "config"), {
    shopName: configNombre.value,
    passAdmin: passNueva.value
  });
  configMsg.textContent = "Configuración guardada";
});

btnRestaurar.addEventListener("click", async () => {
  const snap = await window.get(window.ref(window.db, "config"));
  if (!snap.exists()) return;

  const cfg = snap.val();
  if (cfg.masterPass !== masterPass.value) {
    alert("Contraseña maestra incorrecta");
    return;
  }

  await window.update(window.ref(window.db, "config"), {
    passAdmin: "0123456789"
  });
  alert("Contraseña restaurada");
});
