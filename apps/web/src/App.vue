<script setup lang="ts">
import { onMounted, ref } from 'vue';

type Lead = {
  lead_id: string;
  company_name: string;
  contact_name?: string;
  business_email?: string;
  lead_status: string;
  recommended_solution?: string;
  discovery_date: string;
};

const leads = ref<Lead[]>([]);
const loading = ref(true);
const error = ref('');

async function loadLeads(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const response = await fetch('http://localhost:3000/api/leads');
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    leads.value = (await response.json()).data;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to load leads';
  } finally {
    loading.value = false;
  }
}

onMounted(loadLeads);
</script>

<template>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Lead operations</p>
        <h1>Pipeline intelligence</h1>
        <p class="subtitle">Evidence-backed opportunities, human-approved outreach.</p>
      </div>
      <button @click="loadLeads">Refresh</button>
    </header>

    <section class="summary">
      <div><span>Total leads</span><strong>{{ leads.length }}</strong></div>
      <div><span>Draft policy</span><strong>Approval required</strong></div>
      <div><span>Notifications</span><strong>Telegram</strong></div>
    </section>

    <p v-if="loading" class="state">Loading leads...</p>
    <p v-else-if="error" class="state error">{{ error }}. Start the API and PostgreSQL first.</p>
    <section v-else class="table-wrap">
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
          <tr v-if="!leads.length"><td colspan="5" class="empty">No leads yet. Connect a permitted source adapter to begin.</td></tr>
        </tbody>
      </table>
    </section>
  </main>
</template>
