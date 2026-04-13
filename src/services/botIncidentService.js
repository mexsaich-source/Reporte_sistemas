import { supabase } from '../lib/supabaseClient';

export const botIncidentService = {
  async getActiveIncidents() {
    const { data, error } = await supabase
      .from('bot_incidents')
      .select('*')
      .eq('status', 'active')
      .order('started_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getAllIncidents() {
    const { data, error } = await supabase
      .from('bot_incidents')
      .select('*')
      .order('started_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createIncident(payload, actorId) {
    const { data, error } = await supabase
      .from('bot_incidents')
      .insert([
        {
          ...payload,
          status: 'active',
          created_by: actorId,
          started_at: new Date().toISOString(),
        },
      ])
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async resolveIncident(incidentId, resolutionNote, actorId) {
    const { data, error } = await supabase
      .from('bot_incidents')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_note: resolutionNote || null,
        resolved_by: actorId,
      })
      .eq('id', incidentId)
      .eq('status', 'active')
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async updateIncident(incidentId, payload) {
    const { data, error } = await supabase
      .from('bot_incidents')
      .update({
        service: payload.service,
        priority: payload.priority,
        title: payload.title,
        message: payload.message,
      })
      .eq('id', incidentId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async logTriage({ userId, question, normalizedTopic, botResponse, incidentId = null, outcome = 'self_resolved' }) {
    const { error } = await supabase
      .from('bot_triage_logs')
      .insert([
        {
          user_id: userId,
          question,
          normalized_topic: normalizedTopic,
          bot_response: botResponse,
          incident_id: incidentId,
          outcome,
        },
      ]);

    if (error) throw error;
    return true;
  },
};
