/**
 * WidgetBase — Base class for all dashboard widgets
 */
import { eventBus } from '../core/EventBus.js';

export class WidgetBase {
  constructor(config = {}) {
    this.config = {
      title: config.title || 'Widget',
      icon: config.icon || '📊',
      spanCols: config.spanCols || 1,
      ...config
    };
    this._el = null;
    this._body = null;
    this._destroyed = false;
    this._unsubscribe = null;
  }

  /** Render to a container element and return the widget root */
  mount(container) {
    this._el = document.createElement('div');
    this._el.className = `widget animate-fadeInUp${this.config.spanCols > 1 ? ' widget-span-' + this.config.spanCols : ''}`;
    this._el.innerHTML = `
      <div class="widget-header">
        <div class="widget-title">
          <span class="widget-title-icon">${this.config.icon}</span>
          <span>${this.config.title}</span>
        </div>
        <div class="widget-actions">
          <button class="widget-action-btn" data-action="refresh" title="Reset data">↺</button>
        </div>
      </div>
      <div class="widget-body"></div>
    `;
    this._body = this._el.querySelector('.widget-body');
    this._el.querySelector('[data-action="refresh"]').addEventListener('click', () => this.reset());
    this._render(this._body);
    container.appendChild(this._el);
    this._subscribe();
    return this._el;
  }

  /** Override to render widget content into body */
  _render(body) {}

  /** Override to subscribe to frame events */
  _subscribe() {}

  /** Override to reset widget state */
  reset() {}

  destroy() {
    this._destroyed = true;
    if (this._unsubscribe) this._unsubscribe();
    if (this._el) this._el.remove();
  }
}
