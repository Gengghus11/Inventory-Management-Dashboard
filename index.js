const sideMenu = document.querySelector("aside");
const menuBtn = document.querySelector("#menu-btn");
const closeBtn = document.querySelector("#close-btn");
const themeToggler = document.querySelector(".theme-toggler");

menuBtn?.addEventListener("click", () => {
  sideMenu.style.display = "block";
});

closeBtn?.addEventListener("click", () => {
  sideMenu.style.display = "none";
});

// ===== DOM =====
const tbody = document.querySelector(".recent-order tbody");
const searchInput = document.querySelector("#order-search");
const statusFilter = document.querySelector("#status-filter");
const paymentFilter = document.querySelector("#payment-filter");
const clearBtn = document.querySelector("#clear-filters");
const summaryEl = document.querySelector("#orders-summary");
const exportBtn = document.querySelector("#export-csv");

const statDelivered = document.querySelector("#stat-delivered");
const statPending = document.querySelector("#stat-pending");
const statProcessing = document.querySelector("#stat-processing");
const statDeclined = document.querySelector("#stat-declined");

const chipsEl = document.querySelector("#active-filters");

// Pagination DOM
const paginationEl = document.querySelector("#orders-pagination");
const prevBtn = document.querySelector("#page-prev");
const nextBtn = document.querySelector("#page-next");
const pageInfo = document.querySelector("#page-info");
const rowsSelect = document.querySelector("#rows-per-page");

// ===== Charts =====
let salesByDayChart = null;
let statusChart = null;
let topProductsChart = null;

// ===== State =====
let currentView = [];
let sortKey = null;  // "productName", "ProductNumber", "paymentStatus", "shipping"
let sortDir = "asc"; // "asc" or "desc"

// Pagination state
let page = 1;
let perPage = 10;

// ===== LocalStorage keys =====
const LS = {
  theme: "inv_theme",
  search: "inv_search",
  status: "inv_status",
  payment: "inv_payment",
  sortKey: "inv_sortKey",
  sortDir: "inv_sortDir",
  page: "inv_page",
  perPage: "inv_perPage",
};

// ===== Helpers (NEW) =====
function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function orderTotal(order) {
  // Works with your updated Orders dataset (qty + unitPrice). If missing, returns 0 safely.
  return safeNum(order?.qty) * safeNum(order?.unitPrice);
}

// ===== Charts helpers =====
function groupSalesByDay(list) {
  const map = new Map();

  for (const o of list) {
    const date = o.orderDate || "Unknown";
    if (o.paymentStatus !== "Paid") continue; // sales = paid only
    map.set(date, (map.get(date) || 0) + orderTotal(o));
  }

  const labels = [...map.keys()].sort();
  const values = labels.map((d) => map.get(d) || 0);
  return { labels, values };
}

function groupOrdersByStatus(list) {
  const counts = { Delivered: 0, Pending: 0, Processing: 0, Declined: 0 };

  for (const o of list) {
    if (counts[o.shipping] !== undefined) counts[o.shipping]++;
  }

  const labels = Object.keys(counts);
  const values = labels.map((k) => counts[k]);
  return { labels, values };
}

function topProductsByRevenue(list, limit = 8) {
  const map = new Map();

  for (const o of list) {
    const name = o.productName || "Unknown";
    map.set(name, (map.get(name) || 0) + orderTotal(o));
  }

  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  return {
    labels: sorted.map(([name]) => name),
    values: sorted.map(([, val]) => val),
  };
}

function initCharts() {
  const elSales = document.getElementById("chartSalesByDay");
  const elStatus = document.getElementById("chartStatus");
  const elTop = document.getElementById("chartTopProducts");

  if (!elSales || !elStatus || !elTop || typeof Chart === "undefined") return;

  salesByDayChart = new Chart(elSales, {
    type: "line",
    data: {
      labels: [],
      datasets: [{ label: "Sales", data: [], tension: 0.25, fill: false }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: {
        y: {
          ticks: {
            callback: (v) =>
              Number(v).toLocaleString(undefined, { style: "currency", currency: "USD" }),
          },
        },
      },
    },
  });

  statusChart = new Chart(elStatus, {
  type: "doughnut",
  data: {
    labels: [],
    datasets: [
      {
        label: "Orders",
        data: [],
        backgroundColor: [
          "#22c55e", // Delivered
          "#f59e0b", // Pending
          "#3b82f6", // Processing
          "#ef4444", // Declined
        ],
        borderWidth: 2,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" } },
    plugins: {
      legend: {
        position: "bottom",
          labels: { color: "#e5e7eb" }
  }
}

  },
});
  topProductsChart = new Chart(elTop, {
    type: "bar",
    data: { labels: [], datasets: [{ label: "Revenue", data: [] }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: {
        y: {
          ticks: {
            callback: (v) =>
              Number(v).toLocaleString(undefined, { style: "currency", currency: "USD" }),
          },
        },
      },
    },
  });
}

function updateCharts(list) {
  if (!salesByDayChart || !statusChart || !topProductsChart) return;

  const byDay = groupSalesByDay(list);
  salesByDayChart.data.labels = byDay.labels;
  salesByDayChart.data.datasets[0].data = byDay.values;
  salesByDayChart.update();

  const byStatus = groupOrdersByStatus(list);
  statusChart.data.labels = byStatus.labels;
  statusChart.data.datasets[0].data = byStatus.values;
  statusChart.update();

  const top = topProductsByRevenue(list, 8);
  topProductsChart.data.labels = top.labels;
  topProductsChart.data.datasets[0].data = top.values;
  topProductsChart.update();
}

// ===== Theme persistence =====
function saveThemeState(isDark) {
  localStorage.setItem(LS.theme, isDark ? "dark" : "light");
}

function loadThemeState() {
  if (!themeToggler) return;

  const t = localStorage.getItem(LS.theme) || "light";
  const isDark = t === "dark";

  document.body.classList.toggle("dark-theme-variables", isDark);

  themeToggler.querySelector("span:nth-child(1)")?.classList.toggle("active", !isDark);
  themeToggler.querySelector("span:nth-child(2)")?.classList.toggle("active", isDark);
}

themeToggler?.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark-theme-variables");
  themeToggler.querySelector("span:nth-child(1)")?.classList.toggle("active", !isDark);
  themeToggler.querySelector("span:nth-child(2)")?.classList.toggle("active", isDark);
  saveThemeState(isDark);
});

// ===== UI persistence =====
function saveUIState() {
  if (searchInput) localStorage.setItem(LS.search, searchInput.value);
  if (statusFilter) localStorage.setItem(LS.status, statusFilter.value);
  if (paymentFilter) localStorage.setItem(LS.payment, paymentFilter.value);

  localStorage.setItem(LS.sortKey, sortKey ?? "");
  localStorage.setItem(LS.sortDir, sortDir ?? "asc");

  localStorage.setItem(LS.page, String(page));
  localStorage.setItem(LS.perPage, String(perPage));
}

function loadUIState() {
  if (searchInput) searchInput.value = localStorage.getItem(LS.search) || "";
  if (statusFilter) statusFilter.value = localStorage.getItem(LS.status) || "all";
  if (paymentFilter) paymentFilter.value = localStorage.getItem(LS.payment) || "all";

  const savedKey = localStorage.getItem(LS.sortKey) || "";
  sortKey = savedKey === "" ? null : savedKey;
  sortDir = localStorage.getItem(LS.sortDir) || "asc";

  const savedPerPage = Number(localStorage.getItem(LS.perPage));
  perPage = Number.isFinite(savedPerPage) && savedPerPage > 0 ? savedPerPage : 10;

  const savedPage = Number(localStorage.getItem(LS.page));
  page = Number.isFinite(savedPage) && savedPage > 0 ? savedPage : 1;

  if (rowsSelect) rowsSelect.value = String(perPage);
}

// ===== Chips =====
function renderFilterChips({ q, status, pay }) {
  if (!chipsEl) return;

  const chips = [];
  if (q) chips.push({ type: "search", label: `Search: ${q}` });
  if (status !== "all") chips.push({ type: "status", label: `Status: ${status}` });
  if (pay !== "all") chips.push({ type: "payment", label: `Payment: ${pay}` });

  chipsEl.innerHTML = chips
    .map(
      (c) => `
      <span class="chip" data-type="${c.type}">
        ${c.label}
        <button type="button" aria-label="Remove ${c.type} filter">×</button>
      </span>`
    )
    .join("");
}

chipsEl?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const chip = btn.closest(".chip");
  if (!chip) return;

  const type = chip.dataset.type;

  if (type === "search" && searchInput) searchInput.value = "";
  if (type === "status" && statusFilter) statusFilter.value = "all";
  if (type === "payment" && paymentFilter) paymentFilter.value = "all";

  page = 1;
  applyFilters();
  saveUIState();
});

// ===== Summary + Status cards =====
function updateSummary({ pageStart, pageEnd, totalFiltered }) {
  if (!summaryEl) return;

  if (totalFiltered === 0) {
    summaryEl.textContent = `Showing 0 of ${Orders.length} orders`;
    return;
  }

  summaryEl.textContent =
    `Showing ${pageStart}-${pageEnd} of ${totalFiltered} (Total: ${Orders.length})`;
}

function updateStatusCards(list) {
  const counts = { Delivered: 0, Pending: 0, Processing: 0, Declined: 0 };

  list.forEach((order) => {
    if (counts[order.shipping] !== undefined) counts[order.shipping]++;
  });

  if (statDelivered) statDelivered.textContent = counts.Delivered;
  if (statPending) statPending.textContent = counts.Pending;
  if (statProcessing) statProcessing.textContent = counts.Processing;
  if (statDeclined) statDeclined.textContent = counts.Declined;
}

// ===== Render table =====
function renderOrders(list) {
  if (!tbody) return;

  tbody.innerHTML = "";

  if (list.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="text-muted">No matching orders found.</td>`;
    tbody.appendChild(tr);
    return;
  }

  list.forEach((order) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${order.productName}</td>
      <td>${order.ProductNumber}</td>
      <td><span class="badge payment ${String(order.paymentStatus).toLowerCase()}">${order.paymentStatus}</span></td>
      <td><span class="badge status ${String(order.shipping).toLowerCase()}">${order.shipping}</span></td>
      <td class="primary">Details</td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== Sorting helpers =====
const sortableHeaders = document.querySelectorAll("#orders-table thead th[data-sort]");

function setSortStyles() {
  sortableHeaders.forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.sort === sortKey) {
      th.classList.add(sortDir === "asc" ? "sort-asc" : "sort-desc");
    }
  });
}

function compareValues(a, b, key) {
  if (key === "ProductNumber") return Number(a[key]) - Number(b[key]);
  return String(a[key]).localeCompare(String(b[key]), undefined, { sensitivity: "base" });
}

function sortOrders(list) {
  if (!sortKey) return list;
  const sorted = [...list].sort((a, b) => compareValues(a, b, sortKey));
  if (sortDir === "desc") sorted.reverse();
  return sorted;
}

sortableHeaders.forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.dataset.sort;

    if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
    else {
      sortKey = key;
      sortDir = "asc";
    }

    page = 1;
    setSortStyles();
    applyFilters();
    saveUIState();
  });
});

// ===== Pagination helpers =====
function renderPagination(totalFiltered) {
  if (!paginationEl) return;

  const totalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
  page = Math.min(Math.max(1, page), totalPages);

  if (pageInfo) pageInfo.textContent = `Page ${page} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = page <= 1;
  if (nextBtn) nextBtn.disabled = page >= totalPages;
}

function renderCurrentPage() {
  const totalFiltered = currentView.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
  page = Math.min(Math.max(1, page), totalPages);

  const startIndex = (page - 1) * perPage;
  const pageItems = currentView.slice(startIndex, startIndex + perPage);

  const pageStart = totalFiltered === 0 ? 0 : startIndex + 1;
  const pageEnd = totalFiltered === 0 ? 0 : Math.min(startIndex + perPage, totalFiltered);

  updateSummary({ pageStart, pageEnd, totalFiltered });
  renderOrders(pageItems);
  renderPagination(totalFiltered);
}

prevBtn?.addEventListener("click", () => {
  page = Math.max(1, page - 1);
  renderCurrentPage();
  saveUIState();
});

nextBtn?.addEventListener("click", () => {
  page = page + 1;
  renderCurrentPage();
  saveUIState();
});

rowsSelect?.addEventListener("change", () => {
  const v = Number(rowsSelect.value);
  perPage = Number.isFinite(v) && v > 0 ? v : 10;
  page = 1;
  renderCurrentPage();
  saveUIState();
});

// ===== Filtering =====
function applyFilters() {
  const q = (searchInput?.value || "").trim().toLowerCase();
  const status = statusFilter?.value || "all";
  const pay = paymentFilter?.value || "all";

  renderFilterChips({ q, status, pay });

  const filtered = Orders.filter((order) => {
    const matchesSearch =
      q === "" ||
      (order.productName || "").toLowerCase().includes(q) ||
      String(order.ProductNumber || "").toLowerCase().includes(q);

    const matchesStatus = status === "all" || order.shipping === status;
    const matchesPayment = pay === "all" || order.paymentStatus === pay;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  currentView = sortOrders(filtered);

  updateStatusCards(currentView);
  renderCurrentPage();

  // ✅ update charts using the full filtered list (not just current page)
  updateCharts(currentView);
}

// ===== CSV Export =====
function toCSV(rows) {
  const headers = ["Product Name", "Product Number", "Payment", "Status"];

  const escape = (value) => {
    const s = String(value ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [escape(r.productName), escape(r.ProductNumber), escape(r.paymentStatus), escape(r.shipping)].join(",")
    ),
  ];

  return lines.join("\n");
}

function downloadCSV(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

exportBtn?.addEventListener("click", () => {
  const rows = currentView.length ? currentView : Orders;
  const csv = toCSV(rows);
  const today = new Date().toISOString().slice(0, 10);
  downloadCSV(`orders-${today}.csv`, csv);
});

// ===== Live updates =====
[searchInput, statusFilter, paymentFilter].forEach((el) => {
  if (!el) return;

  el.addEventListener("input", () => {
    page = 1;
    applyFilters();
    saveUIState();
  });

  el.addEventListener("change", () => {
    page = 1;
    applyFilters();
    saveUIState();
  });
});

clearBtn?.addEventListener("click", () => {
  if (searchInput) searchInput.value = "";
  if (statusFilter) statusFilter.value = "all";
  if (paymentFilter) paymentFilter.value = "all";

  sortKey = null;
  sortDir = "asc";
  setSortStyles();

  page = 1;

  localStorage.removeItem(LS.search);
  localStorage.removeItem(LS.status);
  localStorage.removeItem(LS.payment);
  localStorage.removeItem(LS.sortKey);
  localStorage.removeItem(LS.sortDir);
  localStorage.removeItem(LS.page);
  localStorage.removeItem(LS.perPage);

  if (rowsSelect) rowsSelect.value = "10";
  perPage = 10;

  applyFilters();
});

// ===== Initial load =====
loadThemeState();
loadUIState();
setSortStyles();
initCharts();
applyFilters();
