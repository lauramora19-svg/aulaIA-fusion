/* ==========================================================================
   AulaAI - Pipeline Engine & Smart Ripple Shift Algorithm (With Undo Stack)
   ========================================================================== */

class PipelineEngine {
  constructor() {
    this.draggedCellId = null;
    this.historyStack = [];
  }

  // Get all valid lesson slots in chronological order throughout the week
  getOrderedSlots() {
    const slots = [];
    window.DAYS.forEach(day => {
      window.store.state.slots.forEach(slot => {
        if (!slot.isBreak) {
          slots.push({ key: `${day.id}_${slot.id}`, day: day.id, slot: slot.id });
        }
      });
    });
    return slots;
  }

  // Save current lessons state snapshot to history stack before mutating
  saveSnapshot() {
    this.historyStack.push({
      weekIndex: window.store.state.currentWeekIndex || 0,
      lessons: JSON.parse(JSON.stringify(window.store.getWeekLessons())),
    });
    if (this.historyStack.length > 20) {
      this.historyStack.shift(); // Limit stack size to 20
    }
  }

  /**
   * SMART RIPPLE SHIFT (Desplazamiento Inteligente en Cascada)
   * Shifts lesson content of sourceKey to the next occurrence of the SAME subject in the week,
   * pushing subsequent lessons down the pipeline chain.
   */
  shiftSubjectPipeline(sourceKey) {
    const [srcDay, srcSlot] = sourceKey.split('_');
    const targetSubjectId = window.store.getEffectiveSlot(srcDay, srcSlot).subjectId;
    if (!targetSubjectId) {
      this.showToast('La celda seleccionada no tiene una asignatura asignada.', 'warning');
      return;
    }

    const weekLessons = window.store.getWeekLessons();
    const orderedSlots = this.getOrderedSlots();

    // Find all slots in el horario que sean de esta misma asignatura (fijo, no cambia por semana)
    const subjectSlots = orderedSlots.filter(slot => window.store.getScheduleSubject(slot.day, slot.slot) === targetSubjectId);

    const startIndex = subjectSlots.findIndex(s => s.key === sourceKey);
    if (startIndex === -1) return;

    if (startIndex === subjectSlots.length - 1) {
      this.showToast(`Esta es la última sesión de ${window.DEFAULT_SUBJECTS[targetSubjectId].name} de la semana.`, 'info');
      return;
    }

    // Save snapshot before shifting
    this.saveSnapshot();

    // Capture original lesson contents of the subject pipeline chain (de ESTA semana)
    const chainLessons = subjectSlots.slice(startIndex).map(s => {
      return weekLessons[s.key] || { title: '', notes: '', targetNEAE: '', status: 'pending' };
    });

    // Shift contents down by 1 position
    const affectedKeys = [];

    for (let i = subjectSlots.length - 1; i > startIndex; i--) {
      const targetKey = subjectSlots[i].key;
      const prevLessonContent = chainLessons[i - 1 - startIndex];

      window.store.updateLesson(subjectSlots[i].day, subjectSlots[i].slot, {
        title: prevLessonContent.title,
        notes: prevLessonContent.notes,
        targetNEAE: prevLessonContent.targetNEAE,
        status: 'shifted'
      });
      affectedKeys.push(targetKey);
    }

    // Reset the source cell with a clean pending slot
    const [sourceDay, sourceSlot] = sourceKey.split('_');
    window.store.updateLesson(sourceDay, sourceSlot, {
      title: `[Sesión reprogramada]`,
      notes: `Clase desplazada el ${new Date().toLocaleDateString('es-ES')}`,
      targetNEAE: '',
      status: 'pending'
    });
    affectedKeys.push(sourceKey);

    // Re-render and trigger visual ripple animations
    window.app.renderPlannerGrid();
    this.animateRippleShift(affectedKeys);

    this.showToast(`¡Secuencia de ${window.DEFAULT_SUBJECTS[targetSubjectId].name} reprogramada en cascada!`, 'success');
  }

  /**
   * UNDO LAST SHIFT (Dar marcha atrás al desplazamiento)
   */
  undoLastShift() {
    if (this.historyStack.length === 0) {
      this.showToast('No hay desplazamietos previos para deshacer.', 'warning');
      return;
    }

    const previous = this.historyStack.pop();
    window.store.state.weeklyLessons[previous.weekIndex] = previous.lessons;
    window.store.saveState();

    window.app.renderPlannerGrid();
    this.showToast('¡Desplazamiento deshecho correctamente! Se ha restaurado la secuencia.', 'info');
  }

  // Visual Ripple Animation for shifted elements
  animateRippleShift(cellKeys) {
    cellKeys.forEach(key => {
      const cardEl = document.querySelector(`[data-cell-id="${key}"]`);
      if (cardEl) {
        cardEl.classList.add('ripple-shifted');
        setTimeout(() => {
          cardEl.classList.remove('ripple-shifted');
        }, 1000);
      }
    });
  }

  // Setup HTML5 Drag & Drop handlers on card grid
  setupDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.class-card');
      if (card) {
        this.draggedCellId = card.dataset.cellId;
        card.classList.add('is-dragging');
        e.dataTransfer.setData('text/plain', this.draggedCellId);
      }
    });

    document.addEventListener('dragend', (e) => {
      const card = e.target.closest('.class-card');
      if (card) {
        card.classList.remove('is-dragging');
      }
      document.querySelectorAll('.planner-table td').forEach(td => td.classList.remove('drag-over'));
    });

    document.addEventListener('dragover', (e) => {
      const td = e.target.closest('.planner-table td');
      if (td && !td.classList.contains('recreo-cell')) {
        e.preventDefault();
        td.classList.add('drag-over');
      }
    });

    document.addEventListener('dragleave', (e) => {
      const td = e.target.closest('.planner-table td');
      if (td) {
        td.classList.remove('drag-over');
      }
    });

    document.addEventListener('drop', (e) => {
      const td = e.target.closest('.planner-table td');
      if (!td || !this.draggedCellId) return;

      e.preventDefault();
      td.classList.remove('drag-over');

      const targetCellId = td.dataset.targetKey;
      if (targetCellId && targetCellId !== this.draggedCellId) {
        this.swapLessons(this.draggedCellId, targetCellId);
      }
    });
  }

  // Swap two lessons directly via Drag & Drop — cambio PUNTUAL de esta
  // semana: mueve la asignatura entera (no solo el texto) de una casilla a
  // otra, sin tocar el horario fijo de las demás semanas.
  swapLessons(keyA, keyB) {
    const [dayA, slotA] = keyA.split('_');
    const [dayB, slotB] = keyB.split('_');

    const effA = window.store.getEffectiveSlot(dayA, slotA);
    const effB = window.store.getEffectiveSlot(dayB, slotB);

    if (!effA.subjectId && !effB.subjectId) return; // nada que intercambiar

    this.saveSnapshot();

    window.store.updateLesson(dayA, slotA, {
      title: effB.title,
      notes: effB.notes,
      targetNEAE: effB.targetNEAE,
      status: effB.status,
      subjectOverride: effB.subjectId,
      groupOverride: effB.group
    });

    window.store.updateLesson(dayB, slotB, {
      title: effA.title,
      notes: effA.notes,
      targetNEAE: effA.targetNEAE,
      status: effA.status,
      subjectOverride: effA.subjectId,
      groupOverride: effA.group
    });

    window.app.renderPlannerGrid();
    this.animateRippleShift([keyA, keyB]);
    this.showToast('Clases intercambiadas (solo esta semana, el horario fijo no cambia).', 'info');
  }

  showToast(message, type = 'info') {
    if (window.app && window.app.showToast) {
      window.app.showToast(message, type);
    }
  }
}

window.pipelineEngine = new PipelineEngine();
