/*****************************************************
 * init.js
 * Inicialización de la base en Realtime Database
 *****************************************************/
(() => {
  const ramasIniciales = {
    config: { shopName: "SUPERCODE", passAdmin: "0123456789", masterPass: "9999" },
    cajeros: {},
    stock: {},
    movimientos: {},
    historial: {}
  };

  (async () => {
    const rootSnap = await window.get(window.ref(window.db, "/"));
    if (!rootSnap.exists() || rootSnap.val() === null) {
      await window.set(window.ref(window.db, "/"), ramasIniciales);
      console.log("✅ Base inicializada en Firebase");
    } else {
      console.log("ℹ️ Base ya existente, no se sobrescribió");
    }
  })();
})();

/*****************************************************
 * Control de modales con desenfoque
 *****************************************************/

// Abrir modal (quita .hidden y activa desenfoque)
window.abrirModal = function(idModal) {
  const modal = document.getElementById(idModal);
  if (modal) {
    modal.classList.remove("hidden");
    document.body.classList.add("modal-active"); // activa desenfoque
  }
};

// Cerrar modal (pone .hidden y quita desenfoque)
window.cerrarModal = function(idModal) {
  const modal = document.getElementById(idModal);
  if (modal) {
    modal.classList.add("hidden");
    document.body.classList.remove("modal-active"); // desactiva desenfoque
  }
};
