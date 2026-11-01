# Guía docente — Cuestionario Final · Colegio 50-50

## Qué hace la app
- Registro con avatar, apellido, nombre y curso (fijo: 5° 1°).
- 20 preguntas al azar por intento (5 por bloque, con gráficos/tabla entre 3 y 5).
- Pantalla completa obligatoria (Android). Si sale de la app/página, cambia de
  pestaña, toca "atrás" o se apaga la pantalla → **intento anulado** y vuelve a
  registrarse. En iPhone no hay pantalla completa real en Safari, pero la salida
  se detecta igual.
- Sin avisar si acertó: la nota se ve solo al entregar. Cada acierto = 0,5
  (20 bien = 10). Aprobado con 6.
- Reintentos ilimitados, siempre con preguntas nuevas.
- Todo queda guardado en tu Google Sheets: intentos (completos, anulados,
  salidas) y notas.

## Paso 1 — Preparar la planilla
1. Creá una planilla de Google vacía (o usá la que armaste para esto).
2. Copiá su **ID**: es el pedazo de la URL entre `/d/` y `/edit`.
   Ejemplo: `docs.google.com/spreadsheets/d/ESTE_PEDAZO_ES_EL_ID/edit`

## Paso 2 — Publicar el Apps Script
1. En la planilla: **Extensiones → Apps Script**.
2. Borrá lo que haya y pegá **todo** el contenido de `apps-script/Code.gs`.
3. Arriba del archivo, en las constantes, completá:
   - `SPREADSHEET_ID`: el ID copiado en el paso 1.
   - `PIN_DOCENTE`: el PIN que quieras para tu vista docente.
4. **Implementar → Nueva implementación → tipo: Aplicación web**:
   - "Ejecutar como": **Yo**
   - "Quién puede acceder": **Cualquier persona**
5. Implementar → autorizar permisos → copiá la **URL web** (termina en `/exec`).

## Paso 3 — Conectar el sitio
1. En este repo, abrí el archivo `config.js`.
2. Reemplazá `PEGAR_URL_DE_TU_APPS_SCRIPT` por la URL `/exec` del paso 2.
3. Guardá. En 1-2 minutos el sitio ya queda conectado.

## Paso 4 — Usar
- Compartí el link del sitio: `https://patodoc27.github.io/<nombre-del-repo>/`
- Tu vista docente: en la pantalla inicial, abajo, "Acceso docente" → entrás con el PIN.
  Ahí ves intentos por estudiante, qué marcó en cada pregunta, salidas, y podés
  exportar CSV.

## Cómo quedan las hojas en tu planilla
- **Intentos**: una fila por intento (fecha, estudiante, items, respuestas, eventos, estado).
- **Notas**: una fila por intento entregado (nota, correctas, tiempo, estado).
- **Estudiantes**: registro de cada dispositivo/nombre.

## Notas
- Los estudiantes nunca reciben las respuestas correctas: la corrección ocurre
  en el servidor (Apps Script), la clave no viaja al celular.
- Si un estudiante cierra la página sin entregar, queda registrado como
  "anulado" con el motivo detectado.
