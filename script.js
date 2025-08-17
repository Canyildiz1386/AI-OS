(() => {
  const terminalIcon = document.getElementById('terminalIcon');
  const terminalWindow = document.getElementById('terminalWindow');
  const terminalOutput = document.getElementById('terminalOutput');
  const terminalInput = document.getElementById('terminalInput');
  const terminalPrompt = document.getElementById('terminalPrompt');
  const titlebar = document.getElementById('terminalTitlebar');
  const btnClose = document.getElementById('btnClose');
  const btnMin = document.getElementById('btnMin');
  const btnMax = document.getElementById('btnMax');

  function openTerminal() {
    terminalWindow.classList.remove('hidden');
    setTimeout(() => terminalInput.focus(), 0);
  }

  function closeTerminal() {
    terminalWindow.classList.add('hidden');
  }

  function minimizeTerminal() {
    terminalWindow.style.display = 'none';
    setTimeout(() => {
      terminalWindow.style.display = '';
      terminalWindow.classList.add('hidden');
    }, 0);
  }

  function maximizeRestoreTerminal() {
    const isMax = terminalWindow.dataset.maximized === 'true';
    if (isMax) {
      terminalWindow.style.top = terminalWindow.dataset.prevTop;
      terminalWindow.style.left = terminalWindow.dataset.prevLeft;
      terminalWindow.style.width = terminalWindow.dataset.prevWidth;
      terminalWindow.style.height = terminalWindow.dataset.prevHeight;
      terminalWindow.dataset.maximized = 'false';
    } else {
      terminalWindow.dataset.prevTop = terminalWindow.style.top || '120px';
      terminalWindow.dataset.prevLeft = terminalWindow.style.left || '120px';
      terminalWindow.dataset.prevWidth = terminalWindow.style.width || '720px';
      terminalWindow.dataset.prevHeight = terminalWindow.style.height || '420px';
      terminalWindow.style.top = '0px';
      terminalWindow.style.left = '0px';
      terminalWindow.style.width = '100vw';
      terminalWindow.style.height = '100vh';
      terminalWindow.dataset.maximized = 'true';
    }
  }

  terminalIcon.addEventListener('click', openTerminal);
  btnClose.addEventListener('click', closeTerminal);
  btnMin.addEventListener('click', minimizeTerminal);
  btnMax.addEventListener('click', maximizeRestoreTerminal);

  // Drag window
  let dragState = null;
  titlebar.addEventListener('mousedown', (e) => {
    if (terminalWindow.dataset.maximized === 'true') return;
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      startTop: parseInt(window.getComputedStyle(terminalWindow).top, 10) || 0,
      startLeft: parseInt(window.getComputedStyle(terminalWindow).left, 10) || 0
    };
    terminalWindow.classList.add('dragging');
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    terminalWindow.style.top = `${dragState.startTop + dy}px`;
    terminalWindow.style.left = `${dragState.startLeft + dx}px`;
  });
  window.addEventListener('mouseup', () => {
    if (!dragState) return;
    dragState = null;
    terminalWindow.classList.remove('dragging');
  });

  // Simple shell implementation
  const helpText = [
    'Available commands:',
    '  help       - Show this help',
    '  echo [txt] - Print text',
    '  date       - Show current date/time',
    '  clear      - Clear the screen',
    '  whoami     - Show current user',
    '  uname      - Show system info',
    '  ls         - List desktop apps and files',
    '  open X     - Open app (files|terminal)',
    '  create F   - Create empty file F',
    '  read F     - Show contents of file F',
    '  write F T  - Write text T to file F',
    '  delete F   - Delete file F',
  ].join('\n');

  function printLine(text = '') {
    const div = document.createElement('div');
    div.textContent = text;
    terminalOutput.appendChild(div);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  async function runCommand(input, fromAi = false) {
    const [cmd, ...args] = input.trim().split(/\s+/);
    switch (cmd) {
      case '':
        return;
      case 'help':
        printLine(helpText);
        break;
      case 'echo':
        printLine(args.join(' '));
        break;
      case 'date':
        printLine(new Date().toString());
        break;
      case 'clear':
        terminalOutput.innerHTML = '';
        break;
      case 'whoami':
        printLine('user');
        break;
      case 'uname':
        printLine('AI-OS Linux x86_64');
        break;
      case 'ls':
        {
          const items = await filesApi.list();
          const names = items.map(f => f.name);
          printLine(['Terminal.desktop', 'Files.desktop', ...names].join('\n'));
        }
        break;
      case 'open':
        if (args[0] === 'files') { openFm(); }
        else if (args[0] === 'terminal') { openTerminal(); }
        else { printLine('usage: open files|terminal'); }
        break;
      case 'create':
        if (!args[0]) { printLine('usage: create <filename>'); break; }
        await filesApi.save(args[0], '');
        printLine(`created ${args[0]}`);
        break;
      case 'read':
        if (!args[0]) { printLine('usage: read <filename>'); break; }
        {
          const f = await filesApi.get(args[0]);
          if (!f) printLine(`no such file: ${args[0]}`); else printLine(f.content || '');
        }
        break;
      case 'write':
        if (!args[0]) { printLine('usage: write <filename> <content...>'); break; }
        await filesApi.save(args[0], args.slice(1).join(' '));
        printLine(`wrote ${args[0]}`);
        break;
      case 'delete':
        if (!args[0]) { printLine('usage: delete <filename>'); break; }
        await filesApi.remove(args[0]);
        printLine(`deleted ${args[0]}`);
        break;
      default:
        if (!fromAi) {
          const ai = await aiSuggest(input);
          if (ai?.command) {
            printLine(`AI> ${ai.command}`);
            await runCommand(ai.command, true);
          } else {
            printLine(`command not found: ${cmd}`);
            if (ai?.error) printLine(`AI error: ${ai.error}`);
          }
        } else {
          printLine(`command not found: ${cmd}`);
        }
    }
  }

  function onEnter() {
    const input = terminalInput.value;
    printLine(`${terminalPrompt.textContent} ${input}`);
    runCommand(input);
    terminalInput.value = '';
  }

  terminalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onEnter();
  });

  async function aiSuggest(input) {
    try {
      const res = await fetch('/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
      });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const data = await res.json();
      return data;
    } catch (e) {
      return { error: String(e) };
    }
  }

  // Focus terminal when clicking inside
  document.addEventListener('keydown', (e) => {
    if (e.key === '`' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      openTerminal();
    }
  });

  // IndexedDB minimal wrapper
  const DB_NAME = 'ai-os';
  const DB_VERSION = 1;
  const STORE_FILES = 'files';

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          const store = db.createObjectStore(STORE_FILES, { keyPath: 'name' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function withStore(mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, mode);
      const store = tx.objectStore(STORE_FILES);
      const result = fn(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  const filesApi = {
    async list() {
      return withStore('readonly', (store) => {
        return new Promise((resolve, reject) => {
          const items = [];
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const cur = cursor.result;
            if (cur) {
              items.push(cur.value);
              cur.continue();
            } else {
              resolve(items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
            }
          };
          cursor.onerror = () => reject(cursor.error);
        });
      });
    },
    async get(name) {
      return withStore('readonly', (store) => {
        return new Promise((resolve, reject) => {
          const req = store.get(name);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      });
    },
    async save(name, content) {
      const now = Date.now();
      return withStore('readwrite', (store) => {
        store.put({ name, content, updatedAt: now });
      });
    },
    async remove(name) {
      return withStore('readwrite', (store) => {
        store.delete(name);
      });
    }
  };

  // File Manager UI
  const fmIcon = document.getElementById('fmIcon');
  const fmWindow = document.getElementById('fmWindow');
  const fmTitlebar = document.getElementById('fmTitlebar');
  const fmBtnClose = document.getElementById('fmBtnClose');
  const fmBtnMin = document.getElementById('fmBtnMin');
  const fmBtnMax = document.getElementById('fmBtnMax');
  const fmList = document.getElementById('fmList');
  const fmEditor = document.getElementById('fmEditor');
  const fmNewFile = document.getElementById('fmNewFile');
  const fmRefresh = document.getElementById('fmRefresh');
  const fmFilename = document.getElementById('fmFilename');
  const fmContent = document.getElementById('fmContent');
  const fmSave = document.getElementById('fmSave');
  const fmCancel = document.getElementById('fmCancel');

  function openFm() {
    fmWindow.classList.remove('hidden');
    renderList();
  }
  function closeFm() { fmWindow.classList.add('hidden'); }
  function minimizeFm() {
    fmWindow.style.display = 'none';
    setTimeout(() => { fmWindow.style.display = ''; fmWindow.classList.add('hidden'); }, 0);
  }
  function maximizeRestoreFm() {
    const isMax = fmWindow.dataset.maximized === 'true';
    if (isMax) {
      fmWindow.style.top = fmWindow.dataset.prevTop;
      fmWindow.style.left = fmWindow.dataset.prevLeft;
      fmWindow.style.width = fmWindow.dataset.prevWidth;
      fmWindow.style.height = fmWindow.dataset.prevHeight;
      fmWindow.dataset.maximized = 'false';
    } else {
      fmWindow.dataset.prevTop = fmWindow.style.top || '120px';
      fmWindow.dataset.prevLeft = fmWindow.style.left || '120px';
      fmWindow.dataset.prevWidth = fmWindow.style.width || '720px';
      fmWindow.dataset.prevHeight = fmWindow.style.height || '420px';
      fmWindow.style.top = '10px';
      fmWindow.style.left = '10px';
      fmWindow.style.width = '90vw';
      fmWindow.style.height = '80vh';
      fmWindow.dataset.maximized = 'true';
    }
  }

  fmIcon.addEventListener('click', openFm);
  fmBtnClose.addEventListener('click', closeFm);
  fmBtnMin.addEventListener('click', minimizeFm);
  fmBtnMax.addEventListener('click', maximizeRestoreFm);

  // Dragging for File Manager
  let fmDrag = null;
  fmTitlebar.addEventListener('mousedown', (e) => {
    if (fmWindow.dataset.maximized === 'true') return;
    fmDrag = {
      startX: e.clientX,
      startY: e.clientY,
      startTop: parseInt(window.getComputedStyle(fmWindow).top, 10) || 0,
      startLeft: parseInt(window.getComputedStyle(fmWindow).left, 10) || 0
    };
    fmWindow.classList.add('dragging');
  });
  window.addEventListener('mousemove', (e) => {
    if (!fmDrag) return;
    const dx = e.clientX - fmDrag.startX;
    const dy = e.clientY - fmDrag.startY;
    fmWindow.style.top = `${fmDrag.startTop + dy}px`;
    fmWindow.style.left = `${fmDrag.startLeft + dx}px`;
  });
  window.addEventListener('mouseup', () => {
    if (!fmDrag) return;
    fmDrag = null;
    fmWindow.classList.remove('dragging');
  });

  let currentEditingName = null;

  async function renderList() {
    const items = await filesApi.list();
    fmList.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'fm-item';
      empty.innerHTML = '<span class="name">No files yet</span>';
      fmList.appendChild(empty);
      return;
    }
    for (const file of items) {
      const row = document.createElement('div');
      row.className = 'fm-item';
      const date = file.updatedAt ? new Date(file.updatedAt).toLocaleString() : '';
      row.innerHTML = `
        <span class="name">${file.name}</span>
        <span class="meta">${date}</span>
        <span class="row-actions">
          <button data-action="open">Open</button>
          <button data-action="delete">Delete</button>
        </span>
      `;
      row.querySelector('[data-action="open"]').addEventListener('click', async () => {
        const f = await filesApi.get(file.name);
        currentEditingName = f?.name || null;
        fmFilename.value = f?.name || '';
        fmContent.value = f?.content || '';
        fmEditor.classList.remove('hidden');
      });
      row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        await filesApi.remove(file.name);
        if (currentEditingName === file.name) {
          fmEditor.classList.add('hidden');
          currentEditingName = null;
        }
        renderList();
      });
      fmList.appendChild(row);
    }
  }

  fmNewFile.addEventListener('click', () => {
    currentEditingName = null;
    fmFilename.value = '';
    fmContent.value = '';
    fmEditor.classList.remove('hidden');
    fmFilename.focus();
  });
  fmRefresh.addEventListener('click', renderList);
  fmCancel.addEventListener('click', () => {
    fmEditor.classList.add('hidden');
  });

  fmSave.addEventListener('click', async () => {
    const name = fmFilename.value.trim();
    if (!name) { alert('Please enter a filename, e.g., notes.txt'); return; }
    const content = fmContent.value;
    // If renaming, delete old name after save
    if (currentEditingName && currentEditingName !== name) {
      await filesApi.save(name, content);
      await filesApi.remove(currentEditingName);
      currentEditingName = name;
    } else {
      await filesApi.save(name, content);
      currentEditingName = name;
    }
    fmEditor.classList.add('hidden');
    renderList();
  });
})();


