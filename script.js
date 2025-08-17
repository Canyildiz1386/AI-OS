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
    '  ls         - List desktop apps',
  ].join('\n');

  function printLine(text = '') {
    const div = document.createElement('div');
    div.textContent = text;
    terminalOutput.appendChild(div);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  function runCommand(input) {
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
        printLine('Terminal.desktop');
        break;
      default:
        printLine(`command not found: ${cmd}`);
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

  // Focus terminal when clicking inside
  document.addEventListener('keydown', (e) => {
    if (e.key === '`' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      openTerminal();
    }
  });
})();


