/* ==========================================================================
   AulaAI - Student Engine (Fichas de Alumnado, NEAE & Observaciones)
   ========================================================================== */

class AlumnoEngine {
  constructor() {
    this.editingPhones = [];
  }

  renderStudentsList(filterNEAEOnly = false) {
    const container = document.getElementById('students-grid-container');
    if (!container) return;

    let students = window.store.state.students || [];
    if (filterNEAEOnly) {
      students = students.filter(s => s.neae);
    }

    if (students.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fa-solid fa-user-graduate" style="font-size: 2.5rem; margin-bottom: 0.75rem;">
          </i>
          <p>No se encontraron fichas de alumnado en este filtro.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = students.map(student => `
      <div class="student-card" data-student-id="${student.id}">
        <div class="student-header">
          <div class="student-avatar">
            ${student.name.split(' ').map(n => n[0]).slice(0,2).join('')}
          </div>
          <div style="flex:1;">
            <div class="student-info-name">${student.name}</div>
            <div class="student-info-course">${student.group ? `Grupo ${student.group}` : 'Sin grupo asignado'}</div>
          </div>
          ${student.neae ? `<span class="neae-badge"><i class="fa-solid fa-star"></i> NEAE</span>` : ''}
          <button onclick="window.alumnoEngine.deleteStudent('${student.id}')" style="border:none;background:none;color:var(--text-muted);cursor:pointer;flex-shrink:0;" title="Eliminar alumno/a">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        ${student.neae ? `
          <div style="font-size: 0.8rem; font-weight: 600; color: #dc2626; background: #fef2f2; padding: 4px 8px; border-radius: var(--radius-sm);">
            <i class="fa-solid fa-triangle-exclamation"></i> ${student.neaeType}
          </div>
        ` : ''}

        <div style="font-size: 0.84rem; color: var(--text-secondary); line-height: 1.4;">
          <strong>Pautas / Adaptación:</strong> ${student.notes || 'Sin observaciones específicas.'}
        </div>

        <div style="display: flex; align-items: center; gap: 10px; font-size: 0.76rem; color: var(--text-muted);">
          <span><i class="fa-solid fa-cake-candles"></i> ${student.birthday ? this.formatBirthday(student.birthday) : 'Sin cumpleaños'}</span>
          <span class="behavior-pill behavior-${(student.behavior || 'Sin registrar').toLowerCase().replace(' ', '-')}" style="font-size: 0.68rem;">
            ${student.behavior || 'Sin registrar'}
          </span>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
          <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Media: <strong>${student.gradeAvg ?? '—'}</strong></span>
          <button class="btn btn-outline btn-icon-only" onclick="window.alumnoEngine.openEditStudentModal('${student.id}')" title="Editar Ficha">
            <i class="fa-solid fa-pen"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  formatBirthday(dateStr) {
    // dateStr en formato YYYY-MM-DD (del <input type="date">)
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  // Cumpleaños del MES EN CURSO, ordenados del más próximo al más lejano
  getBirthdaysThisMonth(students) {
    const currentMonth = new Date().getMonth();
    return (students || [])
      .filter(s => s.birthday)
      .map(s => ({ student: s, day: new Date(s.birthday + 'T00:00:00').getDate(), month: new Date(s.birthday + 'T00:00:00').getMonth() }))
      .filter(s => s.month === currentMonth)
      .sort((a, b) => a.day - b.day)
      .map(s => s.student);
  }

  openEditStudentModal(studentId) {
    // Si no hay studentId, es un alumno NUEVO: abrimos el formulario en blanco
    // (antes esto cortaba en seco y el botón "Nuevo Alumno" no hacía nada)
    const student = studentId ? window.store.state.students.find(s => s.id === studentId) : null;

    document.getElementById('edit-student-id').value = student ? student.id : '';
    document.getElementById('edit-student-name').value = student ? student.name : '';
    document.getElementById('edit-student-group').value = student ? student.group : '';
    document.getElementById('edit-student-neae').checked = student ? !!student.neae : false;
    document.getElementById('edit-student-neaetype').value = student ? (student.neaeType || '') : '';
    document.getElementById('edit-student-birthday').value = student ? (student.birthday || '') : '';
    document.getElementById('edit-student-behavior').value = student ? (student.behavior || '') : '';
    document.getElementById('edit-student-notes').value = student ? (student.notes || '') : '';
    document.getElementById('edit-student-parentname').value = student ? (student.parentName || '') : '';
    document.getElementById('edit-student-parentemail').value = student ? (student.parentEmail || '') : '';

    // Teléfonos: puede haber varios (Madre, Padre, Abuela...)
    this.editingPhones = student && Array.isArray(student.phones) ? JSON.parse(JSON.stringify(student.phones)) : [];
    this.renderPhonesEditor();

    // El botón de eliminar solo tiene sentido si el alumno ya existe
    const deleteBtn = document.getElementById('modal-student-delete-btn');
    if (deleteBtn) deleteBtn.style.display = student ? 'inline-flex' : 'none';

    window.app.openModal('modal-student');
  }

  renderPhonesEditor() {
    const container = document.getElementById('edit-student-phones-list');
    if (!container) return;

    if (this.editingPhones.length === 0) {
      container.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted);">Sin teléfonos añadidos todavía.</p>`;
      return;
    }

    container.innerHTML = this.editingPhones.map((p, idx) => `
      <div style="display: flex; gap: 6px; align-items: center;">
        <input type="text" value="${p.label || ''}" placeholder="Ej. Madre"
          oninput="window.alumnoEngine.updatePhoneField(${idx}, 'label', this.value)"
          style="width: 100px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 10px; font-size: 0.85rem; background: var(--bg-secondary); color: var(--text-primary);">
        <input type="tel" value="${p.number || ''}" placeholder="Número de teléfono"
          oninput="window.alumnoEngine.updatePhoneField(${idx}, 'number', this.value)"
          style="flex: 1; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 10px; font-size: 0.85rem; background: var(--bg-secondary); color: var(--text-primary);">
        <button type="button" onclick="window.alumnoEngine.removePhoneField(${idx})" style="border: none; background: none; color: var(--text-muted); cursor: pointer;" title="Eliminar este teléfono">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `).join('');
  }

  addPhoneField() {
    this.editingPhones.push({ label: '', number: '' });
    this.renderPhonesEditor();
  }

  removePhoneField(idx) {
    this.editingPhones.splice(idx, 1);
    this.renderPhonesEditor();
  }

  updatePhoneField(idx, field, value) {
    if (this.editingPhones[idx]) this.editingPhones[idx][field] = value;
  }

  saveStudentFromModal() {
    const id = document.getElementById('edit-student-id').value;
    const name = document.getElementById('edit-student-name').value.trim();
    const group = document.getElementById('edit-student-group').value;
    const neae = document.getElementById('edit-student-neae').checked;
    const neaeType = document.getElementById('edit-student-neaetype').value.trim();
    const birthday = document.getElementById('edit-student-birthday').value;
    const behavior = document.getElementById('edit-student-behavior').value;
    const notes = document.getElementById('edit-student-notes').value.trim();
    const parentName = document.getElementById('edit-student-parentname').value.trim();
    const parentEmail = document.getElementById('edit-student-parentemail').value.trim();
    // Solo guardamos los teléfonos que realmente tengan número escrito
    const phones = (this.editingPhones || []).filter(p => (p.number || '').trim());

    if (!name) {
      window.app.showToast('Por favor introduce el nombre del alumno/a', 'warning');
      return;
    }

    const idx = window.store.state.students.findIndex(s => s.id === id);
    if (idx !== -1) {
      window.store.state.students[idx] = {
        ...window.store.state.students[idx],
        name, group, neae, neaeType, birthday, behavior, notes, parentName, parentEmail, phones
      };
    } else {
      window.store.state.students.push({
        id: `STU-${Date.now()}`,
        name, group, neae, neaeType, birthday, behavior, notes, parentName, parentEmail, phones, gradeAvg: null
      });
    }

    window.store.saveState();
    this.renderStudentsList();
    window.app.closeModal('modal-student');
    window.app.showToast('Ficha de alumnado guardada con éxito.', 'success');
  }

  // Elimina un alumno/a directamente desde la tarjeta (con confirmación)
  deleteStudent(studentId) {
    const student = window.store.state.students.find(s => s.id === studentId);
    if (!student) return;
    if (!confirm(`¿Eliminar la ficha de ${student.name}? También se quitará de cualquier pupitre asignado.`)) return;

    window.store.state.students = window.store.state.students.filter(s => s.id !== studentId);
    // Lo quitamos también de cualquier plano de aula donde estuviera sentado
    Object.values(window.store.state.seatingByClass || {}).forEach(record => {
      record.seats.forEach(seat => { if (seat.studentId === studentId) seat.studentId = null; });
    });

    window.store.saveState();
    this.renderStudentsList();
    window.app.showToast('Alumno/a eliminado.', 'info');
  }

  // Elimina desde dentro del propio formulario de edición
  deleteStudentFromModal() {
    const id = document.getElementById('edit-student-id').value;
    if (!id) return;
    this.deleteStudent(id);
    window.app.closeModal('modal-student');
  }
}

window.alumnoEngine = new AlumnoEngine();
