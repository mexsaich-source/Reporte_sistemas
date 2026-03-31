import { supabase } from '../lib/supabaseClient';
import { workNotificationService } from './workNotificationService';

export const ACTIVITY_STATUS = {
  pending: 'pending',
  assigned: 'assigned',
  in_progress: 'in_progress',
  resolved: 'resolved'
};

export const activityService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching activities:', err);
      return [];
    }
  },

  async getLogs(activityId) {
    if (!activityId) return [];
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      return [];
    }
  },

  async createActivity({ title, description, assigned_tech, priority = 'medium', due_date, created_by, status }) {
    try {
      const payload = {
        title,
        description: description || null,
        assigned_tech: assigned_tech || null,
        priority,
        due_date: due_date || null,
        created_by,
        status: status || (assigned_tech ? ACTIVITY_STATUS.assigned : ACTIVITY_STATUS.pending)
      };

      const { data, error } = await supabase
        .from('activities')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      await supabase.from('activity_logs').insert([
        {
          activity_id: data.id,
          actor_id: created_by,
          event_type: 'created',
          message: assigned_tech ? `Actividad creada: ${title} (asignada)` : `Actividad creada: ${title}`
        }
      ]);

      if (assigned_tech) {
        console.log("[activityService] Intentando enviar notificacion de nueva actividad a:", assigned_tech);
        const ok = await workNotificationService.createNotification(
          assigned_tech,
          'Nueva actividad asignada',
          `Se te asigno la actividad: ${title}`
        );
        if (!ok) console.error("[activityService] Falló el push de nueva actividad al técnico:", assigned_tech);
      }

      if (assigned_tech && due_date) {
        await workNotificationService.createNotification(
          assigned_tech,
          'Actividad con fecha limite',
          `La actividad "${title}" tiene fecha limite ${new Date(due_date).toLocaleString()}.`
        );
      }

      return data;
    } catch (err) {
      console.error('Error creating activity:', err);
      return null;
    }
  },

  async addLog({ activity_id, actor_id, event_type = 'comment', message }) {
    try {
      if (!activity_id || !actor_id || !message) return false;
      const { error } = await supabase.from('activity_logs').insert([
        {
          activity_id,
          actor_id,
          event_type,
          message
        }
      ]);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error adding activity log:', err);
      return false;
    }
  },

  async updateActivity(id, updates, { actor_id } = {}) {
    if (!id) return null;
    try {
      const { data: current, error: fetchErr } = await supabase
        .from('activities')
        .select('id,title,status,assigned_tech,due_date')
        .eq('id', id)
        .single();

      if (fetchErr) throw fetchErr;
      if (!current) return null;

      const { data: updated, error: updateErr } = await supabase
        .from('activities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateErr) throw updateErr;
      if (!updated) return null;

      // Bitacora: log de cambios relevantes
      if (actor_id && updates.status && updates.status !== current.status) {
        await activityService.addLog({
          activity_id: id,
          actor_id,
          event_type: 'status_changed',
          message: `Estado cambiado de ${current.status} a ${updates.status}`
        });
      }

      if (('assigned_tech' in updates) && updates.assigned_tech !== current.assigned_tech) {
        if (actor_id) {
          await activityService.addLog({
            activity_id: id,
            actor_id,
            event_type: 'assigned_tech_changed',
            message: `Asignado a tecnico`
          });
        }

        if (updates.assigned_tech) {
          console.log("[activityService] Disparando notificacion al tecnico asignado:", updates.assigned_tech);
          try {
            const notifResult = await workNotificationService.createNotification(
              updates.assigned_tech,
              'Actividad asignada',
              `Se te asigno la actividad: ${updated.title || current.title || id}`
            );
            if (!notifResult) console.error("workNotificationService retornó false o falló");
          } catch(e) {
            console.error("Excepción al notificar técnico:", e);
          }
        }
      }

      if (('due_date' in updates) && updates.due_date !== current.due_date && updated.assigned_tech) {
        await workNotificationService.createNotification(
          updated.assigned_tech,
          'Nueva fecha limite de actividad',
          `La actividad "${updated.title || current.title || id}" vence el ${new Date(updates.due_date).toLocaleString()}.`
        );
      }

      return updated;
    } catch (err) {
      console.error('Error updating activity:', err);
      return null;
    }
  }
};

