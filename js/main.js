/**
 * Portfolio Interactive Scripts | Yan Almeida
 * Systems Architecture Explorer & Real-Time CSTR Dynamic Simulator
 */

document.addEventListener('DOMContentLoaded', () => {
  initArchExplorer();
  initDynamicSimulator();
  initSmoothScroll();
});

/* =========================================================================
   1. Interactive Architecture Explorer
   ========================================================================= */

const archSpecs = {
  reactorcore: {
    title: "ReactorCore.C — High-Performance C11 ODE Solver",
    badge: "Native C11 / Shared ABI",
    lang: "C11 (gcc -O3 -fPIC)",
    interop: "C Shared Object (.so) ABI via include/reactor_ffi.h",
    algorithm: "4th-Order Classical Runge-Kutta (RK4) with Function Pointers",
    throughput: "Zero-allocation in numerical loops; O(Δt⁴) convergence",
    tests: "27 Automated C Tests (100% pass rate)",
    repoUrl: "https://github.com/yancsalmeida/ReactorCore.C",
    summary: "Pre-allocates cache-friendly workspace in C memory. Computes non-linear Arrhenius reaction kinetics, cooling jacket heat exchange, and runaway thermal detection with zero heap fragmentation."
  },
  processtwin: {
    title: "ProcessTwin.Py — Real-Time Digital Twin & SCADA Engine",
    badge: "Python 3.12 / FastAPI / ctypes",
    lang: "Python 3.12, FastAPI, Asyncio, Pydantic v2",
    interop: "ctypes Foreign Function Interface (FFI) to libreactorcore.so",
    algorithm: "Gaussian Noise Injection (4-20mA), IEC 61511 Safety Interlocks",
    throughput: "9.4x Speedup over pure Python (2.66M integration steps/s)",
    tests: "48 Automated Pytest Tests (100% pass rate)",
    repoUrl: "https://github.com/yancsalmeida/ProcessTwin.Py",
    summary: "Continuous 5 Hz WebSocket telemetry stream, emulated sensor drift and noise, auto-negotiation of batches with ChemFlow.NET and streaming to IndustrialTelemetry.Engine."
  },
  chemflow: {
    title: "ChemFlow.NET — Rigorous Thermodynamics & Process Engine",
    badge: "C# 12 / .NET 8 / Clean Architecture",
    lang: "C# 12, .NET 8, ASP.NET Core, SignalR, ADO.NET SQLite",
    interop: "P/Invoke to libreactorcore.so, SignalR WebSockets (/hubs/simulation)",
    algorithm: "Peng-Robinson Cubic EOS, MESH RadFrac Distillation (TDMA + Holland θ)",
    throughput: "Mass balance closure Δm/m < 10⁻¹⁴; Wegstein recycle solver",
    tests: "59 Automated xUnit Tests (100% pass rate)",
    repoUrl: "https://github.com/yancsalmeida/ChemFlow.NET",
    summary: "Rigorous analytical cubic root solver for real fluids, staged distillation column with Thomas Algorithm (TDMA), topological sort (Kahn's algorithm) for process flowsheets."
  },
  telemetry: {
    title: "IndustrialTelemetry.Engine — High-Throughput Ingestion Engine",
    badge: "C# 12 / .NET 8 / PostgreSQL 16",
    lang: "C# 12, .NET 8, PostgreSQL 16, Clean Architecture",
    interop: "REST API, BackgroundService Hosted Worker, Postgres Binary Protocol",
    algorithm: "Bounded In-Memory Channel (System.Threading.Channels), State Machine",
    throughput: "Direct PostgreSQL Binary COPY (NpgsqlBinaryImporter) with 0-alloc",
    tests: "41 Automated xUnit Tests (100% pass rate)",
    repoUrl: "https://github.com/yancsalmeida/IndustrialTelemetry.Engine",
    summary: "Asynchronous producer-consumer queue handling batches of 50,000 events, strict lifecycle state auditing (Scheduled → InProgress → Completed/Aborted) with safety alarm evaluation."
  }
};

function initArchExplorer() {
  const nodes = document.querySelectorAll('.arch-node');
  const specTitle = document.getElementById('archSpecTitle');
  const specBadge = document.getElementById('archSpecBadge');
  const specLang = document.getElementById('archSpecLang');
  const specInterop = document.getElementById('archSpecInterop');
  const specAlgo = document.getElementById('archSpecAlgo');
  const specThroughput = document.getElementById('archSpecThroughput');
  const specTests = document.getElementById('archSpecTests');
  const specSummary = document.getElementById('archSpecSummary');
  const specLink = document.getElementById('archSpecLink');

  if (!nodes.length || !specTitle) return;

  function updateSpec(key) {
    const spec = archSpecs[key];
    if (!spec) return;

    specTitle.textContent = spec.title;
    if (specBadge) specBadge.textContent = spec.badge;
    if (specLang) specLang.textContent = spec.lang;
    if (specInterop) specInterop.textContent = spec.interop;
    if (specAlgo) specAlgo.textContent = spec.algorithm;
    if (specThroughput) specThroughput.textContent = spec.throughput;
    if (specTests) specTests.textContent = spec.tests;
    if (specSummary) specSummary.textContent = spec.summary;
    if (specLink) specLink.href = spec.repoUrl;

    nodes.forEach(n => {
      if (n.dataset.node === key) {
        n.classList.add('active');
      } else {
        n.classList.remove('active');
      }
    });
  }

  nodes.forEach(node => {
    node.addEventListener('click', () => {
      const key = node.dataset.node;
      updateSpec(key);
    });
  });

  // Default active
  updateSpec('reactorcore');
}

/* =========================================================================
   2. Real-Time Dynamic CSTR / RK4 Simulator (Canvas Oscilloscope)
   ========================================================================= */

function initDynamicSimulator() {
  const canvas = document.getElementById('simCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const sliderTcool = document.getElementById('sliderTcool');
  const valTcool = document.getElementById('valTcool');
  const sliderFlow = document.getElementById('sliderFlow');
  const valFlow = document.getElementById('valFlow');

  // Reactor Constants (replicates ReactorCore.C parameters)
  const V = 1.0;          // Volume [m³]
  const Ca0 = 1000.0;     // Feed Concentration [mol/m³]
  const T0 = 300.0;       // Feed Temp [K]
  const k0 = 7.08e10;     // Pre-exponential factor [1/s]
  const E_over_R = 8500.0;// Activation energy / R [K]
  const dH = -50000.0;    // Heat of reaction [J/mol] (exothermic)
  const rho_cp = 4.0e6;   // Density * Specific Heat [J/(m³·K)]
  const UA = 15000.0;     // Heat transfer coefficient * Area [W/K]

  let Tcool = parseFloat(sliderTcool ? sliderTcool.value : 295);
  let F = parseFloat(sliderFlow ? sliderFlow.value : 0.05);

  if (sliderTcool && valTcool) {
    sliderTcool.addEventListener('input', (e) => {
      Tcool = parseFloat(e.target.value);
      valTcool.textContent = `${Tcool.toFixed(1)} K`;
      runSimulation();
    });
  }

  if (sliderFlow && valFlow) {
    sliderFlow.addEventListener('input', (e) => {
      F = parseFloat(e.target.value);
      valFlow.textContent = `${(F * 1000).toFixed(1)} L/s`;
      runSimulation();
    });
  }

  function rk4Step(Ca, T, dt) {
    function derivatives(c, t) {
      const k = k0 * Math.exp(-E_over_R / t);
      const r = k * c;
      const dCadt = (F / V) * (Ca0 - c) - r;
      const dTdt = (F / V) * (T0 - t) + ((-dH) / rho_cp) * r - (UA / (V * rho_cp)) * (t - Tcool);
      return [dCadt, dTdt];
    }

    const [k1_c, k1_t] = derivatives(Ca, T);
    const [k2_c, k2_t] = derivatives(Ca + 0.5 * dt * k1_c, T + 0.5 * dt * k1_t);
    const [k3_c, k3_t] = derivatives(Ca + 0.5 * dt * k2_c, T + 0.5 * dt * k2_t);
    const [k4_c, k4_t] = derivatives(Ca + dt * k3_c, T + dt * k3_t);

    const nextCa = Ca + (dt / 6.0) * (k1_c + 2 * k2_c + 2 * k3_c + k4_c);
    const nextT = T + (dt / 6.0) * (k1_t + 2 * k2_t + 2 * k3_t + k4_t);
    return [Math.max(0, nextCa), Math.max(250, nextT)];
  }

  function runSimulation() {
    const totalTime = 120.0; // 120 seconds
    const dt = 0.5;
    const steps = Math.floor(totalTime / dt);

    const historyT = [];
    const historyX = []; // Conversion X = (Ca0 - Ca) / Ca0

    let Ca = Ca0;
    let T = T0;

    for (let i = 0; i < steps; i++) {
      const [nextCa, nextT] = rk4Step(Ca, T, dt);
      Ca = nextCa;
      T = nextT;
      const X = (Ca0 - Ca) / Ca0;
      historyT.push(T);
      historyX.push(X);
    }

    renderCanvas(historyT, historyX);

    // Update real-time stats
    const finalT = historyT[historyT.length - 1];
    const finalX = historyX[historyX.length - 1] * 100;
    const statTemp = document.getElementById('statSimTemp');
    const statConv = document.getElementById('statSimConv');
    if (statTemp) statTemp.textContent = `${finalT.toFixed(1)} K`;
    if (statConv) statConv.textContent = `${finalX.toFixed(1)}%`;
  }

  function renderCanvas(historyT, historyX) {
    const width = canvas.width = canvas.parentElement.clientWidth - 32;
    const height = canvas.height = 240;

    ctx.clearRect(0, 0, width, height);

    // Background Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 40; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, height - 30);
      ctx.stroke();
    }
    for (let y = 20; y < height - 30; y += 40) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, 10);
    ctx.lineTo(40, height - 30);
    ctx.lineTo(width - 10, height - 30);
    ctx.stroke();

    // Axis Labels
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('0s', 40, height - 15);
    ctx.fillText('60s', width / 2, height - 15);
    ctx.fillText('120s (Time)', width - 75, height - 15);

    // Scale mapping for Temperature [290K to 380K]
    const minT = 290;
    const maxT = 380;
    const plotH = height - 50;

    function mapY_T(temp) {
      const clamped = Math.max(minT, Math.min(maxT, temp));
      return (height - 30) - ((clamped - minT) / (maxT - minT)) * plotH;
    }

    // Plot Temperature Curve (Cyan)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const stepX = (width - 50) / historyT.length;

    for (let i = 0; i < historyT.length; i++) {
      const x = 40 + i * stepX;
      const y = mapY_T(historyT[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Scale mapping for Conversion [0 to 100%]
    function mapY_X(conv) {
      return (height - 30) - conv * plotH;
    }

    // Plot Conversion Curve (Emerald)
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < historyX.length; i++) {
      const x = 40 + i * stepX;
      const y = mapY_X(historyX[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Legend
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('— Temperature (K)', 55, 25);
    ctx.fillStyle = '#34d399';
    ctx.fillText('-- Conversion (%)', 190, 25);
  }

  // Initial draw
  runSimulation();
  window.addEventListener('resize', runSimulation);
}

/* =========================================================================
   3. Helpers & Smooth Scrolling
   ========================================================================= */

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const targetElem = document.querySelector(targetId);
      if (targetElem) {
        e.preventDefault();
        targetElem.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}
