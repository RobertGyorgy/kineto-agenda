import re

with open('src/components/features/reports/ReportsView.astro', 'r') as f:
    content = f.read()

# 1. Add `type TabType = 'day' | 'week' | 'month' | 'quarter' | 'year';`
content = content.replace("type TabType = 'week' | 'month' | 'quarter' | 'year';", "type TabType = 'day' | 'week' | 'month' | 'quarter' | 'year';")

# Replace activeTab initial value to 'day'
content = content.replace("let activeTab: TabType = 'week';", "let activeTab: TabType = 'day';")
content = content.replace("activeTab = 'week';", "activeTab = 'day';")

# 2. Add isUnpaidDetailsOpen state
content = content.replace("let isIncomeDetailsOpen = false;", "let isIncomeDetailsOpen = false;\n  let isUnpaidDetailsOpen = false;")

# Remove stale sheets for unpaid
content = content.replace("'#day-picker-sheet, #income-details-sheet'", "'#day-picker-sheet, #income-details-sheet, #unpaid-details-sheet'")
content = content.replace("if (isIncomeDetailsOpen) closeIncomeDetails();\n      else if (isDayPickerOpen) closeDayPicker();", "if (isUnpaidDetailsOpen) closeUnpaidDetails();\n      else if (isIncomeDetailsOpen) closeIncomeDetails();\n      else if (isDayPickerOpen) closeDayPicker();")

# 3. Create loadUnpaidStats
unpaid_stats_fn = """
  async function loadUnpaidStats() {
    try {
      const unpaid = await getUnpaidPatients();
      const countEl = document.getElementById('unpaid-count');
      const totalEl = document.getElementById('unpaid-total');
      if (countEl) countEl.textContent = unpaid.count.toString();
      if (totalEl) totalEl.textContent = unpaid.totalRON.toString();
    } catch(e) {
      console.error('Eroare loading unpaid stats', e);
    }
  }
"""

# Replace `loadTodayStats` with `loadUnpaidStats`
# Wait, `loadTodayStats` has all the logic. I will rewrite `loadReportStats` to handle 'day' and remove `loadTodayStats`.
old_load_today = re.search(r'async function loadTodayStats\(\) \{.*?\}(?=\n\n  function setupDayNavigation)', content, re.DOTALL)
if old_load_today:
    content = content.replace(old_load_today.group(0), unpaid_stats_fn)

# 4. setupDayNavigation needs to attach to `#report-title` and `#report-date-range` if we click on them, or maybe we don't need day picker anymore? The arrows do the job, but wait, day picker is nice for fast navigation.
# Let's attach day picker to `#report-title` area when 'day' tab is active, or just hide day picker for now to keep it simple. Actually, we can attach to `#report-title` or `#report-date-range`.
content = content.replace("const displayBtn = document.getElementById('today-date-display');", "const displayBtn = document.getElementById('report-title');")

# 5. `openDayPicker` currently sets `currentDayDate`. We should set `currentBaseDate = currentDayDate` and call `loadReportStats()`.
content = content.replace("currentDayDate = btnDate;\n        closeDayPicker();\n        loadTodayStats();", "currentBaseDate = btnDate;\n        closeDayPicker();\n        loadReportStats();")

# 6. `setupTopIncomeCard`
old_setup_top_income = re.search(r'function setupTopIncomeCard\(\) \{.*?\}(?=\n\n  async function loadReportStats)', content, re.DOTALL)
new_setup_top_income = """
  function setupTopIncomeCard() {
    const periodIncomeCard = document.getElementById('period-income-card');
    if (periodIncomeCard && periodIncomeCard.dataset.reportsIncomeBound !== 'true') {
      periodIncomeCard.dataset.reportsIncomeBound = 'true';
      periodIncomeCard.addEventListener('click', () => {
        const titleEl = document.getElementById('report-title')?.textContent || 'Perioadă';
        const dateRangeEl = document.getElementById('report-date-range')?.textContent || '';
        
        let startD = '';
        let endD = '';
        let inc = 0;
        
        if (activeTab === 'day') {
           const dateStr = toLocalISOString(currentBaseDate);
           startD = dateStr;
           endD = dateStr;
           inc = parseInt(document.getElementById('period-income')?.textContent || '0', 10);
        } else if (lastStatData) {
           startD = lastStatData.startStr;
           endD = lastStatData.endStr;
           inc = lastStatData.venit;
        }
        
        if (startD) {
          openIncomeDetails(`Încasări ${titleEl}`, dateRangeEl, startD, endD, inc);
        }
      });
    }
  }
"""
if old_setup_top_income:
    content = content.replace(old_setup_top_income.group(0), new_setup_top_income)

# 7. update loadReportStats
old_load_report = re.search(r'async function loadReportStats\(\) \{.*?\}(?=\n\n  function initInteractiveHatchChart)', content, re.DOTALL)

new_load_report = """
  async function loadReportStats() {
    try {
      const dateStr = toLocalISOString(currentBaseDate);
      const titleEl = document.getElementById('report-title');
      const subtitleEl = document.getElementById('chart-subtitle');
      const dateRangeEl = document.getElementById('report-date-range');
      const chartSection = document.getElementById('chart-container')?.parentElement?.parentElement;

      let statData: any;

      if (activeTab === 'day') {
        if (titleEl) {
          const d = currentBaseDate;
          const dayNameCap = d.toLocaleDateString('ro-RO', { weekday: 'long' }).charAt(0).toUpperCase() + d.toLocaleDateString('ro-RO', { weekday: 'long' }).slice(1);
          titleEl.textContent = dayNameCap;
        }
        if (dateRangeEl) {
          const d = currentBaseDate;
          const dayNum = d.getDate().toString().padStart(2, '0');
          const monthNameCap = d.toLocaleDateString('ro-RO', { month: 'long' }).charAt(0).toUpperCase() + d.toLocaleDateString('ro-RO', { month: 'long' }).slice(1);
          dateRangeEl.textContent = `${dayNum} ${monthNameCap}`;
        }
        if (subtitleEl) subtitleEl.textContent = 'Azi';
        statData = await getTodayStats(dateStr);
        // Normalize today stats to match period stats shape for UI
        statData.total = statData.sedinte_total;
        statData.venit = statData.venit_azi;
        
        // Hide chart for 'day'
        if (chartSection) chartSection.classList.add('hidden');
        
      } else {
        // Show chart for periods
        if (chartSection) chartSection.classList.remove('hidden');
        
        if (activeTab === 'week') {
          if (titleEl) titleEl.textContent = 'Săptămânal';
          if (subtitleEl) subtitleEl.textContent = 'Evoluție săptămânală';
          statData = await getWeekStats(dateStr);
          if (dateRangeEl) dateRangeEl.textContent = `${formatDateRO(new Date(statData.startStr))} - ${formatDateRO(new Date(statData.endStr))}`;
        } else if (activeTab === 'month') {
          if (titleEl) titleEl.textContent = 'Lunar';
          if (subtitleEl) subtitleEl.textContent = 'Evoluție lunară';
          statData = await getMonthStats(dateStr);
          const monthName = currentBaseDate.toLocaleDateString('ro-RO', { month: 'long' });
          if (dateRangeEl) dateRangeEl.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${currentBaseDate.getFullYear()}`;
        } else if (activeTab === 'quarter') {
          if (titleEl) titleEl.textContent = 'Trimestrial';
          if (subtitleEl) subtitleEl.textContent = 'Evoluție trimestrială';
          statData = await getQuarterStats(dateStr);
          if (dateRangeEl) dateRangeEl.textContent = `${formatDateRO(new Date(statData.startStr), true)} - ${formatDateRO(new Date(statData.endStr), true)}`;
        } else if (activeTab === 'year') {
          if (titleEl) titleEl.textContent = 'Anual';
          if (subtitleEl) subtitleEl.textContent = 'Evoluție anuală';
          statData = await getYearStats(dateStr);
          if (dateRangeEl) dateRangeEl.textContent = `${currentBaseDate.getFullYear()}`;
        }
      }

      lastStatData = statData;

      if (statData) {
        const totalPast = statData.finalizate + statData.absente;

        const pDone = document.getElementById('period-done');
        const pTotal = document.getElementById('period-total');
        const pAbsent = document.getElementById('period-absent');
        const pIncome = document.getElementById('period-income');

        if (pDone) pDone.textContent = statData.finalizate.toString();
        if (pTotal) pTotal.textContent = statData.total.toString();
        if (pAbsent) pAbsent.textContent = statData.absente.toString();
        if (pIncome) pIncome.textContent = statData.venit.toString();
        const prezenta = totalPast > 0 ? Math.round((statData.finalizate / totalPast) * 100) : 0;
        const anulari = totalPast > 0 ? Math.round((statData.absente / totalPast) * 100) : 0;

        const wAT = document.getElementById('week-active-time');
        const wCT = document.getElementById('week-cancel-time');
        const wPB = document.getElementById('week-progress-bar');
        const wCB = document.getElementById('week-cancel-bar');
        if(wAT) wAT.textContent = `${prezenta}%`;
        if(wCT) wCT.textContent = `${anulari}%`;
        if(wPB) wPB.style.width = `${prezenta}%`;
        if(wCB) wCB.style.width = `${anulari}%`;

        // Total perioadă
        const periodTotalEl = document.getElementById('chart-period-total');
        if (periodTotalEl) {
          const total = statData.venit || 0;
          periodTotalEl.innerHTML = `${Math.round(total)} <span class="text-xs font-sans font-black text-text-main">RON</span>`;
        }

        // Load chart if data exists
        if (activeTab !== 'day' && statData.chartData) {
          initInteractiveHatchChart(statData.chartData, statData.startStr, activeTab, statData);
        }
      }
    } catch (e) {
      console.error('Error loading report stats:', e);
    }
  }
"""
if old_load_report:
    content = content.replace(old_load_report.group(0), new_load_report)

# 8. Unpaid Details Implementation (to be added at the end of the script before the `</script>`)
unpaid_details_js = """
  // ── UNPAID DETAILS POPUP SHEET ────────────────────────────────
  (window as any).openUnpaidDetails = async function() {
    const sheet = document.getElementById('unpaid-details-sheet');
    const backdrop = document.getElementById('unpaid-details-backdrop');
    const content = document.getElementById('unpaid-details-content');
    const totalEl = document.getElementById('unpaid-details-total');
    const badgeEl = document.getElementById('unpaid-details-count-badge');
    const listEl = document.getElementById('unpaid-details-list');

    if (!sheet || !backdrop || !content || !listEl) return;

    if (sheet.parentElement !== document.body) {
      document.body.appendChild(sheet);
    }

    if (badgeEl) badgeEl.textContent = 'Se încarcă...';
    listEl.innerHTML = `
      <div class="py-10 text-center space-y-2">
        <div class="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-xs font-bold text-text-muted">Se caută plățile restante...</p>
      </div>
    `;

    // Animate open
    isUnpaidDetailsOpen = true;
    sheet.dataset.open = 'true';
    sheet.classList.remove('pointer-events-none');
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    backdrop.classList.add('opacity-100', 'pointer-events-auto');
    content.classList.remove('translate-y-full');
    content.classList.add('translate-y-0');
    lockBodyScroll();

    setupUnpaidDetailsGestures();

    try {
      const unpaid = await getUnpaidPatients();
      
      if (totalEl) totalEl.innerHTML = `${unpaid.totalRON} <span class="text-sm font-sans font-black">RON</span>`;
      if (badgeEl) badgeEl.textContent = `${unpaid.count} pacienți`;

      if (unpaid.patients.length === 0) {
        listEl.innerHTML = `
          <div class="py-8 px-4 text-center rounded-2xl bg-surface-base/50 border border-dashed border-border-subtle/50 flex flex-col items-center justify-center space-y-2">
            <div class="w-12 h-12 rounded-2xl bg-surface-card flex items-center justify-center text-emerald-500 shadow-2xs">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p class="text-sm font-black text-text-main">Toate plățile sunt la zi</p>
            <p class="text-xs font-bold text-text-muted">Nu există niciun pacient cu sume restante.</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = unpaid.patients.map(p => {
        const nameParts = (p.name || 'Pacient').split(' ').filter(Boolean);
        const initials = nameParts.length >= 2 
          ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase() 
          : (nameParts[0]?.slice(0, 2).toUpperCase() || 'PA');

        return `
          <a href="/dashboard/patients/${p.id}" data-astro-history="push" class="block p-3.5 rounded-2xl bg-surface-base border border-border-subtle/30 flex items-center justify-between gap-3 shadow-2xs hover:border-rose-500/30 transition-colors">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-surface-card text-text-main flex items-center justify-center font-black text-sm shrink-0 shadow-sm border border-border-subtle">
                ${initials}
              </div>
              <div class="min-w-0">
                <div class="font-black text-text-main text-sm sm:text-base truncate">${p.name}</div>
                <div class="text-xs font-bold text-text-muted">Total pachet: ${p.cost || 0} RON</div>
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-base sm:text-lg font-black text-rose-600">-${p.suma_restanta} RON</div>
              <div class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Restanță</div>
            </div>
          </a>
        `;
      }).join('');

    } catch (err) {
      console.error('Eroare încărcare restanțe:', err);
      listEl.innerHTML = `
        <div class="p-4 rounded-2xl bg-rose-50 text-rose-700 text-xs font-bold text-center">
          Eroare la încărcarea listei de restanțe. Te rugăm să încerci din nou.
        </div>
      `;
    }
  }

  function closeUnpaidDetails() {
    const sheet = document.getElementById('unpaid-details-sheet');
    const backdrop = document.getElementById('unpaid-details-backdrop');
    const content = document.getElementById('unpaid-details-content');

    if (!sheet || !backdrop || !content) return;

    isUnpaidDetailsOpen = false;
    sheet.dataset.open = 'false';
    content.style.transform = ''; 
    content.classList.remove('translate-y-0');
    content.classList.add('translate-y-full');
    backdrop.classList.remove('opacity-100', 'pointer-events-auto');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
    
    setTimeout(() => {
      sheet.classList.add('pointer-events-none');
      unlockBodyScroll();
    }, 300);
  }

  function setupUnpaidDetailsGestures() {
    const sheet = document.getElementById('unpaid-details-sheet');
    const backdrop = document.getElementById('unpaid-details-backdrop');
    const content = document.getElementById('unpaid-details-content');

    if (!sheet || !backdrop || !content) return;

    if (sheet.dataset.gesturesBound === 'true') return;
    sheet.dataset.gesturesBound = 'true';

    backdrop.addEventListener('click', closeUnpaidDetails);

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const resetDrag = () => {
      isDragging = false;
      content.style.transform = '';
    };

    content.addEventListener('touchstart', (e: TouchEvent) => {
      if (content.scrollTop === 0) {
        startY = e.touches[0].clientY;
        currentY = startY;
        isDragging = true;
      }
    }, { passive: true });

    content.addEventListener('touchmove', (e: TouchEvent) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      if (deltaY > 0) {
        content.style.transform = `translateY(${deltaY}px)`;
      }
    }, { passive: true });

    content.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      const deltaY = currentY - startY;
      content.style.transform = '';
      if (deltaY > 80) {
        closeUnpaidDetails();
      }
    });

    content.addEventListener('touchcancel', resetDrag);
  }
"""
content = content.replace("</script>", unpaid_details_js + "\n</script>")

# 9. setupNavigation changes (add `day`)
content = content.replace("if (activeTab === 'week') currentBaseDate.setDate(currentBaseDate.getDate() - 7);", "if (activeTab === 'day') currentBaseDate.setDate(currentBaseDate.getDate() - 1);\n      else if (activeTab === 'week') currentBaseDate.setDate(currentBaseDate.getDate() - 7);")
content = content.replace("if (activeTab === 'week') currentBaseDate.setDate(currentBaseDate.getDate() + 7);", "if (activeTab === 'day') currentBaseDate.setDate(currentBaseDate.getDate() + 1);\n      else if (activeTab === 'week') currentBaseDate.setDate(currentBaseDate.getDate() + 7);")

# 10. `initReportsView` updates
content = content.replace("loadTodayStats(),", "loadUnpaidStats(),")

# 11. listeners update
content = content.replace("loadTodayStats();\n        loadReportStats();", "loadUnpaidStats();\n        loadReportStats();")

with open('src/components/features/reports/ReportsView.astro', 'w') as f:
    f.write(content)

