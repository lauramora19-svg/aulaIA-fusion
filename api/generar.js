export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "API key no configurada" }), { status: 500 });

  const {
    comunidad, modo, etapa, curso, area, duracion, tema, promptOverride,
    necesidades = [], numAlumnos, objetivos = [],
    tipoResultado, comentario, idioma = "Castellano",
    metodologias = [], continuarDesde = null,
    plantillaId = null, accessToken = null,
    especialistaId = null, grupoTexto = "", contextoEncargo = "",
  } = await req.json();

  // ── CUENTA, LÍMITE MENSUAL Y REGISTRO DE USO ─────────────────────────────
  // Solo pueden generar las cuentas con sesión iniciada. Cada generación se
  // apunta en uso_ia; la administradora no tiene límite.
  if (!supabaseUrl || !supabaseKey) return new Response(JSON.stringify({ error: "Servidor sin configurar" }), { status: 500 });
  const hS = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" };
  const userRes0 = accessToken ? await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` } }).catch(() => null) : null;
  const usuarioActual = userRes0?.ok ? await userRes0.json() : null;
  if (!usuarioActual?.id) return new Response(JSON.stringify({ error: "sesion", mensaje: "Tu sesión ha caducado. Vuelve a entrar en AulaIA." }), { status: 401, headers: { "Content-Type": "application/json" } });
  const perfilActual = await fetch(`${supabaseUrl}/rest/v1/perfiles?id=eq.${usuarioActual.id}&select=*`, { headers: hS }).then(r => r.ok ? r.json() : []).then(a => a[0] || {}).catch(() => ({}));
  const ajustes = await fetch(`${supabaseUrl}/rest/v1/ajustes_ia?id=eq.1&select=*`, { headers: hS }).then(r => r.ok ? r.json() : []).then(a => a[0] || {}).catch(() => ({}));
  const esAdminActual = perfilActual.rol === "admin";
  if (!esAdminActual && !continuarDesde) {
    const limite = perfilActual.limite_mensual ?? ajustes.limite_por_defecto ?? 30;
    const ahora = new Date();
    const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1)).toISOString();
    const cRes = await fetch(`${supabaseUrl}/rest/v1/uso_ia?user_id=eq.${usuarioActual.id}&continuacion=eq.false&created_at=gte.${encodeURIComponent(inicioMes)}&select=id&limit=1`, { headers: { ...hS, Prefer: "count=exact" } }).catch(() => null);
    const usados = Number((cRes?.headers.get("content-range") || "").split("/")[1] || 0);
    if (limite >= 0 && usados >= limite) {
      return new Response(JSON.stringify({ error: "limite", usados, limite, mensaje: `Has llegado a tu límite de ${limite} generaciones de este mes. Se renueva el día 1.` }), { status: 429, headers: { "Content-Type": "application/json" } });
    }
  }
  const registro = await fetch(`${supabaseUrl}/rest/v1/uso_ia`, {
    method: "POST", headers: { ...hS, Prefer: "return=representation" },
    body: JSON.stringify({ user_id: usuarioActual.id, tipo: String(tipoResultado || "").slice(0, 40), especialista: especialistaId || null, continuacion: !!continuarDesde }),
  }).then(r => r.ok ? r.json() : []).then(a => a[0]?.id || null).catch(() => null);
  // Pasa el streaming tal cual y, al terminar, apunta los tokens usados
  const contarTokens = (cuerpo) => {
    if (!registro || !cuerpo) return cuerpo;
    const dec = new TextDecoder(); let buf = "", ent = 0, sal = 0;
    return cuerpo.pipeThrough(new TransformStream({
      transform(chunk, ctrl) {
        ctrl.enqueue(chunk);
        buf += dec.decode(chunk, { stream: true });
        const lineas = buf.split("\n"); buf = lineas.pop();
        for (const l of lineas) {
          if (!l.startsWith("data:") || !l.includes("usage")) continue;
          try { const d = JSON.parse(l.slice(5)); const u = d.message?.usage || d.usage; if (u?.input_tokens) ent = u.input_tokens; if (u?.output_tokens) sal = u.output_tokens; } catch {}
        }
      },
      async flush() {
        await fetch(`${supabaseUrl}/rest/v1/uso_ia?id=eq.${registro}`, { method: "PATCH", headers: hS, body: JSON.stringify({ tokens_entrada: ent, tokens_salida: sal }) }).catch(() => {});
      },
    }));
  };

  const NECESIDADES_MAP = {
    tea:"Trastorno del Espectro Autista (TEA)", tdah:"TDAH",
    dislexia:"Dislexia", di:"Discapacidad intelectual",
    dm:"Discapacidad motora", down:"Síndrome de Down",
    altas:"Altas Capacidades Intelectuales", tgd:"Trastorno Generalizado del Desarrollo",
    visual:"Discapacidad visual", auditiva:"Discapacidad auditiva",
    tdl:"Trastorno del Desarrollo del Lenguaje (TDL)",
    discalculia:"Discalculia",
    tda:"Trastorno por Déficit de Atención sin hiperactividad (TDA)",
  };

  const IDIOMA_MAP = {
    "Castellano": "español (castellano)",
    "Inglés": "inglés",
    "Català": "catalán",
    "Valencià": "valenciano",
    "Euskera": "euskera (vasco)",
    "Galego": "gallego",
  };

  const TIPO_MAP = {
    actividades:"batería de actividades adaptadas paso a paso",
    programacion:"programación didáctica adaptada",
    aci:"Adaptación Curricular Individualizada (ACI) en formato oficial según la LOMLOE",
    dua:"programación siguiendo el Diseño Universal para el Aprendizaje (DUA)",
    pti:"Plan de Trabajo Individualizado (PTI) en formato oficial",
    recursos:"listado de recursos y materiales adaptados con instrucciones de uso",
    situacion:"Situación de Aprendizaje completa con estructura oficial LOMLOE",
    rubrica:"rúbrica de evaluación detallada con criterios e indicadores de logro",
    familias:"comunicación para familias explicando la Situación de Aprendizaje y cómo apoyar desde casa",
    mixto_situacion:"Situación de Aprendizaje inclusiva con dos niveles integrados",
    mixto_programacion:"programación didáctica inclusiva completa con adaptaciones curriculares integradas",
    mixto_actividades:"batería de actividades en dos niveles para la misma sesión",
    mixto_dua:"programación completa bajo el marco DUA que atiende a toda la diversidad",
    mixto_rubrica:"rúbrica de evaluación multinivel con criterios diferenciados",
    mixto_plan:"Plan de Inclusión del Aula con estrategias para atender simultáneamente a todo el alumnado",
  };

  const TIPOS_LARGOS = ["aci","pti","situacion","mixto_situacion","mixto_programacion","dua","mixto_dua","programacion"];

  const necesidadesLabels = necesidades.map(id => NECESIDADES_MAP[id] || id).join(", ");
  const objetivosLabels = objetivos.length > 0 ? objetivos.join(", ") : "los propios de la etapa y área";
  const tipoLabel = TIPO_MAP[tipoResultado] || tipoResultado;
  const idiomaLabel = IDIOMA_MAP[idioma] || "español (castellano)";
  const metodologiasLabel = metodologias.length > 0 ? metodologias.join(", ") : null;
  const esDocumentoLargo = TIPOS_LARGOS.includes(tipoResultado);

  // ── BÚSQUEDA EN SUPABASE ──────────────────────────────────────────────────
  let contextoCurricular = "";
  let curriculoUsado = false;

  if (supabaseUrl && supabaseKey && !continuarDesde) {
    try {
      const searchRes = await fetch(`${supabaseUrl}/rest/v1/rpc/buscar_curriculo`, {
        method: "POST",
        headers: { "Content-Type":"application/json", "apikey":supabaseKey, "Authorization":`Bearer ${supabaseKey}` },
        body: JSON.stringify({ query_text:`${area} ${curso} ${etapa}`, comunidad_filter:comunidad, area_filter:area, limit_results:4 }),
      });
      if (searchRes.ok) {
        const fragmentos = await searchRes.json();
        if (fragmentos?.length > 0) {
          contextoCurricular = `\n\nFRAGMENTOS DEL CURRÍCULO OFICIAL DE ${comunidad.toUpperCase()}:\n` +
            fragmentos.map((f) => `[${f.decreto}]\n${f.contenido}`).join("\n\n");
          curriculoUsado = true;
        }
      }
    } catch {}
  }

  // ── ESTRUCTURAS OFICIALES ─────────────────────────────────────────────────
  const ESTRUCTURA_ACI = `
ESTRUCTURA OFICIAL DE LA ACI — completa TODAS estas secciones en orden:

## ANEXO I — DATOS DE IDENTIFICACIÓN
- Datos del centro educativo
- Datos del alumno/a (usa [Nombre del alumno/a])
- Curso, etapa, grupo
- Fecha de elaboración y vigencia
- Profesionales implicados (tutor/a, PT, AL, orientador/a)

## ANEXO II — NIVEL DE COMPETENCIA CURRICULAR ACTUAL
- Descripción del nivel actual en cada área afectada (mínimo 3 párrafos)
- Puntos fuertes y áreas de mejora
- Estilo de aprendizaje y condiciones que facilitan el aprendizaje

## ANEXO III — ADAPTACIONES CURRICULARES
Para cada área adaptada desarrolla COMPLETAMENTE:
- Competencias específicas adaptadas
- Saberes básicos priorizados o modificados
- Criterios de evaluación adaptados
- Metodología específica
- Materiales y recursos adaptados
- Sistema de evaluación y promoción

## ANEXO IV — MEDIDAS ORGANIZATIVAS Y DE ACCESO
- Organización del espacio y el tiempo
- Apoyos dentro y fuera del aula
- Coordinación entre profesionales
- Colaboración con la familia

## ANEXO V — SEGUIMIENTO Y REVISIÓN
- Indicadores de seguimiento trimestral
- Fecha de revisión
- Criterios de promoción específicos`;

  const ESTRUCTURA_PTI = `
ESTRUCTURA OFICIAL DEL PTI — completa TODAS estas secciones en orden:

## 1. DATOS DE IDENTIFICACIÓN
- Centro, curso, etapa, área/s
- Profesionales responsables
- Período de aplicación

## 2. PUNTO DE PARTIDA
- Competencias y saberes básicos del curso anterior
- Dificultades específicas detectadas
- Potencialidades del alumno/a

## 3. OBJETIVOS DEL PTI
- Objetivos a corto plazo (trimestre) — mínimo 4
- Objetivos a medio plazo (curso) — mínimo 4
- Vinculación con el Perfil de salida de la etapa

## 4. PLANIFICACIÓN DE ACTUACIONES
- Actuaciones dentro del aula ordinaria (mínimo 4)
- Apoyos especializados PT/AL: frecuencia y contenido
- Recursos materiales específicos
- Adaptaciones de acceso

## 5. CRITERIOS DE EVALUACIÓN ADAPTADOS
- Por área o materia
- Instrumentos de evaluación adaptados
- Criterios de promoción

## 6. COLABORACIÓN FAMILIA-ESCUELA
- Compromisos de la familia
- Pautas de trabajo en casa
- Canales de comunicación y seguimiento

## 7. SEGUIMIENTO TRIMESTRAL
- Trimestre 1: fecha, valoración, ajustes
- Trimestre 2: fecha, valoración, ajustes
- Trimestre 3: fecha, valoración, decisión final`;

  const ESTRUCTURA_SA = `
ESTRUCTURA OFICIAL DE LA SITUACIÓN DE APRENDIZAJE — completa TODAS estas secciones en orden:

## 1. IDENTIFICACIÓN
- Título evocador y motivador
- Área/materia, curso, etapa
- Duración (número de sesiones)
- Descripción del contexto y justificación (mínimo 2 párrafos)

## 2. CONEXIONES CURRICULARES
- Competencias clave trabajadas (según Perfil de salida LOMLOE)
- Competencias específicas del área
- Saberes básicos implicados
- Descriptores operativos del Perfil de salida

## 3. SITUACIÓN-PROBLEMA O RETO
- Descripción del reto o pregunta motriz (mínimo 1 párrafo)
- Conexión con la realidad del alumnado
- Producto final o tarea auténtica

## 4. SECUENCIA DE ACTIVIDADES
Para CADA actividad desarrolla completamente:
- Nombre y descripción detallada
- Agrupamiento (individual, parejas, grupo)
- Recursos necesarios
- Tiempo estimado
- Rol del docente y del alumnado

## 5. METODOLOGÍA
- Enfoque metodológico principal
- Estrategias de atención a la diversidad
- Organización del espacio y el tiempo

## 6. EVALUACIÓN
- Criterios de evaluación vinculados a competencias específicas
- Instrumentos de evaluación
- Momentos de evaluación (diagnóstica, formativa, sumativa)
- Indicadores de logro observables

## 7. ATENCIÓN A LA DIVERSIDAD
- Medidas ordinarias para todo el grupo
- Adaptaciones para alumnado con NEE
- Enriquecimiento para altas capacidades`;

  const INSTRUCCIONES_LARGO = esDocumentoLargo ? `
INSTRUCCIONES CRÍTICAS PARA DOCUMENTO LARGO:
- Completa CADA sección antes de pasar a la siguiente.
- Cada sección debe tener el contenido mínimo indicado.
- NUNCA cortes una palabra a mitad.
- NUNCA dejes una frase sin terminar.
- NUNCA abras un paréntesis sin cerrarlo.
- NUNCA escribas "..." para indicar que continúa.
- Si una sección tiene subapartados, desarrolla TODOS.
- Escribe despacio y con cuidado. La calidad es más importante que la velocidad.` : "";

  // ── PROMPT PARA CONTINUAR ─────────────────────────────────────────────────
  if (continuarDesde) {
    const promptContinuar = `Estás completando un documento educativo que quedó incompleto.

TEXTO YA GENERADO (últimas líneas):
${continuarDesde}

INSTRUCCIONES:
- Continúa EXACTAMENTE desde donde se cortó, sin repetir nada de lo ya escrito
- Completa TODAS las secciones que falten
- Mantén el mismo estilo, formato y nomenclatura LOMLOE del texto anterior
- Escribe TODO en ${idiomaLabel}
- NUNCA uses recuadros ASCII (┌──┐), arte de texto ni caracteres especiales de dibujo
- Al terminar TODAS las secciones escribe exactamente:
---
✅ Documento completo generado por AulaIA`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        stream: true,
        system: `Eres un especialista en educación especial y pedagogía inclusiva experto en LOMLOE. Continúas documentos educativos incompletos manteniendo exactamente el mismo estilo y formato. Escribes TODO en ${idiomaLabel}. NUNCA uses recuadros ASCII ni arte de texto.`,
        messages: [{ role:"user", content: promptContinuar }],
      }),
    });
    if (!anthropicRes.ok) return new Response(JSON.stringify({ error:"Error API" }), { status: 502 });
    return new Response(contarTokens(anthropicRes.body), {
      headers: { "Content-Type":"text/event-stream", "Cache-Control":"no-cache", "Access-Control-Allow-Origin":"*" },
    });
  }

  // ── CONSTRUCCIÓN DEL PROMPT NORMAL ───────────────────────────────────────
  const contextoAula = `
DATOS DEL AULA:
- Comunidad Autónoma: ${comunidad}
- Etapa: ${etapa} | Curso: ${curso}
- Área/Asignatura: ${area}
- Duración / Sesiones: ${duracion}
- Tema / contenido específico: ${tema ? `"${tema}" — USA EXACTAMENTE ESTE TEMA` : "Elige un tema apropiado para el curso y área"}
- Objetivos prioritarios: ${objetivosLabels}
- IDIOMA DE SALIDA: ${idiomaLabel} — Escribe TODO el documento en ${idiomaLabel}
${metodologiasLabel ? `- Metodologías a aplicar: ${metodologiasLabel}` : ""}
${comentario ? `- Contexto adicional: "${comentario}"` : ""}
${contextoCurricular}`;

  let instrucciones = "";

  if (modo === "nee") {
    instrucciones = `
PERFIL DEL ALUMNADO NEE:
- Necesidades: ${necesidadesLabels}
- Número de alumnos con NEE: ${numAlumnos}

GENERA: ${tipoLabel}

${tipoResultado === "aci" ? ESTRUCTURA_ACI : ""}
${tipoResultado === "pti" ? ESTRUCTURA_PTI : ""}
${INSTRUCCIONES_LARGO}

INSTRUCCIONES:
- Usa nomenclatura oficial LOMLOE
- Dirígete al docente con lenguaje claro y profesional
- Incluye adaptaciones específicas para CADA NEE indicada
- Especifica nivel de apoyo: (A) apoyo físico · (V) apoyo visual · (I) trabajo independiente
${metodologiasLabel ? `- Integra estas metodologías: ${metodologiasLabel}` : ""}`;

  } else if (modo === "ordinario") {
    instrucciones = `
GENERA: ${tipoLabel}

${tipoResultado === "situacion" ? ESTRUCTURA_SA : ""}
${INSTRUCCIONES_LARGO}

INSTRUCCIONES:
- Usa nomenclatura oficial LOMLOE en todo el documento
- ${curriculoUsado ? `Basa el contenido en los fragmentos curriculares oficiales de ${comunidad}` : `Alinea con el currículo de ${comunidad} según la LOMLOE`}
- Si generas rúbrica: 4 niveles (Excelente, Satisfactorio, En proceso, Iniciando) con descriptores claros
${metodologiasLabel ? `- Integra estas metodologías: ${metodologiasLabel}` : ""}`;

  } else if (modo === "mixto") {
    instrucciones = `
PERFIL DEL AULA INCLUSIVA:
- Grupo ordinario + ${numAlumnos} alumno/s con NEE: ${necesidadesLabels}

GENERA: ${tipoLabel}

${tipoResultado === "mixto_situacion" ? ESTRUCTURA_SA : ""}
${INSTRUCCIONES_LARGO}

INSTRUCCIONES CLAVE — MODO MIXTO:
- Usa nomenclatura oficial LOMLOE
- TODO integrado en un único documento coherente
- Para cada actividad indica en paralelo:
  · 📚 GRUPO ORDINARIO: descripción estándar
  · 🧩 ADAPTACIÓN NEE: misma actividad con apoyos
- Los objetivos iguales para todos, con distintos niveles de logro
- ${curriculoUsado ? `Basa en los fragmentos curriculares de ${comunidad}` : `Alinea con ${comunidad} según la LOMLOE`}
${metodologiasLabel ? `- Integra estas metodologías: ${metodologiasLabel}` : ""}
- Al final incluye "Para el equipo docente"`;
  }

  const PROMPT_FICHA = `Eres un especialista en educación primaria. Crea una ficha de trabajo COMPLETA y lista para imprimir para el alumnado.

DATOS: ${etapa} · ${curso} · ${area} · Tema: ${tema || "el tema del área"} · Comunidad: ${comunidad}
${necesidades.length > 0 ? `NEE presentes: ${necesidadesLabels}` : ""}
IDIOMA: escribe TODO en ${idiomaLabel}

ESTRUCTURA OBLIGATORIA DE LA FICHA:

## Ficha de trabajo: [título motivador relacionado con el tema]

**Área:** ${area} | **Curso:** ${curso} | **Fecha:** _______________

**Nombre:** _______________________________

---

### Instrucciones
Escribe 2-3 frases cortas y claras explicando qué va a hacer el alumno. Usa lenguaje sencillo adaptado al curso.

---

### Actividad 1 — [nombre descriptivo]
Descripción clara de la actividad.
Espacio de respuesta con líneas: _____________ (repite según necesites)

---

### Actividad 2 — [nombre descriptivo]
Descripción clara de la actividad.
Espacio de respuesta con líneas: _____________

---

### Actividad 3 — [nombre descriptivo]
Descripción clara de la actividad.
Espacio de respuesta con líneas: _____________

---

### Actividad 4 — [nombre descriptivo]
Descripción clara de la actividad.
Espacio de respuesta con líneas: _____________

---

### ¿Cómo me ha ido?
Rodea con un círculo: 😄 Muy bien · 🙂 Bien · 😐 Regular · 😟 Necesito ayuda

---

### Para el maestro/a
Breve nota con adaptaciones si hay NEE y criterios de evaluación observables.

REGLAS ABSOLUTAS PARA LA FICHA:
- NUNCA uses recuadros ASCII (┌──┐ │ └──┘) — están prohibidos
- NUNCA uses arte de texto ni caracteres de dibujo
- Para espacios en blanco usa solo líneas de guiones: _______________
- Para tablas simples usa formato Markdown con |
- Las actividades deben ser CONCRETAS y realizables en papel
- Lenguaje adaptado al nivel del curso (más simple para cursos bajos)
- Completa las 4 actividades y la autoevaluación SIEMPRE
- Si hay NEE, añade una nota de adaptación al final de cada actividad relevante
- Al terminar escribe exactamente:
---
✅ Documento completo generado por AulaIA`;

  const prompt = promptOverride || (tipoResultado === "ficha" ? PROMPT_FICHA : `Eres un especialista en educación especial, pedagogía inclusiva y diseño curricular con más de 15 años de experiencia en centros ordinarios españoles. Conoces a fondo la LOMLOE.

${contextoAula}
${instrucciones}

FORMATO:
- Títulos con # ## ###
- Listas con -
- Negrita con **texto**
- NUNCA uses <br>
- NUNCA uses recuadros ASCII (┌──┐ │ └──┘)
- Tablas en Markdown con |
- TODO en ${idiomaLabel}
- Nomenclatura oficial LOMLOE siempre

Genera el documento completo ahora, sección por sección, sin saltarte ninguna.
Al terminar TODAS las secciones escribe exactamente en una línea separada:
---
✅ Documento completo generado por AulaIA`);

  // ── MODELO DEL COLEGIO (acta / informe) ADJUNTO ─────────────────────────
  // El modelo se descarga de Supabase con la clave de servicio, pero solo si
  // pertenece a la docente que lo pide (se comprueba su sesión).
  let adjuntos = [];
  if (plantillaId && supabaseUrl && supabaseKey && accessToken) {
    try {
      const h = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` } });
      const usuario = userRes.ok ? await userRes.json() : null;
      const plRes = await fetch(`${supabaseUrl}/rest/v1/plantillas?id=eq.${encodeURIComponent(plantillaId)}&select=*`, { headers: h });
      const pl = plRes.ok ? (await plRes.json())[0] : null;
      if (usuario?.id && pl && pl.user_id === usuario.id) {
        const instruccion = `MODELO OFICIAL DEL CENTRO ("${pl.nombre}"): reproduce EXACTAMENTE sus apartados, su orden, sus títulos y sus tablas, y rellénalos con la información indicada. No añadas apartados que el modelo no tenga. Si un dato no está disponible, deja la línea preparada con _______________.`;
        if (pl.texto) {
          adjuntos.push({ type: "text", text: `${instruccion}\n\nCONTENIDO DEL MODELO:\n${pl.texto.slice(0, 60000)}` });
        } else if (pl.archivo_path) {
          const fRes = await fetch(`${supabaseUrl}/storage/v1/object/modelos/${pl.archivo_path.split("/").map(encodeURIComponent).join("/")}`, { headers: h });
          if (fRes.ok) {
            const bytes = new Uint8Array(await fRes.arrayBuffer());
            let bin = "";
            for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
            const data = btoa(bin);
            const mime = pl.mime || "application/pdf";
            adjuntos.push(mime.startsWith("image/")
              ? { type: "image", source: { type: "base64", media_type: mime, data } }
              : { type: "document", source: { type: "base64", media_type: "application/pdf", data } });
            adjuntos.push({ type: "text", text: instruccion });
          }
        }
      }
    } catch {}
  }

  // ── ESPECIALISTA DEL EQUIPO DOCENTE (versión fusionada) ────────────────────
  // Sus instrucciones base (sin datos personales) se completan aquí, en el
  // servidor, con el perfil de quien hace el encargo y el grupo elegido.
  // Aporta el CONTENIDO; las reglas de formato de AulaIA se mantienen debajo.
  let capaEspecialista = "", especialistaUsado = "";
  if (!continuarDesde && (especialistaId || tipoResultado)) {
    try {
      const h = hS;
      const usuario = usuarioActual;
      if (usuario?.id) {
        const perfil = perfilActual;
        const filtro = especialistaId ? `id=eq.${encodeURIComponent(especialistaId)}` : `tipos=cs.${encodeURIComponent("{" + tipoResultado + "}")}`;
        const alcance = perfil.rol === "admin" ? "" : "&alcance=eq.todas";
        const eRes = await fetch(`${supabaseUrl}/rest/v1/especialistas?${filtro}&activo=eq.true${alcance}&order=orden&limit=1&select=id,nombre,instrucciones`, { headers: h });
        const esp = eRes.ok ? (await eRes.json())[0] : null;
        if (esp?.instrucciones) {
          const huecos = {
            docente: perfil.nombre || "el/la docente",
            centro: perfil.centro || "su centro",
            comunidad: perfil.comunidad || comunidad || "su comunidad autónoma",
            etapa: perfil.etapa || [etapa, curso].filter(Boolean).join(" ") || "su etapa",
            areas: perfil.areas || area || "las de su horario",
            grupo: (grupoTexto || "").slice(0, 3000) || "(no se ha elegido grupo para este encargo)",
          };
          capaEspecialista = esp.instrucciones.replace(/\{(docente|centro|comunidad|etapa|areas|grupo)\}/g, (_, k) => huecos[k]);
          especialistaUsado = esp.nombre;
        }
      }
    } catch {}
  }

  // ── LLAMADA A CLAUDE ──────────────────────────────────────────────────────
  // Contexto real del grupo y del alumno (si el encargo se hace desde una clase o una ficha)
  const promptFinal = contextoEncargo && String(contextoEncargo).trim()
    ? `${prompt}\n\n════════════\nCONTEXTO REAL DEL AULA (tenlo en cuenta para adaptar TODO el documento; no inventes nombres):\n${String(contextoEncargo).slice(0, 4000)}`
    : prompt;
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      stream: true,
      system: `${capaEspecialista ? `${capaEspecialista}\n\n════════════\nREGLAS DE FORMATO DE AULAIA (se aplican siempre, también a ti):\n\n` : ""}Eres un especialista en educación especial, pedagogía inclusiva y diseño curricular. Experto en LOMLOE. REGLAS ABSOLUTAS:

1. IDIOMA: TODO en ${idiomaLabel}. Sin excepción.

2. NOMENCLATURA LOMLOE:
   - "Situación de Aprendizaje" (nunca "unidad didáctica")
   - "Competencias específicas" (nunca "objetivos específicos")
   - "Saberes básicos" (nunca "contenidos")
   - "Criterios de evaluación" vinculados a competencias
   - "Descriptores operativos del Perfil de salida"
   - "Competencias clave": CCL, CP, STEM, CD, CPSAA, CC, CE, CCEC
   - "DUA" para Diseño Universal para el Aprendizaje

3. PALABRAS COMPLETAS: JAMÁS cortes una palabra a mitad. SIEMPRE escribe las palabras completas y correctamente escritas. Esto es absolutamente innegociable. Presta especial atención a la PRIMERA palabra de cada sección o título — escríbela siempre completa antes de continuar.

4. FRASES COMPLETAS: Cada frase tiene sujeto + verbo + complemento. NUNCA a medias.

5. PARÉNTESIS: Si abres ( SIEMPRE ciérralo antes del punto final.

6. SECCIONES COMPLETAS: Completa CADA sección antes de pasar a la siguiente.

7. RITMO CONSTANTE: Las últimas secciones tienen la misma calidad que las primeras.

8. FORMATO:
   - ## secciones, ### subsecciones
   - **texto** para negrita — SIEMPRE cierra **
   - NUNCA <br>
   - NUNCA ### sin texto en la misma línea
   - Tablas Markdown con | — texto plano en cada celda
   - NUNCA uses recuadros ASCII (┌──┐ │ └──┘ ─) — están completamente prohibidos
   - Para espacios en blanco usa: _______________

9. FIRMA FINAL OBLIGATORIA: Al terminar TODAS las secciones escribe:
---
✅ Documento completo generado por AulaIA

Si no puedes terminar, escribe antes de cortar:
---
⚠️ Documento incompleto — faltan las siguientes secciones: [lista las secciones]`,
      messages: [{ role:"user", content: adjuntos.length ? [...adjuntos, { type: "text", text: promptFinal }] : promptFinal }],
    }),
  });

  if (!anthropicRes.ok) return new Response(JSON.stringify({ error:"Error API" }), { status: 502 });

  return new Response(contarTokens(anthropicRes.body), {
    headers: {
      "Content-Type":"text/event-stream",
      "Cache-Control":"no-cache",
      "Access-Control-Allow-Origin":"*",
      "x-curriculo-usado": curriculoUsado ? "true" : "false",
      "x-especialista": encodeURIComponent(especialistaUsado),
    },
  });
}
