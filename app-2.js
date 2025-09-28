/*****************************************************
 * app-2.js
 * Funciones generales de:
 * - Navegación entre secciones
 * - Combos dinámicos de STOCK
 *****************************************************/
(() => {
  // === NAVEGACIÓN ENTRE SECCIONES ===
  const navBtns = document.querySelectorAll(".nav-btn");
  const sections = document.querySelectorAll("main section");

  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-section");

      // Ocultar todas las secciones
      sections.forEach(sec => sec.classList.add("hidden"));

      // Mostrar la seleccionada
      document.getElementById(target).classList.remove("hidden");
    });
  });

  // === COMBO DE CANTIDADES PARA STOCK ===
  const stockCantidadSelect = document.getElementById("stock-cantidad");
  for (let i = 1; i <= 999; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i.toString().padStart(3, "0");
    stockCantidadSelect.appendChild(opt);
  }

  console.log("✅ app-2.js cargado correctamente");
})();
