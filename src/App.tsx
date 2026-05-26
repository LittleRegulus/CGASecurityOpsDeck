import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import ipuLogo from '../IPUlogo.png';
import exportedOpsState from '../cga-ipu-opsdeck-backup-2026-05-26 (2).json';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Crosshair,
  Database,
  FileSearch,
  Filter,
  Gamepad2,
  Layers,
  LocateFixed,
  MapPin,
  Moon,
  NotebookPen,
  Plus,
  Radio,
  Satellite,
  Search,
  Shield,
  Siren,
  StickyNote,
  Trash2,
  Users,
  X,
  Zap
} from 'lucide-react';

type ToolMode = 'inspect' | 'pin' | 'note' | 'zone';
type MapStyle = 'ops' | 'satellite';
type Priority = 'low' | 'medium' | 'high' | 'critical';
type CaseStatus = 'open' | 'monitoring' | 'closed';

type Pin = {
  id: string;
  label: string;
  category: string;
  priority: Priority;
  color?: string;
  lat: number;
  lng: number;
  note: string;
  createdAt: string;
};

type Sticky = {
  id: string;
  title: string;
  body: string;
  category: string;
  lat: number;
  lng: number;
  x?: number;
  y?: number;
  createdAt: string;
};

type Zone = {
  id: string;
  name: string;
  category?: string;
  level: Priority;
  coordinates: [number, number][];
  note: string;
};

type Task = {
  id: string;
  title: string;
  owner: string;
  due: string;
  priority: Priority;
  done: boolean;
  completedAt?: string;
};

type IntelCase = {
  id: string;
  subject: string;
  type: string;
  status: CaseStatus;
  priority: Priority;
  updatedAt: string;
  summary: string;
};

type OpsState = {
  pins: Pin[];
  stickies: Sticky[];
  zones: Zone[];
  tasks: Task[];
  cases: IntelCase[];
  activeCategory: string;
};

type CollapsedPanels = {
  command: boolean;
  intelligence: boolean;
};

const PARK_CENTER: [number, number] = [-121.9747, 37.3979];
const STORAGE_KEY = 'cga-security-opsdeck-state-v1';
const PANEL_STATE_KEY = 'cga-security-panel-state-v1';

const categories = ['All', 'Park Ops', 'Rides', 'Interactions', 'Parking', 'Investigations', 'Associate', 'Guest Safety', 'Lost & Found', 'Medical', 'Access Control'];
const priorities: Priority[] = ['low', 'medium', 'high', 'critical'];
const pinColors = ['#64f4b4', '#42e8f5', '#ffd166', '#ff8f3d', '#ff3b5c', '#b197fc', '#f8f9fa'];

const starterState: OpsState = {
  activeCategory: 'All',
  pins: [
    {
      id: crypto.randomUUID(),
      label: 'Security Base',
      category: 'Park Ops',
      priority: 'high',
      lat: 37.3979,
      lng: -121.9747,
      note: 'Primary coordination point for shift briefings and incident triage.',
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      label: 'Main Gate Watch',
      category: 'Guest Safety',
      priority: 'medium',
      lat: 37.3997,
      lng: -121.9779,
      note: 'Monitor entry queues, guest services escalations, and re-entry exceptions.',
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      label: 'Gold Striker Queue',
      category: 'Interactions',
      priority: 'medium',
      lat: 37.3971,
      lng: -121.9782,
      note: 'Ride interaction point: queue conduct, lost property handoffs, and guest dispute notes.',
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      label: 'Games Midway',
      category: 'Interactions',
      priority: 'low',
      lat: 37.3976,
      lng: -121.9752,
      note: 'Games interaction point: prize disputes, unattended property, and suspicious behavior reports.',
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      label: 'Ride Operations Hub',
      category: 'Interactions',
      priority: 'medium',
      lat: 37.3961,
      lng: -121.9735,
      note: 'Coordinate with ride leads for guest safety patterns and camera follow-up.',
      createdAt: new Date().toISOString(),
    },
  ],
  stickies: [
    {
      id: crypto.randomUUID(),
      title: 'Shift Intel',
      body: 'Keep active BOLOs, trespass advisories, and priority follow-ups summarized here.',
      category: 'Investigations',
      lat: 37.3968,
      lng: -121.9729,
      createdAt: new Date().toISOString(),
    },
  ],
  zones: [
    {
      id: crypto.randomUUID(),
      name: 'Front Gate Envelope',
      level: 'medium',
      note: 'High-contact guest screening and incident response zone.',
      coordinates: [
        [-121.9791, 37.4011],
        [-121.9759, 37.4011],
        [-121.9759, 37.3984],
        [-121.9791, 37.3984],
        [-121.9791, 37.4011],
      ],
    },
  ],
  tasks: [
    { id: crypto.randomUUID(), title: 'Review overnight incident notes', owner: 'Intel', due: 'Today', priority: 'high', done: false },
    { id: crypto.randomUUID(), title: 'Update BOLO board for supervisor review', owner: 'Investigations', due: '1400', priority: 'medium', done: false },
    { id: crypto.randomUUID(), title: 'Confirm camera coverage gaps', owner: 'Ops', due: 'EOD', priority: 'low', done: true },
  ],
  cases: [
    {
      id: crypto.randomUUID(),
      subject: 'Case CGA-INT-001',
      type: 'Associate / policy support',
      status: 'monitoring',
      priority: 'medium',
      updatedAt: new Date().toISOString(),
      summary: 'Placeholder case card for structured notes, evidence links, and authorized follow-up.',
    },
    {
      id: crypto.randomUUID(),
      subject: 'Guest Safety Pattern',
      type: 'Guest safety',
      status: 'open',
      priority: 'high',
      updatedAt: new Date().toISOString(),
      summary: 'Track recurring locations, times, witness statements, and supervisor-approved actions.',
    },
  ],
};

const defaultState: OpsState = {
  ...starterState,
  ...(exportedOpsState as unknown as OpsState),
};

const resourceLinks = [
  { label: 'Santa Clara PD', type: 'Agency', url: 'https://www.santaclaraca.gov/our-city/departments-g-z/police-department' },
  { label: 'Santa Clara Fire', type: 'Agency', url: 'https://www.santaclaraca.gov/our-city/departments-g-z/fire-department' },
  { label: 'NWS Bay Area', type: 'Weather', url: 'https://www.weather.gov/mtr/' },
  { label: 'USGS Earthquakes', type: 'Situational', url: 'https://earthquake.usgs.gov/earthquakes/map/' },
  { label: 'California Megan Law', type: 'Public registry', url: 'https://www.meganslaw.ca.gov/' },
  { label: 'Santa Clara County GIS', type: 'Maps', url: 'https://www.sccgov.org/sites/isd/gis/Pages/gis.aspx' },
];

function loadState(): OpsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    return { ...defaultState, ...JSON.parse(raw) };
  } catch {
    return defaultState;
  }
}

function priorityColor(priority: Priority) {
  return {
    low: '#63e6be',
    medium: '#ffd166',
    high: '#ff8f3d',
    critical: '#ff3b5c',
  }[priority];
}

function categoryAllowed(category: string, active: string) {
  return active === 'All' || category === active;
}

function pinColor(pin: Pin) {
  return pin.color || priorityColor(pin.priority);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function loadPanelState(): CollapsedPanels {
  try {
    const raw = localStorage.getItem(PANEL_STATE_KEY);
    return raw ? { command: false, intelligence: false, ...JSON.parse(raw) } as CollapsedPanels : { command: false, intelligence: false };
  } catch {
    return { command: false, intelligence: false };
  }
}

function createZoneAt(lng: number, lat: number): Zone {
  const width = 0.0012;
  const height = 0.00075;
  return {
    id: crypto.randomUUID(),
    name: 'New Response Zone',
    category: 'Park Ops',
    level: 'medium',
    note: 'Define patrol boundaries, rally points, or restricted-area notes.',
    coordinates: [
      [lng - width, lat + height],
      [lng + width, lat + height],
      [lng + width, lat - height],
      [lng - width, lat - height],
      [lng - width, lat + height],
    ],
  };
}

function getZoneCenter(zone: Zone): [number, number] {
  const corners = zone.coordinates.slice(0, 4);
  const total = corners.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);
  return [total[0] / corners.length, total[1] / corners.length];
}

function createZoneHandleData(zone: Zone | undefined) {
  if (!zone) return { type: 'FeatureCollection' as const, features: [] };
  const corners = zone.coordinates.slice(0, 4).map((coordinates, index) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates },
    properties: { id: zone.id, kind: 'handle', index },
  }));
  return {
    type: 'FeatureCollection' as const,
    features: [
      ...corners,
      {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: getZoneCenter(zone) },
        properties: { id: zone.id, kind: 'ok', label: 'OK' },
      },
    ],
  };
}

function createZoneLabelData(zones: Zone[]) {
  return {
    type: 'FeatureCollection' as const,
    features: zones.map(zone => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: getZoneCenter(zone) },
      properties: {
        id: zone.id,
        name: zone.name,
        note: zone.note,
        color: priorityColor(zone.level),
        hasNote: Boolean(zone.note.trim()),
        noteLabel: zone.note.trim() ? `NOTE: ${zone.note.trim()}` : '',
      },
    })),
  };
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [ops, setOps] = useState<OpsState>(loadState);
  const [tool, setTool] = useState<ToolMode>('inspect');
  const [mapStyle, setMapStyle] = useState<MapStyle>('satellite');
  const [selected, setSelected] = useState<{ type: 'pin' | 'sticky' | 'zone'; id: string } | null>(null);
  const [selectedPanelItem, setSelectedPanelItem] = useState<{ type: 'task' | 'case'; id: string } | null>(null);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'intel' | 'tasks' | 'resources' | null>(null);
  const [query, setQuery] = useState('');
  const [showClosedCases, setShowClosedCases] = useState(false);
  const [collapsedPanels, setCollapsedPanels] = useState(loadPanelState);
  const [zoneView, setZoneView] = useState<'filtered' | 'only' | 'hidden'>('filtered');
  const [showScreenStickies, setShowScreenStickies] = useState(true);
  const toolRef = useRef<ToolMode>(tool);
  const activeCategoryRef = useRef(ops.activeCategory);
  const zoneDragRef = useRef<{ zoneId: string; index: number } | null>(null);
  const now = useClock();

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    activeCategoryRef.current = ops.activeCategory;
  }, [ops.activeCategory]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
  }, [ops]);

  useEffect(() => {
    localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(collapsedPanels));
  }, [collapsedPanels]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const cutoff = Date.now() - 60_000;
      setOps(current => {
        const tasks = current.tasks.filter(task => !task.done || !task.completedAt || new Date(task.completedAt).getTime() > cutoff);
        return tasks.length === current.tasks.length ? current : { ...current, tasks };
      });
    }, 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredPins = useMemo(
    () => zoneView === 'only' ? [] : ops.pins.filter(pin => categoryAllowed(pin.category, ops.activeCategory) && pin.label.toLowerCase().includes(query.toLowerCase())),
    [ops.pins, ops.activeCategory, query, zoneView]
  );
  const filteredStickies = useMemo(
    () => zoneView === 'only' ? [] : ops.stickies.filter(note => categoryAllowed(note.category, ops.activeCategory) && `${note.title} ${note.body}`.toLowerCase().includes(query.toLowerCase())),
    [ops.stickies, ops.activeCategory, query, zoneView]
  );
  const filteredZones = useMemo(() => {
    if (zoneView === 'hidden') return [];
    const zoneMatches = (zone: Zone) => categoryAllowed(zone.category || 'Park Ops', ops.activeCategory) && `${zone.name} ${zone.note}`.toLowerCase().includes(query.toLowerCase());
    return ops.zones.filter(zoneMatches);
  }, [ops.activeCategory, ops.zones, query, zoneView]);
  const filteredCases = useMemo(
    () => ops.cases.filter(item => (showClosedCases || item.status !== 'closed') && `${item.subject} ${item.type} ${item.summary}`.toLowerCase().includes(query.toLowerCase())),
    [ops.cases, query, showClosedCases]
  );

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      center: PARK_CENTER,
      zoom: 16.2,
      minZoom: 13,
      maxZoom: 20,
      pitch: 38,
      bearing: -18,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 20,
          },
          labels: {
            type: 'raster',
            tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
          },
          ops: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
          },
          pins: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          zones: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          zoneLabels: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          zoneHandles: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          centerline: {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-121.9796, 37.3979], [-121.9704, 37.3979]] }, properties: {} },
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-121.9747, 37.4025], [-121.9747, 37.3932]] }, properties: {} },
              ],
            },
          },
        },
        layers: [
          { id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-opacity': 1 } },
          { id: 'ops', type: 'raster', source: 'ops', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.78 } },
          { id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.55 } },
          { id: 'zone-fill', type: 'fill', source: 'zones', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 } },
          { id: 'zone-line', type: 'line', source: 'zones', paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-dasharray': [2, 1] } },
          { id: 'zone-label', type: 'symbol', source: 'zoneLabels', layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-font': ['Open Sans Bold'], 'text-transform': 'uppercase', 'text-max-width': 14, 'text-allow-overlap': true }, paint: { 'text-color': '#f2fff8', 'text-halo-color': '#06100d', 'text-halo-width': 2.6 } },
          { id: 'zone-note-label', type: 'symbol', source: 'zoneLabels', minzoom: 15.8, filter: ['==', ['get', 'hasNote'], true], layout: { 'text-field': ['get', 'noteLabel'], 'text-size': 10, 'text-font': ['Open Sans Regular'], 'text-offset': [0, 2.25], 'text-max-width': 20, 'text-allow-overlap': false }, paint: { 'text-color': '#fff1a8', 'text-halo-color': '#1b1604', 'text-halo-width': 1.4 } },
          { id: 'zone-handle-dot', type: 'circle', source: 'zoneHandles', filter: ['==', ['get', 'kind'], 'handle'], paint: { 'circle-radius': 8, 'circle-color': '#05100d', 'circle-stroke-color': '#64f4b4', 'circle-stroke-width': 3 } },
          { id: 'zone-ok-dot', type: 'circle', source: 'zoneHandles', filter: ['==', ['get', 'kind'], 'ok'], paint: { 'circle-radius': 15, 'circle-color': '#64f4b4', 'circle-stroke-color': '#05100d', 'circle-stroke-width': 2 } },
          { id: 'zone-ok-label', type: 'symbol', source: 'zoneHandles', filter: ['==', ['get', 'kind'], 'ok'], layout: { 'text-field': ['get', 'label'], 'text-size': 10, 'text-font': ['Open Sans Bold'] }, paint: { 'text-color': '#05100d' } },
          { id: 'centerline', type: 'line', source: 'centerline', paint: { 'line-color': '#42e8f5', 'line-width': 1, 'line-opacity': 0.35, 'line-dasharray': [1, 2] } },
          { id: 'pin-glow', type: 'circle', source: 'pins', paint: { 'circle-radius': 18, 'circle-color': ['get', 'color'], 'circle-opacity': 0.14, 'circle-blur': 0.7 } },
          { id: 'pin-dot', type: 'circle', source: 'pins', paint: { 'circle-radius': 7, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#f6fff9', 'circle-stroke-width': 1.5 } },
          { id: 'pin-label', type: 'symbol', source: 'pins', minzoom: 15, layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-font': ['Open Sans Bold'], 'text-offset': [0, 1.45], 'text-max-width': 10 }, paint: { 'text-color': '#eefbf3', 'text-halo-color': '#06100d', 'text-halo-width': 1.4 } },
        ],
      },
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    mapRef.current = map;

    map.on('dblclick', event => {
      event.preventDefault();
      const lng = event.lngLat.lng;
      const lat = event.lngLat.lat;
      const mouseEvent = event.originalEvent as MouseEvent;
      setOps(current => ({
        ...current,
        stickies: [
          ...current.stickies,
          { id: crypto.randomUUID(), title: 'New Sticky', body: 'Add notes, reminders, or follow-up context.', category: 'Park Ops', lat, lng, x: mouseEvent.clientX, y: mouseEvent.clientY, createdAt: new Date().toISOString() },
        ],
      }));
    });

    map.on('click', event => {
      const lng = event.lngLat.lng;
      const lat = event.lngLat.lat;
      const zoneAction = map.queryRenderedFeatures(event.point, { layers: ['zone-ok-dot', 'zone-ok-label'] })[0];
      if (zoneAction?.properties?.kind === 'ok') {
        setEditingZoneId(null);
        return;
      }
      const currentTool = toolRef.current;
      if (currentTool === 'pin') {
        const pin: Pin = { id: crypto.randomUUID(), label: 'New Pin', category: activeCategoryRef.current === 'All' ? 'Park Ops' : activeCategoryRef.current, priority: 'medium', lat, lng, note: '', createdAt: new Date().toISOString() };
        setOps(current => ({ ...current, pins: [...current.pins, pin] }));
        setSelected({ type: 'pin', id: pin.id });
        setEditingZoneId(null);
        return;
      }
      if (currentTool === 'note') {
        const mouseEvent = event.originalEvent as MouseEvent;
        const note: Sticky = { id: crypto.randomUUID(), title: 'New Sticky', body: '', category: activeCategoryRef.current === 'All' ? 'Park Ops' : activeCategoryRef.current, lat, lng, x: mouseEvent.clientX, y: mouseEvent.clientY, createdAt: new Date().toISOString() };
        setOps(current => ({ ...current, stickies: [...current.stickies, note] }));
        setSelected({ type: 'sticky', id: note.id });
        setEditingZoneId(null);
        return;
      }
      const features = map.queryRenderedFeatures(event.point, { layers: ['pin-dot', 'zone-label', 'zone-note-label', 'zone-fill'] });
      const hit = features[0];
      if (hit?.source === 'pins') {
        setSelected({ type: 'pin', id: String(hit.properties?.id) });
        setEditingZoneId(null);
        return;
      }
      if (hit?.source === 'zones') {
        const id = String(hit.properties?.id);
        setSelected({ type: 'zone', id });
        setEditingZoneId(toolRef.current === 'zone' ? id : null);
        return;
      }
      if (hit?.source === 'zoneLabels') {
        const id = String(hit.properties?.id);
        setSelected({ type: 'zone', id });
        setEditingZoneId(toolRef.current === 'zone' ? id : null);
        return;
      }
      if (currentTool === 'zone') {
        const zone = createZoneAt(lng, lat);
        zone.category = activeCategoryRef.current === 'All' ? 'Park Ops' : activeCategoryRef.current;
        setOps(current => ({ ...current, zones: [...current.zones, zone] }));
        setSelected({ type: 'zone', id: zone.id });
        setEditingZoneId(zone.id);
      }
    });

    const startZoneDrag = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || toolRef.current !== 'zone') return;
      event.preventDefault();
      zoneDragRef.current = { zoneId: String(feature.properties?.id), index: Number(feature.properties?.index) };
      map.dragPan.disable();
    };

    const moveZoneDrag = (event: maplibregl.MapMouseEvent) => {
      const drag = zoneDragRef.current;
      if (!drag) return;
      const nextPoint: [number, number] = [event.lngLat.lng, event.lngLat.lat];
      setOps(current => ({
        ...current,
        zones: current.zones.map(zone => {
          if (zone.id !== drag.zoneId) return zone;
          const coordinates = [...zone.coordinates] as [number, number][];
          coordinates[drag.index] = nextPoint;
          if (drag.index === 0) coordinates[4] = nextPoint;
          return { ...zone, coordinates };
        }),
      }));
    };

    const endZoneDrag = () => {
      if (!zoneDragRef.current) return;
      zoneDragRef.current = null;
      map.dragPan.enable();
    };

    map.on('mouseenter', 'zone-handle-dot', () => { map.getCanvas().style.cursor = 'grab'; });
    map.on('mouseleave', 'zone-handle-dot', () => { if (!zoneDragRef.current) map.getCanvas().style.cursor = ''; });
    map.on('mousedown', 'zone-handle-dot', startZoneDrag);
    map.on('mousemove', moveZoneDrag);
    map.on('mouseup', endZoneDrag);
    (map as any).on('touchstart', 'zone-handle-dot', startZoneDrag);
    (map as any).on('touchmove', moveZoneDrag);
    (map as any).on('touchend', endZoneDrag);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pins = filteredPins.map(pin => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [pin.lng, pin.lat] },
      properties: { ...pin, color: pinColor(pin) },
    }));
    const zones = filteredZones.map(zone => ({
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [zone.coordinates] },
      properties: { ...zone, color: priorityColor(zone.level) },
    }));
    (map.getSource('pins') as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: pins });
    (map.getSource('zones') as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: zones });
    (map.getSource('zoneLabels') as maplibregl.GeoJSONSource | undefined)?.setData(createZoneLabelData(filteredZones));
    (map.getSource('zoneHandles') as maplibregl.GeoJSONSource | undefined)?.setData(createZoneHandleData(tool === 'zone' ? filteredZones.find(zone => zone.id === editingZoneId) : undefined));
  }, [filteredPins, filteredZones, editingZoneId, tool]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getLayer('satellite') || !map.getLayer('ops')) return;
    map.setLayoutProperty('satellite', 'visibility', mapStyle === 'satellite' ? 'visible' : 'none');
    map.setLayoutProperty('labels', 'visibility', mapStyle === 'satellite' ? 'visible' : 'none');
    map.setLayoutProperty('ops', 'visibility', mapStyle === 'ops' ? 'visible' : 'none');
  }, [mapStyle]);

  const selectedRecord = useMemo(() => {
    if (!selected) return null;
    if (selected.type === 'pin') return ops.pins.find(item => item.id === selected.id) || null;
    if (selected.type === 'sticky') return ops.stickies.find(item => item.id === selected.id) || null;
    return ops.zones.find(item => item.id === selected.id) || null;
  }, [ops, selected]);

  const updateSelected = (patch: Record<string, string>) => {
    if (!selected) return;
    setOps(current => {
      if (selected.type === 'pin') return { ...current, pins: current.pins.map(item => item.id === selected.id ? { ...item, ...patch } as Pin : item) };
      if (selected.type === 'sticky') return { ...current, stickies: current.stickies.map(item => item.id === selected.id ? { ...item, ...patch } as Sticky : item) };
      return { ...current, zones: current.zones.map(item => item.id === selected.id ? { ...item, ...patch } as Zone : item) };
    });
  };

  const selectedPanelRecord = useMemo(() => {
    if (!selectedPanelItem) return null;
    if (selectedPanelItem.type === 'task') return ops.tasks.find(item => item.id === selectedPanelItem.id) || null;
    return ops.cases.find(item => item.id === selectedPanelItem.id) || null;
  }, [ops.cases, ops.tasks, selectedPanelItem]);

  const updatePanelItem = (patch: Partial<Task> | Partial<IntelCase>) => {
    if (!selectedPanelItem) return;
    setOps(current => {
      if (selectedPanelItem.type === 'task') {
        return { ...current, tasks: current.tasks.map(item => item.id === selectedPanelItem.id ? { ...item, ...patch } as Task : item) };
      }
      return { ...current, cases: current.cases.map(item => item.id === selectedPanelItem.id ? { ...item, ...patch, updatedAt: new Date().toISOString() } as IntelCase : item) };
    });
  };

  const deletePanelItem = () => {
    if (!selectedPanelItem) return;
    setOps(current => ({
      ...current,
      tasks: selectedPanelItem.type === 'task' ? current.tasks.filter(item => item.id !== selectedPanelItem.id) : current.tasks,
      cases: selectedPanelItem.type === 'case' ? current.cases.filter(item => item.id !== selectedPanelItem.id) : current.cases,
    }));
    setSelectedPanelItem(null);
  };

  const deleteSelected = () => {
    if (!selected) return;
    const selectedSnapshot = selected;
    setOps(current => ({
      ...current,
      pins: selectedSnapshot.type === 'pin' ? current.pins.filter(item => item.id !== selectedSnapshot.id) : current.pins,
      stickies: selectedSnapshot.type === 'sticky' ? current.stickies.filter(item => item.id !== selectedSnapshot.id) : current.stickies,
      zones: selectedSnapshot.type === 'zone' ? current.zones.filter(item => item.id !== selectedSnapshot.id) : current.zones,
    }));
    if (selectedSnapshot.type === 'zone') setEditingZoneId(null);
    setSelected(null);
  };

  const addTask = () => {
    setOps(current => ({
      ...current,
      tasks: [{ id: crypto.randomUUID(), title: 'New reminder', owner: 'Security', due: 'Today', priority: 'medium', done: false }, ...current.tasks],
    }));
  };

  const addCase = () => {
    setOps(current => ({
      ...current,
      cases: [{
        id: crypto.randomUUID(),
        subject: 'New Intel Case',
        type: 'Security / Investigations',
        status: 'open',
        priority: 'medium',
        updatedAt: new Date().toISOString(),
        summary: 'Add authorized notes, source links, timeline context, and supervisor-approved next steps.',
      }, ...current.cases],
    }));
  };

  const locatePark = () => {
    mapRef.current?.flyTo({ center: PARK_CENTER, zoom: 16.6, pitch: 42, bearing: -18, duration: 1200 });
  };

  const addNoteToSelectedZone = () => {
    const zoneId = selected?.type === 'zone' ? selected.id : editingZoneId;
    if (!zoneId) return;
    const zone = ops.zones.find(item => item.id === zoneId);
    if (!zone) return;
    const [lng, lat] = getZoneCenter(zone);
    const note: Sticky = {
      id: crypto.randomUUID(),
      title: `${zone.name} Note`,
      body: zone.note || 'Add zone-specific note, reminder, or patrol context.',
      category: 'Park Ops',
      lat,
      lng,
      x: Math.round(window.innerWidth / 2 - 110),
      y: Math.round(window.innerHeight / 2 - 90),
      createdAt: new Date().toISOString(),
    };
    setOps(current => ({ ...current, stickies: [...current.stickies, note] }));
    setShowScreenStickies(true);
    setSelected({ type: 'sticky', id: note.id });
  };

  const moveSticky = (id: string, x: number, y: number) => {
    setOps(current => ({
      ...current,
      stickies: current.stickies.map(item => item.id === id ? { ...item, x, y } : item),
    }));
  };

  const exportOps = () => {
    const blob = new Blob([JSON.stringify(ops, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cga-ipu-opsdeck-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importOps = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const nextState = JSON.parse(text) as OpsState;
    setOps({ ...defaultState, ...nextState });
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <section className="brand">
          <div className="brand-mark"><img src={ipuLogo} alt="IPU" /></div>
          <div>
            <h1>CGA IPU OpsDeck</h1>
            <p>Intelligence · Prevention · Operations</p>
          </div>
        </section>
        <section className="status-strip">
          <span><Radio size={13} /> OPS ONLINE</span>
          <span><CalendarClock size={13} /> {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span><Users size={13} /> SHIFT INTEL</span>
        </section>
      </header>

      <aside className={`left-panel panel desktop-panel ${collapsedPanels.command ? 'panel-collapsed' : ''}`}>
        <div className="panel-header">
          <div>
            <span className="eyebrow">Command Filters</span>
            <h2>Operating picture</h2>
          </div>
          <button className="collapse-button" onClick={() => setCollapsedPanels(current => ({ ...current, command: !current.command }))}>
            {collapsedPanels.command ? <ChevronDown size={16} /> : <X size={16} />}
          </button>
        </div>
        {!collapsedPanels.command && (
          <>
            <div className="search-field">
              <Search size={15} />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search pins, notes, cases" />
            </div>
            <div className="category-grid">
              {categories.map(category => (
                <button key={category} onClick={() => setOps(current => ({ ...current, activeCategory: category }))} className={ops.activeCategory === category ? 'active' : ''}>
                  {category}
                </button>
              ))}
            </div>
            <div className="zone-view-toggle">
              <button className={zoneView === 'filtered' ? 'active' : ''} onClick={() => setZoneView('filtered')}>Zones On</button>
              <button className={zoneView === 'only' ? 'active' : ''} onClick={() => setZoneView('only')}>Zones Only</button>
              <button className={zoneView === 'hidden' ? 'active' : ''} onClick={() => setZoneView('hidden')}>Zones Off</button>
            </div>
            <button className={`sticky-visibility ${showScreenStickies ? 'active' : ''}`} onClick={() => setShowScreenStickies(value => !value)}>
              <StickyNote size={14} />
              {showScreenStickies ? 'Sticky Notes On' : 'Sticky Notes Off'}
            </button>
            <div className="tool-grid">
              {[
                { id: 'inspect' as const, label: 'Inspect', icon: Crosshair },
                { id: 'pin' as const, label: 'Pin', icon: MapPin },
                { id: 'note' as const, label: 'Sticky', icon: StickyNote },
                { id: 'zone' as const, label: 'Zone', icon: Layers },
              ].map(item => (
                <button key={item.id} onClick={() => setTool(item.id)} className={tool === item.id ? 'selected' : ''}>
                  <item.icon size={16} />
                  {item.label}
                </button>
              ))}
            </div>
            <div className="metric-grid">
              <Metric label="Pins" value={ops.pins.length} tone="cyan" />
              <Metric label="Notes" value={ops.stickies.length} tone="gold" />
              <Metric label="Zones" value={filteredZones.length} tone="orange" />
              <Metric label="Open Cases" value={ops.cases.filter(item => item.status !== 'closed').length} tone="red" />
            </div>
            {tool === 'zone' && (
              <section className="zone-help">
                <Layers size={15} />
                <span>Click a zone to edit corners. Drag the green points, then press OK on the map.</span>
              </section>
            )}
            <section className="privacy-card">
              <Shield size={17} />
              <div>
                <strong>Authorized use only</strong>
                <span>Store minimum necessary information. Keep case notes factual, sourced, and supervisor-approved.</span>
              </div>
            </section>
            <Resources embedded />
            <section className="backup-tools">
              <span className="eyebrow">Data Backup</span>
              <div>
                <button onClick={exportOps}>Export Zones</button>
                <button onClick={() => importInputRef.current?.click()}>Import</button>
              </div>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                onChange={event => importOps(event.target.files?.[0])}
              />
            </section>
          </>
        )}
      </aside>

      <section className="map-stage">
        <div ref={mapContainer} className="map" />
        <div className="map-toolbar">
          <button onClick={() => setMapStyle(value => value === 'satellite' ? 'ops' : 'satellite')}>
            {mapStyle === 'satellite' ? <Moon size={16} /> : <Satellite size={16} />}
            {mapStyle === 'satellite' ? 'OPS MAP' : 'SATELLITE'}
          </button>
          <button onClick={locatePark}><LocateFixed size={16} /> CENTER PARK</button>
          <button onClick={() => setTool('pin')} className={tool === 'pin' ? 'hot' : ''}><Plus size={16} /> DROP PIN</button>
          <button onClick={addNoteToSelectedZone} disabled={selected?.type !== 'zone'}><NotebookPen size={16} /> ZONE NOTE</button>
        </div>
        <div className="map-mode">
          <span>{tool.toUpperCase()} MODE</span>
          <ChevronDown size={14} />
        </div>
      </section>

      <aside className={`right-panel panel desktop-panel ${collapsedPanels.intelligence ? 'panel-collapsed' : ''}`}>
        <PanelTitle
          icon={<FileSearch size={18} />}
          eyebrow="Intelligence"
          title="Cases & leads"
          action={
            <>
              <button onClick={addCase}><Plus size={14} /></button>
              <button onClick={() => setCollapsedPanels(current => ({ ...current, intelligence: !current.intelligence }))}>
                {collapsedPanels.intelligence ? <ChevronDown size={14} /> : <X size={14} />}
              </button>
            </>
          }
        />
        {!collapsedPanels.intelligence && (
          <>
            <label className="toggle-row">
              <input type="checkbox" checked={showClosedCases} onChange={event => setShowClosedCases(event.target.checked)} />
              Show closed cases
            </label>
            <div className="case-list">
              {filteredCases.map(item => (
                <article key={item.id} className={`case-card ${item.priority}`} onClick={() => setSelectedPanelItem({ type: 'case', id: item.id })}>
                  <div>
                    <strong>{item.subject}</strong>
                    <span>{item.type}</span>
                  </div>
                  <p>{item.summary}</p>
                  <footer>
                    <span>{item.status}</span>
                    <span>{formatTime(item.updatedAt)}</span>
                  </footer>
                </article>
              ))}
            </div>

            <PanelTitle icon={<ClipboardList size={18} />} eyebrow="Action Board" title="Reminders" action={<button onClick={addTask}><Plus size={14} /></button>} />
            <div className="task-list">
              {ops.tasks.map(task => (
                <label key={task.id} className={`task-card ${task.done ? 'done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => setOps(current => ({ ...current, tasks: current.tasks.map(item => item.id === task.id ? { ...item, done: !item.done, completedAt: !item.done ? new Date().toISOString() : undefined } : item) }))}
                  />
                  <div onClick={event => { event.preventDefault(); setSelectedPanelItem({ type: 'task', id: task.id }); }}>
                    <strong>{task.title}</strong>
                    <span>{task.owner} · {task.due} · {task.priority}</span>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}
      </aside>

      <div className="mobile-nav">
        {[
          { id: 'intel' as const, label: 'Intel', icon: FileSearch },
          { id: 'tasks' as const, label: 'Tasks', icon: ClipboardList },
          { id: 'resources' as const, label: 'Links', icon: Database },
        ].map(item => (
          <button key={item.id} onClick={() => setMobilePanel(mobilePanel === item.id ? null : item.id)}>
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </div>

      {mobilePanel && (
        <div className="mobile-drawer panel">
          <button className="drawer-close" onClick={() => setMobilePanel(null)}><X size={18} /></button>
          {mobilePanel === 'intel' && (
            <>
              <PanelTitle icon={<FileSearch size={18} />} eyebrow="Intelligence" title="Cases & leads" action={<button onClick={addCase}><Plus size={14} /></button>} />
              <div className="case-list">{filteredCases.map(item => <article key={item.id} className={`case-card ${item.priority}`} onClick={() => setSelectedPanelItem({ type: 'case', id: item.id })}><strong>{item.subject}</strong><p>{item.summary}</p></article>)}</div>
            </>
          )}
          {mobilePanel === 'tasks' && (
            <>
              <PanelTitle icon={<ClipboardList size={18} />} eyebrow="Action Board" title="Reminders" action={<button onClick={addTask}><Plus size={14} /></button>} />
              <div className="task-list">{ops.tasks.map(task => <label key={task.id} className="task-card"><input type="checkbox" checked={task.done} onChange={() => setOps(current => ({ ...current, tasks: current.tasks.map(item => item.id === task.id ? { ...item, done: !item.done, completedAt: !item.done ? new Date().toISOString() : undefined } : item) }))} /><div onClick={event => { event.preventDefault(); setSelectedPanelItem({ type: 'task', id: task.id }); }}><strong>{task.title}</strong><span>{task.owner} · {task.due}</span></div></label>)}</div>
            </>
          )}
          {mobilePanel === 'resources' && <Resources />}
        </div>
      )}

      <section className="bottom-console">
        <div><Siren size={15} /> PRIORITY MONITOR</div>
        <Ticker items={ops.tasks.filter(item => !item.done).map(item => `${item.priority.toUpperCase()}: ${item.title}`)} />
      </section>

      {selected && selectedRecord && (
        <EditorOverlay
          selected={selected}
          record={selectedRecord}
          updateSelected={updateSelected}
          deleteSelected={deleteSelected}
          createZoneNote={selected.type === 'zone' ? addNoteToSelectedZone : undefined}
          close={() => setSelected(null)}
        />
      )}

      {showScreenStickies && (
        <StickyLayer
          stickies={filteredStickies}
          selectSticky={id => setSelected({ type: 'sticky', id })}
          moveSticky={moveSticky}
        />
      )}

      {selectedPanelItem && selectedPanelRecord && (
        <PanelItemEditor
          selected={selectedPanelItem}
          record={selectedPanelRecord}
          updatePanelItem={updatePanelItem}
          deletePanelItem={deletePanelItem}
          close={() => setSelectedPanelItem(null)}
        />
      )}
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelTitle({ icon, eyebrow, title, action }: { icon: React.ReactNode; eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="panel-title">
      <div className="title-icon">{icon}</div>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action && <div className="panel-action">{action}</div>}
    </div>
  );
}

function Ticker({ items }: { items: string[] }) {
  return (
    <div className="ticker">
      {(items.length ? items : ['NO ACTIVE REMINDERS']).map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
    </div>
  );
}

function Resources({ embedded = false }: { embedded?: boolean }) {
  return (
    <aside className={embedded ? 'embedded-resources' : ''}>
      <PanelTitle icon={<Database size={18} />} eyebrow="Resources" title="Approved links" />
      <div className="resource-list">
        {resourceLinks.map(link => (
          <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
            <Zap size={13} />
            <div>
              <strong>{link.label}</strong>
              <span>{link.type}</span>
            </div>
          </a>
        ))}
      </div>
    </aside>
  );
}

function StickyLayer({
  stickies,
  selectSticky,
  moveSticky,
}: {
  stickies: Sticky[];
  selectSticky: (id: string) => void;
  moveSticky: (id: string, x: number, y: number) => void;
}) {
  const dragRef = useRef<{ id: string; startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>, sticky: Sticky) => {
    event.preventDefault();
    event.stopPropagation();
    const baseX = sticky.x ?? 120;
    const baseY = sticky.y ?? 140;
    dragRef.current = { id: sticky.id, startX: event.clientX, startY: event.clientY, baseX, baseY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    const nextX = Math.min(Math.max(8, dragRef.current.baseX + event.clientX - dragRef.current.startX), window.innerWidth - 230);
    const nextY = Math.min(Math.max(74, dragRef.current.baseY + event.clientY - dragRef.current.startY), window.innerHeight - 190);
    moveSticky(dragRef.current.id, nextX, nextY);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className="sticky-layer">
      {stickies.map(sticky => (
        <article
          key={sticky.id}
          className="screen-sticky"
          style={{ left: sticky.x ?? 120, top: sticky.y ?? 140 }}
          onClick={() => selectSticky(sticky.id)}
        >
          <button
            className="sticky-corner"
            aria-label="Move sticky note"
            onPointerDown={event => startDrag(event, sticky)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={event => { event.preventDefault(); event.stopPropagation(); }}
          />
          <strong>{sticky.title || 'Sticky Note'}</strong>
          <p>{sticky.body || 'Tap to add details.'}</p>
        </article>
      ))}
    </div>
  );
}

function EditorOverlay({
  selected,
  record,
  updateSelected,
  deleteSelected,
  createZoneNote,
  close,
}: {
  selected: { type: 'pin' | 'sticky' | 'zone'; id: string };
  record: Pin | Sticky | Zone;
  updateSelected: (patch: Record<string, string>) => void;
  deleteSelected: () => void;
  createZoneNote?: () => void;
  close: () => void;
}) {
  const isPin = selected.type === 'pin';
  const isSticky = selected.type === 'sticky';
  return (
    <div className="editor-backdrop">
      <section className="editor panel">
        <div className="editor-head">
          <div>
            <span className="eyebrow">{selected.type}</span>
            <h2>{isPin ? (record as Pin).label : isSticky ? (record as Sticky).title : (record as Zone).name}</h2>
          </div>
          <button onClick={close}><X size={18} /></button>
        </div>
        <label>
          Name
          <input
            value={isPin ? (record as Pin).label : isSticky ? (record as Sticky).title : (record as Zone).name}
            onChange={event => updateSelected({ [isPin ? 'label' : isSticky ? 'title' : 'name']: event.target.value })}
          />
        </label>
        {(isPin || isSticky || selected.type === 'zone') && (
          <label>
            Category
            <select value={(record as Pin | Sticky | Zone).category || 'Park Ops'} onChange={event => updateSelected({ category: event.target.value })}>
              {categories.filter(item => item !== 'All').map(category => <option key={category}>{category}</option>)}
            </select>
          </label>
        )}
        {(isPin || selected.type === 'zone') && (
          <label>
            Priority
            <select value={isPin ? (record as Pin).priority : (record as Zone).level} onChange={event => updateSelected({ [isPin ? 'priority' : 'level']: event.target.value })}>
              {priorities.map(priority => <option key={priority}>{priority}</option>)}
            </select>
          </label>
        )}
        {isPin && (
          <label>
            Pin Color
            <div className="color-swatches">
              {pinColors.map(color => (
                <button
                  key={color}
                  type="button"
                  className={pinColor(record as Pin) === color ? 'selected' : ''}
                  style={{ backgroundColor: color }}
                  onClick={() => updateSelected({ color })}
                  aria-label={`Set pin color ${color}`}
                />
              ))}
            </div>
          </label>
        )}
        <label>
          Notes
          <textarea
            value={isSticky ? (record as Sticky).body : (record as Pin | Zone).note}
            onChange={event => updateSelected({ [isSticky ? 'body' : 'note']: event.target.value })}
          />
        </label>
        <div className="editor-actions">
          <button className="danger" onClick={event => { event.preventDefault(); event.stopPropagation(); deleteSelected(); }}><Trash2 size={15} /> Delete</button>
          {selected.type === 'zone' && createZoneNote && <button onClick={createZoneNote}><NotebookPen size={15} /> Note</button>}
          <button onClick={close}><CheckCircle2 size={15} /> Save</button>
        </div>
      </section>
    </div>
  );
}

function PanelItemEditor({
  selected,
  record,
  updatePanelItem,
  deletePanelItem,
  close,
}: {
  selected: { type: 'task' | 'case'; id: string };
  record: Task | IntelCase;
  updatePanelItem: (patch: Partial<Task> | Partial<IntelCase>) => void;
  deletePanelItem: () => void;
  close: () => void;
}) {
  const isTask = selected.type === 'task';
  return (
    <div className="editor-backdrop">
      <section className="editor panel">
        <div className="editor-head">
          <div>
            <span className="eyebrow">{isTask ? 'reminder' : 'case'}</span>
            <h2>{isTask ? (record as Task).title : (record as IntelCase).subject}</h2>
          </div>
          <button onClick={close}><X size={18} /></button>
        </div>
        {isTask ? (
          <>
            <label>
              Title
              <input value={(record as Task).title} onChange={event => updatePanelItem({ title: event.target.value })} />
            </label>
            <label>
              Owner
              <input value={(record as Task).owner} onChange={event => updatePanelItem({ owner: event.target.value })} />
            </label>
            <label>
              Due
              <input value={(record as Task).due} onChange={event => updatePanelItem({ due: event.target.value })} />
            </label>
            <label>
              Priority
              <select value={(record as Task).priority} onChange={event => updatePanelItem({ priority: event.target.value as Priority })}>
                {priorities.map(priority => <option key={priority}>{priority}</option>)}
              </select>
            </label>
            <label className="editor-check">
              <input
                type="checkbox"
                checked={(record as Task).done}
                onChange={event => updatePanelItem({ done: event.target.checked, completedAt: event.target.checked ? new Date().toISOString() : undefined })}
              />
              Completed
            </label>
          </>
        ) : (
          <>
            <label>
              Subject
              <input value={(record as IntelCase).subject} onChange={event => updatePanelItem({ subject: event.target.value })} />
            </label>
            <label>
              Type
              <input value={(record as IntelCase).type} onChange={event => updatePanelItem({ type: event.target.value })} />
            </label>
            <label>
              Status
              <select value={(record as IntelCase).status} onChange={event => updatePanelItem({ status: event.target.value as CaseStatus })}>
                <option>open</option>
                <option>monitoring</option>
                <option>closed</option>
              </select>
            </label>
            <label>
              Priority
              <select value={(record as IntelCase).priority} onChange={event => updatePanelItem({ priority: event.target.value as Priority })}>
                {priorities.map(priority => <option key={priority}>{priority}</option>)}
              </select>
            </label>
            <label>
              Summary
              <textarea value={(record as IntelCase).summary} onChange={event => updatePanelItem({ summary: event.target.value })} />
            </label>
          </>
        )}
        <div className="editor-actions">
          <button className="danger" onClick={event => { event.preventDefault(); event.stopPropagation(); deletePanelItem(); }}><Trash2 size={15} /> Delete</button>
          <button onClick={close}><CheckCircle2 size={15} /> Save</button>
        </div>
      </section>
    </div>
  );
}

export default App;
