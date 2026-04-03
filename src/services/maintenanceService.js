import { supabase } from '../lib/supabaseClient';
import { auditService } from './auditService';
import { workNotificationService } from './workNotificationService';

const normalize = (value = '') => value.toString().trim().toLowerCase();

async function getMaintenanceSupervisors(excludeUserId = null) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, department')
      .eq('status', true);

    if (error) {
      console.warn('Error loading maintenance supervisors:', error.message || error);
      return [];
    }

    return (data || [])
      .filter((user) => {
        const role = normalize(user.role);
        const department = normalize(user.department);
        const isMaintenanceAdmin = role === 'jefe_mantenimiento';
        const isGlobalAdmin = role === 'admin';
        const isMaintenanceDept = department.includes('mantenimiento') || department.includes('ingenieria') || department.includes('ingeniería');
        return isGlobalAdmin || (isMaintenanceAdmin && isMaintenanceDept);
      })
      .map((user) => user.id)
      .filter((id) => id && id !== excludeUserId);
  } catch (error) {
    console.warn('Error getting maintenance supervisors:', error?.message || error);
    return [];
  }
}

export const maintenanceService = {
  // 1. Obtener todos los tickets (Para Jefe/Admin)
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('maintenance_tickets')
        .select(`
          *,
          creador:creado_por(full_name),
          asignado:asignado_a(full_name)
        `)
        .order('fecha_creacion', { ascending: false });

      if (error) {
        console.warn("Retrying query without joins due to error:", error);
        // Fallback: Si el join falla (por las relaciones de Supabase), traemos los datos planos
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('maintenance_tickets')
          .select('*')
          .order('fecha_creacion', { ascending: false });
          
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      return data;
    } catch (error) {
      console.error("Error fetching maintenance tickets:", error);
      return [];
    }
  },

  // 2. Obtener tickets asignados a un ingeniero específico
  async getByEngineer(engineerId) {
    try {
      const { data, error } = await supabase
        .from('maintenance_tickets')
        .select(`
           *,
           creador:creado_por(full_name)
        `)
        .eq('asignado_a', engineerId)
        .order('fecha_creacion', { ascending: false });

      if (error) {
        console.warn("Retrying engineer query without joins:", error);
        // Fallback sin joins
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('maintenance_tickets')
          .select('*')
          .eq('asignado_a', engineerId)
          .order('fecha_creacion', { ascending: false });
          
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      return data;
    } catch (error) {
      console.error("Error fetching assigned tickets:", error);
      return [];
    }
  },

  // 3. Crear un nuevo ticket (Jefe)
  async create(ticketData, actorId) {
    try {
      const { data, error } = await supabase
        .from('maintenance_tickets')
        .insert([{
          ...ticketData,
          creado_por: actorId,
          estado: 'Pendiente'
        }])
        .select();

      if (error) throw error;

      // Audit log
      await auditService.log(actorId, 'CREATE_MAINTENANCE_TICKET', 'maintenance_tickets', data[0].id, {
        title: ticketData.title_falla
      });

      const supervisors = await getMaintenanceSupervisors(actorId);
      await Promise.all(
        supervisors.map((userId) =>
          workNotificationService.createNotification(
            userId,
            'Nueva orden de mantenimiento',
            `Se creó la orden "${ticketData.title_falla}" y requiere asignación.`
          )
        )
      );

      return { success: true, data: data[0] };
    } catch (error) {
      console.error("Error creating maintenance ticket:", error);
      return { success: false, error: error.message };
    }
  },

  // 4. Asignar un ingeniero (Jefe)
  async assign(ticketId, engineerId, actorId) {
    try {
      const payload = engineerId
        ? { asignado_a: engineerId, estado: 'Asignado' }
        : { asignado_a: null, estado: 'Pendiente' };

      const { data, error } = await supabase
        .from('maintenance_tickets')
        .update(payload)
        .eq('id', ticketId)
        .select('id, title_falla, creado_por, asignado_a, estado')
        .single();

      if (error) throw error;

      await auditService.log(actorId, 'ASSIGN_MAINTENANCE_TICKET', 'maintenance_tickets', ticketId, {
        engineer_id: engineerId
      });

      if (engineerId) {
        await workNotificationService.createNotification(
          engineerId,
          'Orden de mantenimiento asignada',
          `Se te asignó la orden "${data?.title_falla || ticketId}".`
        );
      }

      if (data?.creado_por && data.creado_por !== actorId) {
        await workNotificationService.createNotification(
          data.creado_por,
          engineerId ? 'Orden asignada' : 'Orden desasignada',
          engineerId
            ? `La orden "${data?.title_falla || ticketId}" ya fue asignada a ingeniería.`
            : `La orden "${data?.title_falla || ticketId}" quedó nuevamente pendiente.`
        );
      }

      return { success: true };
    } catch (error) {
      console.error("Error assigning maintenance ticket:", error);
      return { success: false, error: error.message };
    }
  },

  // 4b. Comenzar trabajo (Ingeniero)
  async startWork(ticketId, actorId) {
    try {
      const { data, error } = await supabase
        .from('maintenance_tickets')
        .update({ 
          estado: 'En Proceso'
        })
        .eq('id', ticketId)
        .eq('asignado_a', actorId)
        .select('id, title_falla, creado_por, asignado_a, estado')
        .single();

      if (error) throw error;

      await auditService.log(actorId, 'START_MAINTENANCE_WORK', 'maintenance_tickets', ticketId);

      const supervisors = await getMaintenanceSupervisors(actorId);
      const recipients = new Set(supervisors);
      if (data?.creado_por && data.creado_por !== actorId) {
        recipients.add(data.creado_por);
      }

      await Promise.all(
        [...recipients].map((userId) =>
          workNotificationService.createNotification(
            userId,
            'Orden en proceso',
            `El técnico inició atención de la orden "${data?.title_falla || ticketId}".`
          )
        )
      );

      return { success: true };
    } catch (error) {
      console.error("Error starting work:", error);
      return {
        success: false,
        error: error?.message || 'No fue posible cambiar a En Proceso. Verifica RLS y estado del ticket.'
      };
    }
  },

  // 5. Resolver ticket (Ingeniero)
  async resolve(ticketId, notas, actorId) {
    try {
      const { data, error } = await supabase
        .from('maintenance_tickets')
        .update({ 
          estado: 'Resuelto',
          fecha_resolucion: new Date().toISOString(),
          notas_resolucion: notas
        })
        .eq('id', ticketId)
        .eq('asignado_a', actorId)
        .select(`
          id,
          title_falla,
          ubicacion,
          estado,
          fecha_resolucion,
          notas_resolucion,
          creado_por,
          asignado_a,
          asignado:asignado_a(full_name)
        `)
        .single();

      if (error) throw error;

      // Audit log
      await auditService.log(actorId, 'RESOLVE_MAINTENANCE_TICKET', 'maintenance_tickets', ticketId, {
        notas: notas
      });

      const supervisors = await getMaintenanceSupervisors(actorId);
      const recipients = new Set(supervisors);
      if (data?.creado_por && data.creado_por !== actorId) {
        recipients.add(data.creado_por);
      }

      await Promise.all(
        [...recipients].map((userId) =>
          workNotificationService.createNotification(
            userId,
            'Orden resuelta',
            `La orden "${data?.title_falla || ticketId}" fue finalizada por ingeniería.`
          )
        )
      );

      return { success: true, data };
    } catch (error) {
      console.error("Error resolving maintenance ticket:", error);
      return {
        success: false,
        error: error?.message || 'No fue posible resolver la orden. Verifica permisos y estado del ticket.'
      };
    }
  }
};
