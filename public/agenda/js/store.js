/* ==========================================================================
   AulaAI - Store & Local Storage Management
   ========================================================================== */

const STORAGE_KEY = 'aulaai_agenda_db_v1';

// Catalog of default Subjects with styles & icons
const DEFAULT_SUBJECTS = {
  MATES: { id: 'MATES', name: 'Matemáticas', colorClass: 'subj-mates', icon: 'fa-calculator' },
  LENGUA: { id: 'LENGUA', name: 'Lengua Castellana', colorClass: 'subj-lengua', icon: 'fa-book-open' },
  CIENCIAS: { id: 'CIENCIAS', name: 'Ciencias Naturales', colorClass: 'subj-ciencias', icon: 'fa-flask' },
  SOCIALES: { id: 'SOCIALES', name: 'Ciencias Sociales', colorClass: 'subj-sociales', icon: 'fa-earth-europe' },
  INGLES: { id: 'INGLES', name: 'Inglés', colorClass: 'subj-ingles', icon: 'fa-language' },
  EF: { id: 'EF', name: 'Educación Física', colorClass: 'subj-ef', icon: 'fa-running' },
  MUSICA: { id: 'MUSICA', name: 'Música', colorClass: 'subj-musica', icon: 'fa-music' },
  ARTISTICA: { id: 'ARTISTICA', name: 'Educación Artística', colorClass: 'subj-artistica', icon: 'fa-palette' },
  RELIGION: { id: 'RELIGION', name: 'Religión', colorClass: 'subj-religion', icon: 'fa-dove' },
  REFUERZO: { id: 'REFUERZO', name: 'Refuerzo', colorClass: 'subj-refuerzo', icon: 'fa-hands-holding-circle' },
  TUTORIA: { id: 'TUTORIA', name: 'Tutoría / Valores', colorClass: 'subj-tutoria', icon: 'fa-comments' },
  RECREO: { id: 'RECREO', name: 'Recreo / Descanso', colorClass: 'subj-recreo', icon: 'fa-coffee' }
};

// Default Schedule Slots (6 periods + Recreo) — estructura, no son datos inventados de alumnado
const DEFAULT_SLOTS = [
  { id: 'S1', label: '1ª Hora', time: '09:00 - 09:55' },
  { id: 'S2', label: '2ª Hora', time: '09:55 - 10:50' },
  { id: 'REC', label: 'Recreo', time: '10:50 - 11:20', isBreak: true },
  { id: 'S3', label: '3ª Hora', time: '11:20 - 12:15' },
  { id: 'S4', label: '4ª Hora', time: '12:15 - 13:10' },
  { id: 'S5', label: '5ª Hora', time: '13:10 - 14:05' }
];

// Days of the week
const DAYS = [
  { id: 'LUN', name: 'Lunes', short: 'Lun' },
  { id: 'MAR', name: 'Martes', short: 'Mar' },
  { id: 'MIE', name: 'Miércoles', short: 'Mié' },
  { id: 'JUE', name: 'Jueves', short: 'Jue' },
  { id: 'VIE', name: 'Viernes', short: 'Vie' }
];

// Distribuciones de agrupamiento disponibles para el Plano de Aula
const SEATING_LAYOUTS = {
  individual: { label: 'Individual', size: 1 },
  parejas: { label: 'Parejas', size: 2 },
  trios: { label: 'Tríos', size: 3 },
  grupos4: { label: 'Grupos de 4', size: 4 },
  grupos5: { label: 'Grupos de 5', size: 5 },
  grupos6: { label: 'Grupos de 6', size: 6 }
};

// Biblioteca de comunicaciones a familias: empieza con 5 modelos de ejemplo
// reutilizables (no son datos de alumnado, son plantillas de texto), y a
// partir de aquí se pueden editar, borrar o añadir nuevas — todas persisten.
const DEFAULT_MESSAGE_TEMPLATES = [
  {
    id: 'TPL-1',
    category: 'Tutoría & Reuniones',
    title: 'Convocatoria de Tutoría Presencial',
    text: 'Estimada familia de {nombre_alumno}:\n\nMe pongo en contacto con ustedes para convocarles a una reunión de tutoría el próximo [Fecha/Hora] en el aula de [Grupo]. Nos gustaría tratar la evolución académica y adaptación en este trimestre.\n\nLes ruego me confirmen asistencia.\n\nUn cordial saludo,\n[Nombre del Tutor/a]'
  },
  {
    id: 'TPL-2',
    category: 'Seguimiento Académico',
    title: 'Aviso por Tareas Pendientes',
    text: 'Estimada familia:\n\nLes informo de que {nombre_alumno} no ha entregado la tarea asignada para hoy en la asignatura de {asignatura}. Para evitar acumular retrasos en la materia, es importante completar los ejercicios en casa antes de la siguiente clase.\n\nGracias por su colaboración.\n\nAtentamente,\n[Profesor/a]'
  },
  {
    id: 'TPL-3',
    category: 'Reconocimiento y Felicitación',
    title: 'Felicitación por Excelente Progreso',
    text: 'Estimada familia de {nombre_alumno}:\n\nQuería escribirles brevemente para felicitarles por la magnífica actitud, esfuerzo y excelente progreso que está demostrando {nombre_alumno} esta semana en el aula. ¡Es una alegría contar con su participación!\n\n¡Enhorabuena!\n\nUn saludo muy afectuoso,'
  },
  {
    id: 'TPL-4',
    category: 'Exámenes y Evaluación',
    title: 'Recordatorio de Prueba Evaluativa',
    text: 'Estimada familia:\n\nLes recordamos que el próximo [Día de la semana] realizaremos la prueba evaluativa de la Unidad [Número] de {asignatura}. En el cuaderno y en el aula virtual disponen de la guía de repaso recomendada.\n\nSaludos cordiales,'
  },
  {
    id: 'TPL-5',
    category: 'Atención a la Diversidad / NEAE',
    title: 'Seguimiento de Adaptaciones NEAE',
    text: 'Estimada familia:\n\nLes escribo para informarles de que las pautas de adaptación metodológica de {nombre_alumno} están dando resultados muy positivos. Hemos ajustado los tiempos en las actividades escritas y su confianza en el aula ha aumentado notablemente.\n\nSeguimos en contacto constante.\n\nUn saludo,'
  }
];

// Estado inicial: SIN datos de ejemplo de personas. Todo empieza vacío, como un formulario en blanco.
const DEFAULT_STATE = {
  startDate: '2026-09-07',
  currentWeekIndex: 0,
  currentRole: 'docente',
  zoomScale: 1.0,
  gridMode: 'normal',
  darkMode: false,
  selectedClassId: null,
  classes: [],
  // Las clases se guardan POR SEMANA del curso: weeklyLessons[0] = semana 1, weeklyLessons[1] = semana 2...
  weeklyLessons: {},
  // Horario FIJO: qué asignatura toca en cada casilla (día+hora), igual todas las
  // semanas del curso — independiente del contenido que se planifique cada semana.
  schedule: {},
  students: [],
  // Horas del horario (1ª, 2ª, Recreo...) — editables, cada docente tiene las suyas
  slots: JSON.parse(JSON.stringify(DEFAULT_SLOTS)),
  // Asientos guardados por cada clase/grupo: { [classId]: { layout: 'individual', seats: [{id, studentId}] } }
  seatingByClass: {},
  holidays: [],
  annualGoals: [],
  schoolContacts: [],
  absences: [],
  messageTemplates: DEFAULT_MESSAGE_TEMPLATES,
  // Días concretos que hay que dejar preparados para sustitución, y notas
  // generales para quien cubra la ausencia (llaves, incidencias, etc.)
  substitutionRange: { start: null, end: null },
  substitutionNotes: '',
  // Listas de entrega por grupo: autorizaciones, dinero de salidas, tareas...
  // { id, groupLabel, title, hasGrade, entries: { [studentId]: { delivered, grade } } }
  checklists: [],
  // Documentos subidos (autorizaciones en PDF o foto). El archivo en sí vive
  // en Supabase Storage; aquí solo se guarda la referencia (ruta, título...).
  documents: []
};

class AppStore {
  constructor() {
    // Arranca con el estado por defecto; los datos reales llegan tras el
    // login, con loadFromCloud() (ver authGate.js).
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.userId = null;
  }

  // Se llama justo después de iniciar sesión, con el id del usuario, para
  // traer sus datos guardados en Supabase (o arrancar en blanco si es la
  // primera vez que entra).
  async loadFromCloud(userId) {
    this.userId = userId;
    try {
      const { data, error } = await window.sb
        .from('agenda_data')
        .select('data, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      // Fecha del último guardado en la nube (para detectar cambios hechos desde AulaIA)
      this.remoteUpdatedAt = (data && data.updated_at) || null;
      this.rememberBase((data && data.data) || {});

      const parsed = (data && data.data) || {};
      // Migración desde versiones antiguas: "lessons" plano -> semana 0
      if (parsed.lessons && !parsed.weeklyLessons) {
        parsed.weeklyLessons = { 0: parsed.lessons };
        delete parsed.lessons;
      }
      this.state = {
        ...DEFAULT_STATE,
        ...parsed,
        weeklyLessons: parsed.weeklyLessons || DEFAULT_STATE.weeklyLessons,
        seatingByClass: parsed.seatingByClass || DEFAULT_STATE.seatingByClass,
        messageTemplates: parsed.messageTemplates || DEFAULT_STATE.messageTemplates,
        slots: parsed.slots && parsed.slots.length ? parsed.slots : DEFAULT_STATE.slots,
        schedule: parsed.schedule || {},
      };

      // Migración: el horario fijo antes solo guardaba el id de la asignatura
      // (un texto suelto); ahora guarda también el grupo/clase, así que lo
      // convertimos a { subjectId, group } sin perder lo que ya había.
      let migrated = false;
      Object.entries(this.state.schedule).forEach(([key, entry]) => {
        if (typeof entry === 'string') {
          this.state.schedule[key] = { subjectId: entry, group: '' };
          migrated = true;
        }
      });

      // Migración: si ya habías programado clases antes de separar el horario
      // fijo del contenido semanal, recuperamos la asignatura y el grupo de
      // cada casilla a partir de lo que ya tuvieras escrito (sin perder nada).
      Object.values(this.state.weeklyLessons).forEach(weekLessons => {
        Object.entries(weekLessons).forEach(([key, lesson]) => {
          if (!lesson) return;
          if (!this.state.schedule[key] && lesson.subjectId) {
            this.state.schedule[key] = { subjectId: lesson.subjectId, group: lesson.group || '' };
            migrated = true;
          } else if (this.state.schedule[key] && !this.state.schedule[key].group && lesson.group) {
            this.state.schedule[key].group = lesson.group;
            migrated = true;
          }
        });
      });

      // Importante: si la migración recuperó algo, lo guardamos YA en la nube.
      // Si no lo hiciéramos, quedaría solo en memoria y se perdería en cuanto
      // recargaras la página o entraras desde otro dispositivo.
      if (migrated) {
        await this.saveState();
      }
    } catch (e) {
      console.error('Error cargando datos de Supabase:', e);
      this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  saveState() {
    if (!this.userId || !window.sb) return Promise.resolve();
    const userId = this.userId;
    this._pending = (this._pending || 0) + 1;

    // Encadenamos los guardados en fila (uno espera a que termine el
    // anterior) para que nunca se crucen y un guardado más antiguo pise
    // por accidente a uno más reciente que haya terminado antes.
    this._saveQueue = (this._saveQueue || Promise.resolve()).then(async () => {
      try {
        // Si AulaIA ha guardado algo mientras tanto, lo incorporamos antes de
        // guardar, para no borrar alumnado, clases o sesiones que vengan de allí.
        await this.mergeRemoteIfNewer();
        const snapshot = JSON.parse(JSON.stringify(this.state));
        const now = new Date().toISOString();
        const { error } = await window.sb
          .from('agenda_data')
          .upsert({ user_id: userId, data: snapshot, updated_at: now }, { onConflict: 'user_id' });
        if (error) console.error('Error guardando en Supabase:', error);
        else { this.remoteUpdatedAt = now; this.rememberBase(snapshot); }
      } finally {
        this._pending--;
      }
    });
    return this._saveQueue;
  }

  // ── Conexión con AulaIA ────────────────────────────────────────────────
  // Copia de cómo estaba cada alumno/a la última vez que se sincronizó
  rememberBase(st) {
    this._baseStudents = {};
    ((st && st.students) || []).forEach(s => {
      this._baseStudents[s.id] = { name: s.name, group: s.group, neae: s.neae, neaeType: s.neaeType };
    });
  }

  async fetchRemote() {
    const { data, error } = await window.sb
      .from('agenda_data').select('data, updated_at').eq('user_id', this.userId).maybeSingle();
    if (error) throw error;
    return data;
  }

  // Trae a esta pestaña lo que AulaIA haya añadido (alumnado, clases y
  // sesiones con documento de AulaIA) sin tocar lo que se ha hecho aquí.
  async mergeRemoteIfNewer() {
    if (!this.userId || !window.sb) return;
    let remote;
    try { remote = await this.fetchRemote(); } catch (e) { return; }
    if (!remote || !remote.updated_at) return;
    if (this.remoteUpdatedAt && new Date(remote.updated_at).getTime() <= new Date(this.remoteUpdatedAt).getTime()) return;
    const r = remote.data || {};
    const st = this.state;
    st.students = st.students || [];
    (r.students || []).forEach(rs => {
      const local = st.students.find(s => s.id === rs.id);
      if (!local && String(rs.id).startsWith('STU-AULAIA-')) st.students.push(rs);
      else if (local) {
        // Cambios hechos desde AulaIA en nombre, grupo o NEAE: solo se aplican
        // si aquí no se ha tocado ese dato desde que se cargó.
        const base = (this._baseStudents || {})[rs.id] || {};
        ['name', 'group', 'neae', 'neaeType'].forEach(k => {
          if (rs[k] !== undefined && rs[k] !== base[k] && local[k] === base[k]) local[k] = rs[k];
        });
      }
    });
    st.classes = st.classes || [];
    (r.classes || []).forEach(rc => {
      if (!st.classes.some(c => c.id === rc.id) && String(rc.id).startsWith('CLASS-AULAIA-')) st.classes.push(rc);
    });
    Object.entries(r.weeklyLessons || {}).forEach(([w, lessons]) => {
      Object.entries(lessons || {}).forEach(([key, rl]) => {
        if (!rl || !rl.aulaiaDocId) return;
        st.weeklyLessons[w] = st.weeklyLessons[w] || {};
        const local = st.weeklyLessons[w][key] || { id: key, day: rl.day, slot: rl.slot };
        st.weeklyLessons[w][key] = { ...local, title: rl.title, aulaiaDocId: rl.aulaiaDocId, aulaiaUrl: rl.aulaiaUrl };
      });
    });
    this.remoteUpdatedAt = remote.updated_at;
  }

  // Al volver a esta pestaña (o cada minuto), recarga si AulaIA cambió algo
  async refreshIfRemoteChanged() {
    if (!this.userId || !window.sb || this._pending > 0) return false;
    let remote;
    try { remote = await this.fetchRemote(); } catch (e) { return false; }
    if (!remote || !remote.updated_at) return false;
    if (this.remoteUpdatedAt && new Date(remote.updated_at).getTime() <= new Date(this.remoteUpdatedAt).getTime()) return false;
    const keep = { currentWeekIndex: this.state.currentWeekIndex, selectedClassId: this.state.selectedClassId };
    await this.loadFromCloud(this.userId);
    Object.assign(this.state, keep);
    return true;
  }

  // Devuelve (y crea si hace falta) el objeto de clases de una semana concreta.
  getWeekLessons(weekIndex) {
    const wi = weekIndex ?? (this.state.currentWeekIndex || 0);
    if (!this.state.weeklyLessons[wi]) {
      this.state.weeklyLessons[wi] = {};
    }
    return this.state.weeklyLessons[wi];
  }

  getLesson(dayId, slotId, weekIndex) {
    const key = `${dayId}_${slotId}`;
    return this.getWeekLessons(weekIndex)[key] || null;
  }

  // Asignatura + grupo fijos de una casilla (igual todas las semanas del curso)
  getScheduleEntry(dayId, slotId) {
    return this.state.schedule[`${dayId}_${slotId}`] || null;
  }

  // Solo la asignatura (útil para el Ripple Shift, que agrupa por asignatura)
  getScheduleSubject(dayId, slotId) {
    const entry = this.getScheduleEntry(dayId, slotId);
    return entry ? entry.subjectId : null;
  }

  // Resuelve qué toca REALMENTE en una casilla esta semana: normalmente es
  // la asignatura fija del horario, PERO si esa semana en concreto se ha
  // arrastrado/intercambiado con otra casilla (cambio puntual, no permanente),
  // aquí se refleja ese intercambio en su lugar.
  getEffectiveSlot(dayId, slotId, weekIndex) {
    const entry = this.getScheduleEntry(dayId, slotId);
    const lesson = this.getLesson(dayId, slotId, weekIndex);
    let subjectId, group;

    if (lesson && Object.prototype.hasOwnProperty.call(lesson, 'subjectOverride')) {
      // Esta semana concreta tiene un intercambio puntual (puede ser "null",
      // que significa "esta hora se quedó vacía porque su asignatura se movió").
      subjectId = lesson.subjectOverride;
      group = lesson.groupOverride || '';
    } else {
      subjectId = entry ? entry.subjectId : null;
      group = entry ? entry.group : '';
    }

    return {
      subjectId,
      group,
      title: (lesson && lesson.title) || '',
      notes: (lesson && lesson.notes) || '',
      targetNEAE: (lesson && lesson.targetNEAE) || '',
      status: (lesson && lesson.status) || 'pending',
      aulaiaUrl: (lesson && lesson.aulaiaUrl) || ''
    };
  }

  setSchedule(dayId, slotId, { subjectId, group }) {
    const key = `${dayId}_${slotId}`;
    if (subjectId) {
      this.state.schedule[key] = { subjectId, group: group || '' };
    } else {
      delete this.state.schedule[key];
    }
    this.saveState();
  }

  updateLesson(dayId, slotId, updateObj, weekIndex) {
    const key = `${dayId}_${slotId}`;
    const weekLessons = this.getWeekLessons(weekIndex);
    if (!weekLessons[key]) {
      weekLessons[key] = { id: key, day: dayId, slot: slotId };
    }
    weekLessons[key] = { ...weekLessons[key], ...updateObj };
    this.saveState();
  }

  // Quita un intercambio puntual (por arrastre) de una casilla en la semana
  // actual, para que vuelva a mostrar la asignatura fija del horario.
  clearWeeklyOverride(dayId, slotId, weekIndex) {
    const key = `${dayId}_${slotId}`;
    const weekLessons = this.getWeekLessons(weekIndex);
    if (weekLessons[key]) {
      delete weekLessons[key].subjectOverride;
      delete weekLessons[key].groupOverride;
    }
    this.saveState();
  }

  toggleGoal(goalId) {
    const goal = this.state.annualGoals.find(g => g.id === goalId);
    if (goal) {
      goal.done = !goal.done;
      this.saveState();
    }
  }
}

window.store = new AppStore();
window.DEFAULT_SUBJECTS = DEFAULT_SUBJECTS;
window.DEFAULT_SLOTS = DEFAULT_SLOTS;
window.DAYS = DAYS;
window.SEATING_LAYOUTS = SEATING_LAYOUTS;
