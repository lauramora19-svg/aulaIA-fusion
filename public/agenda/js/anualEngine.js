/* ==========================================================================
   AulaAI - Anual Engine (Vista Anual, Calendario 12 Meses, Festivos, Objetivos)
   ========================================================================== */

class AnualEngine {
  constructor() {}

  renderAnualView() {
    const container = document.getElementById('anual-view-container');
    if (!container) return;

    const holidays = window.store.state.holidays || [];
    const goals = window.store.state.annualGoals || [];
    const contacts = window.store.state.schoolContacts || [];
    const absences = window.store.state.absences || [];

    const completedGoals = goals.filter(g => g.done).length;
    const progressPercent = Math.round((completedGoals / (goals.length || 1)) * 100);

    // Inicio/Fin de curso calculados a partir de la fecha real configurada
    // (antes eran textos fijos, "7 SEP 2026", que no cambiaban aunque cambiaras la fecha)
    const monthsAbbr = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const courseStart = new Date(window.store.state.startDate + 'T00:00:00');
    // Fin de curso: el que haya puesto la docente; si no, aproximado (~12 meses)
    const finPuesto = !!window.store.state.endDate;
    const courseEnd = finPuesto ? new Date(window.store.state.endDate + 'T00:00:00') : new Date(courseStart);
    if (!finPuesto) courseEnd.setDate(courseEnd.getDate() + 12 * 30 - 8);
    const fmtCourseDate = (d) => `${d.getDate()} ${monthsAbbr[d.getMonth()]} ${d.getFullYear()}`;
    const totalWeeks = Math.max(0, Math.ceil(((courseEnd - courseStart) / 86400000 + 1) / 7));
    const diasLectivos = this.contarDiasLectivos(courseStart, courseEnd, holidays);
    const ed = this.editandoFechas;
    const hEsc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const holidaysOrdenados = holidays.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const fmtFestivo = (h) => {
      const f = (x) => { const d = new Date(x + 'T00:00:00'); return isNaN(d) ? x : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); };
      return h.endDate && h.endDate !== h.date ? `${f(h.date)} → ${f(h.endDate)}` : f(h.date);
    };

    container.innerHTML = `
      <!-- TOP BANNER KPI SUMMARY -->
      <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffffff 100%); border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-sm);">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 style="font-family: var(--font-display); font-size: 1.6rem; color: var(--text-primary);">
              Año Escolar <span style="color: var(--accent-primary);">${courseStart.getFullYear()} - ${courseEnd.getFullYear()}</span>
            </h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">El año completo, de un vistazo</p>
          </div>

          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <div class="stat-card" style="min-width: 140px; padding: 0.85rem 1.1rem;">
              <div>
                <div class="stat-label">Inicio del Curso</div>
                <div style="font-family: var(--font-display); font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">${fmtCourseDate(window.store.state.firstClassDay ? new Date(window.store.state.firstClassDay + 'T00:00:00') : courseStart)}</div>
              </div>
            </div>

            <div class="stat-card" style="min-width: 140px; padding: 0.85rem 1.1rem;">
              <div>
                <div class="stat-label">Fin del Curso${finPuesto ? '' : ' (aprox.)'}</div>
                <div style="font-family: var(--font-display); font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">${fmtCourseDate(courseEnd)}</div>
              </div>
            </div>

            <div class="stat-card" style="min-width: 110px; padding: 0.85rem 1.1rem;">
              <div>
                <div class="stat-label">Semanas</div>
                <div style="font-family: var(--font-display); font-weight: 700; font-size: 1.3rem; color: var(--accent-primary);">${totalWeeks}</div>
              </div>
            </div>

            <div class="stat-card" style="min-width: 110px; padding: 0.85rem 1.1rem;">
              <div>
                <div class="stat-label">Días Lectivos</div>
                <div style="font-family: var(--font-display); font-weight: 700; font-size: 1.3rem; color: #10b981;">${diasLectivos}</div>
              </div>
            </div>
            <button class="btn btn-secondary" style="align-self: center;" onclick="window.anualEngine.toggleEditarFechas()">
              <i class="fa-solid fa-pen"></i> Cambiar fechas del curso
            </button>
          </div>
        </div>
        ${ed ? `
          <div style="margin-top: 1rem; display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label">Primer día de clase</label>
              <input type="date" id="anual-inicio" class="form-input" value="${window.store.state.firstClassDay || window.store.state.startDate}">
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label">Último día de clase</label>
              <input type="date" id="anual-fin" class="form-input" value="${window.store.state.endDate || ''}">
            </div>
            <button class="btn btn-primary" onclick="window.anualEngine.guardarFechas()"><i class="fa-solid fa-check"></i> Guardar fechas</button>
            <button class="btn btn-outline" onclick="window.anualEngine.toggleEditarFechas()">Cancelar</button>
            <p style="flex-basis: 100%; margin: 0; font-size: 0.8rem; color: var(--text-muted);">Las semanas del horario se cuentan desde el lunes de la semana en la que empieza el curso. Tus sesiones ya planificadas no se borran.</p>
          </div>` : ''}
      </div>

      <!-- GRID LAYOUT: CALENDARIO 12 MESES & LATERAL -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;" class="anual-grid-layout">
        
        <!-- COLUMNA IZQUIERDA: CALENDARIO ANUAL DE 12 MESES -->
        <div>
          <div style="background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 1.5rem; box-shadow: var(--shadow-sm); margin-bottom: 1.5rem;">
            <h3 style="font-family: var(--font-display); font-size: 1.25rem; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid fa-calendar-days" style="color: var(--accent-primary);"></i> Calendario Anual (12 Meses)
            </h3>
            
            <div class="months-mini-grid">
              ${this.render12MonthsGrid()}
            </div>
          </div>

          <!-- TABLA CONTACTOS DEL CENTRO Y FECHAS IMPORTANTES -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
            
            <!-- CONTACTOS DEL CENTRO -->
            <div style="background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 1.25rem; box-shadow: var(--shadow-sm);">
              <h4 style="font-family: var(--font-display); font-size: 1.05rem; margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
                <i class="fa-solid fa-address-book" style="color: var(--accent-primary);"></i> Contactos del Centro
              </h4>
              <table style="width: 100%; font-size: 0.84rem; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-align: left;">
                    <th style="padding: 4px 0;">Cargo</th>
                    <th style="padding: 4px 0;">Nombre</th>
                    <th style="padding: 4px 0;">Email</th>
                    <th style="padding: 4px 0; width: 24px;"></th>
                  </tr>
                </thead>
                <tbody>
                  ${contacts.map(c => `
                    <tr style="border-bottom: 1px dashed var(--border-color);">
                      <td style="padding: 6px 4px 6px 0;">
                        <input type="text" value="${c.role}" onchange="window.anualEngine.editContact('${c.id}', 'role', this.value)" style="width: 100%; border: none; background: transparent; font-weight: 600; color: var(--text-primary); font-size: 0.84rem;">
                      </td>
                      <td style="padding: 6px 4px;">
                        <input type="text" value="${c.name}" onchange="window.anualEngine.editContact('${c.id}', 'name', this.value)" style="width: 100%; border: none; background: transparent; color: var(--text-secondary); font-size: 0.84rem;">
                      </td>
                      <td style="padding: 6px 4px;">
                        <input type="email" value="${c.email}" onchange="window.anualEngine.editContact('${c.id}', 'email', this.value)" style="width: 100%; border: none; background: transparent; color: var(--accent-primary); font-size: 0.78rem;">
                      </td>
                      <td style="padding: 6px 0 6px 4px;">
                        <button onclick="window.anualEngine.deleteContact('${c.id}')" style="border: none; background: none; color: var(--text-muted); cursor: pointer;" title="Eliminar contacto">
                          <i class="fa-solid fa-xmark"></i>
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <button onclick="window.anualEngine.addContact()" style="margin-top: 0.6rem; border: 1px dashed var(--border-color); background: none; color: var(--accent-primary); font-size: 0.8rem; font-weight: 600; padding: 6px 10px; border-radius: var(--radius-sm); cursor: pointer; width: 100%;">
                <i class="fa-solid fa-plus"></i> Añadir contacto
              </button>
            </div>

            <!-- SUSTITUCIONES Y AUSENCIAS -->
            <div style="background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 1.25rem; box-shadow: var(--shadow-sm);">
              <h4 style="font-family: var(--font-display); font-size: 1.05rem; margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
                <i class="fa-solid fa-user-clock" style="color: var(--accent-primary);"></i> Sustituciones y Ausencias
              </h4>
              <table style="width: 100%; font-size: 0.84rem; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-align: left;">
                    <th style="padding: 4px 0;">Fecha</th>
                    <th style="padding: 4px 0;">Tipo</th>
                    <th style="padding: 4px 0;">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${absences.map(a => `
                    <tr style="border-bottom: 1px dashed var(--border-color);">
                      <td style="padding: 8px 0; font-weight: 600; color: var(--text-primary);">${a.date}</td>
                      <td style="padding: 8px 0;"><span style="background: var(--accent-light); color: var(--accent-primary); padding: 2px 6px; border-radius: var(--radius-sm); font-size: 0.72rem; font-weight: 700;">${a.type}</span></td>
                      <td style="padding: 8px 0; color: var(--text-secondary); font-size: 0.78rem;">${a.notes}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

          </div>
        </div>

        <!-- COLUMNA DERECHA: VACACIONES Y OBJETIVOS -->
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- VACACIONES Y FESTIVOS -->
          <div style="background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 1.25rem; box-shadow: var(--shadow-sm);">
            <h4 style="font-family: var(--font-display); font-size: 1.1rem; margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
              <i class="fa-solid fa-umbrella-beach" style="color: #f59e0b;"></i> Vacaciones y Festivos
            </h4>
            <div style="display: flex; flex-direction: column; gap: 0.65rem;">
              ${holidaysOrdenados.length === 0 ? `<p style="font-size: 0.82rem; color: var(--text-muted);">Aún no hay festivos ni vacaciones.</p>` : ''}
              ${holidaysOrdenados.map(h => `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; background: var(--bg-tertiary); padding: 0.65rem 0.85rem; border-radius: var(--radius-md);">
                  <div style="min-width: 0;">
                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary);">${hEsc(h.name)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${fmtFestivo(h)}</div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0;">
                    <span style="font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: var(--radius-full); ${h.type === 'Festivo' ? 'background: #d1fae5; color: #047857;' : 'background: #ffedd5; color: #c2410c;'}">
                      ${hEsc(h.type)}
                    </span>
                    <button onclick="window.anualEngine.borrarFestivo('${h.id}')" style="border: none; background: none; color: var(--text-muted); cursor: pointer;" title="Quitar">✕
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
            <div style="margin-top: 0.85rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
              <input id="festivo-nombre" class="form-input" placeholder="Nombre (p. ej. Navidad)" style="grid-column: 1 / -1;">
              <div><label class="form-label" style="font-size: 0.72rem;">Desde</label><input type="date" id="festivo-desde" class="form-input"></div>
              <div><label class="form-label" style="font-size: 0.72rem;">Hasta (opcional)</label><input type="date" id="festivo-hasta" class="form-input"></div>
              <select id="festivo-tipo" class="form-input">
                <option value="Festivo">Festivo</option>
                <option value="Vacaciones">Vacaciones</option>
                <option value="No lectivo">No lectivo</option>
              </select>
              <button onclick="window.anualEngine.anadirFestivo()" style="border: 1px dashed var(--border-color); background: none; color: var(--accent-primary); font-size: 0.8rem; font-weight: 600; padding: 6px 10px; border-radius: var(--radius-sm); cursor: pointer;">
                <i class="fa-solid fa-plus"></i> Añadir
              </button>
            </div>
          </div>

          <!-- OBJETIVOS DEL AÑO -->
          <div style="background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 1.25rem; box-shadow: var(--shadow-sm);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
              <h4 style="font-family: var(--font-display); font-size: 1.1rem; display: flex; align-items: center; gap: 0.4rem;">
                <i class="fa-solid fa-bullseye" style="color: var(--accent-primary);"></i> Objetivos del Año
              </h4>
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent-primary);">${completedGoals}/${goals.length} (${progressPercent}%)</span>
            </div>

            <!-- BARRA DE PROGRESO -->
            <div style="height: 8px; background: var(--bg-tertiary); border-radius: var(--radius-full); overflow: hidden; margin-bottom: 1rem;">
              <div style="height: 100%; width: ${progressPercent}%; background: linear-gradient(90deg, #f97316, #fb923c); transition: width 0.4s ease;"></div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${goals.map((g, idx) => `
                <div style="display: flex; align-items: center; gap: 0.55rem; font-size: 0.85rem; color: var(--text-primary);">
                  <span onclick="window.anualEngine.toggleGoal('${g.id}')" style="cursor: pointer; flex-shrink: 0; width: 22px; height: 22px; border-radius: var(--radius-sm); background: ${g.done ? 'var(--accent-primary)' : 'var(--bg-tertiary)'}; color: ${g.done ? 'white' : 'var(--text-muted)'}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; transition: all 0.2s;" title="Marcar como completado / pendiente">
                    ${idx + 1}
                  </span>
                  <input type="text" value="${g.text}" onchange="window.anualEngine.editGoalText('${g.id}', this.value)" style="flex: 1; border: none; background: transparent; font-size: 0.85rem; color: var(--text-primary); ${g.done ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">
                  <button onclick="window.anualEngine.deleteGoal('${g.id}')" style="border: none; background: none; color: var(--text-muted); cursor: pointer; flex-shrink: 0;" title="Eliminar objetivo">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              `).join('')}
            </div>
            <button onclick="window.anualEngine.addGoal()" style="margin-top: 0.75rem; border: 1px dashed var(--border-color); background: none; color: var(--accent-primary); font-size: 0.8rem; font-weight: 600; padding: 6px 10px; border-radius: var(--radius-sm); cursor: pointer; width: 100%;">
              <i class="fa-solid fa-plus"></i> Añadir objetivo
            </button>
          </div>

        </div>

      </div>
    `;
  }

  // Render 12 months mini calendars, empezando por el mes real de inicio de curso
  // (p.ej. si el curso empieza en septiembre, el orden es Sep→Ago, no Ene→Dic)
  render12MonthsGrid() {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const start = new Date(window.store.state.startDate);
    const startMonth = start.getMonth(); // 0-11
    const startYear = start.getFullYear();

    let html = '';
    for (let i = 0; i < 12; i++) {
      const monthIndex = (startMonth + i) % 12;
      const year = startYear + Math.floor((startMonth + i) / 12);
      html += this.renderMonthCard(monthNames[monthIndex], monthIndex, year);
    }
    return html;
  }

  // Genera una tarjeta de mes con los días reales de ese mes/año (no una plantilla fija)
  renderMonthCard(monthName, monthIndex, year) {
    const firstOfMonth = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    // getDay(): 0=domingo..6=sábado → lo convertimos a que la semana empiece en lunes (0=lunes..6=domingo)
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

    let cells = '';
    for (let b = 0; b < leadingBlanks; b++) {
      cells += `<span></span>`;
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const weekday = (leadingBlanks + day - 1) % 7; // 5=sábado, 6=domingo
      const isWeekend = weekday === 5 || weekday === 6;
      const fiesta = this.festivoDe(new Date(year, monthIndex, day));
      const estilo = fiesta && !isWeekend ? (fiesta.type === 'Festivo' ? 'background:#d1fae5;color:#047857;border-radius:4px;font-weight:700;' : 'background:#ffedd5;color:#c2410c;border-radius:4px;font-weight:700;') : '';
      cells += `<span class="${isWeekend ? 'weekend' : ''}" style="${estilo}"${fiesta ? ` title="${String(fiesta.name).replace(/"/g, '&quot;')}"` : ''}>${day}</span>`;
    }

    return `
      <div class="month-card" onclick="window.anualEngine.jumpToMonth(${year}, ${monthIndex})">
        <div class="month-title">${monthName} ${year}</div>
        <div class="month-days-grid">
          <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
          ${cells}
        </div>
      </div>
    `;
  }

  // ── Fechas del curso y festivos (añadido en la versión fusionada) ──────────
  toggleEditarFechas() {
    this.editandoFechas = !this.editandoFechas;
    this.renderAnualView();
  }

  guardarFechas() {
    const ini = document.getElementById('anual-inicio')?.value;
    const fin = document.getElementById('anual-fin')?.value || '';
    if (!ini) { window.app.showToast('Pon el primer día de clase.', 'warning'); return; }
    if (fin && fin <= ini) { window.app.showToast('El último día tiene que ser después del primero.', 'warning'); return; }
    // El horario cuenta las semanas desde un LUNES: se usa el lunes de esa semana
    const d = new Date(ini + 'T00:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const lunes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    window.store.state.endDate = fin || null;
    window.store.state.firstClassDay = ini;
    window.dateEngine.setCourseStartDate(lunes);
    this.editandoFechas = false;
    this.renderAnualView();
    try { window.app.refreshAll(); window.app.updateDateMotorUI && window.app.updateDateMotorUI(); } catch (e) { console.error(e); }
    window.app.showToast('Fechas del curso guardadas.', 'success');
  }

  anadirFestivo() {
    const nombre = (document.getElementById('festivo-nombre')?.value || '').trim();
    const desde = document.getElementById('festivo-desde')?.value;
    const hasta = document.getElementById('festivo-hasta')?.value || '';
    const tipo = document.getElementById('festivo-tipo')?.value || 'Festivo';
    if (!nombre || !desde) { window.app.showToast('Pon el nombre y la fecha.', 'warning'); return; }
    if (hasta && hasta < desde) { window.app.showToast('«Hasta» no puede ser antes de «Desde».', 'warning'); return; }
    window.store.state.holidays = window.store.state.holidays || [];
    window.store.state.holidays.push({ id: 'HOL-' + Date.now(), name: nombre, date: desde, endDate: hasta || null, type: tipo });
    window.store.saveState();
    this.renderAnualView();
  }

  borrarFestivo(id) {
    const h = (window.store.state.holidays || []).find(x => x.id === id);
    if (!h || !confirm(`¿Quitar «${h.name}»?`)) return;
    window.store.state.holidays = window.store.state.holidays.filter(x => x.id !== id);
    window.store.saveState();
    this.renderAnualView();
  }

  // ¿Ese día es festivo o vacaciones? Devuelve el festivo o null
  festivoDe(fecha) {
    const t = new Date(fecha); t.setHours(0, 0, 0, 0);
    return (window.store.state.holidays || []).find(h => {
      const a = new Date(h.date + 'T00:00:00'); const b = new Date((h.endDate || h.date) + 'T00:00:00');
      return !isNaN(a) && t >= a && t <= b;
    }) || null;
  }

  // Días de lunes a viernes entre dos fechas, sin contar festivos ni vacaciones
  contarDiasLectivos(inicio, fin, festivos) {
    const libres = new Set();
    (festivos || []).forEach(h => {
      const a = new Date(h.date + 'T00:00:00'); const b = new Date((h.endDate || h.date) + 'T00:00:00');
      if (isNaN(a) || isNaN(b)) return;
      for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) libres.add(d.toDateString());
    });
    const primero = window.store.state.firstClassDay ? new Date(window.store.state.firstClassDay + 'T00:00:00') : inicio;
    let n = 0;
    for (const d = new Date(primero); d <= fin; d.setDate(d.getDate() + 1)) {
      const dia = d.getDay();
      if (dia !== 0 && dia !== 6 && !libres.has(d.toDateString())) n++;
    }
    return n;
  }

  toggleGoal(goalId) {
    window.store.toggleGoal(goalId);
    this.renderAnualView();
  }

  editGoalText(goalId, text) {
    const goal = window.store.state.annualGoals.find(g => g.id === goalId);
    if (goal) {
      goal.text = text.trim();
      window.store.saveState();
    }
  }

  addGoal() {
    window.store.state.annualGoals.push({
      id: `G-${Date.now()}`,
      text: 'Nuevo objetivo (edítalo aquí)',
      done: false
    });
    window.store.saveState();
    this.renderAnualView();
  }

  deleteGoal(goalId) {
    window.store.state.annualGoals = window.store.state.annualGoals.filter(g => g.id !== goalId);
    window.store.saveState();
    this.renderAnualView();
  }

  editContact(contactId, field, value) {
    const contact = window.store.state.schoolContacts.find(c => c.id === contactId);
    if (contact) {
      contact[field] = value.trim();
      window.store.saveState();
    }
  }

  addContact() {
    window.store.state.schoolContacts.push({
      id: `C-${Date.now()}`,
      role: 'Cargo',
      name: 'Nombre',
      email: 'correo@centro.es'
    });
    window.store.saveState();
    this.renderAnualView();
  }

  deleteContact(contactId) {
    window.store.state.schoolContacts = window.store.state.schoolContacts.filter(c => c.id !== contactId);
    window.store.saveState();
    this.renderAnualView();
  }

  // Salta a la semana real que contiene ese mes/año, calculada a partir de la
  // fecha de inicio de curso (antes usaba una fórmula fija que no correspondía
  // a fechas reales)
  jumpToMonth(year, monthIndex) {
    const start = new Date(window.store.state.startDate);
    start.setHours(0, 0, 0, 0);

    // Usamos el día 15 del mes como referencia para caer siempre dentro del mes
    const reference = new Date(year, monthIndex, 15);
    reference.setHours(0, 0, 0, 0);

    const diffDays = Math.round((reference - start) / (1000 * 60 * 60 * 24));
    const targetWeek = Math.floor(diffDays / 7);

    window.store.state.currentWeekIndex = targetWeek;
    window.store.saveState();

    window.app.switchView('horario');
    window.app.updateDateMotorUI();
    window.app.renderPlannerGrid();
    window.app.showToast(`Navegando a Semana ${targetWeek + 1}...`, 'info');
  }
}

window.anualEngine = new AnualEngine();
