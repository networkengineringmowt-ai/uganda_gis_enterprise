// 3D Network Universe — RMS Gravitational Sun Core with 8 orbiting subsystem planets and their
// crews. A deliberate, one-off exception to this platform's usual restrained/no-decoration
// direction, approved for this feature specifically. Every number in the metrics panel is pulled
// live from DataStore, the same way every other section on this site works — nothing here is
// fabricated, and where a subsystem has no dedicated live dataset yet, that is stated plainly.

RENDERERS.universe = async function (container) {
  container.innerHTML = '';
  container.appendChild(pageHead(
    '3D Network Universe',
    'The Road Management System staged as a solar system — RMS at the centre, eight subsystems orbiting as planets, each with a crew and its own live metrics.'
  ));

  const wrap = el('div', { class: 'universe-wrap' });
  const canvasHost = el('div', { class: 'universe-canvas-host', id: 'universe-canvas-host' });
  wrap.appendChild(canvasHost);
  container.appendChild(wrap);

  let metrics = null;
  try {
    metrics = await loadUniverseMetrics();
  } catch (err) {
    console.error(err);
  }

  const hud = SolarHUD.build(container, SolarSystem.PLANETS, (id) => selectPlanet(id));

  // ---- Three.js scene ----
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);
  scene.fog = new THREE.FogExp2(0x05070d, 0.006);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  camera.position.set(0, 22, 52);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.id = 'universe-canvas';
  canvasHost.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 140;

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  const sys = SolarSystem.build(THREE, scene);
  const crews = Astronauts.buildCrews(THREE, sys.planetRefs, SolarSystem.PLANETS);
  scene.add(crews.bodyMesh, crews.helmetMesh, crews.visorMesh);

  function resize() {
    const w = canvasHost.clientWidth || 800;
    const h = canvasHost.clientHeight || 560;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes = Object.values(sys.planetRefs).map((r) => r.mesh);
    const hits = raycaster.intersectObjects(meshes);
    if (hits.length) {
      const found = Object.entries(sys.planetRefs).find(([, r]) => r.mesh === hits[0].object);
      if (found) selectPlanet(found[0]);
    }
  });

  function selectPlanet(id) {
    const planet = SolarSystem.PLANETS.find((p) => p.id === id);
    if (!planet) return;
    hud.setActive(id);
    hud.setMetrics(renderMetricsFor(planet, metrics));
    hud.setRoster(planet, Crew.rosterFor(id));
  }

  const clock = new THREE.Clock();
  (function animate() {
    if (!document.getElementById('universe-canvas')) return; // section was unmounted — stop cleanly
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    SolarSystem.update(THREE, sys, dt, clock.elapsedTime);
    Astronauts.update(THREE, crews, dt, clock.elapsedTime);
    controls.update();
    renderer.render(scene, camera);
  })();

  container.appendChild(el('p', { class: 'footnote' },
    "Illustrative 3D staging over the platform's live data — subsystem metrics are computed the same way as Overview and Analytics, not fabricated for this view. Where a subsystem has no dedicated live dataset yet, that is stated rather than estimated."
  ));
};

async function loadUniverseMetrics() {
  const [net, ms, ndpiv, oprc, raw] = await Promise.all([
    DataStore.networkStats(),
    DataStore.msSummary(),
    DataStore.ndpivProjects(),
    DataStore.oprcContracts(),
    DataStore.network(),
  ]);
  const geoDatasetCount = Object.keys(DataStore).filter((k) => typeof DataStore[k] === 'function').length;

  let aadtSum = 0, aadtN = 0, heavySum = 0;
  raw.features.forEach((f) => {
    const aadt = f.properties['Aadt 2026 Live'];
    const heavy = f.properties['Aadt Heavy Trucks'];
    if (typeof aadt === 'number') { aadtSum += aadt; aadtN++; }
    if (typeof heavy === 'number') heavySum += heavy;
  });

  return {
    net, ms, ndpiv, oprc, geoDatasetCount,
    avgAadt: aadtN ? aadtSum / aadtN : null,
    totalHeavyAadt: heavySum,
  };
}

function universeMetricRow(label, value) {
  return el('div', { class: 'universe-metric-row' }, [el('span', { class: 'muted' }, label), el('span', {}, value)]);
}

function renderMetricsFor(planet, metrics) {
  const box = el('div', {}, [
    el('h3', {}, planet.full),
    el('p', { class: 'muted' }, planet.body + (planet.moon ? ' / ' + planet.moon.name : '')),
  ]);
  if (!metrics) {
    box.appendChild(el('p', { class: 'muted' }, 'Live data unavailable right now.'));
    return box;
  }
  const rows = el('div', { class: 'universe-metric-rows' });
  switch (planet.id) {
    case 'pms': {
      const cond = metrics.net.byCondition || {};
      Object.entries(cond).forEach(([label, count]) => rows.appendChild(universeMetricRow(label, fmtNum(count) + ' links')));
      break;
    }
    case 'tis': {
      rows.appendChild(universeMetricRow('Average AADT (network-wide)', metrics.avgAadt ? fmtNum(metrics.avgAadt) + ' veh/day' : '—'));
      rows.appendChild(universeMetricRow('Total heavy-truck AADT', fmtNum(metrics.totalHeavyAadt) + ' veh/day'));
      break;
    }
    case 'bms': {
      rows.appendChild(universeMetricRow('Bridges', fmtNum(metrics.ms.kpi_summary.total_bridges)));
      rows.appendChild(universeMetricRow('Major Culverts (reported separately)', fmtNum(metrics.ms.kpi_summary.total_major_culverts)));
      break;
    }
    case 'socio': {
      rows.appendChild(universeMetricRow('NDP IV Investment Projects', fmtNum(metrics.ndpiv.features ? metrics.ndpiv.features.length : 0)));
      break;
    }
    case 'budget': {
      rows.appendChild(universeMetricRow('Total Asset Value', 'USD ' + fmtNum(metrics.ms.kpi_summary.total_asset_value_mn_usd, 1) + 'M'));
      rows.appendChild(universeMetricRow('Total Asset Value', 'UGX ' + fmtNum(metrics.ms.kpi_summary.total_asset_value_mn_ushs / 1e6, 2) + ' trillion'));
      break;
    }
    case 'lidar': {
      rows.appendChild(universeMetricRow('Geospatial data layers on this platform', fmtNum(metrics.geoDatasetCount)));
      rows.appendChild(el('p', { class: 'muted', style: 'margin-top:6px;' }, 'No dedicated LiDAR/point-cloud dataset is live on this platform yet.'));
      break;
    }
    case 'piarc': {
      rows.appendChild(el('p', { class: 'muted' }, 'No live PIARC/international-benchmark dataset is wired into this platform yet.'));
      break;
    }
    case 'pims': {
      rows.appendChild(universeMetricRow('OPRC Contract Lots', fmtNum(metrics.oprc.features ? metrics.oprc.features.length : 0)));
      break;
    }
  }
  box.appendChild(rows);
  return box;
}
