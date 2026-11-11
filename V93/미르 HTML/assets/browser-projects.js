const MAX_RECENT = 10;

function pickProjectFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.hidden = true;
    const finish = (file) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files[0]), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    document.body.append(input);
    input.click();
  });
}

function fileName(title) {
  const safe = String(title || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim().replace(/[. ]+$/, '').slice(0, 110);
  return `${safe || 'wiring'}.mir.json`;
}

function chooseFileName(suggestion) {
  const dialog = document.getElementById('saveNameDialog');
  const input = document.getElementById('saveFileName');
  input.value = suggestion.replace(/\.mir\.json$/i, '');
  dialog.returnValue = '';
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(
      dialog.returnValue === 'save' ? fileName(input.value.trim().replace(/\.mir\.json$/i, '')) : null
    ), { once: true });
    dialog.showModal();
    input.select();
  });
}

function downloadProject(data, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openProjectStorage() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('mir-html-projects', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('recent');
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function makeProjectStore() {
  let databasePromise;
  let memory = [];
  let pending = Promise.resolve();
  function access(read, change) {
    const operation = pending.then(async () => {
      databasePromise ??= openProjectStorage();
      const database = await databasePromise;
      if (database) {
        try {
          memory = await new Promise((resolve, reject) => {
            const transaction = database.transaction('recent', change ? 'readwrite' : 'readonly');
            const store = transaction.objectStore('recent');
            const request = store.get('projects');
            let result;
            transaction.oncomplete = () => resolve(result);
            transaction.onabort = transaction.onerror = () => reject(transaction.error);
            request.onsuccess = () => {
              const records = Array.isArray(request.result) ? request.result : [];
              result = change ? change(records) : records;
              if (change) store.put(result, 'projects');
            };
          });
          return read(memory, true);
        } catch {
          database.close();
          databasePromise = Promise.resolve(null);
        }
      }
      if (change) memory = change(memory);
      return read(memory, false);
    });
    pending = operation.catch(() => {});
    return operation;
  }
  return access;
}

export function createBrowserProjects() {
  const storage = makeProjectStore();
  let activeProject = null;
  let pendingProject = null;
  let revision = 0;

  function remember(project, title, data) {
    const snapshot = structuredClone(data);
    return storage((records, persisted) => persisted, (records) => {
      const previous = records.find((entry) => entry.path === project.path);
      const record = {
        path: project.path,
        filename: project.filename,
        alias: previous?.alias,
        title: previous?.alias || title?.trim() || project.filename,
        data: snapshot
      };
      return [record, ...records.filter((entry) => entry.path !== record.path)].slice(0, MAX_RECENT);
    });
  }

  return {
    async saveProject(data, saveAs = false) {
      const savingRevision = revision;
      let project = !saveAs && activeProject
        ? activeProject : { path: crypto.randomUUID(), filename: fileName(data.title) };
      let handle = project.handle;
      if (!handle && typeof window.showSaveFilePicker === 'function') {
        try {
          handle = await window.showSaveFilePicker({
            suggestedName: project.filename,
            types: [{ description: '미르 프로젝트', accept: { 'application/json': ['.mir.json'] } }]
          });
        } catch (error) {
          if (error.name === 'AbortError') return null;
          if (error.name !== 'SecurityError') throw error;
        }
      }
      if (handle) {
        const stream = await handle.createWritable();
        try {
          await stream.write(JSON.stringify(data, null, 2));
          await stream.close();
        } catch (error) {
          await stream.abort().catch(() => {});
          throw error;
        }
        project = { ...project, handle, filename: handle.name };
        if (revision === savingRevision) activeProject = project;
        await remember(project, data.title, data);
        return { saved: true, message: '프로젝트 파일에 저장했어요.' };
      }
      if (saveAs) {
        const name = await chooseFileName(project.filename);
        if (name === null) return null;
        project.filename = name;
      }
      downloadProject(data, project.filename);
      if (revision === savingRevision) activeProject = project;
      const persisted = await remember(project, data.title, data);
      return {
        saved: persisted,
        message: persisted
          ? '최근 프로젝트에 보관했어요. 파일 다운로드 결과는 브라우저에서 확인해 주세요.'
          : '파일 다운로드를 요청했어요. 브라우저에서 완료됐는지 확인해 주세요. 최근 프로젝트에는 이번 탭에서만 남아요.'
      };
    },
    async openProject(recentPath) {
      const opening = ++revision;
      pendingProject = null;
      let project;
      let data;
      if (recentPath !== undefined) {
        const record = await storage((records) => records.find((entry) => entry.path === recentPath));
        if (!record) throw new Error('최근 프로젝트 목록에서 파일을 찾을 수 없어요.');
        project = { path: record.path, filename: record.filename };
        data = record.data;
      } else {
        const file = await pickProjectFile();
        if (!file || opening !== revision) return null;
        data = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
        project = { path: crypto.randomUUID(), filename: file.name };
      }
      if (opening !== revision) return null;
      pendingProject = { project, data };
      return data;
    },
    async newProject() {
      revision++;
      activeProject = pendingProject = null;
    },
    async acceptOpenProject(title) {
      if (!pendingProject) return;
      const { project, data } = pendingProject;
      activeProject = project;
      pendingProject = null;
      await remember(project, title, data);
    },
    recentProjects: () => storage((records) => records.map(({ path, title }) => ({ path, title }))),
    async updateRecentProject(path, name) {
      if (name !== null && (typeof name !== 'string' || !name.trim() || name.length > 120)) {
        throw new Error('이름을 1~120자로 입력하세요.');
      }
      let found = false;
      await storage(() => {}, (records) => {
        found = records.some((entry) => entry.path === path);
        if (name === null) return records.filter((entry) => entry.path !== path);
        return records.map((entry) => entry.path === path
          ? { ...entry, title: name.trim(), alias: name.trim() } : entry);
      });
      if (!found) throw new Error('최근 프로젝트를 찾을 수 없어요.');
    }
  };
}
