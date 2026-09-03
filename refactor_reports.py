import re

with open('src/components/features/reports/ReportsView.astro', 'r') as f:
    content = f.read()

# 1. Remove the old top cards section (today cards) and `reports-tabs-container`
# It starts at `<div class="flex items-center justify-start px-1">` (line 24) up to `</section>` around line 56
old_top_cards = re.search(r'(<div class="flex items-center justify-start px-1">.*?)</section>', content, re.DOTALL)
if old_top_cards:
    content = content.replace(old_top_cards.group(1), "")

# 2. Find and replace Plati Restante section to use a button instead of <a>
plati_restante = re.search(r'(<!-- 2\. PLĂȚI RESTANTE \(GLOBAL\).*?<!-- 3\. RAPOARTE COMPARATIVE \(Tabs\))', content, re.DOTALL)
if plati_restante:
    new_plati = plati_restante.group(1).replace(
        '<a\n        href="/dashboard/patients"\n        data-astro-history="replace"',
        '<button type="button" onclick="openUnpaidDetails()"'
    ).replace('</a>', '</button>')
    content = content.replace(plati_restante.group(1), new_plati)

# 3. Replace Rapoarte comparative section with the unified one
# From `<!-- 3. RAPOARTE COMPARATIVE (Tabs)                          -->` down to `<!-- Card Grafic Hașurat -->`
rapoarte_comp = re.search(r'(<!-- 3\. RAPOARTE COMPARATIVE \(Tabs\).*?)<!-- Card Grafic Hașurat -->', content, re.DOTALL)
if rapoarte_comp:
    unified_header = """<!-- 3. EVOLUȚIE GRAFICĂ & TIMP ACTIV -->
  <section class="space-y-4">
    <!-- Card Grafic Hașurat -->"""
    content = content.replace(rapoarte_comp.group(1), unified_header)

# Insert the unified tabs + top cards at the top (where we removed the old cards)
unified_top = """
    <!-- Tabs Container Moved to Top -->
    <div class="relative flex items-center space-x-2 bg-surface-card p-1.5 rounded-xl shadow-sm border border-transparent mb-6" id="reports-tabs-container">
      <div id="tabs-active-pill" class="absolute top-1/2 rounded-lg bg-text-main pointer-events-none z-0" style="left: 0; width: 0; height: calc(100% - 12px); opacity: 0; transform: translateY(-50%); transition: transform 450ms cubic-bezier(0.34, 1.36, 0.64, 1), width 450ms cubic-bezier(0.34, 1.36, 0.64, 1), opacity 300ms ease;"></div>
      <button class="tab-btn relative z-10 flex-1 py-1.5 rounded-lg text-sm font-black transition-all text-text-inverse" data-tab="day">Zi</button>
      <button class="tab-btn relative z-10 flex-1 py-1.5 rounded-lg text-sm font-black transition-all text-text-muted hover:text-text-main" data-tab="week">Săpt</button>
      <button class="tab-btn relative z-10 flex-1 py-1.5 rounded-lg text-sm font-black transition-all text-text-muted hover:text-text-main" data-tab="month">Lun</button>
      <button class="tab-btn relative z-10 flex-1 py-1.5 rounded-lg text-sm font-black transition-all text-text-muted hover:text-text-main" data-tab="quarter">Trim</button>
      <button class="tab-btn relative z-10 flex-1 py-1.5 rounded-lg text-sm font-black transition-all text-text-muted hover:text-text-main" data-tab="year">An</button>
    </div>

    <!-- Antet perioadă + navigare -->
    <div class="flex items-center justify-between px-1 mb-3">
      <div class="flex flex-col">
        <h2 id="report-title" class="text-xl sm:text-2xl font-black text-text-main">Azi</h2>
        <span id="report-date-range" class="text-sm font-bold text-text-muted">--</span>
      </div>
      <div class="flex gap-2">
        <button type="button" id="prev-report-btn" class="p-2 rounded-full bg-surface-card shadow-sm border border-transparent active:scale-95 transition-transform text-text-main hover:text-brand-secondary">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <button type="button" id="next-report-btn" class="p-2 rounded-full bg-surface-card shadow-sm border border-transparent active:scale-95 transition-transform text-text-main hover:text-brand-secondary">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
        </button>
      </div>
    </div>

    <!-- Unified Stats Cards Row -->
    <div class="grid grid-cols-3 gap-3 mb-7">
      <!-- Card 1: Ședințe -->
      <div class="bg-surface-card rounded-tl-[2.2rem] rounded-br-[2.2rem] rounded-tr-md rounded-bl-md p-4 shadow-sm border border-transparent flex flex-col items-center justify-center text-center transition-all hover:border-transparent">
        <div class="flex items-baseline gap-1">
          <span id="period-done" class="text-3xl sm:text-4xl font-black text-brand-secondary tracking-tight leading-none">0</span>
          <span class="text-xl font-bold text-text-muted opacity-40">/</span>
          <span id="period-total" class="text-3xl sm:text-4xl font-black text-text-main tracking-tight leading-none">0</span>
        </div>
        <div class="text-sm sm:text-base font-sans font-black text-text-main leading-tight mt-2">Ședințe</div>
      </div>
      <!-- Card 2: Absent -->
      <div class="bg-surface-card rounded-tr-[2.2rem] rounded-bl-[2.2rem] rounded-tl-md rounded-br-md p-4 shadow-sm border border-transparent flex flex-col items-center justify-center text-center transition-all hover:border-transparent">
        <div id="period-absent" class="text-3xl sm:text-4xl font-black text-brand-secondary tracking-tight leading-none">0</div>
        <div class="text-sm sm:text-base font-sans font-black text-text-main leading-tight mt-2">Absent</div>
      </div>
      <!-- Card 3: Încasat -->
      <button type="button" id="period-income-card" class="bg-surface-card rounded-tl-[2.2rem] rounded-br-[2.2rem] rounded-tr-md rounded-bl-md p-4 shadow-sm border border-transparent flex flex-col items-center justify-center text-center transition-all hover:border-transparent cursor-pointer active:scale-95 group">
        <div id="period-income" class="text-3xl sm:text-4xl font-black text-text-main tracking-tight leading-none group-hover:text-brand-secondary transition-colors">0</div>
        <div class="text-sm sm:text-base font-sans font-black text-text-main leading-tight mt-2 flex items-center gap-1">
          <span>RON</span>
          <svg class="w-3.5 h-3.5 text-text-muted opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
        </div>
      </button>
    </div>

"""
# We must insert it exactly where `<div id="reports-data" class="space-y-7 hidden">\n` is.
content = content.replace('<div id="reports-data" class="space-y-7 hidden">\n', '<div id="reports-data" class="space-y-7 hidden">\n' + unified_top)

# Add unpaid details sheet HTML
unpaid_sheet_html = """
<!-- Unpaid Details Popup Sheet -->
<div id="unpaid-details-sheet" data-sheet-root class="fixed inset-0 z-[120] pointer-events-none">
  <div id="unpaid-details-backdrop" class="fixed inset-0 bg-black/25 opacity-0 pointer-events-none transition-opacity duration-300"></div>
  <div id="unpaid-details-content" class="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-surface-card rounded-t-[2.5rem] p-6 pb-safe shadow-2xl pointer-events-auto transform translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] max-h-[85vh] flex flex-col border border-border-subtle/30 z-[10000]">
    <div class="w-12 h-1.5 bg-text-main/15 rounded-full mx-auto mb-4 shrink-0 cursor-grab active:cursor-grabbing"></div>
    
    <div class="flex items-start justify-between mb-4 shrink-0">
      <div class="min-w-0 pr-2">
        <h2 class="text-xl sm:text-2xl font-black text-text-main tracking-tight truncate">Plăți Restante</h2>
      </div>
    </div>

    <!-- Summary Box -->
    <div class="mb-4 bg-rose-50 rounded-2xl p-4 flex items-center justify-between shrink-0 border border-rose-100 shadow-2xs">
      <div>
        <span class="text-xs font-black uppercase tracking-wider text-rose-600">Total Datorat</span>
        <div id="unpaid-details-total" class="text-2xl sm:text-3xl font-black text-rose-600 mt-0.5">0 <span class="text-sm font-sans font-black">RON</span></div>
      </div>
      <div id="unpaid-details-count-badge" class="px-3.5 py-1.5 rounded-xl bg-white text-rose-600 text-xs sm:text-sm font-black border border-rose-200">
        0 pacienți
      </div>
    </div>

    <!-- Debtors List -->
    <div id="unpaid-details-list" class="space-y-2.5 overflow-y-auto flex-1 pr-1 overscroll-contain">
      <!-- Generated by JS -->
    </div>
  </div>
</div>
"""
content = content.replace('<!-- Income Details Popup Sheet', unpaid_sheet_html + '\n<!-- Income Details Popup Sheet')

with open('src/components/features/reports/ReportsView.astro', 'w') as f:
    f.write(content)

