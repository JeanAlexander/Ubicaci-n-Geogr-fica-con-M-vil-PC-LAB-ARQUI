import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

// ============================================
// CONFIGURACIÓN FIREBASE (tus credenciales)
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyB2Jp8_HZ1qzAD41NvETR5iBDn5eZma4qI",
  authDomain: "mapa-realtime-jean.firebaseapp.com",
  projectId: "mapa-realtime-jean",
  storageBucket: "mapa-realtime-jean.firebasestorage.app",
  messagingSenderId: "439925756332",
  appId: "1:439925756332:web:5d32ec30e51de0f9ed2a09",
  databaseURL: "https://mapa-realtime-jean-default-rtdb.firebaseio.com/"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ============================================
// MAPA (centrado en Arequipa)
// ============================================
const map = L.map('map').setView([-16.3989, -71.535], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 18,
}).addTo(map);

// ============================================
// Variables de usuario
// ============================================
let userMarker;
let userName = localStorage.getItem("userName") || "Usuario anónimo";
const userId = localStorage.getItem("userId") || "id_" + Math.random().toString(36).substring(2, 9);
localStorage.setItem("userId", userId);

const statusEl = document.getElementById("status");
statusEl.textContent = "🛰️ Localizando...";

const usersRef = ref(db, "usuarios");

// ============================================
// FUNCIÓN: Actualizar ubicación en Firebase
// ============================================
function updateUserPosition(lat, lng) {
  set(ref(db, "usuarios/" + userId), {
    nombre: userName,
    lat: lat,
    lng: lng,
    timestamp: Date.now()
  });
}

// ============================================
// MONITOREO GPS
// ============================================
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    pos => {
      const { latitude, longitude } = pos.coords;

      if (!userMarker) {
        userMarker = L.marker([latitude, longitude], { title: userName })
          .addTo(map)
          .bindPopup(`<b>${userName}</b>`)
          .openPopup();
      } else {
        userMarker.setLatLng([latitude, longitude]);
        userMarker.getPopup().setContent(`<b>${userName}</b>`);
      }

      updateUserPosition(latitude, longitude);
      statusEl.textContent = "✅ Conectado";
    },
    err => {
      console.error(err);
      statusEl.textContent = "⚠️ Error al obtener ubicación";
    },
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
} else {
  statusEl.textContent = "❌ GPS no soportado";
}

// ============================================
// MOSTRAR OTROS USUARIOS EN EL MAPA
// ============================================
const markers = {};

onValue(usersRef, snapshot => {
  const data = snapshot.val() || {};
  for (const id in data) {
    const user = data[id];

    if (id !== userId) { // no mostrar el propio marcador duplicado
      if (!markers[id]) {
        markers[id] = L.marker([user.lat, user.lng]).addTo(map);
      } else {
        markers[id].setLatLng([user.lat, user.lng]);
      }
      markers[id].bindPopup(`<b>${user.nombre}</b>`);
    }
  }
});

// ============================================
// RENOMBRAR USUARIO
// ============================================
document.getElementById("renameUser").addEventListener("click", () => {
  const newName = prompt("Introduce tu nuevo nombre:");
  if (newName && newName.trim() !== "") {
    userName = newName.trim();
    localStorage.setItem("userName", userName);
    if (userMarker) {
      userMarker.getPopup().setContent(`<b>${userName}</b>`);
    }
    statusEl.textContent = `✏️ Nombre actualizado: ${userName}`;
  }
});

// ============================================
// RECENTRAR MAPA
// ============================================
document.getElementById("recenterMap").addEventListener("click", () => {
  if (userMarker) {
    map.setView(userMarker.getLatLng(), 15, { animate: true });
  }
});

// ============================================
// ELIMINAR USUARIO AL SALIR
// ============================================
window.addEventListener("beforeunload", () => {
  remove(ref(db, "usuarios/" + userId));
});
