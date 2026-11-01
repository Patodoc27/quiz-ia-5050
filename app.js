/* Cuestionario Final · Colegio 50-50 — lógica de la app (ES2017) */
"use strict";

/* ====== CONFIG ====== */
/* API_URL viene de config.js */
var CURSO_FIJO = "5° 1°";
var AVATARES = ["avatars/a1.webp","avatars/a2.webp","avatars/a3.webp","avatars/a4.webp","avatars/a5.webp","avatars/a6.webp"];
var NOTA_APROBADO = 6;
var LS_KEY = "cf5050";

/* ====== helpers ====== */
function $(id) { return document.getElementById(id); }
function el(tag, cls, txt) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
}
function mostrar(id) {
  var ps = document.querySelectorAll(".pantalla");
  for (var i = 0; i < ps.length; i++) ps[i].classList.remove("visible");
  $(id).classList.add("visible");
  window.scrollTo(0, 0);
}
var toastTimer = null;
function toast(msg, ms) {
  var t = $("toast"); t.textContent = msg; t.classList.remove("oculto");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.add("oculto"); }, ms || 2600);
}
function fmtTiempo(seg) {
  seg = Math.max(0, Math.round(seg));
  var m = Math.floor(seg / 60), s = seg % 60;
  return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}
function hayAPI() { return API_URL.indexOf("http") === 0; }
function api(datos, opts) {
  opts = opts || {};
  if (!hayAPI()) return Promise.reject(new Error("sin-api"));
  var body = JSON.stringify(datos);
  if (opts.beacon && navigator.sendBeacon) {
    var ok = navigator.sendBeacon(API_URL, new Blob([body], { type: "text/plain" }));
    return ok ? Promise.resolve({ ok: true, beacon: true }) : Promise.reject(new Error("beacon-fallo"));
  }
  return fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: body,
    redirect: "follow"
  }).then(function (r) { return r.json(); });
}

/* ====== estado ====== */
var estado = {
  deviceId: null,
  studentId: null,
  apellido: "", nombre: "", avatar: null,
  attemptId: null,
  items: null,
  respuestas: {},
  idx: 0,
  startedAt: 0,
  anulado: false,
  entregado: false
};
var timerInt = null;
var salidaPermitida = false;
var fsSoportado = !!(document.documentElement.requestFullscreen && document.fullscreenEnabled !== false);

function guardarLS() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      deviceId: estado.deviceId, studentId: estado.studentId,
      apellido: estado.apellido, nombre: estado.nombre, avatar: estado.avatar,
      attemptId: estado.attemptId, items: estado.items, respuestas: estado.respuestas,
      idx: estado.idx, startedAt: estado.startedAt,
      anulado: estado.anulado, entregado: estado.entregado
    }));
  } catch (e) {}
}
function leerLS() {
  try {
    var s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    return s;
  } catch (e) { return null; }
}
function limpiarIntentoLS() {
  var s = leerLS() || {};
  delete s.attemptId; delete s.items; delete s.respuestas;
  delete s.idx; delete s.startedAt; delete s.anulado; delete s.entregado;
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
}

/* ====== voz ====== */
var vozOn = true;
function leerVoz(texto) {
  if (!vozOn || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(texto);
    u.lang = "es-MX";
    var voces = speechSynthesis.getVoices();
    var v = null;
    for (var i = 0; i < voces.length; i++) {
      if (/es[-_](MX|US|419|AR|LATAM)/i.test(voces[i].lang)) { v = voces[i]; break; }
    }
    if (!v) for (var j = 0; j < voces.length; j++) { if (/^es/i.test(voces[j].lang)) { v = voces[j]; break; } }
    if (v) u.voice = v;
    u.rate = 1.0;
    speechSynthesis.speak(u);
  } catch (e) {}
}
if ("speechSynthesis" in window) {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = function () { speechSynthesis.getVoices(); };
}

/* ====== anti-salida ====== */
function intentoActivo() {
  return estado.attemptId && estado.items && !estado.anulado && !estado.entregado;
}
function anular(motivo) {
  if (!intentoActivo()) return;
  estado.anulado = true;
  guardarLS();
  desarmarTrampas();
  api({ action: "evento", attemptId: estado.attemptId, tipo: "salida", motivo: motivo }, { beacon: true })
    .catch(function () {});
  $("a-motivo").textContent = motivo;
  if (document.fullscreenElement && document.exitFullscreen) {
    try { document.exitFullscreen(); } catch (e) {}
  }
  mostrar("p-anulado");
}
function onFsChange() {
  if (!intentoActivo() || salidaPermitida) return;
  if (fsSoportado && !document.fullscreenElement) anular("Saliste del modo pantalla completa.");
}
function onVisChange() {
  if (!intentoActivo() || salidaPermitida) return;
  if (document.hidden) anular("Cambiaste de aplicación o de pestaña.");
}
function onBlur() {
  if (!intentoActivo() || salidaPermitida) return;
  anular("La aplicación perdió el foco.");
}
function onPageHide() {
  if (!intentoActivo() || salidaPermitida) return;
  estado.anulado = true; guardarLS();
  api({ action: "evento", attemptId: estado.attemptId, tipo: "salida", motivo: "Cerraste la página." }, { beacon: true })
    .catch(function () {});
}
function onPopState(ev) {
  if (!intentoActivo() || salidaPermitida) return;
  history.pushState({ quiz: 1 }, "");
  anular("Usaste el botón atrás.");
}
function armarTrampas() {
  salidaPermitida = false;
  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("visibilitychange", onVisChange);
  window.addEventListener("blur", onBlur);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("popstate", onPopState);
  history.pushState({ quiz: 1 }, "");
}
function desarmarTrampas() {
  salidaPermitida = true;
  document.removeEventListener("fullscreenchange", onFsChange);
  document.removeEventListener("visibilitychange", onVisChange);
  window.removeEventListener("blur", onBlur);
  window.removeEventListener("pagehide", onPageHide);
  window.removeEventListener("popstate", onPopState);
}
function pedirFullscreen() {
  if (!fsSoportado) return Promise.resolve(false);
  try {
    var p = document.documentElement.requestFullscreen({ navigationUI: "hide" });
    if (p && p.then) return p.then(function () { return true; }).catch(function () { return false; });
    return Promise.resolve(!!document.fullscreenElement);
  } catch (e) { return Promise.resolve(false); }
}

/* bloquear copia/selección/menú contextual */
["copy", "cut", "contextmenu", "selectstart", "dragstart"].forEach(function (ev) {
  document.addEventListener(ev, function (e) { e.preventDefault(); return false; });
});
document.addEventListener("paste", function (e) { e.preventDefault(); return false; }, true);

/* ====== registro ====== */
var avatarSel = null;
function armarAvatares() {
  var g = $("avatar-grid"); g.innerHTML = "";
  AVATARES.forEach(function (src, i) {
    var b = el("button", "avatar-op");
    b.type = "button";
    var img = el("img"); img.src = src; img.alt = "Avatar " + (i + 1);
    b.appendChild(img);
    b.addEventListener("click", function () {
      avatarSel = i;
      var ops = g.querySelectorAll(".avatar-op");
      for (var k = 0; k < ops.length; k++) ops[k].classList.remove("sel");
      b.classList.add("sel");
    });
    g.appendChild(b);
  });
}
function nombreCompleto() { return (estado.apellido + ", " + estado.nombre).trim(); }

/* ====== flujo de intento ====== */
function sortearItems() {
  /* Sorteo de preguntas y orden de opciones con crypto (cliente).
   * El cliente no conoce la clave real: usa una ficticia solo para cumplir
   * las reglas del sorteo. El servidor valida todo y reequilibra el orden
   * de las opciones con la clave verdadera antes de devolver los items. */
  var claveFake = {};
  BANCO.forEach(function (q) {
    var ops = q.opciones;
    claveFake[q.id] = ops[Sorteo._randInt(ops.length)].oid;
  });
  var intento = Sorteo.armarIntento(BANCO, claveFake);
  return intento.items;
}
function nuevoIntento() {
  estado.items = sortearItems();
  estado.respuestas = {};
  estado.idx = 0;
  estado.anulado = false;
  estado.entregado = false;
  var payload = {
    action: "iniciar",
    deviceId: estado.deviceId,
    studentId: estado.studentId,
    apellido: estado.apellido, nombre: estado.nombre,
    curso: CURSO_FIJO, avatar: estado.avatar,
    items: estado.items.map(function (p) {
      return { qid: p.qid, oids: p.opciones.map(function (o) { return o.oid; }) };
    })
  };
  return api(payload).then(function (r) {
    if (!r || !r.ok) throw new Error(r && r.error ? r.error : "sin-respuesta");
    /* el servidor devuelve el orden definitivo (equilibrado con la clave real) */
    estado.attemptId = r.attemptId;
    estado.items = r.items.map(function (it) {
      return { qid: it.qid, opciones: it.opciones };
    });
    estado.startedAt = Date.now(); /* reloj local solo para mostrar; el oficial lo lleva el servidor */
    guardarLS();
  });
}
function iniciarTimer() {
  clearInterval(timerInt);
  timerInt = setInterval(function () {
    $("q-tiempo").textContent = fmtTiempo((Date.now() - estado.startedAt) / 1000);
  }, 1000);
  $("q-tiempo").textContent = fmtTiempo((Date.now() - estado.startedAt) / 1000);
}
function entrarQuiz() {
  $("q-avatar").src = AVATARES[estado.avatar];
  $("q-nombre").textContent = nombreCompleto();
  $("q-curso").textContent = CURSO_FIJO;
  $("q-nota").textContent = "—";
  armarTrampas();
  iniciarTimer();
  renderPregunta();
  mostrar("p-quiz");
}

/* ====== render de pregunta ====== */
function parseNota(q) {
  var nota = { titulo: null, ilustrativo: false, ymax: null };
  if (!q.nota) return nota;
  var m = q.nota.match(/Título sugerido:\s*«([^»]+)»/);
  if (m) nota.titulo = m[1];
  if (/ilustrativo/i.test(q.nota)) nota.ilustrativo = true;
  var my = q.nota.match(/eje Y de 0 a (\d+)/);
  if (my) nota.ymax = parseInt(my[1], 10);
  return nota;
}
function numDe(celda) { return parseFloat(String(celda).replace(",", ".").replace(/[^\d.\-]/g, "")); }

function svgBarra(q) {
  var nota = parseNota(q);
  var filas = q.tabla.slice(1);
  var vals = filas.map(function (f) { return numDe(f[1]); });
  var ymax = nota.ymax || Math.max.apply(null, vals) * 1.15;
  var W = 340, H = 210, padL = 34, padB = 56, padT = 10, padR = 8;
  var n = filas.length, bw = (W - padL - padR) / n * 0.55;
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img">';
  /* grilla + eje Y */
  var pasos = 5;
  for (var g = 0; g <= pasos; g++) {
    var y = padT + (H - padB - padT) * (1 - g / pasos);
    var val = ymax * g / pasos;
    s += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="#e5defa" stroke-width="1"/>';
    s += '<text x="' + (padL - 5) + '" y="' + (y + 4) + '" font-size="9" text-anchor="end" fill="#7a70a8">' + (val % 1 === 0 ? val : val.toFixed(1).replace(".", ",")) + "</text>";
  }
  for (var i = 0; i < n; i++) {
    var x = padL + (W - padL - padR) * (i + 0.5) / n - bw / 2;
    var h = (H - padB - padT) * vals[i] / ymax;
    var y2 = H - padB - h;
    var col = ["#4c2fd8", "#19b8d8", "#d946ef", "#7c3aed", "#0ea5b7", "#a855f7"][i % 6];
    s += '<rect x="' + x + '" y="' + y2 + '" width="' + bw + '" height="' + h + '" rx="4" fill="' + col + '"/>';
    s += '<text x="' + (x + bw / 2) + '" y="' + (y2 - 4) + '" font-size="10" font-weight="700" text-anchor="middle" fill="#241a4d">' + filas[i][1] + "</text>";
    /* etiqueta categoría (puede ser larga → dos líneas) */
    var cat = String(filas[i][0]);
    var cortada = cat.length > 16 ? [cat.slice(0, 16), cat.slice(16, 32)] : [cat];
    cortada.forEach(function (ln, li) {
      s += '<text x="' + (x + bw / 2) + '" y="' + (H - padB + 12 + li * 11) + '" font-size="8.5" text-anchor="middle" fill="#5b5286">' + ln.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</text>";
    });
  }
  s += '<text x="14" y="' + (padT - 2) + '" font-size="9" fill="#7a70a8">' + String(q.tabla[0][1]).replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</text>";
  s += "</svg>";
  return s;
}
function svgTorta(q) {
  var filas = q.tabla.slice(1);
  var vals = filas.map(function (f) { return numDe(f[1]); });
  var total = vals.reduce(function (a, b) { return a + b; }, 0);
  var cx = 110, cy = 105, r = 78, W = 340, H = 210;
  var cols = ["#4c2fd8", "#19b8d8", "#d946ef", "#7c3aed", "#0ea5b7", "#a855f7"];
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img">';
  var a0 = -Math.PI / 2;
  for (var i = 0; i < vals.length; i++) {
    var a1 = a0 + (vals[i] / total) * Math.PI * 2;
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    s += '<path d="M' + cx + ' ' + cy + ' L' + x0 + ' ' + y0 + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1 + ' ' + y1 + ' Z" fill="' + cols[i % 6] + '" stroke="#fff" stroke-width="1.5"/>';
    var am = (a0 + a1) / 2, lr = r * 0.62;
    s += '<text x="' + (cx + lr * Math.cos(am)) + '" y="' + (cy + lr * Math.sin(am)) + '" font-size="10" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="#fff">' + filas[i][1] + "</text>";
    a0 = a1;
  }
  for (var j = 0; j < filas.length; j++) {
    s += '<rect x="200" y="' + (48 + j * 26) + '" width="12" height="12" rx="3" fill="' + cols[j % 6] + '"/>';
    var cat = String(filas[j][0]);
    if (cat.length > 20) cat = cat.slice(0, 19) + "…";
    s += '<text x="218" y="' + (58 + j * 26) + '" font-size="9.5" fill="#241a4d">' + cat.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</text>";
  }
  s += "</svg>";
  return s;
}
function renderRecurso(q) {
  var box = $("q-recurso");
  box.innerHTML = "";
  if (!q.recurso || !q.tabla) return;
  var card = el("div", "recurso-card");
  var nota = parseNota(q);
  var titulo = nota.titulo;
  if (!titulo && q.recurso === "tabla") titulo = null;
  if (titulo) card.appendChild(el("div", "recurso-titulo", titulo));
  if (q.recurso === "tabla") {
    var t = el("table", "tabla-rec");
    var thead = el("thead"), trh = el("tr");
    q.tabla[0].forEach(function (c) { trh.appendChild(el("th", "", c)); });
    thead.appendChild(trh); t.appendChild(thead);
    var tb = el("tbody");
    q.tabla.slice(1).forEach(function (f) {
      var tr = el("tr");
      f.forEach(function (c) { tr.appendChild(el("td", "", c)); });
      tb.appendChild(tr);
    });
    t.appendChild(tb); card.appendChild(t);
  } else {
    var g = el("div", "grafico");
    g.innerHTML = /torta/.test(q.recurso) ? svgTorta(q) : svgBarra(q);
    card.appendChild(g);
  }
  if (nota.ilustrativo) card.appendChild(el("div", "recurso-nota", "Datos ilustrativos"));
  box.appendChild(card);
}
function bancoDe(qid) {
  for (var i = 0; i < BANCO.length; i++) if (BANCO[i].id === qid) return BANCO[i];
  return null;
}
function renderPregunta() {
  var item = estado.items[estado.idx];
  var q = bancoDe(item.qid);
  $("q-contador").textContent = "Pregunta " + (estado.idx + 1) + " de " + estado.items.length;
  $("barra-prog").style.width = ((estado.idx + 1) / estado.items.length * 100) + "%";
  renderRecurso(q);
  $("q-enunciado").textContent = q.enunciado;
  var box = $("q-opciones"); box.innerHTML = "";
  var marcada = estado.respuestas[item.qid];
  item.opciones.forEach(function (op) {
    var b = el("button", "opcion" + (marcada === op.oid ? " sel" : ""));
    b.type = "button";
    b.appendChild(el("span", "letra", op.letra));
    b.appendChild(el("span", "", op.texto));
    b.addEventListener("click", function () {
      estado.respuestas[item.qid] = op.oid;
      guardarLS();
      var ops = box.querySelectorAll(".opcion");
      for (var k = 0; k < ops.length; k++) ops[k].classList.remove("sel");
      b.classList.add("sel");
      api({ action: "respuesta", attemptId: estado.attemptId, qid: item.qid, oid: op.oid, idx: estado.idx })
        .catch(function () {});
      if (estado.idx < estado.items.length - 1) {
        setTimeout(function () { estado.idx++; guardarLS(); renderPregunta(); }, 260);
      }
      renderNav();
    });
    box.appendChild(b);
  });
  renderNav();
}
function renderNav() {
  var ultima = estado.idx === estado.items.length - 1;
  $("btn-anterior").disabled = estado.idx === 0;
  $("btn-siguiente").classList.toggle("oculto", ultima);
  $("btn-entregar").classList.toggle("oculto", !ultima);
  if (!ultima) $("btn-entregar").classList.add("oculto");
}

/* ====== entrega ====== */
function entregar() {
  var sin = estado.items.filter(function (p) { return !estado.respuestas[p.qid]; }).length;
  if (sin > 0) {
    $("m-titulo").textContent = "Te quedan " + sin + " sin responder";
    $("m-texto").textContent = "Podés volver con Anterior para revisarlas. Si entregás igual, cuentan como incorrectas. ¿Entregar de todas formas?";
  } else {
    $("m-titulo").textContent = "¿Entregar el quiz?";
    $("m-texto").textContent = "Después de entregar no podés cambiar respuestas. Recién ahí vas a ver tu nota.";
  }
  $("modal").classList.remove("oculto");
}
function confirmarEntrega() {
  $("modal").classList.add("oculto");
  var btn = $("btn-entregar"); btn.disabled = true;
  api({
    action: "entregar",
    attemptId: estado.attemptId,
    respuestas: estado.respuestas
  }).then(function (r) {
    if (!r || !r.ok) throw new Error(r && r.error ? r.error : "fallo");
    estado.entregado = true;
    desarmarTrampas();
    if (document.fullscreenElement && document.exitFullscreen) {
      try { document.exitFullscreen(); } catch (e) {}
    }
    clearInterval(timerInt);
    var nota = Math.round(r.correctas * 0.5 * 100) / 100;
    $("r-avatar").src = AVATARES[estado.avatar];
    $("r-nombre").textContent = nombreCompleto();
    $("r-correctas").textContent = r.correctas;
    $("r-nota").textContent = String(nota).replace(".", ",");
    $("r-tiempo").textContent = fmtTiempo(r.segundos || ((Date.now() - estado.startedAt) / 1000));
    var ap = $("r-aprobado");
    if (nota >= NOTA_APROBADO) { ap.textContent = "Aprobado"; ap.className = "badge ok"; }
    else { ap.textContent = "No aprobado"; ap.className = "badge no"; }
    limpiarIntentoLS();
    estado.items = null;
    mostrar("p-resultado");
    btn.disabled = false;
  }).catch(function (e) {
    btn.disabled = false;
    toast("No se pudo entregar. Revisá tu conexión y tocá Entregar otra vez.");
  });
}

/* ====== docente ====== */
var docPin = "";
function entrarDocente() {
  docPin = $("doc-pin").value.trim();
  if (!docPin) { $("doc-error").textContent = "Ingresá la contraseña."; return; }
  $("doc-error").textContent = "";
  api({ action: "panel", pin: docPin }).then(function (r) {
    if (!r || !r.ok) { $("doc-error").textContent = (r && r.error) || "Contraseña incorrecta."; return; }
    $("doc-login").classList.add("oculto");
    $("doc-panel").classList.remove("oculto");
    renderPanel(r.filas || []);
  }).catch(function () { $("doc-error").textContent = "Sin conexión con el servidor."; });
}
function renderPanel(filas) {
  var box = $("doc-tabla"); box.innerHTML = "";
  if (!filas.length) { box.appendChild(el("p", "nota-chica", "Todavía no hay intentos registrados.")); return; }
  var t = el("table", "tabla-doc");
  var thead = el("thead"), trh = el("tr");
  ["Fecha", "Estudiante", "Curso", "Estado", "Correctas", "Nota", "Tiempo", "Salidas"].forEach(function (c) {
    trh.appendChild(el("th", "", c));
  });
  thead.appendChild(trh); t.appendChild(thead);
  var tb = el("tbody");
  filas.forEach(function (f) {
    var tr = el("tr", "fila");
    tr.appendChild(el("td", "", f.fecha || "—"));
    tr.appendChild(el("td", "", (f.apellido || "") + ", " + (f.nombre || "")));
    tr.appendChild(el("td", "", f.curso || "—"));
    var est = el("td", "", f.estado || "—");
    if (f.estado === "anulado") est.className = "est-anulado";
    if (f.estado === "entregado") est.className = "est-entregado";
    tr.appendChild(est);
    tr.appendChild(el("td", "", f.correctas !== null && f.correctas !== undefined ? String(f.correctas) : "—"));
    tr.appendChild(el("td", "", f.nota !== null && f.nota !== undefined ? String(f.nota).replace(".", ",") : "—"));
    tr.appendChild(el("td", "", f.segundos !== null && f.segundos !== undefined ? fmtTiempo(f.segundos) : "—"));
    tr.appendChild(el("td", "", String(f.salidas || 0)));
    tr.addEventListener("click", function () { verDetalle(f.attemptId); });
    tb.appendChild(tr);
  });
  t.appendChild(tb); box.appendChild(t);
}
function verDetalle(attemptId) {
  api({ action: "detalle", pin: docPin, attemptId: attemptId }).then(function (r) {
    if (!r || !r.ok) { toast("No se pudo cargar el detalle."); return; }
    var d = $("doc-detalle"); d.innerHTML = ""; d.classList.remove("oculto");
    var card = el("div", "detalle-card");
    card.appendChild(el("h4", "", r.apellido + ", " + r.nombre + " — intento " + attemptId));
    card.appendChild(el("p", "", "Estado: " + r.estado + " · Correctas: " + (r.correctas === null ? "—" : r.correctas) + "/20 · Nota: " + (r.nota === null ? "—" : String(r.nota).replace(".", ",")) + " · Salidas: " + (r.salidas || 0)));
    (r.preguntas || []).forEach(function (p, i) {
      var row = el("div", "preg");
      var head = el("b", "", (i + 1) + ") " + p.enunciado);
      row.appendChild(head);
      row.appendChild(el("br"));
      var txt;
      if (!p.marcada) {
        txt = el("span", "sin", "Sin responder — correcta: " + p.letraCorrecta + ") " + p.textoCorrecta);
      } else if (p.correcta) {
        txt = el("span", "ok", "Marcó " + p.letraMarcada + ") " + p.textoMarcada + " — correcta");
      } else {
        txt = el("span", "mal", "Marcó " + p.letraMarcada + ") " + p.textoMarcada + " — correcta: " + p.letraCorrecta + ") " + p.textoCorrecta);
      }
      row.appendChild(txt);
      card.appendChild(row);
    });
    var cerrar = el("button", "btn btn-sec chico", "Cerrar detalle");
    cerrar.addEventListener("click", function () { d.classList.add("oculto"); });
    card.appendChild(el("br")); card.appendChild(cerrar);
    d.appendChild(card);
    d.scrollIntoView({ behavior: "smooth" });
  }).catch(function () { toast("Sin conexión."); });
}
function exportarCSV() {
  api({ action: "panel", pin: docPin }).then(function (r) {
    if (!r || !r.ok) { toast("Sin conexión."); return; }
    var filas = [["fecha", "apellido", "nombre", "curso", "estado", "correctas", "nota", "segundos", "salidas", "attemptId", "deviceId"]];
    (r.filas || []).forEach(function (f) {
      filas.push([f.fecha, f.apellido, f.nombre, f.curso, f.estado,
        f.correctas === null || f.correctas === undefined ? "" : f.correctas,
        f.nota === null || f.nota === undefined ? "" : f.nota,
        f.segundos === null || f.segundos === undefined ? "" : f.segundos,
        f.salidas || 0, f.attemptId, f.deviceId || ""]);
    });
    var csv = filas.map(function (row) {
      return row.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\r\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "quiz-ia-5050-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }).catch(function () { toast("Sin conexión."); });
}

/* ====== arranque ====== */
function init() {
  var guardado = leerLS() || {};
  estado.deviceId = guardado.deviceId;
  if (!estado.deviceId) {
    estado.deviceId = "dev-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e9).toString(36);
    guardarLS();
  }
  armarAvatares();

  /* si hay intento guardado activo, mostrar opción de retomar */
  if (guardado.attemptId && guardado.items && !guardado.anulado && !guardado.entregado) {
    var btn = el("button", "btn btn-sec", "Retomar intento sin terminar");
    btn.style.marginTop = "10px";
    btn.addEventListener("click", function () {
      /* consultar estado real en el servidor */
      api({ action: "estado", attemptId: guardado.attemptId }).then(function (r) {
        if (r && r.ok && r.estado === "activo") {
          estado.studentId = guardado.studentId;
          estado.apellido = guardado.apellido; estado.nombre = guardado.nombre;
          estado.avatar = guardado.avatar; avatarSel = guardado.avatar;
          estado.attemptId = guardado.attemptId;
          estado.items = r.items || guardado.items;
          estado.respuestas = r.respuestas || guardado.respuestas || {};
          estado.idx = Math.min(guardado.idx || 0, estado.items.length - 1);
          estado.startedAt = guardado.startedAt || Date.now();
          pedirFullscreen().then(function () { entrarQuiz(); });
        } else {
          limpiarIntentoLS();
          toast("Ese intento ya no está disponible. Registrate de nuevo.");
        }
      }).catch(function () {
        toast("Sin conexión: no se puede retomar el intento.");
      });
    });
    $("p-inicio").querySelector(".contenido").appendChild(btn);
  } else if (guardado.attemptId && guardado.anulado && !guardado.entregado) {
    limpiarIntentoLS();
  }

  $("btn-ir-registro").addEventListener("click", function () {
    mostrar("p-registro");
    if (guardado.apellido) { $("f-apellido").value = guardado.apellido; $("f-nombre").value = guardado.nombre; }
  });
  $("btn-volver-inicio").addEventListener("click", function () { mostrar("p-inicio"); });
  $("btn-docente").addEventListener("click", function () { mostrar("p-docente"); });
  $("btn-doc-volver").addEventListener("click", function () { mostrar("p-inicio"); });
  $("btn-doc-entrar").addEventListener("click", entrarDocente);
  $("doc-pin").addEventListener("keydown", function (e) { if (e.key === "Enter") entrarDocente(); });
  $("btn-doc-actualizar").addEventListener("click", entrarDocente);
  $("btn-csv").addEventListener("click", exportarCSV);

  $("btn-comenzar").addEventListener("click", function () {
    var ap = $("f-apellido").value.trim(), no = $("f-nombre").value.trim();
    if (avatarSel === null && estado.avatar === null) {
      $("reg-error").textContent = "Elegí un avatar."; return;
    }
    if (avatarSel !== null) estado.avatar = avatarSel;
    if (!ap || !no) { $("reg-error").textContent = "Completá apellido y nombre."; return; }
    $("reg-error").textContent = "";
    estado.apellido = ap; estado.nombre = no;
    var btn = $("btn-comenzar"); btn.disabled = true; btn.textContent = "Preparando…";
    leerVoz("Hola " + no + ". Este es el quiz de IA, Ideas Brillantes. Son veinte preguntas y cada acierto suma medio punto. La pantalla se va a poner en modo completa: si salís o cambiás de aplicación, el intento se anula y tenés que volver a registrarte. No se muestran las respuestas correctas: la nota aparece solo al entregar. ¡Suerte!");
    var paso = estado.studentId ? Promise.resolve({ ok: true }) :
      api({ action: "registrar", deviceId: estado.deviceId, apellido: ap, nombre: no, curso: CURSO_FIJO, avatar: estado.avatar })
        .then(function (r) { if (r && r.ok) { estado.studentId = r.studentId; guardarLS(); return r; } throw new Error((r && r.error) || "fallo-registro"); });
    paso.then(function () {
      return nuevoIntento();
    }).then(function () {
      return pedirFullscreen();
    }).then(function () {
      entrarQuiz();
      btn.disabled = false; btn.textContent = "Comenzar";
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = "Comenzar";
      $("reg-error").textContent = "No se pudo iniciar el intento. Revisá tu conexión y probá de nuevo.";
    });
  });

  $("btn-anterior").addEventListener("click", function () {
    if (estado.idx > 0) { estado.idx--; guardarLS(); renderPregunta(); }
  });
  $("btn-siguiente").addEventListener("click", function () {
    if (estado.idx < estado.items.length - 1) { estado.idx++; guardarLS(); renderPregunta(); }
  });
  $("btn-entregar").addEventListener("click", entregar);
  $("m-cancelar").addEventListener("click", function () { $("modal").classList.add("oculto"); });
  $("m-confirmar").addEventListener("click", confirmarEntrega);
  $("btn-reintentar").addEventListener("click", function () {
    var btn = $("btn-reintentar"); btn.disabled = true;
    nuevoIntento().then(function () {
      return pedirFullscreen();
    }).then(function () {
      btn.disabled = false;
      entrarQuiz();
    }).catch(function () {
      btn.disabled = false;
      toast("Sin conexión. Probá de nuevo.");
    });
  });
  $("btn-recomenzar").addEventListener("click", function () {
    limpiarIntentoLS();
    estado.attemptId = null; estado.items = null; estado.respuestas = {};
    estado.anulado = false;
    /* tiene que volver a registrarse */
    estado.studentId = null;
    $("f-apellido").value = estado.apellido; $("f-nombre").value = estado.nombre;
    mostrar("p-registro");
  });
}
document.addEventListener("DOMContentLoaded", init);
