/* ==========================================================================
   AulaAI - App Controller Main Script
   ========================================================================== */

class AppController {
  constructor() {
    this.activeCellKey = null;
    this.init();
  }

  init() {
    this.applyTheme();
    this.watchAulaIA();
    this.renderPlannerGrid();
    this.updateDateMotorUI();
    this.setupEventListeners();
    window.pipelineEngine.setupDragAndDrop();
    window.alumnoEngine.renderStudentsList();
    window.templatesEngine.renderTemplatesGrid();
    window.templatesEngine.renderSubstitutionFolder();
  }

  // Si AulaIA cambia algo (alumnado, clases, sesiones), esta pestaña se
  // actualiza sola al volver a ella o cada minuto.
  watchAulaIA() {
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const changed = await window.store.refreshIfRemoteChanged();
      if (changed) this.refreshAll();
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    setInterval(check, 60000);
  }

  refreshAll() {
    try {
      this.renderPlannerGrid();
      this.updateDateMotorUI();
      window.alumnoEngine.renderStudentsList();
      if (window.clasesEngine && document.querySelector('#view-clases.active-view')) window.clasesEngine.renderClasesView();
    } catch (e) { console.error(e); }
  }

  // Apply Light/Dark mode
  applyTheme() {
    if (window.store.state.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  toggleTheme() {
    window.store.state.darkMode = !window.store.state.darkMode;
    window.store.saveState();
    this.applyTheme();
    this.showToast(`Modo ${window.store.state.darkMode ? 'oscuro' : 'claro'} activado`, 'info');
  }

  // Date Motor UI Update
  updateDateMotorUI() {
    const weekIndex = window.store.state.currentWeekIndex || 0;
    const weekText = window.dateEngine.getWeekFormattedString(weekIndex);
    const trimesterText = window.dateEngine.getTrimester(weekIndex);

    const weekLabelEl = document.getElementById('current-week-label');
    if (weekLabelEl) weekLabelEl.innerText = `Semana ${weekIndex + 1}: ${weekText}`;

    const trimesterTagEl = document.getElementById('trimester-tag-label');
    if (trimesterTagEl) trimesterTagEl.innerText = trimesterText;

    // Update Th headers with calculated day dates
    const dayDates = window.dateEngine.getDayDates(weekIndex);
    window.DAYS.forEach(day => {
      const thSub = document.getElementById(`day-date-${day.id}`);
      if (thSub) {
        thSub.innerText = dayDates[day.id];
      }
    });
  }

  navigateWeek(direction) {
    // Navegación libre, sin límite inferior ni superior de semanas
    const newIndex = (window.store.state.currentWeekIndex || 0) + direction;

    window.store.state.currentWeekIndex = newIndex;
    window.store.saveState();
    this.updateDateMotorUI();
    this.renderPlannerGrid();
  }

  // Render Timetable Planner Grid
  renderPlannerGrid() {
    const tbody = document.getElementById('planner-tbody');
    if (!tbody) return;

    let html = '';

    window.store.state.slots.forEach(slot => {
      if (slot.isBreak) {
        // Recreo / Break Row
        html += `
          <tr class="recreo-row">
            <td class="time-slot-cell">
              <span class="time-slot-label">${slot.label}</span>
              <span class="time-slot-sub">${slot.time}</span>
            </td>
            <td colspan="5" class="recreo-cell">
              ☕ ${slot.label} — Tiempo de patio y descanso
            </td>
          </tr>
        `;
      } else {
        html += `
          <tr>
            <td class="time-slot-cell">
              <span class="time-slot-label">${slot.label}</span>
              <span class="time-slot-sub">${slot.time}</span>
            </td>
        `;

        window.DAYS.forEach(day => {
          const cellKey = `${day.id}_${slot.id}`;
          const eff = window.store.getEffectiveSlot(day.id, slot.id);
          const subj = eff.subjectId ? window.DEFAULT_SUBJECTS[eff.subjectId] : null;

          if (subj) {
            let statusClass = 'status-pending';
            let statusText = 'Pendiente';
            if (eff.status === 'done') { statusClass = 'status-done'; statusText = 'Impartida'; }
            if (eff.status === 'shifted') { statusClass = 'status-shifted'; statusText = 'Reprogramada'; }

            html += `
              <td data-target-key="${cellKey}">
                <div class="class-card ${subj.colorClass}" data-cell-id="${cellKey}" draggable="true" onclick="window.app.openExpandedLessonModal('${cellKey}')">
                  <div class="card-header">
                    <span class="subject-badge">
                      <i class="fa-solid ${subj.icon}"></i> ${subj.name}
                    </span>
                    <span class="group-badge">${eff.group || 'Sin grupo'}</span>
                  </div>

                  <div class="card-body">
                    <div class="lesson-title">${eff.title || 'Sin planificar esta semana'}</div>
                    <div class="lesson-notes-snippet">${eff.notes || ''}</div>
                    ${eff.aulaiaUrl ? `<a class="aulaia-link" href="${eff.aulaiaUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="fa-solid fa-file-lines"></i> Ver sesión en AulaIA</a>` : ''}
                  </div>

                  <div class="card-footer">
                    <span class="status-pill ${statusClass}">
                      <i class="fa-solid fa-circle" style="font-size: 0.45rem;"></i> ${statusText}
                    </span>
                    <div style="display: flex; gap: 4px;">
                      <button class="btn-undo-pipeline" title="Dar marcha atrás / Deshacer desplazamiento" onclick="event.stopPropagation(); window.pipelineEngine.undoLastShift()">
                        <i class="fa-solid fa-rotate-left"></i>
                      </button>
                      <button class="btn-shift-pipeline" title="Desplazar al siguiente día de ${subj.name} (Ripple Shift)" onclick="event.stopPropagation(); window.pipelineEngine.shiftSubjectPipeline('${cellKey}')">
                        <i class="fa-solid fa-forward-step"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </td>
            `;
          } else {
            // Empty Cell — todavía no se ha asignado ninguna asignatura fija a esta hora
            html += `
              <td data-target-key="${cellKey}">
                <div class="class-card" style="border: 1px dashed var(--border-color); justify-content: center; align-items: center; color: var(--text-muted);" onclick="window.app.openExpandedLessonModal('${cellKey}')">
                  <i class="fa-solid fa-plus" style="font-size: 1.2rem;"></i>
                  <span style="font-size: 0.78rem; font-weight: 600; margin-top: 4px;">Añadir clase</span>
                </div>
              </td>
            `;
          }
        });

        html += `</tr>`;
      }
    });

    tbody.innerHTML = html;
  }

  // Open Lesson Expanded Detail Modal
  openExpandedLessonModal(cellKey) {
    this.activeCellKey = cellKey;
    const [day, slot] = cellKey.split('_');

    const eff = window.store.getEffectiveSlot(day, slot);
    const subj = eff.subjectId ? window.DEFAULT_SUBJECTS[eff.subjectId] : null;

    document.getElementById('modal-lesson-title-display').innerText = subj ? `Detalle de Clase — ${subj.name}` : 'Nueva Casilla del Horario';
    document.getElementById('modal-subject-select').value = eff.subjectId || 'MATES';
    document.getElementById('modal-group-input').value = eff.group || '';
    document.getElementById('modal-title-input').value = eff.title || '';
    document.getElementById('modal-notes-input').value = eff.notes || '';
    document.getElementById('modal-neae-input').value = eff.targetNEAE || '';
    document.getElementById('modal-status-select').value = eff.status || 'pending';

    // Enlace al documento de AulaIA (si esta sesión se programó desde allí)
    const notesEl = document.getElementById('modal-notes-input');
    let linkEl = document.getElementById('modal-aulaia-link');
    if (!linkEl && notesEl) {
      linkEl = document.createElement('a');
      linkEl.id = 'modal-aulaia-link';
      linkEl.className = 'aulaia-link';
      linkEl.target = '_blank';
      linkEl.rel = 'noopener';
      notesEl.insertAdjacentElement('afterend', linkEl);
    }
    if (linkEl) {
      linkEl.href = eff.aulaiaUrl || '#';
      linkEl.innerHTML = '<i class="fa-solid fa-file-lines"></i> Ver la sesión en AulaIA';
      linkEl.style.display = eff.aulaiaUrl ? 'inline-flex' : 'none';
    }

    this.openModal('modal-lesson');
  }

  saveLessonFromModal() {
    if (!this.activeCellKey) return;
    const [day, slot] = this.activeCellKey.split('_');

    const subjectId = document.getElementById('modal-subject-select').value;
    const group = document.getElementById('modal-group-input').value.trim();
    const title = document.getElementById('modal-title-input').value.trim();
    const notes = document.getElementById('modal-notes-input').value.trim();
    const targetNEAE = document.getElementById('modal-neae-input').value.trim();
    const status = document.getElementById('modal-status-select').value;

    // La asignatura Y el grupo se guardan en el horario FIJO (igual todas las semanas).
    window.store.setSchedule(day, slot, { subjectId, group });
    // El resto (qué se va a dar, notas, estado...) se guarda solo para ESTA semana.
    window.store.updateLesson(day, slot, {
      title, notes, targetNEAE, status
    });
    // Al guardar aquí a mano, es una decisión permanente para esta hora:
    // si esa semana tenía un intercambio puntual (por arrastre), lo quitamos,
    // para que no se quede "atascada" en el intercambio antiguo.
    window.store.clearWeeklyOverride(day, slot);

    this.renderPlannerGrid();
    this.closeModal('modal-lesson');
    this.showToast('Programación de clase guardada correctamente.', 'success');
  }

  // View Navigation Tabs Switcher
  switchView(viewId) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active-view'));

    const activeNav = document.querySelector(`[data-view-target="${viewId}"]`);
    if (activeNav) activeNav.classList.add('active');

    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) targetView.classList.add('active-view');

    // Page Heading text
    const headings = {
      'horario': 'Horario semanal',
      'anual': 'Vista anual',
      'clases': 'Plano de aula',
      'alumnado': 'Alumnado y NEAE',
      'listados': 'Listados del grupo',
      'mensajes': 'Mensajes a familias',
      'sustitucion': 'Carpeta de Sustitución'
    };
    const titleEl = document.getElementById('page-title-heading');
    if (titleEl) titleEl.innerText = headings[viewId] || 'AulaAI';

    if (viewId === 'anual') {
      window.anualEngine.renderAnualView();
    }
    if (viewId === 'clases') {
      window.clasesEngine.renderClasesView();
    }
    if (viewId === 'listados') {
      window.checklistEngine.renderListadosView();
    }
    if (viewId === 'sustitucion') {
      window.templatesEngine.renderSubstitutionFolder();
    }
  }

  // Zoom & View Mode Controls
  setGridMode(mode) {
    const gridWrapper = document.getElementById('planner-grid-wrapper');
    if (!gridWrapper) return;

    gridWrapper.classList.remove('mode-compact', 'mode-expanded');
    if (mode === 'compact') gridWrapper.classList.add('mode-compact');
    if (mode === 'expanded') gridWrapper.classList.add('mode-expanded');

    document.querySelectorAll('.view-mode-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`)?.classList.add('active');
  }

  setZoomScale(val) {
    const gridWrapper = document.getElementById('planner-grid-wrapper');
    if (gridWrapper) {
      gridWrapper.style.transform = `scale(${val})`;
      gridWrapper.style.transformOrigin = 'top left';
    }
  }

  // ---- Configurar Horario: horas del día editables (cada docente tiene las suyas) ----
  openSlotsModal() {
    this.renderSlotsEditor();
    this.openModal('modal-slots');
  }

  renderSlotsEditor() {
    const container = document.getElementById('slots-editor-list');
    if (!container) return;

    const slots = window.store.state.slots || [];

    if (slots.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem;">Sin horas configuradas. Añade la primera.</p>`;
      return;
    }

    container.innerHTML = slots.map(slot => `
      <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--bg-tertiary); padding: 0.6rem 0.75rem; border-radius: var(--radius-md);">
        <input type="text" value="${slot.label}" placeholder="Ej. 1ª Hora"
          onchange="window.app.updateSlot('${slot.id}', 'label', this.value)"
          style="width: 90px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 6px 8px; font-size: 0.82rem; font-weight: 600; background: var(--bg-secondary); color: var(--text-primary);">
        <input type="text" value="${slot.time}" placeholder="Ej. 09:00 - 09:55"
          onchange="window.app.updateSlot('${slot.id}', 'time', this.value)"
          style="flex: 1; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 6px 8px; font-size: 0.82rem; background: var(--bg-secondary); color: var(--text-primary);">
        <label style="display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap; cursor: pointer;">
          <input type="checkbox" ${slot.isBreak ? 'checked' : ''} onchange="window.app.updateSlot('${slot.id}', 'isBreak', this.checked)">
          Recreo
        </label>
        <button onclick="window.app.deleteSlot('${slot.id}')" style="border: none; background: none; color: var(--text-muted); cursor: pointer;" title="Eliminar hora">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `).join('');
  }

  updateSlot(slotId, field, value) {
    const slot = (window.store.state.slots || []).find(s => s.id === slotId);
    if (!slot) return;
    slot[field] = field === 'isBreak' ? !!value : value;
    window.store.saveState();
    this.renderPlannerGrid();
  }

  addSlot() {
    const n = (window.store.state.slots || []).filter(s => !s.isBreak).length + 1;
    window.store.state.slots.push({
      id: `S${Date.now()}`,
      label: `${n}ª Hora`,
      time: '00:00 - 00:00',
      isBreak: false
    });
    window.store.saveState();
    this.renderSlotsEditor();
    this.renderPlannerGrid();
  }

  deleteSlot(slotId) {
    window.store.state.slots = (window.store.state.slots || []).filter(s => s.id !== slotId);
    window.store.saveState();
    this.renderSlotsEditor();
    this.renderPlannerGrid();
    this.showToast('Hora eliminada del horario.', 'info');
  }

  // Modal Dialog Utils
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  // Toast System
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  setupEventListeners() {
    // Zoom Slider Listener
    const zoomInput = document.getElementById('zoom-slider');
    if (zoomInput) {
      zoomInput.addEventListener('input', (e) => this.setZoomScale(e.target.value));
    }
  }
}

// AppController se instancia desde authGate.js, solo después de que el
// usuario haya iniciado sesión y se hayan cargado sus datos de Supabase.
