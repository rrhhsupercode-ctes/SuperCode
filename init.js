/*****************************************************
 * init.js
 * Inicialización de la base en Realtime Database
 *****************************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Tu configuración
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

// Helpers globales (para que app.js los use igual que antes)
window.db = db;
window.ref = (path) => ref(db, path);
window.get = (r) => get(r);
window.set = (r, v) => set(r, v);
window.update = (r, v) => update(r, v);
window.push = (r) => push(r);
window.remove = (r) => remove(r);
window.onValue = (r, cb) => onValue(r, cb);

// Inicialización de ramas base
(() => {
  const ramasIniciales = {
    config: { shopName: "SUPERCODE", passAdmin: "0123456789", masterPass: "9999" },
    cajeros: {},
    stock: {},
    movimientos: {},
    historial: {} // ⚡ ya dejamos lista la rama HISTORIAL
  };

  (async () => {
    const rootSnap = await get(ref(db, "/"));
    if (!rootSnap.exists() || rootSnap.val() === null) {
      await set(ref(db, "/"), ramasIniciales);
      console.log("✅ Base inicializada en Firebase con HISTORIAL incluido");
    } else {
      console.log("ℹ️ Base ya existente, no se sobrescribió");
    }
  })();
})();
