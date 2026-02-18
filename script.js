// Configuration
const DATA_SOURCE_URL = 'https://script.google.com/macros/s/AKfycbzQ5mJy0xHcOYqUSuOrK4PpHaiEq8TaBJjSklkMT60UValpu3Ph2CvH2KqZ25hcEOLE/exec';
const REFRESH_INTERVAL = 30000; // 30 seconds

// State
let rawData = [];
let filteredData = [];
let currentFilter = 'today';
let customDateRange = { start: null, end: null };
let isDarkMode = false;

// DOM Elements
const elements = {
    fileInput: document.getElementById('file-input'),
    lastUpdated: document.getElementById('update-time'),
    themeToggle: document.getElementById('theme-toggle'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    customStart: document.getElementById('start-date'),
    customEnd: document.getElementById('end-date'),
    applyCustom: document.getElementById('apply-custom-date'),
    refreshBtn: document.getElementById('refresh-data'),
    exportCsv: document.getElementById('export-csv'),
    exportXlsx: document.getElementById('export-xlsx'),
    tableBody: document.querySelector('#data-table tbody'),
    tableSearch: document.getElementById('table-search'),
    tableFilter: document.getElementById('table-filter'),
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page'),
    pageInfo: document.getElementById('page-info'),
    sidebar: document.getElementById('sidebar'), // Updated ID
    toggleSidebar: document.getElementById('toggle-sidebar'), // Updated ID
    closeSidebar: document.getElementById('close-sidebar') // Updated ID
};

// Pagination State
let currentPage = 1;
const rowsPerPage = 10;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEventListeners();
    renderSkeletons(); // Show skeleton immediately
    fetchData();
    setInterval(fetchData, REFRESH_INTERVAL);
});

// Theme Logic
function initTheme() {
    const storedTheme = localStorage.getItem('theme') || 'light';
    setTheme(storedTheme === 'dark');

    // Set initial select value
    if (elements.themeSelect) {
        elements.themeSelect.value = storedTheme === 'dark' ? 'dark' : 'light';
    }
}

function setTheme(isDark) {
    isDarkMode = isDark;
    const html = document.documentElement;

    if (isDark) {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    } else {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }
    updateChartsTheme();
}

// Event Listeners
function initEventListeners() {
    // Theme Select
    if (elements.themeSelect) {
        elements.themeSelect.addEventListener('change', (e) => {
            setTheme(e.target.value === 'dark');
        });
    }

    // Sidebar Logic
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (elements.toggleSidebar && sidebar && overlay) {
        elements.toggleSidebar.addEventListener('click', () => {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
        });
    }

    const closeMenu = () => {
        if (sidebar && overlay) {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
        }
    };

    if (elements.closeSidebar) elements.closeSidebar.addEventListener('click', closeMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);

    // Filter Buttons
    elements.filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            elements.filterBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentFilter = e.currentTarget.dataset.range;
            applyDataFilters();
            // Optional: close sidebar on mobile selection
            if (window.innerWidth < 768) closeMenu();
        });
    });

    // Custom Date Range
    if (elements.applyCustom) {
        elements.applyCustom.addEventListener('click', () => {
            const start = elements.customStart.value;
            const end = elements.customEnd.value;
            if (start && end) {
                currentFilter = 'custom';
                customDateRange = { start, end };
                elements.filterBtns.forEach(b => b.classList.remove('active'));
                applyDataFilters();
                if (window.innerWidth < 768) closeMenu();
            }
        });
    }

    // Refresh
    if (elements.refreshBtn) elements.refreshBtn.addEventListener('click', fetchData);

    // Table Search & Filter
    if (elements.tableSearch) elements.tableSearch.addEventListener('input', () => { currentPage = 1; renderTable(); });
    if (elements.tableFilter) elements.tableFilter.addEventListener('change', () => { currentPage = 1; renderTable(); });

    // Pagination
    if (elements.prevPage) {
        elements.prevPage.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });
    }
    if (elements.nextPage) {
        elements.nextPage.addEventListener('click', () => {
            const totalPages = Math.ceil(getFilteredTableData().length / rowsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });
    }

    // Export
    if (elements.exportCsv) elements.exportCsv.addEventListener('click', (e) => { e.preventDefault(); exportData('csv'); });
    if (elements.exportXlsx) elements.exportXlsx.addEventListener('click', (e) => { e.preventDefault(); exportData('xlsx'); });
}

// Data Fetching
async function fetchData() {
    try {
        const response = await fetch(DATA_SOURCE_URL);
        if (!response.ok) throw new Error("Failed to load data from Google Sheets");

        const jsonData = await response.json();

        // Google Sheets API returns array of objects directly
        processData(jsonData);
        updateLastUpdatedTime();
    } catch (error) {
        console.error("Error loading data:", error);
        // Optional: Show error to user
    }
}

function updateLastUpdatedTime() {
    const now = new Date();
    if (elements.lastUpdated) elements.lastUpdated.textContent = now.toLocaleTimeString();
}

// Data Processing
function processData(data) {
    rawData = data.map(row => {
        let dateObj;
        // Google Sheets returns ISO date strings usually, or raw strings
        if (row.Date) {
            const d = new Date(row.Date);
            if (!isNaN(d)) {
                dateObj = d;
            } else {
                dateObj = new Date(); // Fallback
            }
        } else {
            dateObj = new Date();
        }

        const complianceStats = calculateBatchComplianceStats(row);

        return {
            ...row,
            parsedDate: dateObj,
            isNonCompliant: checkCompliance(row),
            nonComplianceReason: getNonComplianceReason(row),
            nonCompliancePercent: complianceStats.percent // New Field
        };
    });

    applyDataFilters();
}

function calculateBatchComplianceStats(row) {
    const complianceFields = [
        'Leakage Test', 'Nitrogen Flush', 'Oxygen % Check',
        'Pack & Seal Integrity', 'Material Uniformity (Mixing)',
        'Size Uniformity (Slice of Mixes)'
    ];

    let totalChecks = 0;
    let failChecks = 0;

    // Check Lumps
    totalChecks++;
    if (row['Lumps'] && row['Lumps'].toString().trim().toLowerCase() === 'yes') {
        failChecks++;
    }

    // Check others
    complianceFields.forEach(field => {
        totalChecks++;
        const val = row[field] ? row[field].toString().trim().toLowerCase() : '';
        if (val === 'no') {
            failChecks++;
        }
    });

    return {
        percent: totalChecks > 0 ? ((failChecks / totalChecks) * 100).toFixed(1) : 0
    };
}

function checkCompliance(row) {
    if (row['Lumps'] && row['Lumps'].toString().trim().toLowerCase() === 'yes') return true;

    const requiredYesFields = [
        'Leakage Test',
        'Nitrogen Flush',
        'Oxygen % Check',
        'Pack & Seal Integrity',
        'Material Uniformity (Mixing)',
        'Size Uniformity (Slice of Mixes)'
    ];

    for (const field of requiredYesFields) {
        if (row[field] && row[field].toString().trim().toLowerCase() === 'no') return true;
    }

    return false;
}

function getNonComplianceReason(row) {
    let reasons = [];
    if (row['Lumps'] && row['Lumps'].toString().trim().toLowerCase() === 'yes') reasons.push('Lumps detected');

    const requiredYesFields = [
        'Leakage Test',
        'Nitrogen Flush',
        'Oxygen % Check',
        'Pack & Seal Integrity',
        'Material Uniformity (Mixing)',
        'Size Uniformity (Slice of Mixes)'
    ];

    requiredYesFields.forEach(field => {
        if (row[field] && row[field].toString().trim().toLowerCase() === 'no') {
            reasons.push(`${field} Failed`);
        }
    });

    return reasons.join(', ');
}

// Filtering Logic
function applyDataFilters() {
    const now = dayjs();

    filteredData = rawData.filter(item => {
        const itemDate = dayjs(item.parsedDate);

        switch (currentFilter) {
            case 'today':
                return itemDate.isSame(now, 'day');
            case 'yesterday':
                return itemDate.isSame(now.subtract(1, 'day'), 'day');
            case 'last7':
                return itemDate.isAfter(now.subtract(7, 'day'));
            case 'custom':
                if (customDateRange.start && customDateRange.end) {
                    return itemDate.isAfter(dayjs(customDateRange.start).subtract(1, 'day')) &&
                        itemDate.isBefore(dayjs(customDateRange.end).add(1, 'day'));
                }
                return true;
            default:
                return true;
        }
    });

    updateDashboard();
}

// Dashboard Updates
function updateDashboard() {
    updateKPIs();
    updateCharts();
    renderTable();
}

function updateKPIs() {
    const totalBatches = filteredData.length;
    const nonCompliantBatches = filteredData.filter(d => d.isNonCompliant).length;

    // Calculate Compliance based on total parameter checks (Granular)
    let totalChecks = 0;
    let totalCompliant = 0;

    const complianceFields = [
        'Leakage Test', 'Nitrogen Flush', 'Oxygen % Check',
        'Pack & Seal Integrity', 'Material Uniformity (Mixing)',
        'Size Uniformity (Slice of Mixes)'
    ];

    filteredData.forEach(row => {
        // Check Lumps (Yes = Fail, No/Empty = Pass)
        totalChecks++;
        const lumps = row['Lumps'] ? row['Lumps'].toString().trim().toLowerCase() : '';
        if (lumps !== 'yes') {
            totalCompliant++;
        }

        // Check other fields (Yes = Pass, No = Fail)
        complianceFields.forEach(field => {
            totalChecks++;
            const val = row[field] ? row[field].toString().trim().toLowerCase() : '';
            // Assuming empty is not a fail, or strictly 'no' is fail.
            // The prompt said: "Yes = Compliant, No = Non-Compliant".
            // So strictly 'no' is non-compliant. 'yes' is compliant.
            // What about empty? Let's assume valid data or treat non-'no' as pass for now to be safe,
            // or better, if 'yes' -> pass, if 'no' -> fail.
            if (val !== 'no') {
                totalCompliant++;
            }
        });
    });

    // Formula: Compliant Count / (Compliant + NonCompliant)
    // Here totalChecks = Compliant + NonCompliant
    const overallCompliance = totalChecks > 0 ? (totalCompliant / totalChecks * 100).toFixed(1) : 0;

    // Animate numbers
    animateValue('kpi-overall', overallCompliance, '%');
    animateValue('kpi-non-compliant', nonCompliantBatches, ''); // Keep batch count for this card
    animateValue('kpi-total-batches', totalBatches, '');

    // Parameter Specific Compliance (Leakage)
    const leakageRows = filteredData.filter(d => d['Leakage Test']);
    const leakageCount = leakageRows.length;
    const leakageFail = leakageRows.filter(d => d['Leakage Test'].toString().toLowerCase() === 'no').length;
    const leakageCompliance = leakageCount > 0 ? ((leakageCount - leakageFail) / leakageCount * 100).toFixed(1) : 0;

    const leakageEl = document.querySelector('#kpi-leakage .value');
    if (leakageEl) leakageEl.textContent = `${leakageCompliance}%`;
}

function animateValue(id, end, suffix) {
    const el = document.querySelector(`#${id} .value`);
    if (el) el.textContent = `${end}${suffix}`;
}

// Charts
let trendChart, productChart, parameterChart;

function updateCharts() {
    updateTrendChart();
    updateProductChart();
    updateParameterChart();
}

function updateTrendChart() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const trendData = {};
    filteredData.forEach(d => {
        if (d.isNonCompliant) {
            const dateStr = dayjs(d.parsedDate).format('YYYY-MM-DD');
            trendData[dateStr] = (trendData[dateStr] || 0) + 1;
        }
    });

    const labels = Object.keys(trendData).sort();
    const data = labels.map(l => trendData[l]);

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Non-Compliant Cases',
                data: data,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function updateProductChart() {
    const canvas = document.getElementById('productChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const productData = {};
    filteredData.forEach(d => {
        if (d.isNonCompliant) {
            const prod = d['Product Name'] || 'Unknown';
            productData[prod] = (productData[prod] || 0) + 1;
        }
    });

    const sorted = Object.entries(productData).sort((a, b) => b[1] - a[1]).slice(0, 10);

    if (productChart) productChart.destroy();

    productChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(i => i[0]),
            datasets: [{
                label: 'Non-Compliant Cases',
                data: sorted.map(i => i[1]),
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
        }
    });
}

function updateParameterChart() {
    const canvas = document.getElementById('parameterChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const params = [
        'Leakage Test', 'Nitrogen Flush', 'Oxygen % Check', 'Pack & Seal Integrity',
        'Material Uniformity (Mixing)', 'Size Uniformity (Slice of Mixes)', 'Lumps'
    ];

    const data = params.map(param => {
        const total = filteredData.length;
        if (total === 0) return 100;

        let fails = 0;
        if (param === 'Lumps') {
            fails = filteredData.filter(d => d[param] && d[param].toString().toLowerCase() === 'yes').length;
        } else {
            fails = filteredData.filter(d => d[param] && d[param].toString().toLowerCase() === 'no').length;
        }

        return ((total - fails) / total * 100).toFixed(1);
    });

    if (parameterChart) parameterChart.destroy();

    parameterChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: params,
            datasets: [{
                label: 'Compliance %',
                data: data,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderColor: '#10b981',
                pointBackgroundColor: '#10b981'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    min: 0,
                    max: 100,
                    ticks: { display: false },
                    pointLabels: {
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

function updateChartsTheme() {
    const color = isDarkMode ? '#e5e7eb' : '#374151';
    Chart.defaults.color = color;
    Chart.defaults.borderColor = isDarkMode ? '#374151' : '#e5e7eb';
    updateCharts();
}

// Table Rendering
function getFilteredTableData() {
    const searchTerm = elements.tableSearch ? elements.tableSearch.value.toLowerCase() : '';
    const filterType = elements.tableFilter ? elements.tableFilter.value : 'all';

    return filteredData.filter(item => {
        const matchesSearch = (item['Batch Code']?.toString().toLowerCase().includes(searchTerm) ||
            item['Product Name']?.toString().toLowerCase().includes(searchTerm));

        let matchesType = true;
        if (filterType !== 'all') {
            // Filter by specific parameter failure
            if (filterType === 'Lumps') {
                matchesType = item['Lumps'] && item['Lumps'].toString().toLowerCase() === 'yes';
            } else {
                matchesType = item[filterType] && item[filterType].toString().toLowerCase() === 'no';
            }
        } else {
            matchesType = item.isNonCompliant;
        }

        return matchesSearch && matchesType;
    });
}

function renderTable() {
    const data = getFilteredTableData();
    const start = (currentPage - 1) * rowsPerPage;
    const paginatedData = data.slice(start, start + rowsPerPage);

    if (elements.tableBody) {
        elements.tableBody.innerHTML = '';

        paginatedData.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-muted/50 transition-colors';

            tr.innerHTML = `
                <td class="px-6 py-4 font-medium">${dayjs(row.parsedDate).format('DD-MMM-YYYY')}</td>
                <td class="px-6 py-4">${row['Batch Code'] || '-'}</td>
                <td class="px-6 py-4">${row['Product Name'] || '-'}</td>
                <td class="px-6 py-4 text-destructive font-medium text-xs">${row.nonComplianceReason}</td>
                <td class="px-6 py-4 text-muted-foreground">${row['Checked By'] || '-'}</td>
                <td class="px-6 py-4 text-center">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                        Non-Compliant
                    </span>
                </td>
            `;
            elements.tableBody.appendChild(tr);
        });
    }

    updatePagination(data.length);
}

function updatePagination(totalItems) {
    if (!elements.pageInfo) return;
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    elements.pageInfo.textContent = `Showing ${Math.min((currentPage - 1) * rowsPerPage + 1, totalItems)} - ${Math.min(currentPage * rowsPerPage, totalItems)} of ${totalItems}`;
    if (elements.prevPage) elements.prevPage.disabled = currentPage === 1;
    if (elements.nextPage) elements.nextPage.disabled = currentPage === totalPages || totalPages === 0;
}

// Export
function exportData(type) {
    const dataToExport = getFilteredTableData().map(row => ({
        Date: dayjs(row.parsedDate).format('DD-MM-YYYY'),
        'Batch Code': row['Batch Code'],
        'Product Name': row['Product Name'],
        'Issue': row.nonComplianceReason,
        'Checked By': row['Checked By']
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "IPQC Data");
    XLSX.writeFile(wb, `IPQC_Export_${dayjs().format('YYYY-MM-DD')}.${type}`);
}

// Skeleton Loading
function renderSkeletons() {
    // KPI Skeletons
    const kpiIds = ['kpi-overall', 'kpi-non-compliant', 'kpi-total-batches', 'kpi-leakage'];
    kpiIds.forEach(id => {
        const el = document.querySelector(`#${id} .value`);
        if (el) {
            el.innerHTML = '<div class="h-8 w-24 bg-muted animate-pulse rounded my-1"></div>';
        }
    });

    // Table Skeletons
    if (elements.tableBody) {
        elements.tableBody.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const tr = document.createElement('tr');
            tr.className = "animate-pulse"; // Pulse the row
            tr.innerHTML = `
                <td class="px-6 py-4"><div class="h-6 w-full bg-transparent rounded"></div></td>
                <td class="px-6 py-4"><div class="h-6 w-full bg-transparent rounded"></div></td>
                <td class="px-6 py-4"><div class="h-6 w-full bg-transparent rounded"></div></td>
                <td class="px-6 py-4"><div class="h-6 w-full bg-transparent rounded"></div></td>
                <td class="px-6 py-4"><div class="h-6 w-full bg-transparent rounded"></div></td>
                <td class="px-6 py-4"><div class="h-6 w-full bg-transparent rounded"></div></td>
            `;
            elements.tableBody.appendChild(tr);
        }
    }
}
