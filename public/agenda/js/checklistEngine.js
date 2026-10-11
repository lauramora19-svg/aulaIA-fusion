/* ==========================================================================
   AulaAI - Checklist Engine (Listado del Grupo: entregas y documentos)
   ========================================================================== */

class ChecklistEngine {
  constructor() {
    this.activeTab = 'checklists'; // 'checklists' | 'documents'
    this.activeChecklistId = null; // null = mostrando la lista de listas
  }

  renderListadosView() {
    const container = document.getElementById('listados-view-container');
    if (!container) return;

    const classes = window.store.state.classes || [];

    if (classes.length === 0) {
      container.innerHTML = `
        <div style="border: 1px dashed var(--border-color); border-radius: var(--radius-lg); padding: 2rem; text-align: center; color: var(--text-muted);">
          Todavía no has creado ninguna clase. Ve a "Mis Clases & Plano" para crear la primera, y luego vuelve aquí.
        </div>
      `;
      return;
    }

    const selectedClassId = window.store.state.selectedClassId || classes[0].id;
    if (window.store.state.selectedClassId !== selectedClassId) {
      window.store.state.selectedClassId = selectedClassId;
      window.store.saveState();
    }
    const activeClass = classes.find(c => c.id === selectedClassId) || classes[0];

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <label class="form-label" style="margin: 0;">Grupo:</label>
          <select class="form-select" style="width: auto;" onchange="window.checklistEngine.changeGroup(this.value)">
            ${classes.map(c => `<option value="${c.id}" ${c.id === selectedClassId ? 'selected' : ''}>${c.groupLabel}</option>`).join('')}
          </select>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn ${this.activeTab === 'checklists' ? 'btn-primary' : 'btn-outline'}" onclick="window.checklistEngine.setTab('checklists')">
            <i class="fa-solid fa-list-check"></i> Listas de entrega
          </button>
          <button class="btn ${this.activeTab === 'documents' ? 'btn-primary' : 'btn-outline'}" onclick="window.checklistEngine.setTab('documents')">
            <i class="fa-solid fa-file-lines"></i> Documentos
          </button>
        </div>
      </div>
      <div id="listados-tab-content"></div>
    `;

    if (this.activeTab === 'checklists') {
      this.renderChecklistsTab(activeClass);
    } else {
      this.renderDocumentsTab(activeClass);
    }
  }

  changeGroup(classId) {
    window.store.state.selectedClassId = classId;
    window.store.saveState();
    this.activeChecklistId = null;
    this.renderListadosView();
  }

  setTab(tab) {
    this.activeTab = tab;
    this.activeChecklistId = null;
    this.renderListadosView();
  }

  // ==================== LISTAS DE ENTREGA ====================

  renderChecklistsTab(activeClass) {
    const el = document.getElementById('listados-tab-content');
    if (!el) return;

    if (this.activeChecklistId) {
      this.renderChecklistDetail(activeClass);
      return;
    }

    const lists = (window.store.state.checklists || []).filter(c => c.groupLabel === activeClass.groupLabel);

    el.innerHTML = `
      <div style="display: flex; justify-content: flex-end; margin-bottom: 0.85rem;">
        <button class="btn btn-secondary" onclick="window.checklistEngine.openNewChecklistModal()">
          <i class="fa-solid fa-plus"></i> Nueva lista
        </button>
      </div>
      ${lists.length === 0 ? `
        <div style="border: 1px dashed var(--border-color); border-radius: var(--radius-lg); padding: 2rem; text-align: center; color: var(--text-muted);">
          Sin listas todavía para ${activeClass.groupLabel}. Crea una, por ejemplo "Autorización excursión museo" o "Tarea Tema 3".
        </div>
      ` : `
        <div class="classes-cards-grid">
          ${lists.map(list => {
            const roster = window.clasesEngine.studentsForClass(activeClass);
            const delivered = roster.filter(s => list.entries[s.id] && list.entries[s.id].delivered).length;
            return `
              <div class="class-group-card" onclick="window.checklistEngine.openChecklist('${list.id}')">
                <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                  <div style="font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; color: var(--text-primary);">
                    ${list.title}
                  </div>
                  <button onclick="event.stopPropagation(); window.checklistEngine.deleteChecklist('${list.id}')" style="border: none; background: none; color: var(--text-muted); cursor: pointer;" title="Eliminar lista">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px;">
                  <i class="fa-solid fa-users"></i> ${delivered}/${roster.length} entregado${delivered === 1 ? '' : 's'}${list.hasGrade ? ' · con nota' : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  }

  openNewChecklistModal() {
    document.getElementById('edit-checklist-title').value = '';
    document.getElementById('edit-checklist-hasgrade').checked = false;
    window.app.openModal('modal-checklist');
  }

  saveChecklistFromModal() {
    const title = document.getElementById('edit-checklist-title').value.trim();
    const hasGrade = document.getElementById('edit-checklist-hasgrade').checked;
    if (!title) {
      window.app.showToast('Escribe qué estás registrando (el título de la lista).', 'warning');
      return;
    }

    const activeClass = (window.store.state.classes || []).find(c => c.id === window.store.state.selectedClassId);
    if (!activeClass) return;

    window.store.state.checklists.push({
      id: `CHK-${Date.now()}`,
      groupLabel: activeClass.groupLabel,
      title,
      hasGrade,
      entries: {}
    });
    window.store.saveState();
    window.app.closeModal('modal-checklist');
    this.renderListadosView();
    window.app.showToast('Lista creada.', 'success');
  }

  deleteChecklist(id) {
    if (!confirm('¿Eliminar esta lista? Se perderá el registro de quién ha entregado.')) return;
    window.store.state.checklists = (window.store.state.checklists || []).filter(c => c.id !== id);
    window.store.saveState();
    this.renderListadosView();
    window.app.showToast('Lista eliminada.', 'info');
  }

  openChecklist(id) {
    this.activeChecklistId = id;
    this.renderListadosView();
  }

  backToChecklists() {
    this.activeChecklistId = null;
    this.renderListadosView();
  }

  renderChecklistDetail(activeClass) {
    const el = document.getElementById('listados-tab-content');
    const list = (window.store.state.checklists || []).find(c => c.id === this.activeChecklistId);
    if (!list) {
      this.activeChecklistId = null;
      this.renderChecklistsTab(activeClass);
      return;
    }

    const roster = window.clasesEngine.studentsForClass(activeClass);
    const delivered = roster.filter(s => list.entries[s.id] && list.entries[s.id].delivered).length;

    el.innerHTML = `
      <button class="btn btn-outline" onclick="window.checklistEngine.backToChecklists()" style="margin-bottom: 1rem;">
        <i class="fa-solid fa-arrow-left"></i> Volver a las listas
      </button>

      <div style="margin-bottom: 1rem;">
        <h3 style="font-family: var(--font-display); font-size: 1.2rem; color: var(--text-primary);">${list.title}</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem;">${activeClass.groupLabel} · ${delivered}/${roster.length} entregado${delivered === 1 ? '' : 's'}</p>
      </div>

      ${roster.length === 0 ? `
        <div style="border: 1px dashed var(--border-color); border-radius: var(--radius-md); padding: 1.5rem; text-align: center; color: var(--text-muted);">
          Sin alumnado en este grupo todavía.
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${roster.map(s => {
            const entry = list.entries[s.id] || { delivered: false, grade: '' };
            return `
              <div style="display: flex; align-items: center; gap: 0.75rem; background: var(--bg-tertiary); padding: 0.65rem 0.85rem; border-radius: var(--radius-md);">
                <div style="flex: 1; font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">
                  ${s.name} ${s.neae ? '<span class="neae-badge" style="font-size: 0.62rem;">NEAE</span>' : ''}
                </div>
                ${list.hasGrade ? `
                  <input type="text" value="${entry.grade || ''}" placeholder="Nota"
                    onchange="window.checklistEngine.updateGrade('${list.id}', '${s.id}', this.value)"
                    style="width: 70px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 6px 8px; font-size: 0.85rem; text-align: center; background: var(--bg-secondary); color: var(--text-primary);">
                ` : ''}
                <button onclick="window.checklistEngine.toggleDelivered('${list.id}', '${s.id}')"
                  style="border: 1px solid ${entry.delivered ? 'var(--subj-ciencias-border)' : 'var(--border-color)'}; background: ${entry.delivered ? 'var(--subj-ciencias-bg)' : 'var(--bg-secondary)'}; color: ${entry.delivered ? 'var(--subj-ciencias)' : 'var(--text-muted)'}; font-weight: 700; font-size: 0.82rem; padding: 8px 14px; border-radius: var(--radius-md); cursor: pointer; white-space: nowrap;">
                  <i class="fa-solid ${entry.delivered ? 'fa-check' : 'fa-minus'}"></i> ${entry.delivered ? 'Entregado' : 'Pendiente'}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  }

  toggleDelivered(checklistId, studentId) {
    const list = (window.store.state.checklists || []).find(c => c.id === checklistId);
    if (!list) return;
    if (!list.entries[studentId]) list.entries[studentId] = { delivered: false, grade: '' };
    list.entries[studentId].delivered = !list.entries[studentId].delivered;
    window.store.saveState();
    this.renderListadosView();
  }

  updateGrade(checklistId, studentId, value) {
    const list = (window.store.state.checklists || []).find(c => c.id === checklistId);
    if (!list) return;
    if (!list.entries[studentId]) list.entries[studentId] = { delivered: false, grade: '' };
    list.entries[studentId].grade = value;
    window.store.saveState();
  }

  // ==================== DOCUMENTOS ====================

  renderDocumentsTab(activeClass) {
    const el = document.getElementById('listados-tab-content');
    if (!el) return;

    const docs = (window.store.state.documents || []).filter(d => d.groupLabel === activeClass.groupLabel);
    const roster = window.clasesEngine.studentsForClass(activeClass);

    el.innerHTML = `
      <div style="display: flex; justify-content: flex-end; margin-bottom: 0.85rem;">
        <button class="btn btn-secondary" onclick="window.checklistEngine.openUploadDocumentModal()">
          <i class="fa-solid fa-upload"></i> Subir documento
        </button>
      </div>
      ${docs.length === 0 ? `
        <div style="border: 1px dashed var(--border-color); border-radius: var(--radius-lg); padding: 2rem; text-align: center; color: var(--text-muted);">
          Sin documentos guardados para ${activeClass.groupLabel} todavía. Autorizaciones, justificantes, dinero de salidas... aquí puedes tenerlos siempre a mano.
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${docs.map(d => {
            const student = roster.find(s => s.id === d.studentId);
            return `
              <div style="display: flex; align-items: center; gap: 0.75rem; background: var(--bg-tertiary); padding: 0.65rem 0.85rem; border-radius: var(--radius-md);">
                <i class="fa-solid ${d.fileType === 'pdf' ? 'fa-file-pdf' : 'fa-file-image'}" style="color: var(--accent-primary); font-size: 1.2rem;"></i>
                <div style="flex: 1;">
                  <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary);">${d.title}</div>
                  <div style="font-size: 0.76rem; color: var(--text-muted);">${student ? student.name : 'General del grupo'} · ${new Date(d.uploadedAt).toLocaleDateString('es-ES')}</div>
                </div>
                <button class="btn btn-outline" onclick="window.checklistEngine.viewDocument('${d.id}')" style="padding: 6px 10px;">
                  <i class="fa-solid fa-eye"></i> Ver
                </button>
                <button onclick="window.checklistEngine.deleteDocument('${d.id}')" style="border: none; background: none; color: var(--text-muted); cursor: pointer;" title="Eliminar">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  }

  openUploadDocumentModal() {
    if (!window.supabaseConfigured) {
      window.app.showToast('Falta configurar Supabase para poder subir documentos.', 'warning');
      return;
    }
    const activeClass = (window.store.state.classes || []).find(c => c.id === window.store.state.selectedClassId);
    const roster = activeClass ? window.clasesEngine.studentsForClass(activeClass) : [];

    document.getElementById('edit-document-title').value = '';
    document.getElementById('edit-document-file').value = '';
    const select = document.getElementById('edit-document-student');
    select.innerHTML = `<option value="">General del grupo (no de un alumno concreto)</option>` +
      roster.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    window.app.openModal('modal-document-upload');
  }

  async uploadDocumentFromModal() {
    const title = document.getElementById('edit-document-title').value.trim();
    const studentId = document.getElementById('edit-document-student').value;
    const fileInput = document.getElementById('edit-document-file');
    const file = fileInput.files[0];

    if (!title) { window.app.showToast('Escribe un título para el documento.', 'warning'); return; }
    if (!file) { window.app.showToast('Elige un archivo (PDF o foto).', 'warning'); return; }
    if (!window.sb || !window.store.userId) { window.app.showToast('Falta configurar Supabase.', 'warning'); return; }

    const activeClass = (window.store.state.classes || []).find(c => c.id === window.store.state.selectedClassId);
    if (!activeClass) return;

    window.app.showToast('Subiendo archivo…', 'info');

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const docId = `DOC-${Date.now()}`;
    const path = `${window.store.userId}/${docId}.${ext}`;

    const { error } = await window.sb.storage.from('documentos-alumnado').upload(path, file);
    if (error) {
      window.app.showToast('Error al subir el archivo: ' + error.message, 'warning');
      return;
    }

    window.store.state.documents.push({
      id: docId,
      title,
      studentId: studentId || '',
      groupLabel: activeClass.groupLabel,
      storagePath: path,
      fileType: file.type.includes('pdf') ? 'pdf' : 'image',
      fileName: file.name,
      uploadedAt: new Date().toISOString()
    });
    window.store.saveState();

    window.app.closeModal('modal-document-upload');
    this.renderListadosView();
    window.app.showToast('Documento guardado.', 'success');
  }

  async viewDocument(docId) {
    const doc = (window.store.state.documents || []).find(d => d.id === docId);
    if (!doc || !window.sb) return;

    const { data, error } = await window.sb.storage.from('documentos-alumnado').createSignedUrl(doc.storagePath, 300);
    if (error || !data) {
      window.app.showToast('No se pudo abrir el archivo.', 'warning');
      return;
    }
    window.open(data.signedUrl, '_blank');
  }

  async deleteDocument(docId) {
    if (!confirm('¿Eliminar este documento? No se podrá deshacer.')) return;
    const doc = (window.store.state.documents || []).find(d => d.id === docId);
    if (!doc) return;

    if (window.sb) {
      await window.sb.storage.from('documentos-alumnado').remove([doc.storagePath]);
    }
    window.store.state.documents = (window.store.state.documents || []).filter(d => d.id !== docId);
    window.store.saveState();
    this.renderListadosView();
    window.app.showToast('Documento eliminado.', 'info');
  }
}

window.checklistEngine = new ChecklistEngine();
