
const ROUTES = ['Bachillerato', 'Primaria', 'Transición', 'Especial'];
const STORAGE_KEY = 'ruta_escolar_montenegro_v2';
const DEFAULT_CONFIG = {
  serviceName: 'ruta escolar',
  schoolName: 'Institución Educativa',
  sendMode: 'demo',
  backendUrl: '',
  publicKey: '',
  autoSend: true,
  autoSave: true,
  radioGeneral: 250,
  tonoGeneral: 'cercano'
};

const state = {
  students: [],
  barrios: [],
  logs: [],
  route: ROUTES[0],
  currentIndex: 0,
  config: structuredClone(DEFAULT_CONFIG),
  position: null,
  watchId: null,
  map: null,
  markers: { bus: null, target: null },
  routeStarted: false
};

const $ = (id) => document.getElementById(id);

async function init() {
  bindTabs();
  bindStaticEvents();
  await loadData();
  initMap();
  renderAll();
  buildPreview();
  logEvent('Sistema listo para operar.', 'info');
}

document.addEventListener('DOMContentLoaded', init);

function bindTabs() {
  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
      button.classList.add('active');
      document.querySelector(`#panel-${button.dataset.panel}`).classList.add('active');
    });
  });
}

function bindStaticEvents() {
  $('btnIniciar').addEventListener('click', startRoute);
  $('btnGps').addEventListener('click', toggleGps);
  $('btnSiguiente').addEventListener('click', nextStudent);
  $('btnSubio').addEventListener('click', () => updateStudentStatus('subio'));
  $('btnNoSalio').addEventListener('click', () => updateStudentStatus('noSalio'));
  $('btnLlegada').addEventListener('click', () => updateStudentStatus('llegada'));
  $('btnMejorarActual').addEventListener('click', improveCurrentPreview);
  $('btnEnviarActual').addEventListener('click', sendCurrentPreview);
  $('studentForm').addEventListener('submit', saveStudent);
  $('btnLimpiarForm').addEventListener('click', resetForm);
  $('searchStudent').addEventListener('input', renderStudentList);
  $('rutaSelect').addEventListener('change', () => { state.route = $('rutaSelect').value; state.currentIndex = 0; renderAll(); buildPreview(); });
  $('radioGeneral').addEventListener('input', () => { state.config.radioGeneral = Number($('radioGeneral').value || 250); saveState(); buildPreview(); });
  $('tonoGeneral').addEventListener('change', () => { state.config.tonoGeneral = $('tonoGeneral').value; saveState(); buildPreview(); });
  $('autoSend').addEventListener('change', () => { state.config.autoSend = $('autoSend').checked; saveState(); refreshBadges(); });
  $('msgStudent').addEventListener('change', buildPreview);
  $('msgType').addEventListener('change', buildPreview);
  $('msgTone').addEventListener('change', buildPreview);
  $('msgExtra').addEventListener('input', buildPreview);
  $('waType').addEventListener('change', buildPreview);
  $('btnBuildMsg').addEventListener('click', buildPreview);
  $('btnCopyMsg').addEventListener('click', copyPreview);
  $('btnSendMsg').addEventListener('click', sendFromMessagesPanel);
  $('btnClearLogs').addEventListener('click', () => { state.logs = []; renderLogs(); saveState(); });
  $('btnSaveConfig').addEventListener('click', saveConfigFromForm);
  $('btnTestBackend').addEventListener('click', testBackend);
}

async function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.students = parsed.students || [];
      state.barrios = parsed.barrios || [];
      state.logs = parsed.logs || [];
      state.route = parsed.route || ROUTES[0];
      state.currentIndex = parsed.currentIndex || 0;
      state.config = { ...DEFAULT_CONFIG, ...(parsed.config || {}) };
    } catch (error) {
      console.warn('No fue posible leer el estado guardado', error);
    }
  }

  if (!state.barrios.length) {
    state.barrios = await fetchJson('data/barrios.json', []);
  }
  if (!state.students.length) {
    state.students = await fetchJson('data/estudiantes.json', []);
  }
}

async function fetchJson(url, fallback) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('No se pudo cargar ' + url);
    return await res.json();
  } catch (error) {
    console.warn(error);
    return fallback;
  }
}

function saveState() {
  if (!state.config.autoSave) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    students: state.students,
    barrios: state.barrios,
    logs: state.logs,
    route: state.route,
    currentIndex: state.currentIndex,
    config: state.config
  }));
}

function renderAll() {
  fillRouteSelects();
  fillBarrioSelect();
  fillStudentSelect();
  renderStudentList();
  renderCurrentStudent();
  renderLogs();
  fillConfigForm();
  refreshBadges();
  $('barriosCount').textContent = state.barrios.length;
  saveState();
}

function fillRouteSelects() {
  const html = ROUTES.map((route) => `<option value="${route}">${route}</option>`).join('');
  ['rutaSelect', 'rutaEstudiante'].forEach((id) => {
    $(id).innerHTML = html;
  });
  $('rutaSelect').value = state.route;
}

function fillBarrioSelect() {
  $('barrio').innerHTML = state.barrios.map((name) => `<option value="${name}">${name}</option>`).join('');
}

function fillStudentSelect() {
  const filtered = getStudentsByRoute(state.route);
  $('msgStudent').innerHTML = filtered.map((student) => `<option value="${student.id}">${student.nombre} · ${student.barrio}</option>`).join('');
  if (!filtered.length) $('msgStudent').innerHTML = '<option value="">Sin estudiantes</option>';
}

function fillConfigForm() {
  $('serviceName').value = state.config.serviceName;
  $('schoolName').value = state.config.schoolName;
  $('sendMode').value = state.config.sendMode;
  $('backendUrl').value = state.config.backendUrl;
  $('publicKey').value = state.config.publicKey;
  $('autoSave').checked = state.config.autoSave;
  $('autoSend').checked = state.config.autoSend;
  $('radioGeneral').value = state.config.radioGeneral;
  $('tonoGeneral').value = state.config.tonoGeneral;
}

function getStudentsByRoute(route) {
  return state.students.filter((student) => (student.ruta || '') === route && student.activo !== false);
}

function getCurrentStudent() {
  const list = getStudentsByRoute(state.route).filter((student) => !['subio', 'llegada'].includes(student.estado));
  if (!list.length) return null;
  if (state.currentIndex >= list.length) state.currentIndex = 0;
  return list[state.currentIndex] || list[0];
}

function renderCurrentStudent() {
  const current = getCurrentStudent();
  if (!current) {
    $('studentName').textContent = 'Sin pendientes';
    $('studentMeta').textContent = 'No hay estudiantes activos en esta ruta.';
    $('guardianText').textContent = '--';
    $('phoneText').textContent = '--';
    $('distanceText').textContent = '--';
    $('studentState').textContent = 'Completa';
    return;
  }

  $('studentName').textContent = current.nombre;
  $('studentMeta').textContent = `${current.barrio} · ${current.direccion || 'Sin referencia'}`;
  $('guardianText').textContent = current.acudiente;
  $('phoneText').textContent = current.telefono;
  $('studentState').textContent = current.estado || 'pendiente';
  $('messageCount').textContent = String(state.logs.filter((x) => x.studentId === current.id && x.kind === 'message').length);

  const distance = state.position && hasCoords(current)
    ? haversine(state.position.lat, state.position.lng, Number(current.lat), Number(current.lng))
    : null;
  $('distanceText').textContent = distance === null ? '--' : `${Math.round(distance)} m`;
  updateMapTarget(current);
}

function renderStudentList() {
  const query = $('searchStudent').value.trim().toLowerCase();
  const items = state.students.filter((student) => {
    const text = `${student.nombre} ${student.acudiente} ${student.barrio} ${student.ruta}`.toLowerCase();
    return text.includes(query);
  });

  $('studentList').innerHTML = items.length ? items.map((student) => `
    <article class="list-item">
      <h4>${escapeHtml(student.nombre)}</h4>
      <p>${escapeHtml(student.ruta)} · ${escapeHtml(student.barrio)}</p>
      <small>${escapeHtml(student.acudiente)} · ${escapeHtml(student.telefono)} · Estado: ${escapeHtml(student.estado || 'pendiente')}</small>
      <div class="list-actions">
        <button data-edit="${student.id}">Editar</button>
        <button data-msg="${student.id}">Mensaje</button>
        <button class="danger" data-del="${student.id}">Borrar</button>
      </div>
    </article>
  `).join('') : '<article class="list-item"><p>No hay estudiantes registrados.</p></article>';

  $('studentList').querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => editStudent(btn.dataset.edit)));
  $('studentList').querySelectorAll('[data-msg]').forEach((btn) => btn.addEventListener('click', () => focusMessageStudent(btn.dataset.msg)));
  $('studentList').querySelectorAll('[data-del]').forEach((btn) => btn.addEventListener('click', () => deleteStudent(btn.dataset.del)));
}

function renderLogs() {
  $('logList').innerHTML = state.logs.length ? state.logs.map((log) => `
    <article class="list-item">
      <h4>${escapeHtml(log.title)}</h4>
      <p>${escapeHtml(log.message)}</p>
      <small>${new Date(log.createdAt).toLocaleString()}${log.status ? ' · ' + escapeHtml(log.status) : ''}</small>
    </article>
  `).join('') : '<article class="list-item"><p>Sin eventos todavía.</p></article>';
}

function logEvent(message, status = 'info', kind = 'event', studentId = null) {
  state.logs.unshift({
    id: crypto.randomUUID(),
    title: status === 'error' ? 'Error' : status === 'success' ? 'Correcto' : 'Evento',
    message,
    status,
    kind,
    studentId,
    createdAt: new Date().toISOString()
  });
  state.logs = state.logs.slice(0, 120);
  $('ultimaAccion').textContent = message;
  renderLogs();
  saveState();
}

function saveStudent(event) {
  event.preventDefault();
  const student = {
    id: $('studentId').value || crypto.randomUUID(),
    nombre: $('nombre').value.trim(),
    acudiente: $('acudiente').value.trim(),
    telefono: $('telefono').value.replace(/\D/g, ''),
    ruta: $('rutaEstudiante').value,
    barrio: $('barrio').value,
    direccion: $('direccion').value.trim(),
    lat: parseFloat($('lat').value || '0'),
    lng: parseFloat($('lng').value || '0'),
    nota: $('nota').value.trim(),
    estado: 'pendiente',
    activo: true,
    radioAviso: Number($('radioAviso').value || 250),
    tono: $('tonoEstudiante').value
  };

  if (!student.nombre || !student.acudiente || !student.telefono) {
    logEvent('Faltan datos obligatorios del estudiante.', 'error');
    return;
  }

  const idx = state.students.findIndex((x) => x.id === student.id);
  if (idx >= 0) state.students[idx] = { ...state.students[idx], ...student };
  else state.students.unshift(student);

  resetForm();
  renderAll();
  buildPreview();
  logEvent(`Se guardó el estudiante ${student.nombre}.`, 'success', 'event', student.id);
}

function resetForm() {
  $('studentForm').reset();
  $('studentId').value = '';
  $('radioAviso').value = 250;
  $('tonoEstudiante').value = 'cercano';
}

function editStudent(id) {
  const student = state.students.find((x) => x.id === id);
  if (!student) return;
  $('studentId').value = student.id;
  $('nombre').value = student.nombre || '';
  $('acudiente').value = student.acudiente || '';
  $('telefono').value = student.telefono || '';
  $('rutaEstudiante').value = student.ruta || ROUTES[0];
  $('barrio').value = student.barrio || state.barrios[0] || '';
  $('direccion').value = student.direccion || '';
  $('lat').value = student.lat ?? '';
  $('lng').value = student.lng ?? '';
  $('nota').value = student.nota || '';
  $('radioAviso').value = student.radioAviso || 250;
  $('tonoEstudiante').value = student.tono || 'cercano';
  document.querySelector('[data-panel="estudiantes"]').click();
}

function deleteStudent(id) {
  const student = state.students.find((x) => x.id === id);
  if (!student) return;
  state.students = state.students.filter((x) => x.id !== id);
  renderAll();
  buildPreview();
  logEvent(`Se eliminó el estudiante ${student.nombre}.`, 'success', 'event', id);
}

function focusMessageStudent(id) {
  document.querySelector('[data-panel="mensajes"]').click();
  $('msgStudent').value = id;
  buildPreview();
}

function startRoute() {
  state.routeStarted = true;
  state.currentIndex = 0;
  $('estadoRuta').textContent = `Ruta ${state.route} en operación`;
  logEvent(`Ruta ${state.route} iniciada.`, 'success');
  renderCurrentStudent();
  buildPreview();
}

function nextStudent() {
  const list = getStudentsByRoute(state.route).filter((student) => !['subio', 'llegada'].includes(student.estado));
  if (!list.length) {
    logEvent('No hay más estudiantes pendientes en esta ruta.', 'info');
    renderCurrentStudent();
    return;
  }
  state.currentIndex = (state.currentIndex + 1) % list.length;
  renderCurrentStudent();
  buildPreview();
  logEvent(`Siguiente estudiante: ${getCurrentStudent()?.nombre || 'sin dato'}.`, 'info');
}

function updateStudentStatus(kind) {
  const current = getCurrentStudent();
  if (!current) return;
  const map = { subio: 'subio', noSalio: 'noSalio', llegada: 'llegada' };
  current.estado = map[kind] || 'pendiente';
  renderAll();
  const msg = RutaIA.buildMessage({
    estudiante: current,
    tipo: kind,
    tono: current.tono || state.config.tonoGeneral,
    extra: current.nota,
    config: state.config
  });
  $('autoPreview').value = msg;
  logEvent(`Estado actualizado para ${current.nombre}: ${current.estado}.`, 'success', 'event', current.id);
}

function improveCurrentPreview() {
  const current = getCurrentStudent();
  if (!current) return;
  const mejorado = RutaIA.assistantReply('mejora el mensaje actual', { current, tone: state.config.tonoGeneral, config: state.config });
  $('autoPreview').value = mejorado.includes('\n') ? mejorado : mejorado;
}

function buildPreview() {
  const student = selectedMessageStudent() || getCurrentStudent();
  if (!student) {
    $('msgPreview').value = 'No hay estudiante seleccionado.';
    $('autoPreview').value = 'No hay estudiante activo.';
    return;
  }

  const tipo = $('msgType').value;
  const tono = $('msgTone').value || state.config.tonoGeneral;
  const extra = $('msgExtra').value;
  const distance = state.position && hasCoords(student)
    ? haversine(state.position.lat, state.position.lng, Number(student.lat), Number(student.lng))
    : null;
  const minutos = distance === null ? 4 : Math.max(1, Math.round(distance / 80));
  const text = RutaIA.buildMessage({ estudiante: student, tipo, tono, extra, config: state.config, minutos });
  $('msgPreview').value = text;
  if (student.id === getCurrentStudent()?.id) $('autoPreview').value = text;
}

function selectedMessageStudent() {
  const id = $('msgStudent').value;
  return state.students.find((student) => student.id === id) || null;
}

async function sendCurrentPreview() {
  const student = getCurrentStudent();
  if (!student) return;
  const payload = buildPayload(student, $('autoPreview').value, $('waType').value || 'text');
  await sendPayload(student, payload, 'manual');
}

async function sendFromMessagesPanel() {
  const student = selectedMessageStudent();
  if (!student) return;
  const payload = buildPayload(student, $('msgPreview').value, $('waType').value);
  await sendPayload(student, payload, 'manual');
}

function buildPayload(student, text, type) {
  if (type === 'interactive') {
    return RutaIA.buildInteractive({
      message: text,
      buttons: [$('btn1Text').value.trim(), $('btn2Text').value.trim(), $('btn3Text').value.trim()]
    });
  }

  if (type === 'template') {
    return RutaIA.buildTemplatePayload({
      templateName: $('templateName').value.trim(),
      languageCode: 'es_CO',
      bodyParams: [student.acudiente, student.nombre, student.barrio]
    });
  }

  return { type: 'text', text: { body: text } };
}

async function sendPayload(student, payload, source = 'manual') {
  const mode = state.config.sendMode;
  const textPreview = payload.type === 'text' ? payload.text.body : $('msgPreview').value || $('autoPreview').value;

  if (mode === 'demo') {
    logEvent(`Demo: ${student.nombre} → ${textPreview}`, 'info', 'message', student.id);
    return;
  }

  if (mode === 'wa') {
    const phone = normalizePhone(student.telefono);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(textPreview)}`;
    window.open(url, '_blank');
    logEvent(`WhatsApp abierto para ${student.nombre}.`, 'success', 'message', student.id);
    return;
  }

  if (mode === 'backend') {
    if (!state.config.backendUrl) {
      logEvent('Configura la URL del backend para enviar automático.', 'error', 'message', student.id);
      return;
    }

    try {
      const response = await fetch(state.config.backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': state.config.publicKey || ''
        },
        body: JSON.stringify({
          to: normalizePhone(student.telefono),
          student,
          payload,
          source
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo enviar');
      logEvent(`Mensaje enviado a ${student.acudiente}.`, 'success', 'message', student.id);
      localStorage.setItem(`sent_${student.id}_${payload.type}`, String(Date.now()));
    } catch (error) {
      logEvent(`Error enviando a ${student.acudiente}: ${error.message}`, 'error', 'message', student.id);
    }
  }
}

function copyPreview() {
  navigator.clipboard.writeText($('msgPreview').value || '').then(() => logEvent('Mensaje copiado.', 'success'));
}

function saveConfigFromForm() {
  state.config.serviceName = $('serviceName').value.trim() || DEFAULT_CONFIG.serviceName;
  state.config.schoolName = $('schoolName').value.trim() || DEFAULT_CONFIG.schoolName;
  state.config.sendMode = $('sendMode').value;
  state.config.backendUrl = $('backendUrl').value.trim();
  state.config.publicKey = $('publicKey').value.trim();
  state.config.autoSave = $('autoSave').checked;
  state.config.autoSend = $('autoSend').checked;
  saveState();
  refreshBadges();
  buildPreview();
  logEvent('Configuración guardada.', 'success');
}

async function testBackend() {
  if (!state.config.backendUrl) {
    logEvent('Primero ingresa la URL del backend.', 'error');
    return;
  }
  try {
    const url = state.config.backendUrl.replace(/\/send$/, '/health');
    const response = await fetch(url);
    const data = await response.json();
    logEvent(`Backend activo: ${data.name || 'OK'}.`, 'success');
  } catch (error) {
    logEvent(`No se pudo probar el backend: ${error.message}`, 'error');
  }
}

function refreshBadges() {
  $('sendBadge').textContent = state.config.sendMode === 'backend' ? 'Backend real' : state.config.sendMode === 'wa' ? 'Abre WhatsApp' : 'Modo demo';
}

function toggleGps() {
  if (state.watchId) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
    $('gpsBadge').textContent = 'GPS apagado';
    logEvent('GPS detenido.', 'info');
    return;
  }

  if (!navigator.geolocation) {
    logEvent('Este celular no soporta geolocalización.', 'error');
    return;
  }

  state.watchId = navigator.geolocation.watchPosition(onGpsSuccess, onGpsError, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 10000
  });
  $('gpsBadge').textContent = 'GPS encendido';
  logEvent('GPS activado.', 'success');
}

function onGpsSuccess(position) {
  state.position = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    ts: position.timestamp
  };
  $('coordsText').textContent = `Lat ${state.position.lat.toFixed(5)} / Lng ${state.position.lng.toFixed(5)}`;
  if (state.markers.bus) {
    state.markers.bus.setLatLng([state.position.lat, state.position.lng]);
    state.map.panTo([state.position.lat, state.position.lng], { animate: true, duration: 0.8 });
  }
  renderCurrentStudent();
  buildPreview();
  autoCheckAndSend();
}

function onGpsError(error) {
  logEvent(`Error GPS: ${error.message}`, 'error');
  $('gpsBadge').textContent = 'GPS con error';
}

function initMap() {
  state.map = L.map('map').setView([4.5662, -75.7510], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(state.map);
  state.markers.bus = L.marker([4.5662, -75.7510]).addTo(state.map).bindPopup('Bus');
}

function updateMapTarget(student) {
  if (!state.map || !student || !hasCoords(student)) return;
  if (!state.markers.target) {
    state.markers.target = L.marker([student.lat, student.lng]).addTo(state.map).bindPopup('Estudiante');
  } else {
    state.markers.target.setLatLng([student.lat, student.lng]);
  }
}

async function autoCheckAndSend() {
  if (!state.routeStarted || !state.config.autoSend) return;
  const current = getCurrentStudent();
  if (!current || !state.position || !hasCoords(current)) return;
  const distance = haversine(state.position.lat, state.position.lng, Number(current.lat), Number(current.lng));
  const radio = Number(current.radioAviso || state.config.radioGeneral || 250);
  if (distance > radio) return;

  const last = Number(localStorage.getItem(`sent_${current.id}_auto`) || 0);
  if (Date.now() - last < 5 * 60 * 1000) return;

  const minutos = Math.max(1, Math.round(distance / 80));
  const text = RutaIA.buildMessage({
    estudiante: current,
    tipo: 'cerca',
    tono: current.tono || state.config.tonoGeneral,
    extra: current.nota,
    config: state.config,
    minutos
  });
  $('autoPreview').value = text;
  const payload = buildPayload(current, text, $('waType').value || 'text');
  await sendPayload(current, payload, 'auto');
  localStorage.setItem(`sent_${current.id}_auto`, String(Date.now()));
}

function hasCoords(student) {
  return Number.isFinite(Number(student.lat)) && Number.isFinite(Number(student.lng)) && Number(student.lat) !== 0 && Number(student.lng) !== 0;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function toRad(value) {
  return value * Math.PI / 180;
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.startsWith('57') ? digits : `57${digits}`;
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
