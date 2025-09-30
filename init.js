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
    historial: {}   // 🔥 Nueva rama para el historial
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
