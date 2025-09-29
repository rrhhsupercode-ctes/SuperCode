// === Firebase SDK ===
import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  push,
  remove,
  onValue
} from "firebase/database";

// Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAzbtibp4-myG8SNY6Irrb7-nuoyP1535g",
  authDomain: "supercode-ctes.firebaseapp.com",
  databaseURL: "https://supercode-ctes-default-rtdb.firebaseio.com",
  projectId: "supercode-ctes",
  storageBucket: "supercode-ctes.firebasestorage.app",
  messagingSenderId: "1034642261455",
  appId: "1:1034642261455:web:f60232b259997fd0e5feba"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// === NAVEGACIÓN ENTRE SECCIONES ===
const sections = document.querySelectorAll("main section");
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    sections.forEach(s =>
      s.id === target ? s.classList.remove("hidden") : s.classList.add("hidden")
    );
  });
});

// === VARIABLES ===
let carrito = [];

// === UTILIDAD ===
const formatDate = ts => new Date(ts).toLocaleString();

// === COBRO ===
const carritoBody = document.querySelector("#carrito tbody");
const totalDiv = document.querySelector("#total-div");
const btnCobrar = document.querySelector("#btn-cobrar");

function renderCarrito() {
  carritoBody.innerHTML = "";
  let total = 0;
  carrito.forEach((item, i) => {
    total += item.total;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.codigo}</td>
      <td>${item.nombre}</td>
      <td>${item.cantidad}</td>
      <td>$${item.precio}</td>
      <td>$${item.total}</td>
      <td><button data-i="${i}" class="btn-remove">X</button></td>
    `;
    carritoBody.appendChild(tr);
  });
  totalDiv.textContent = `TOTAL: $${total}`;
}

carritoBody.addEventListener("click", e => {
  if (e.target.classList.contains("btn-remove")) {
    const idx = e.target.dataset.i;
    carrito.splice(idx, 1);
    renderCarrito();
  }
});

btnCobrar.addEventListener("click", async () => {
  const total = carrito.reduce((acc, it) => acc + it.total, 0);
  if (!total) return;

  const id = push(ref(db, "movimientos")).key;
  const venta = {
    id,
    total,
    tipo: "VENTA",
    fecha: Date.now(),
    items: carrito
  };

  // Guardar en movimientos
  await set(ref(db, "movimientos/" + id), venta);

  // Guardar también en historial por día
  const hoy = new Date();
  const fechaKey = `${hoy.getFullYear()}${String(hoy.getMonth()+1).padStart(2,"0")}${String(hoy.getDate()).padStart(2,"0")}`;
  await set(ref(db, `historial/${fechaKey}/${id}`), venta);

  carrito = [];
  renderCarrito();
});

// === STOCK ===
const stockBody = document.querySelector("#tabla-stock tbody");
const formStock = document.querySelector("#form-stock");

formStock.addEventListener("submit", async e => {
  e.preventDefault();
  const codigo = formStock.codigo.value.trim();
  const cantidad = parseInt(formStock.cantidad.value);
  if (!codigo || isNaN(cantidad)) return;

  const productoRef = ref(db, "stock/" + codigo);
  const snap = await get(productoRef);
  if (snap.exists()) {
    const prod = snap.val();
    prod.cantidad += cantidad;
    await update(productoRef, prod);
  } else {
    await set(productoRef, {
      codigo,
      nombre: "PRODUCTO NUEVO",
      cantidad,
      precio: 0
    });
  }
  formStock.reset();
});

onValue(ref(db, "stock"), snap => {
  stockBody.innerHTML = "";
  if (snap.exists()) {
    Object.values(snap.val()).forEach(prod => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${prod.codigo}</td>
        <td>${prod.nombre}</td>
        <td>${prod.cantidad}</td>
        <td>$${prod.precio}</td>
      `;
      stockBody.appendChild(tr);
    });
  }
});

// === MOVIMIENTOS ===
const movBody = document.querySelector("#tabla-movimientos tbody");

onValue(ref(db, "movimientos"), snap => {
  movBody.innerHTML = "";
  if (snap.exists()) {
    Object.values(snap.val()).forEach(mov => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${mov.id}</td>
        <td>${mov.tipo}</td>
        <td>$${mov.total}</td>
        <td>${formatDate(mov.fecha)}</td>
      `;
      movBody.appendChild(tr);
    });
  }
});

// === HISTORIAL ===
const tablaHist = document.querySelector("#tabla-historial tbody");

onValue(ref(db, "historial"), snap => {
  tablaHist.innerHTML = "";
  if (snap.exists()) {
    Object.entries(snap.val()).forEach(([fecha, ventas]) => {
      Object.values(ventas).forEach(venta => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${fecha}</td>
          <td>${venta.id}</td>
          <td>$${venta.total}</td>
        `;
        tablaHist.appendChild(tr);
      });
    });
  }
});

// === CAJEROS ===
const cajerosBody = document.querySelector("#tabla-cajeros tbody");
const formCajero = document.querySelector("#form-cajero");

formCajero.addEventListener("submit", async e => {
  e.preventDefault();
  const nombre = formCajero.nombre.value.trim();
  if (!nombre) return;
  const id = push(ref(db, "cajeros")).key;
  await set(ref(db, "cajeros/" + id), { id, nombre });
  formCajero.reset();
});

onValue(ref(db, "cajeros"), snap => {
  cajerosBody.innerHTML = "";
  if (snap.exists()) {
    Object.values(snap.val()).forEach(caj => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${caj.id}</td><td>${caj.nombre}</td>`;
      cajerosBody.appendChild(tr);
    });
  }
});

// === CONFIG ===
const formConfig = document.querySelector("#form-config");
const configMsg = document.querySelector("#config-msg");

formConfig.addEventListener("submit", async e => {
  e.preventDefault();
  const empresa = formConfig.empresa.value.trim();
  const direccion = formConfig.direccion.value.trim();
  if (!empresa) return;
  await set(ref(db, "config"), { empresa, direccion });
  configMsg.textContent = "Configuración guardada.";
  setTimeout(() => (configMsg.textContent = ""), 2000);
});

onValue(ref(db, "config"), snap => {
  if (snap.exists()) {
    formConfig.empresa.value = snap.val().empresa || "";
    formConfig.direccion.value = snap.val().direccion || "";
  }
});
