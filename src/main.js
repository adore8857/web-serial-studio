/**
 * main.js — Application entry point
 */
import { eventBus } from './core/EventBus.js';
import { appState } from './core/AppState.js';
import { ConnectionManager } from './io/ConnectionManager.js';
import { DataSimulator } from './io/DataSimulator.js';
import { Toolbar } from './ui/Toolbar.js';
import { Sidebar } from './ui/Sidebar.js';
import { Dashboard } from './ui/Dashboard.js';
import { Console } from './ui/Console.js';
import { ProjectModel } from './core/ProjectModel.js';
import { PreferencesDialog } from './ui/PreferencesDialog.js';

class App {
  constructor() {
    this._conn = new ConnectionManager();
    this._sim = new DataSimulator();
    this._project = new ProjectModel();
    this._dashboard = null;
    this._console = null;
    this._prefs = null;
    this._init();
  }

  _init() {
    const root = document.getElementById('app');
    root.innerHTML = `
      <div id="toolbar-root"></div>
      <div class="main-area" id="main-area">
        <div id="sidebar-root"></div>
        <div class="dashboard-container" id="content-area">
          <div id="dashboard-area" class="dashboard-container" style="display:flex;flex-direction:column;flex:1;overflow:hidden"></div>
          <div id="console-area" style="height:100%;display:none;flex-direction:column;flex:1;overflow:hidden"></div>
        </div>
      </div>
      <div id="taskbar-root"></div>
      <div id="toast-container" style="position:fixed;bottom:50px;right:16px;display:flex;flex-direction:column;gap:8px;z-index:500;pointer-events:none"></div>
      <div id="modal-root"></div>`;

    // Toolbar
    new Toolbar(document.getElementById('toolbar-root'), this._conn, this._sim);

    // Sidebar
    new Sidebar(document.getElementById('sidebar-root'));

    // Dashboard
    const dashArea = document.getElementById('dashboard-area');
    this._dashboard = new Dashboard(dashArea);

    // Console
    const conArea = document.getElementById('console-area');
    this._console = new Console(conArea, this._conn);

    // Preferences Dialog
    this._prefs = new PreferencesDialog(document.getElementById('modal-root'));

    // Taskbar
    this._renderTaskbar();

    // Event bindings
    this._bindGlobalEvents();
  }

  _renderTaskbar() {
    const el = document.getElementById('taskbar-root');
    el.innerHTML = `
      <div class="taskbar">
        <button class="taskbar-menu-btn" id="tb-menu">☰ Menu</button>
        <div class="taskbar-tabs">
          <button class="taskbar-tab active" data-ws="dashboard">
            <span class="taskbar-tab-icon">📈</span> Dashboard
          </button>
          <button class="taskbar-tab" data-ws="console">
            <span class="taskbar-tab-icon">💻</span> Console
          </button>
        </div>
        <div class="taskbar-status">
          <div class="taskbar-status-item">
            <span style="color:var(--accent-cyan)">⬡</span>
            <span id="tb-mode">${appState.operationMode}</span>
          </div>
          <div class="taskbar-status-item">
            <span>📋</span>
            <span id="tb-project">No Project</span>
          </div>
        </div>
      </div>`;

    el.querySelectorAll('.taskbar-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        el.querySelectorAll('.taskbar-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const ws = tab.dataset.ws;
        document.getElementById('dashboard-area').style.display = ws === 'dashboard' ? 'flex' : 'none';
        document.getElementById('dashboard-area').style.flexDirection = 'column';
        document.getElementById('console-area').style.display = ws === 'console' ? 'flex' : 'none';
        document.getElementById('console-area').style.flexDirection = ws === 'console' ? 'column' : 'none';
        appState.currentWorkspace = ws;
      });
    });
  }

  _bindGlobalEvents() {
    // Sidebar toggle
    eventBus.on('ui:toggleSidebar', () => {
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return;
      sidebar.classList.toggle('collapsed');
    });

    // Toast notifications
    eventBus.on('toast', ({ type, message }) => this._showToast(type, message));

    // Empty-state quick-start buttons
    eventBus.on('ui:startSimulator', () => {
      this._sim?.start?.();
      this._sim?.toggle?.();
      eventBus.emit('toast', { type: 'info', message: 'Demo Simulator started!' });
    });
    eventBus.on('project:openFile', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json';
      input.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => eventBus.emit('project:load', ev.target.result);
        reader.readAsText(file);
      });
      input.click();
    });


    // Project load from file
    eventBus.on('project:load', (jsonStr) => {
      if (this._project.loadFromJSON(jsonStr)) {
        this._dashboard.buildFromProject(this._project.project);
        appState.operationMode = 'ProjectFile';
        const tbProject = document.getElementById('tb-project');
        if (tbProject) tbProject.textContent = this._project.title;
        eventBus.emit('toast', { type: 'success', message: `Loaded: ${this._project.title}` });
      } else {
        eventBus.emit('toast', { type: 'error', message: 'Failed to parse project file' });
      }
    });

    // Project save
    eventBus.on('project:save', () => {
      const json = this._project.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (this._project.title || 'project') + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    // Taskbar mode label
    eventBus.on('state:operationModeChanged', (mode) => {
      const el = document.getElementById('tb-mode');
      if (el) el.textContent = mode;
    });

    // Apply JSON schema from sidebar editor (DeviceSendsJSON mode)
    eventBus.on('project:applyJSON', (schema) => {
      // Build a project-compatible structure from the compact JSON format
      const groups = (schema.g || schema.groups || []).map((g, gi) => ({
        title: g.t || g.title || `Group ${gi + 1}`,
        widget: g.w || g.widget || 'MultiPlot',
        datasets: (g.d || g.datasets || []).map((d, di) => ({
          title: d.t || d.title || `Dataset ${di + 1}`,
          index: di,
          units: d.u || d.units || '',
          min: d.min ?? 0,
          max: d.max ?? 100,
          gauge: d.g ?? false,
          bar: d.b ?? false,
          widget: d.w || 'Bar'
        }))
      }));
      const project = {
        title: schema.t || schema.title || 'Device Project',
        groups
      };
      this._dashboard.buildFromProject(project);
      const tbProject = document.getElementById('tb-project');
      if (tbProject) tbProject.textContent = project.title;
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        eventBus.emit('ui:toggleSidebar');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        eventBus.emit('ui:openPreferences');
      }
    });
  }

  _showToast(type, message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const colors = {
      success: '#10b981', error: '#ef4444',
      info: '#3b82f6', warning: '#f59e0b'
    };
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

    const toast = document.createElement('div');
    toast.style.cssText = `
      display:flex;align-items:center;gap:8px;
      padding:10px 14px;
      background:rgba(12,18,32,0.95);
      border:1px solid ${colors[type]}40;
      border-left:3px solid ${colors[type]};
      border-radius:8px;
      color:#f1f5f9;
      font-size:13px;
      pointer-events:auto;
      box-shadow:0 4px 12px rgba(0,0,0,0.5);
      animation:fadeInUp 0.2s ease;
      backdrop-filter:blur(8px);
      max-width:320px;
    `;
    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Boot the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => new App());
