/*****************************************************
 * init.js
 * Inicialización de la base en Realtime Database
 *****************************************************/
import { getDatabase, ref, get, set } from "firebase/database";
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyAzbtibp4-myG8SNY6Irrb7-nuoyP1535g",
  authDomain: "supercode-ctes.firebaseapp.com",
  databaseURL: "https://supercode-ctes-default-rtdb.firebaseio.com",
  projectId: "supercode-ctes",
  storageBucket: "supercode-ctes.firebasestorage.app",
  messagingSenderId: "1034642261455",
  appId: "1:1034642261455:web:f60232b259997fd0e5feba"
};

// Inicializar app y base
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const ramasIniciales = {
  config: { shopName: "SUPERCODE", passAdmin: "0123456789", masterPass: "9999" },
  cajeros: {},
  stock: {},
  movimientos: {},
  historial: {} // 👈 ahora incluida siempre
};

(async () => {
  const rootRef = ref(db, "/");
  const snapshot = await get(rootRef);
  if (!snapshot.exists() || snapshot.val() === null) {
    await set(rootRef, ramasIniciales);
    console.log("✅ Base inicializada en Firebase con historial");
  } else {
    console.log("ℹ️ Base ya existente, no se sobrescribió");
    if (!snapshot.val().historial) {
      await set(ref(db, "/historial"), {});
      console.log("📌 Rama 'historial' creada en base existente");
    }
  }
})();
