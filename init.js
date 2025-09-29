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
    historial: {}   // 👈 nueva rama para historial
  };

  (async () => {
    const rootSnap = await window.get(window.ref(window.db, "/"));
    if (!rootSnap.exists() || rootSnap.val() === null) {
      await window.set(window.ref(window.db, "/"), ramasIniciales);
      console.log("✅ Base inicializada en Firebase con historial");
    } else {
      console.log("ℹ️ Base ya existente, no se sobrescribió");
      // 👇 aseguro que la rama historial exista aunque la base sea vieja
      const val = rootSnap.val();
      if (!val.historial) {
        await window.set(window.ref(window.db, "/historial"), {});
        console.log("📌 Rama 'historial' creada en base existente");
      }
    }
  })();
})();
