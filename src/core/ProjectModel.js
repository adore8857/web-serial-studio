/**
 * ProjectModel — Project file data model (JSON schema)
 */

export const defaultProject = () => ({
  title: 'Untitled Project',
  separator: ',',
  frameStart: '',
  frameEnd: '\\n',
  frameDetection: 'EndDelimiterOnly',
  groups: [
    {
      title: 'Sensor Data',
      widget: 'MultiPlot',
      datasets: [
        { title: 'Temperature', index: 0, units: '°C', widget: 'Gauge', min: -20, max: 80, alarm: 50, led: false, fft: false, plot: true, bar: true, gauge: true, compass: false },
        { title: 'Humidity', index: 1, units: '%', widget: 'Bar', min: 0, max: 100, alarm: 85, led: false, fft: false, plot: true, bar: true, gauge: false, compass: false },
        { title: 'Pressure', index: 2, units: 'hPa', widget: 'Gauge', min: 900, max: 1100, alarm: 0, led: false, fft: false, plot: true, bar: false, gauge: true, compass: false },
      ]
    }
  ]
});

export class ProjectModel {
  constructor() {
    this._project = null;
  }

  get project() { return this._project; }
  get hasProject() { return this._project !== null; }
  get title() { return this._project?.title || 'Untitled'; }
  get groups() { return this._project?.groups || []; }

  loadFromJSON(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      this._project = this._validateProject(data);
      return true;
    } catch (e) {
      console.error('ProjectModel: Failed to load project', e);
      return false;
    }
  }

  loadDefault() {
    this._project = defaultProject();
    return true;
  }

  exportJSON() {
    return JSON.stringify(this._project, null, 2);
  }

  addGroup(title = 'New Group') {
    if (!this._project) this._project = defaultProject();
    this._project.groups.push({
      title,
      widget: 'DataGrid',
      datasets: []
    });
  }

  removeGroup(index) {
    if (!this._project) return;
    this._project.groups.splice(index, 1);
  }

  addDataset(groupIndex, title = 'New Dataset') {
    if (!this._project) return;
    const group = this._project.groups[groupIndex];
    if (!group) return;
    const idx = group.datasets.length;
    group.datasets.push({
      title,
      index: idx,
      units: '',
      widget: 'Bar',
      min: 0,
      max: 100,
      alarm: 0,
      led: false,
      fft: false,
      plot: true,
      bar: true,
      gauge: false,
      compass: false
    });
  }

  removeDataset(groupIndex, datasetIndex) {
    if (!this._project) return;
    const group = this._project.groups[groupIndex];
    if (!group) return;
    group.datasets.splice(datasetIndex, 1);
  }

  _validateProject(data) {
    return {
      title: data.title || 'Untitled',
      separator: data.separator || ',',
      frameStart: data.frameStart || '',
      frameEnd: data.frameEnd || '\\n',
      frameDetection: data.frameDetection || 'EndDelimiterOnly',
      groups: (data.groups || []).map(g => ({
        title: g.title || 'Group',
        widget: g.widget || 'DataGrid',
        datasets: (g.datasets || []).map((d, i) => ({
          title: d.title || `Dataset ${i + 1}`,
          index: d.index ?? i,
          units: d.units || '',
          widget: d.widget || 'Bar',
          min: d.min ?? 0,
          max: d.max ?? 100,
          alarm: d.alarm ?? 0,
          led: d.led ?? false,
          fft: d.fft ?? false,
          plot: d.plot ?? true,
          bar: d.bar ?? false,
          gauge: d.gauge ?? false,
          compass: d.compass ?? false
        }))
      }))
    };
  }
}
