// ============================================
// CONFIGURACIÓN FIREBASE
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyB2Jp8_HZ1qzAD41NvETR5iBDn5eZma4qI",
  authDomain: "mapa-realtime-jean.firebaseapp.com",
  databaseURL: "https://mapa-realtime-jean-default-rtdb.firebaseio.com/",
  projectId: "mapa-realtime-jean",
  storageBucket: "mapa-realtime-jean.firebasestorage.app",
  messagingSenderId: "439925756332",
  appId: "1:439925756332:web:5d32ec30e51de0f9ed2a09"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============================================
// INICIALIZAR MAPA
// ============================================
const map = L.map('map').setView([-16.3989, -71.5350], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
  maxZoom: 19
}).addTo(map);

// ============================================
// GEOLOCALIZAR AL USUARIO
// ============================================
let userId = "user_" + Math.random().toString(36).substring(2, 9);
let marker = null;

function publicarUbicacion(lat, lon) {
  db.ref('usuarios/' + userId).set({
    lat: lat,
    lon: lon,
    timestamp: Date.now()
  });
}

function eliminarUbicacion() {
  db.ref('usuarios/' + userId).remove();
}

window.addEventListener("beforeunload", eliminarUbicacion);

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      if (!marker) {
        marker = L.marker([lat, lon], { title: "Tú" }).addTo(map);
        marker.bindPopup("<b>Tu ubicación</b>").openPopup();
        map.setView([lat, lon], 15);
      } else {
        marker.setLatLng([lat, lon]);
      }

      publicarUbicacion(lat, lon);
    },
    (err) => {
      console.error("Error al obtener ubicación:", err);
      alert("No se pudo obtener tu ubicación. Verifica los permisos.");
    },
    { enableHighAccuracy: true }
  );
} else {
  alert("Tu navegador no soporta geolocalización.");
}

// ============================================
// MOSTRAR TODOS LOS USUARIOS EN EL MAPA
// ============================================
const markers = {};

db.ref('usuarios').on('value', (snapshot) => {
  const data = snapshot.val();

  if (!data) return;

  for (let id in data) {
    const { lat, lon } = data[id];

    if (!markers[id]) {
      markers[id] = L.marker([lat, lon]).addTo(map);
      markers[id].bindPopup(`<b>Usuario:</b> ${id}`);
    } else {
      markers[id].setLatLng([lat, lon]);
    }
  }
});
