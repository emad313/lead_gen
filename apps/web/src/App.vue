<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

type Lead = {
  lead_id: string;
  company_name: string;
  contact_name?: string;
  business_email?: string;
  lead_status: string;
  recommended_solution?: string;
  discovery_date: string;
};
type CrawlJob = { job_id: string; status: string; seed_count: number; pages_crawled: number; emails_found: number; error?: string; created_at: string; completed_at?: string };
type Activity = { event_id: string; event_type: string; status: string; event_timestamp: string; details?: Record<string, unknown> };
type Operations = { queries: string[]; searchEnabled: boolean; schedule: string; jobs: CrawlJob[]; activity: Activity[]; queue: Record<string, number>; googleSheets: { configured: boolean; status: string } };

const leads = ref<Lead[]>([]);
const operations = ref<Operations | null>(null);
const loading = ref(true);
const error = ref('');
const starting = ref(false);
const syncingSheets = ref(false);
const lastUpdated = ref<Date>();
let timer: number | undefined;

async function loadLeads(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const [leadsResponse, operationsResponse] = await Promise.all([
      fetch('http://localhost:3000/api/leads'),
      fetch('http://localhost:3000/api/operations')
    ]);
    if (!leadsResponse.ok || !operationsResponse.ok) throw new Error('API is unavailable');
    leads.value = (await leadsResponse.json()).data;
    operations.value = (await operationsResponse.json()).data;
    lastUpdated.value = new Date();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to load leads';
  } finally {
    loading.value = false;
  }
}

async function startDiscovery(): Promise<void> {
  starting.value = true;
  error.value = '';
  try {
    const response = await fetch('http://localhost:3000/api/jobs/daily-discovery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not start discovery');
    await loadLeads();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not start discovery';
  } finally {
    starting.value = false;
  }
}

async function syncSheets(): Promise<void> {
  syncingSheets.value = true;
  error.value = '';
  try {
    const response = await fetch('http://localhost:3000/api/jobs/sync-sheets', { method: 'POST' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Google Sheets sync failed');
    await loadLeads();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Google Sheets sync failed';
  } finally {
    syncingSheets.value = false;
  }
}

const activeJob = computed(() => operations.value?.jobs.find((job) => job.status === 'running') || operations.value?.jobs.find((job) => job.status === 'queued'));
const latestJob = computed(() => operations.value?.jobs[0]);
const isSearching = computed(() => Boolean(activeJob.value) || (operations.value?.queue.active ?? 0) > 0);
const formatTime = (value?: string) => value ? new Date(value).toLocaleString() : '—';

onMounted(() => {
  void loadLeads();
  timer = window.setInterval(() => void loadLeads(), 5000);
});
onUnmounted(() => { if (timer) window.clearInterval(timer); });
</script>

<template>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Lead operations</p>
        <h1>Lead control center</h1>
        <p class="subtitle">See exactly what is being searched, crawled, and saved.</p>
      </div>
      <div class="hero-actions"><span class="live"><i :class="{ on: isSearching }"></i>{{ isSearching ? 'SEARCHING NOW' : 'IDLE' }}</span><button class="secondary" @click="loadLeads">Refresh</button><button :disabled="starting || isSearching" @click="startDiscovery">{{ starting ? 'Starting...' : isSearching ? 'Running now' : 'Start discovery' }}</button></div>
    </header>

    <section class="control-grid">
      <div class="panel status-panel">
        <div class="panel-heading"><div><p class="label">Current run</p><h2>{{ isSearching ? 'Collecting leads' : 'No active run' }}</h2></div><span class="status-dot" :class="{ active: isSearching }"></span></div>
        <p v-if="activeJob" class="muted">Job {{ activeJob.job_id }} is {{ activeJob.status }}. Progress updates every 5 seconds.</p>
        <p v-else class="muted">Click <strong>Start discovery</strong> to search online now.</p>
        <div class="metrics"><div><strong>{{ activeJob?.pages_crawled || 0 }}</strong><span>Pages crawled</span></div><div><strong>{{ activeJob?.emails_found || 0 }}</strong><span>Emails found</span></div><div><strong>{{ leads.length }}</strong><span>Leads saved</span></div></div>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="label">Automation</p><h2>Daily schedule</h2></div><span class="schedule-icon">↻</span></div>
        <p class="schedule">{{ operations?.schedule || 'Loading schedule...' }}</p>
        <p class="muted">Server timezone · Manual runs are always available.</p>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><p class="label">Export</p><h2>Google Sheets</h2></div><span class="connected" v-if="operations?.googleSheets.configured">Ready</span><span class="disconnected" v-else>Not configured</span></div>
        <p class="muted">{{ operations?.googleSheets.configured ? 'Lead rows can be upserted into your configured sheet.' : 'Add a service-account JSON path and Sheet ID to enable export.' }}</p>
        <button class="secondary" :disabled="syncingSheets || !operations?.googleSheets.configured" @click="syncSheets">{{ syncingSheets ? 'Syncing...' : 'Sync all leads' }}</button>
      </div>
    </section>

    <section class="panel search-panel">
      <div class="panel-heading"><div><p class="label">Discovery configuration</p><h2>What the agent searches</h2></div><span class="connected" v-if="operations?.searchEnabled">SearXNG connected</span><span class="disconnected" v-else>SearXNG offline</span></div>
      <div class="query-list"><span v-for="query in operations?.queries" :key="query">“{{ query }}”</span></div>
    </section>

    <section class="summary">
      <div><span>Total leads</span><strong>{{ leads.length }}</strong></div>
      <div><span>Latest run</span><strong>{{ latestJob?.status || 'Not started' }}</strong></div>
      <div><span>Last updated</span><strong>{{ lastUpdated ? lastUpdated.toLocaleTimeString() : '—' }}</strong></div>
    </section>

    <p v-if="loading && !operations" class="state">Connecting to control center...</p>
    <p v-else-if="error" class="state error">{{ error }}. Start the API and PostgreSQL first.</p>
    <section v-else class="panel table-panel">
      <div class="panel-heading"><div><p class="label">Lead database</p><h2>Collected leads</h2></div><span class="muted">Auto-refreshing</span></div>
      <table>
        <thead><tr><th>Company</th><th>Contact</th><th>Status</th><th>Recommendation</th><th>Discovered</th></tr></thead>
        <tbody>
          <tr v-for="lead in leads" :key="lead.lead_id">
            <td><strong>{{ lead.company_name }}</strong></td>
            <td>{{ lead.contact_name || lead.business_email || 'Not available' }}</td>
            <td><span class="badge">{{ lead.lead_status }}</span></td>
            <td>{{ lead.recommended_solution || 'Research pending' }}</td>
            <td>{{ new Date(lead.discovery_date).toLocaleDateString() }}</td>
          </tr>
          <tr v-if="!leads.length"><td colspan="5" class="empty">No leads yet. Start discovery to search public websites.</td></tr>
        </tbody>
      </table>
    </section>

    <section class="panel activity-panel">
      <div class="panel-heading"><div><p class="label">Audit trail</p><h2>Recent activity</h2></div></div>
      <div v-if="!operations?.activity.length" class="muted">No activity yet.</div>
      <div v-for="event in operations?.activity.slice(0, 8)" :key="event.event_id" class="activity-row"><span class="activity-mark" :class="event.status"></span><strong>{{ event.event_type.split('_').join(' ') }}</strong><span class="muted">{{ formatTime(event.event_timestamp) }}</span></div>
    </section>
  </main>
</template>
