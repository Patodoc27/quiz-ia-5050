/*
 * Motor de sorteo del cuestionario. Compartido entre navegador y Node (simulación).
 * Reglas (20 preguntas):
 *  a) 5 por bloque; primero 1 al azar de cada subgrupo, el resto al azar del bloque.
 *  b) Entre 3 y 5 preguntas con recurso por intento; si no, re-sortear completo.
 *  c) Las preguntas 65 y 69 nunca juntas.
 *  d) Orden aleatorio con máx. 2 seguidas del mismo bloque.
 *  e) Opciones mezcladas + letras reasignadas; la 75 queda ordenada (números).
 *  f) Clave equilibrada: cada letra 4-6 veces, sin más de 3 seguidas (20 preguntas).
 *  g) Azar: crypto.getRandomValues + Fisher-Yates.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) { module.exports = api; }
  else { root.Sorteo = api; }
})(typeof self !== "undefined" ? self : this, function () {

  var SUBGRUPOS = {
    1: [[1, 5], [6, 7], [8, 10], [11, 15], [16, 20]],
    2: [[21, 24], [25, 29], [30, 34], [35, 40]],
    3: [[41, 44], [45, 50], [51, 55], [56, 60]],
    4: [[61, 63], [64, 67], [68, 73], [74, 75]]
  };
  var POR_BLOQUE = 5;
  var MIN_RECURSO = 3, MAX_RECURSO = 5;
  var MIN_CLAVE = 4, MAX_CLAVE = 6, MAX_SEGUIDAS = 3;
  var EXCLUIDAS_JUNTAS = [65, 69];

  function getCrypto() {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) return crypto;
    if (typeof require === "function") {
      try { return require("crypto").webcrypto; } catch (e) {}
    }
    throw new Error("No hay crypto.getRandomValues disponible");
  }
  var _crypto = getCrypto();

  function randInt(n) { // 0..n-1 uniforme
    var max = Math.floor(0x100000000 / n) * n;
    var buf = new Uint32Array(1);
    do { _crypto.getRandomValues(buf); } while (buf[0] >= max);
    return buf[0] % n;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randInt(i + 1);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function porSubgrupo(banco, qid) {
    return banco[qid].subgrupo;
  }

  function sortearBloque(banco, bloque) {
    var elegidas = [];
    var usados = {};
    var rangos = SUBGRUPOS[bloque];
    for (var s = 0; s < rangos.length; s++) {
      var pool = [];
      for (var q = rangos[s][0]; q <= rangos[s][1]; q++) pool.push(q);
      var pick = pool[randInt(pool.length)];
      elegidas.push(pick); usados[pick] = true;
    }
    var resto = [];
    for (var r = rangos[0][0]; r <= rangos[rangos.length - 1][1]; r++) {
      if (!usados[r]) resto.push(r);
    }
    shuffle(resto);
    while (elegidas.length < POR_BLOQUE) elegidas.push(resto.pop());
    return elegidas;
  }

  function cumpleOrden(ids, banco) {
    var seguidas = 1;
    for (var i = 1; i < ids.length; i++) {
      if (banco[ids[i]].bloque === banco[ids[i - 1]].bloque) {
        seguidas++;
        if (seguidas > 2) return false;
      } else seguidas = 1;
    }
    return true;
  }

  function sortearPreguntas(banco) {
    for (var intento = 0; intento < 5000; intento++) {
      var elegidas = [];
      for (var b = 1; b <= 4; b++) elegidas = elegidas.concat(sortearBloque(banco, b));
      var conRecurso = elegidas.filter(function (id) { return !!banco[id].recurso; }).length;
      if (conRecurso < MIN_RECURSO || conRecurso > MAX_RECURSO) continue;
      if (elegidas.indexOf(EXCLUIDAS_JUNTAS[0]) !== -1 &&
          elegidas.indexOf(EXCLUIDAS_JUNTAS[1]) !== -1) continue;
      var orden = shuffle(elegidas.slice());
      if (!cumpleOrden(orden, banco)) {
        var ok = false;
        for (var t = 0; t < 200; t++) { orden = shuffle(orden.slice()); if (cumpleOrden(orden, banco)) { ok = true; break; } }
        if (!ok) continue;
      }
      return orden;
    }
    throw new Error("No se pudo sortear un intento válido");
  }

  function letrasDeClave(preguntas, clave) {
    return preguntas.map(function (p) {
      var idx = p.opciones.findIndex(function (o) { return o.oid === clave[p.qid]; });
      return "abcd"[idx];
    });
  }

  function claveEquilibrada(letras) {
    var conteo = { a: 0, b: 0, c: 0, d: 0 };
    var seguidas = 1;
    for (var i = 0; i < letras.length; i++) {
      conteo[letras[i]]++;
      if (i > 0) {
        if (letras[i] === letras[i - 1]) { seguidas++; if (seguidas > MAX_SEGUIDAS) return false; }
        else seguidas = 1;
      }
    }
    return ["a", "b", "c", "d"].every(function (l) {
      return conteo[l] >= MIN_CLAVE && conteo[l] <= MAX_CLAVE;
    });
  }

  /* Mezcla opciones hasta equilibrar la clave. Devuelve intento:
   * [{qid, opciones:[{oid, letra, texto}]}] en orden de presentación. */
  function sortearOpciones(banco, ids, clave) {
    for (var intento = 0; intento < 8000; intento++) {
      var preguntas = ids.map(function (qid) {
        var q = banco[qid];
        var ops = q.opciones.map(function (o) { return { oid: o.oid, texto: o.texto }; });
        if (qid !== 75) shuffle(ops);
        return { qid: qid, opciones: ops.map(function (o, i) {
          return { oid: o.oid, letra: "abcd"[i], texto: o.texto };
        })};
      });
      var letras = letrasDeClave(preguntas, clave);
      if (claveEquilibrada(letras)) {
        preguntas.forEach(function (p, i) { p.claveLetra = letras[i]; });
        return preguntas;
      }
    }
    throw new Error("No se pudo equilibrar la clave");
  }

  /* Arma un intento completo. `banco` = array de preguntas (data.js),
   * `clave` = {qid: oidCorrecto}. Devuelve {items:[{qid, opciones:[{oid,letra,texto}]}]}. */
  function armarIntento(bancoArr, clave) {
    var banco = {};
    bancoArr.forEach(function (q) { banco[q.id] = q; });
    var ids = sortearPreguntas(banco);
    var items = sortearOpciones(banco, ids, clave);
    return { items: items };
  }

  /* Validador usado por la simulación (también sirve server-side). */
  function validarIntento(bancoArr, clave, items) {
    var banco = {};
    bancoArr.forEach(function (q) { banco[q.id] = q; });
    var errores = [];
    var porBloque = { 1: 0, 2: 0, 3: 0, 4: 0 };
    var vistos = {};
    var conRecurso = 0;
    var ids = items.map(function (p) { return p.qid; });
    ids.forEach(function (id) {
      porBloque[banco[id].bloque]++;
      if (vistos[id]) errores.push("repetida " + id);
      vistos[id] = true;
      if (banco[id].recurso) conRecurso++;
    });
    if (ids.length !== 20) errores.push("no son 20");
    [1, 2, 3, 4].forEach(function (b) { if (porBloque[b] !== 5) errores.push("bloque " + b + " con " + porBloque[b]); });
    if (conRecurso < 3 || conRecurso > 5) errores.push("recurso=" + conRecurso);
    if (vistos[65] && vistos[69]) errores.push("65 y 69 juntas");
    // cobertura de subgrupos
    [1, 2, 3, 4].forEach(function (b) {
      SUBGRUPOS[b].forEach(function (rg) {
        var cubierto = ids.some(function (id) { return id >= rg[0] && id <= rg[1]; });
        if (!cubierto) errores.push("subgrupo " + rg[0] + "-" + rg[1] + " sin cobertura");
      });
    });
    if (!cumpleOrden(ids, banco)) errores.push("más de 2 seguidas del mismo bloque");
    // opciones: 4 únicas, letras a-d en orden; q75 ascendente
    items.forEach(function (p) {
      if (p.opciones.length !== 4) errores.push("q" + p.qid + " sin 4 opciones");
      var letras = p.opciones.map(function (o) { return o.letra; }).join("");
      if (letras !== "abcd") errores.push("q" + p.qid + " letras " + letras);
      var oids = {}; p.opciones.forEach(function (o) { oids[o.oid] = true; });
      if (Object.keys(oids).length !== 4) errores.push("q" + p.qid + " oids repetidos");
      if (p.qid === 75) {
        var nums = p.opciones.map(function (o) { return parseInt(o.texto, 10); });
        for (var i = 1; i < nums.length; i++) if (nums[i] < nums[i - 1]) errores.push("q75 no ascendente");
      }
    });
    var letras = letrasDeClave(items, clave);
    if (!claveEquilibrada(letras)) errores.push("clave desequilibrada");
    // letra efectivamente corresponde a la correcta
    items.forEach(function (p, i) {
      var idx = p.opciones.findIndex(function (o) { return o.oid === clave[p.qid]; });
      if (idx < 0) errores.push("q" + p.qid + " clave ausente");
      else if ("abcd"[idx] !== letras[i]) errores.push("q" + p.qid + " letra mal calculada");
    });
    return errores;
  }

  return {
    armarIntento: armarIntento,
    validarIntento: validarIntento,
    letrasDeClave: letrasDeClave,
    _randInt: randInt,
    _shuffle: shuffle,
    SUBGRUPOS: SUBGRUPOS
  };
});
