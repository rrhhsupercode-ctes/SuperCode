/*****************************************************
 * init.js
 * Inicialización de la base en Realtime Database
 * Asegura ramas iniciales y crea 'historial' si falta
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
    try {
      const rootSnap = await window.get(window.ref(window.db, "/"));
      if (!rootSnap.exists() || rootSnap.val() === null) {
        await window.set(window.ref(window.db, "/"), ramasIniciales);
        console.log("✅ Base inicializada en Firebase (ramas iniciales creadas)");
      } else {
        console.log("ℹ️ Base ya existente, no se sobrescribió");
        const val = rootSnap.val() || {};
        if (!val.historial) {
          await window.set(window.ref(window.db, "/historial"), {});
          console.log("📌 Rama 'historial' creada en base existente");
        }
        if (!val.config) {
          await window.set(window.ref(window.db, "/config"), ramasIniciales.config);
          console.log("📌 Rama 'config' creada en base existente");
        }
      }
    } catch (e) {
      console.error("init.js error:", e);
    }
  })();
})();
