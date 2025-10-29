// ============================
// 🔥 CONFIGURACIÓN FIREBASE
// ============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getDatabase, ref, set, onValue, push, remove } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB2Jp8_HZ1qzAD41NvETR5iBDn5eZma4qI",
  authDomain: "mapa-realtime-jean.firebaseapp.com",
  databaseURL: "https://mapa-realtime-jean-default-rtdb.firebaseio.com/",
  projectId: "mapa-realtime-jean",
  storageBucket: "mapa-realtime-jean.firebasestorage.app",
  messagingSenderId: "439925756332",
  appId: "1:439925756332:web:5d32ec30e51de0f9ed2a09"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ============================
// 🌌 PARTÍCULAS
// ============================
tsParticles.load("particles-js", {
  background: { color: "transparent" },
  particles: {
    color: { value: ["#00eaff", "#ffffff"] },
    links: { enable: true, color: "#00eaff", distance: 120, opacity: 0.5 },
    move: { enable: true, speed: 1 },
    number: { value: 80 },
    opacity: { value: 0.4 },
    shape: { type: "circle" },
    size: { value: 2 }
  }
});

// ============================
// 🗺️ MAPA Y DIBUJO (igual que antes)
// ============================
const map = L.map("map").setView([-16.3989, -71.535], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// Mover controles de zoom
map.zoomControl.setPosition("topright");

// --- Estado usuario ---
let username = localStorage.getItem("username") || ('user_' + Math.random().toString(36).substr(2,8));
let prevName = username;
document.getElementById('username').value = localStorage.getItem('username') || '';
let userMarker = null;
let userLocation = null;

let addMessageMode = false;
let drawMode = false;
let drawControl = null;

// Contenedores para marcadores y trazos (igual que antes)
const otherUserMarkers = {};
const messageMarkers = {}; // si decides en el futuro mapear por id
let drawnLayerGroup = new L.FeatureGroup();
map.addLayer(drawnLayerGroup);

// ============================
// --- PANEL DE COORDENADAS (nuevo)
// ============================
const coordsListEl = document.getElementById('coords-list');
// mapa local de usuarios y coords (se mantiene en memoria)
const usersCoords = {}; // key: username -> [lat, lon]

function renderCoordsPanel() {
  coordsListEl.innerHTML = '';
  // ordenar por nombre para consistencia
  const keys = Object.keys(usersCoords).sort((a,b)=> a.localeCompare(b));
  for (const k of keys) {
    const c = usersCoords[k];
    const li = document.createElement('li');
    // mostrar con 5 decimales
    li.textContent = `${k}: [${(c[0]).toFixed(5)}, ${(c[1]).toFixed(5)}]`;
    coordsListEl.appendChild(li);
  }
}

// ============================
// 🧭 GEOLOCALIZACIÓN (respetando tu lógica, actualizado para mantener usersCoords)
// ============================
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      userLocation = [lat, lon];

      const iconUser = L.divIcon({
        className: 'custom-icon',
        html: `<div class="user-ping"></div>`,
        iconSize: [24,24]
      });

      if (!userMarker) {
        userMarker = L.marker(userLocation, { icon: iconUser })
          .addTo(map)
          .bindPopup(`<b>${username}</b><br>📍 Tú estás aquí`)
          .openPopup();
        map.setView(userLocation, 15);
      } else {
        userMarker.setLatLng(userLocation);
        if (userMarker.getPopup) userMarker.getPopup().setContent(`<b>${username}</b><br>📍 Tú estás aquí`);
      }

      // PUBLICAR EN FIREBASE con la clave por nombre (manteniendo tu esquema)
      // si prevName cambió se intenta eliminar
      try {
        if (prevName && prevName !== username) {
          remove(ref(db, `usuarios/${prevName}`)).catch(()=>{});
        }
      } catch(e){}
      set(ref(db, `usuarios/${username}`), { lat, lon });

      // actualizar panel local y re-render
      usersCoords[username] = userLocation;
      renderCoordsPanel();
    },
    (err) => console.error('Error GPS:', err),
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
  );
}

// ============================
// 👥 OTROS USUARIOS (igual que antes, con update al panel coords)
// ============================
onValue(ref(db, 'usuarios'), (snap) => {
  const data = snap.val() || {};
  // limpiar marcadores de usuarios que ya no existen
  const present = new Set(Object.keys(data));

  for (const u in otherUserMarkers) {
    if (!present.has(u)) {
      try { map.removeLayer(otherUserMarkers[u]); } catch(e){}
      delete otherUserMarkers[u];
      delete usersCoords[u];
    }
  }

  for (const name in data) {
    const { lat, lon } = data[name];
    // mantener usersCoords (incluye self updated por geolocation)
    usersCoords[name] = [lat, lon];

    if (name === username) {
      // si el registro es para mi mismo (por ejemplo por otra sesión), actualizar popup/marker
      if (userMarker) {
        // no sobreescribimos mi marker position con la DB si ya uso GPS local,
        // pero si no tengo userMarker, crear uno
        if (!userMarker) {
          const iconUser = L.divIcon({ className:'custom-icon', html: `<div class="user-ping"></div>`, iconSize:[24,24]});
          userMarker = L.marker([lat, lon], { icon: iconUser }).addTo(map).bindPopup(`<b>${username}</b><br>📍 Tú estás aquí`);
        }
      }
      continue;
    }

    const icon = L.divIcon({ className: 'icon-other', html: `<div class="pulse"></div>`, iconSize:[20,20] });

    if (!otherUserMarkers[name]) {
      otherUserMarkers[name] = L.marker([lat, lon], { icon }).addTo(map).bindPopup(`<b>${name}</b><br>🧭 Ubicación activa.`);
    } else {
      otherUserMarkers[name].setLatLng([lat, lon]);
    }
  }

  // renderizamos la lista actualizada de coords
  renderCoordsPanel();
});

// ============================
// 💬 MENSAJES (igual que antes)
// ============================
const btnMsg = document.getElementById('toggleMsgMode');
btnMsg.addEventListener('click', () => {
  addMessageMode = !addMessageMode;
  btnMsg.classList.toggle('active', addMessageMode);
  btnMsg.textContent = addMessageMode ? '💬 Mensajes: ON' : '💬 Activar Mensajes';
});

map.on('click', (e) => {
  if (!addMessageMode) return;
  const texto = prompt('💬 Escribe tu mensaje:');
  if (!texto) return;
  push(ref(db, 'mensajes'), { usuario: username, texto: texto.substring(0,200), lat: e.latlng.lat, lon: e.latlng.lng, ts: Date.now() });
});

onValue(ref(db, 'mensajes'), (snap) => {
  const data = snap.val() || {};
  // para simplicidad y seguridad, no intentamos deduplicar todos los markers aquí;
  // mantenemos comportamiento original de añadir marcadores (si quieres evitar duplicados
  // podemos guardar messageMarkers por id y limpiar antes).
  for (const id in data) {
    const m = data[id];
    const iconMsg = L.divIcon({ className: 'msg-icon', html: `<div class="msg-dot"></div>`, iconSize:[20,20] });
    L.marker([m.lat, m.lon], { icon: iconMsg }).addTo(map).bindPopup(`<b>${m.usuario}</b> 💬<br>${m.texto}`);
  }
});

// ============================
// ✏️ DIBUJO Y TRAZOS (igual que antes)
// ============================
map.addLayer(drawnLayerGroup);
function enableDrawControl() {
  if (drawControl) return;
  drawControl = new L.Control.Draw({
    position: 'topright',
    draw: { polyline:true, polygon:true, rectangle:true, circle:false, marker:false },
    edit: { featureGroup: drawnLayerGroup }
  });
  map.addControl(drawControl);
}
function disableDrawControl() {
  if (!drawControl) return;
  try { map.removeControl(drawControl); } catch(e){}
  drawControl = null;
}
// por compatibilidad activamos control por defecto (como antes)
if (!drawControl) { enableDrawControl(); }

map.on(L.Draw.Event.CREATED, (e) => {
  const layer = e.layer;
  drawnLayerGroup.addLayer(layer);
  const gj = layer.toGeoJSON();
  push(ref(db, 'trazos'), { usuario: username, geojson: gj, ts: Date.now() });
});

onValue(ref(db, 'trazos'), (snap) => {
  const data = snap.val() || {};
  drawnLayerGroup.clearLayers();
  for (const id in data) {
    const item = data[id];
    try {
      L.geoJSON(item.geojson, { style: { color: '#00ff9d', weight: 3, opacity: 0.85 } }).addTo(drawnLayerGroup);
    } catch(e){ console.warn('bad geojson', e); }
  }
});

// ============================
// 🎛️ BOTONES (respetando tu lógica y agregando update al renombrar)
// ============================
document.getElementById('setName').addEventListener('click', () => {
  const val = document.getElementById('username').value.trim();
  if (!val) { alert('Ingresa un nombre válido'); return; }
  const old = username;
  prevName = old;
  username = val;
  localStorage.setItem('username', username);
  alert('Nombre guardado: ' + username);
  // actualizar popup del marker si existe
  if (userMarker && userMarker.getPopup) userMarker.getPopup().setContent(`<b>${username}</b><br>📍 Tú estás aquí`);
  // actualizar DB: eliminar clave anterior y escribir la nueva con la última ubicación
  if (userLocation) {
    try { remove(ref(db, `usuarios/${old}`)); } catch(e){}
    set(ref(db, `usuarios/${username}`), { lat: userLocation[0], lon: userLocation[1] });
  }
  // actualizar panel local
  if (userLocation) usersCoords[username] = userLocation;
  delete usersCoords[old];
  renderCoordsPanel();
});

document.getElementById('clearMessages').addEventListener('click', async () => {
  if (confirm('¿Borrar todos los mensajes y trazos?')) {
    await remove(ref(db, 'mensajes'));
    await remove(ref(db, 'trazos'));
    location.reload();
  }
});

document.getElementById('centerMe').addEventListener('click', () => { if (userLocation) map.setView(userLocation, 15, { animate:true }); });

document.getElementById('viewAll').addEventListener('click', () => {
  const groupLayers = [];
  for (const k in otherUserMarkers) groupLayers.push(otherUserMarkers[k]);
  if (userMarker) groupLayers.push(userMarker);
  try {
    const group = new L.featureGroup(groupLayers);
    if (group.getLayers().length) map.fitBounds(group.getBounds(), { padding: [40,40] });
  } catch(e){}
});

document.getElementById('toggleTheme').addEventListener('click', () => {
  document.body.classList.toggle('light');
});

// ============================
// 🌈 Estilos dinámicos para DivIcons (igual que antes)
// ============================
const style = document.createElement('style');
style.innerHTML = `
.user-ping{ width:18px;height:18px;border-radius:50%;background:#00eaff;box-shadow:0 0 18px #00eaff; animation: pulse 1.6s infinite; }
.icon-other .pulse{ width:14px;height:14px;border-radius:50%;background:#ff007f;box-shadow:0 0 12px #ff007f; animation: pulse 2s infinite; }
.msg-icon .msg-dot{ width:12px;height:12px;border-radius:50%;background:#fff000;box-shadow:0 0 10px #fff000; animation: blink 1.2s infinite; }
@keyframes pulse{0%{transform:scale(.85);opacity:.7}50%{transform:scale(1.18);opacity:1}100%{transform:scale(.85);opacity:.7}} 
@keyframes blink{0%,100%{opacity:.6}50%{opacity:1}}`;
document.head.appendChild(style);
