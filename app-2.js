/*****************************************************
 * app-2.js
 * Funciones generales:
 * - Navegación entre secciones
 * - Combos dinámicos de STOCK y CAJEROS
 *****************************************************/
(() => {
  // === NAVEGACIÓN ENTRE SECCIONES ===
  const navBtns = document.querySelectorAll(".nav-btn");
  const sections = document.querySelectorAll("main section");

  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-section");
      sections.forEach(sec => sec.classList.add("hidden")); // ocultar todas
      document.getElementById(target).classList.remove("hidden"); // mostrar seleccionada
    });
  });

  // === COMBO DE CANTIDADES PARA STOCK (001–999) ===
  const stockCantidadSelect = document.getElementById("stock-cantidad");
  if (stockCantidadSelect) {
    for (let i = 1; i <= 999; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = i.toString().padStart(3, "0");
      stockCantidadSelect.appendChild(opt);
    }
  }

  // === COMBO DE NÚMEROS DE CAJEROS (01–99) ===
  const cajeroNroSelect = document.getElementById("cajero-nro");
  if (cajeroNroSelect) {
    for (let i = 1; i <= 99; i++) {
      const opt = document.createElement("option");
      opt.value = i.toString().padStart(2, "0");
      opt.textContent = i.toString().padStart(2, "0");
      cajeroNroSelect.appendChild(opt);
    }
  }

  console.log("✅ app-2.js cargado correctamente");
})();
