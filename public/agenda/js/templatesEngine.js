/* ==========================================================================
   AulaAI - Templates Engine (Banco de Mensajes a Familias & Carpeta de Sustitución)
   ========================================================================== */

// Convierte una fecha a "YYYY-MM-DD" usando el día/mes/año LOCAL del
// dispositivo. OJO: toISOString() convierte a UTC, así que en España
// (o cualquier huso por delante de UTC) puede devolver el día ANTERIOR
// si es de madrugada — por eso NO se usa toISOString() para esto.
function formatDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

class TemplatesEngine {
  constructor() {}

  renderTemplatesGrid() {
    const container = document.getElementById('templates-grid-container');
    if (!container) return;

    const templates = window.store.state.messageTemplates || [];

    const addButtonHtml = `
      <div style="grid-column: 1/-1; display: flex; justify-content: flex-end; margin-bottom: 0.25rem;">
        <button class="btn btn-primary" onclick="window.templatesEngine.openEditTemplateModal('')">
          <i class="fa-solid fa-plus"></i> Nuevo Comunicado
        </button>
      </div>
    `;

    if (templates.length === 0) {
      container.innerHTML = addButtonHtml + `
        <div style="grid-column: 1/-1; border: 1px dashed var(--border-color); border-radius: var(--radius-lg); padding: 2rem; text-align: center; color: var(--text-muted);">
          Todavía no hay comunicados en tu biblioteca. Pulsa "Nuevo Comunicado" para crear el primero.
        </div>
      `;
      return;
    }

    container.innerHTML = addButtonHtml + templates.map(tpl => `
      <div class="template-card">
        <div>
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
            <div class="template-title">
              <i class="fa-regular fa-comment-dots" style="color: var(--accent-primary);"></i>
              ${tpl.title}
            </div>
            <div style="display: flex; gap: 6px; flex-shrink: 0;">
              <button onclick="window.templatesEngine.openEditTemplateModal('${tpl.id}')" style="border:none;background:none;color:var(--text-muted);cursor:pointer;" title="Editar comunicado">
                <i class="fa-solid fa-pen" style="font-size: 0.8rem;"></i>
              </button>
              <button onclick="window.templatesEngine.deleteTemplate('${tpl.id}')" style="border:none;background:none;color:var(--text-muted);cursor:pointer;" title="Eliminar comunicado">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
          <span style="font-size: 0.72rem; background: var(--accent-light); color: var(--accent-primary); padding: 2px 6px; border-radius: var(--radius-sm); font-weight: 600;">
            ${tpl.category || 'Sin categoría'}
          </span>
          <div class="template-preview" style="margin-top: 0.75rem;">${tpl.text}</div>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: auto;">
          <button class="btn btn-primary" style="flex:1;" onclick="window.templatesEngine.copyTemplateText('${tpl.id}')">
            <i class="fa-regular fa-copy"></i> Copiar Mensaje
          </button>
        </div>
      </div>
    `).join('');
  }

  copyTemplateText(templateId) {
    const tpl = (window.store.state.messageTemplates || []).find(t => t.id === templateId);
    if (!tpl) return;

    navigator.clipboard.writeText(tpl.text).then(() => {
      window.app.showToast('¡Plantilla copiada al portapapeles! Lista para personalizar.', 'success');
    }).catch(err => {
      console.error('Error al copiar: ', err);
    });
  }

  openEditTemplateModal(templateId) {
    const tpl = templateId ? (window.store.state.messageTemplates || []).find(t => t.id === templateId) : null;
    document.getElementById('modal-template-title-display').innerText = tpl ? 'Editar Comunicado' : 'Nuevo Comunicado';
    document.getElementById('edit-template-id').value = tpl ? tpl.id : '';
    document.getElementById('edit-template-category').value = tpl ? (tpl.category || '') : '';
    document.getElementById('edit-template-title').value = tpl ? tpl.title : '';
    document.getElementById('edit-template-text').value = tpl ? tpl.text : '';
    window.app.openModal('modal-template');
  }

  saveTemplateFromModal() {
    const id = document.getElementById('edit-template-id').value;
    const category = document.getElementById('edit-template-category').value.trim();
    const title = document.getElementById('edit-template-title').value.trim();
    const text = document.getElementById('edit-template-text').value.trim();

    if (!title || !text) {
      window.app.showToast('Escribe al menos un título y el texto del mensaje.', 'warning');
      return;
    }

    if (!window.store.state.messageTemplates) window.store.state.messageTemplates = [];

    if (id) {
      const tpl = window.store.state.messageTemplates.find(t => t.id === id);
      if (tpl) {
        tpl.category = category;
        tpl.title = title;
        tpl.text = text;
      }
    } else {
      window.store.state.messageTemplates.push({
        id: `TPL-${Date.now()}`,
        category, title, text
      });
    }

    window.store.saveState();
    window.app.closeModal('modal-template');
    this.renderTemplatesGrid();
    window.app.showToast('Comunicado guardado en tu biblioteca.', 'success');
  }

  deleteTemplate(templateId) {
    window.store.state.messageTemplates = (window.store.state.messageTemplates || []).filter(t => t.id !== templateId);
    window.store.saveState();
    this.renderTemplatesGrid();
    window.app.showToast('Comunicado eliminado.', 'info');
  }

  // Generador de Carpeta de Sustitución (Vista de Guardia / Relevo)
  renderSubstitutionFolder() {
    const container = document.getElementById('substitution-content');
    if (!container) return;

    // Rango de días a sustituir (guardado; por defecto, solo hoy)
    const todayStr = formatDateLocal(new Date());
    let range = window.store.state.substitutionRange;
    if (!range.start || !range.end) {
      range = { start: todayStr, end: todayStr };
      window.store.state.substitutionRange = range;
      window.store.saveState();
    }

    const days = this.buildDateRange(range.start, range.end);
    const neaeStudents = (window.store.state.students || []).filter(s => s.neae);

    container.innerHTML = `
      <div class="substitution-sheet">

        <!-- CONTROLES: NO SE IMPRIMEN, solo sirven para elegir qué día(s) preparar -->
        <div class="no-print" style="display: flex; flex-wrap: wrap; align-items: end; gap: 1rem; background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
          <div>
            <label class="form-label" style="margin-bottom: 4px; display:block;">Desde</label>
            <input type="date" id="sub-range-start" class="form-input" value="${range.start}" onchange="window.templatesEngine.updateSubstitutionRange()">
          </div>
          <div>
            <label class="form-label" style="margin-bottom: 4px; display:block;">Hasta</label>
            <input type="date" id="sub-range-end" class="form-input" value="${range.end}" onchange="window.templatesEngine.updateSubstitutionRange()">
          </div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); flex: 1; min-width: 200px;">
            Elige el día (o los días) que vas a faltar. Esta selección se guarda, y esto es lo que se imprime/exporta.
          </div>
          <button class="btn btn-secondary" onclick="window.print()">
            <i class="fa-solid fa-print"></i> Imprimir / Exportar PDF
          </button>
        </div>

        <div class="substitution-header">
          <div class="sub-title-group">
            <h2>📁 Carpeta de Sustitución y Plan de Clase</h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">
              Guía rápida para el profesor/a de guardia o sustituto/a · ${this.formatRangeLabel(range)}
            </p>
          </div>
        </div>

        <!-- NOTAS GENERALES: editable, se guarda sola y SÍ se imprime -->
        <div style="margin: 1.25rem 0;">
          <h3 style="font-family: var(--font-display); font-size: 1rem; margin-bottom: 0.5rem;">📝 Notas generales para quien sustituya</h3>
          <textarea id="sub-general-notes" class="form-textarea" rows="3"
            placeholder="Ej. Las llaves del aula están en conserjería, el proyector falla a veces, dudas al tutor de guardia..."
            onchange="window.templatesEngine.saveSubstitutionNotes(this.value)"
          >${window.store.state.substitutionNotes || ''}</textarea>
        </div>

        ${days.length === 0 ? `
          <div style="border: 1px dashed var(--border-color); border-radius: var(--radius-md); padding: 1.5rem; text-align: center; color: var(--text-muted);">
            El rango elegido no incluye ningún día lectivo (¿fin de semana?).
          </div>
        ` : days.map(dateStr => this.renderSubstitutionDay(dateStr)).join('')}

        ${neaeStudents.length === 0 ? '' : `
          <div style="margin-top: 2rem; background: #fff1f2; padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid #fecdd3;">
            <h3 style="font-family: var(--font-display); font-size: 1.05rem; color: #9f1239; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid fa-triangle-exclamation"></i> Avisos Importantes de Alumnado (Atención NEAE)
            </h3>
            <ul style="padding-left: 1.25rem; font-size: 0.88rem; color: #881337; display: flex; flex-direction: column; gap: 0.4rem;">
              ${neaeStudents.map(s => `
                <li><strong>${s.name}${s.neaeType ? ` (${s.neaeType})` : ''}:</strong> ${s.notes || 'Sin observaciones.'}</li>
              `).join('')}
            </ul>
          </div>
        `}
      </div>
    `;
  }

  // Genera un bloque de horario para un día concreto (usado dentro del rango elegido)
  renderSubstitutionDay(dateStr) {
    const dayId = window.dateEngine.getDayIdForDate(dateStr);
    const dayLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    if (!dayId) {
      return `
        <div style="margin-bottom: 1.5rem;">
          <h3 style="font-family: var(--font-display); font-size: 1.1rem; margin-bottom: 0.5rem; text-transform: capitalize;">${dayLabel}</h3>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Fin de semana, sin sesiones.</p>
        </div>
      `;
    }

    const weekIndex = window.dateEngine.getWeekIndexForDate(dateStr);
    const weekLessons = window.store.getWeekLessons(weekIndex);
    const dayLessons = [];

    window.store.state.slots.forEach(slot => {
      if (slot.isBreak) {
        dayLessons.push({ time: slot.time, label: 'RECREO / DESCANSO EN PATIO', isBreak: true });
      } else {
        const key = `${dayId}_${slot.id}`;
        const eff = window.store.getEffectiveSlot(dayId, slot.id, weekIndex);
        if (eff.subjectId) {
          const subj = window.DEFAULT_SUBJECTS[eff.subjectId] || {};
          dayLessons.push({
            time: slot.time,
            label: `${slot.label} - ${subj.name || 'Asignatura'}${eff.group ? ` (${eff.group})` : ''}`,
            title: eff.title || 'Sin planificar esta semana',
            notes: eff.notes || 'Sin notas adicionales.',
            targetNEAE: eff.targetNEAE,
            isBreak: false
          });
        }
      }
    });

    return `
      <div style="margin-bottom: 1.75rem;">
        <h3 style="font-family: var(--font-display); font-size: 1.1rem; margin-bottom: 0.75rem; text-transform: capitalize;">
          📌 ${dayLabel}
        </h3>
        ${dayLessons.filter(d => !d.isBreak).length === 0 ? `
          <p style="color: var(--text-muted); font-size: 0.85rem;">No hay sesiones programadas este día en "Programación &amp; Pipeline".</p>
        ` : `
          <div class="sub-schedule-list">
            ${dayLessons.map(item => `
              <div class="sub-schedule-item" style="${item.isBreak ? 'border-left-color: #64748b; opacity: 0.8;' : ''}">
                <div class="sub-time">${item.time}</div>
                <div>
                  <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">
                    ${item.label}
                  </div>
                  ${!item.isBreak ? `
                    <div style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 4px;">
                      <strong>Actividad programada:</strong> ${item.title}
                    </div>
                    <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 2px;">
                      <strong>Notas / Materiales:</strong> ${item.notes}
                    </div>
                    ${item.targetNEAE ? `
                      <div style="font-size: 0.8rem; color: #dc2626; font-weight: 600; margin-top: 4px;">
                        ⚠️ Adaptación NEAE: ${item.targetNEAE}
                      </div>
                    ` : ''}
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  buildDateRange(startStr, endStr) {
    const dates = [];
    let cur = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    if (cur > end) return [];
    // Límite de seguridad: máximo 31 días para no generar rangos enormes por error
    let guard = 0;
    while (cur <= end && guard < 31) {
      dates.push(formatDateLocal(cur));
      cur.setDate(cur.getDate() + 1);
      guard++;
    }
    return dates;
  }

  formatRangeLabel(range) {
    const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    return range.start === range.end ? fmt(range.start) : `${fmt(range.start)} — ${fmt(range.end)}`;
  }

  updateSubstitutionRange() {
    const start = document.getElementById('sub-range-start').value;
    const end = document.getElementById('sub-range-end').value;
    if (!start || !end) return;
    window.store.state.substitutionRange = { start, end };
    window.store.saveState();
    this.renderSubstitutionFolder();
  }

  saveSubstitutionNotes(text) {
    window.store.state.substitutionNotes = text;
    window.store.saveState();
  }
}

window.templatesEngine = new TemplatesEngine();
