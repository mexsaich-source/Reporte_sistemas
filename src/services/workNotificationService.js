import { supabase } from '../lib/supabaseClient';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

async function createNotification(userId, title, message, type = 'info', actionUrl = null) {
  if (!userId || !title || !message) return false;

  try {
    let notificationId = null;

    // 1) Intento principal: RPC con validación de negocio.
    const { data, error } = await supabase.rpc('create_notification_safe', {
      p_user_id: userId,
      p_title: title,
      p_message: message,
      p_type: type,
      p_action_url: actionUrl
    });

    if (!error) {
      notificationId = data?.[0]?.id || null;
    } else {
      console.warn('⚠️ RPC create_notification_safe falló, usando fallback directo:', error.message || error);

      // 2) Fallback: inserción directa en notifications cuando el RPC no aplique para el actor.
      const { data: directData, error: directErr } = await supabase
        .from('notifications')
        .insert([
          {
            user_id: userId,
            title,
            message,
            type,
            action_url: actionUrl,
          }
        ])
        .select('id')
        .single();

      if (directErr) {
        console.error('❌ Error creando notificación (fallback directo):', directErr.message || directErr);
        return false;
      }

      notificationId = directData?.id || null;
    }

    // Fallback: intentar push directo para no depender solo del trigger SQL.
    // Si falla, no bloquea el flujo principal porque la notificacion ya quedo guardada.
    supabase.functions
      .invoke('send-fcm-push', {
        body: {
          record: {
            id: notificationId,
            user_id: userId,
            title,
            message,
            type,
            action_url: actionUrl
          }
        }
      })
      .then(({ error: pushErr }) => {
        if (pushErr) {
          console.warn('⚠️ Push fallback no enviado:', pushErr.message || pushErr);
        }
      })
      .catch((pushErr) => {
        console.warn('⚠️ Push fallback exception:', pushErr?.message || pushErr);
      });

    // 🌟 Disparar Alerta Omnicanal (WhatsApp y Email) en paralelo sin bloquear
    supabase.functions
      .invoke('notify-omnicanal', {
        body: {
          user_id: userId,
          title,
          message,
          type
        }
      })
      .then(({ error: omniErr }) => {
        if (omniErr) console.warn('⚠️ Omnicanal fallback warning:', omniErr.message || omniErr);
      })
      .catch((err) => console.warn('⚠️ Omnicanal request error:', err?.message || err));

    console.log('✅ Notificación creada:', {
      id: notificationId,
      user_id: userId,
      title,
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (err) {
    console.error('❌ Excepción creando notificación:', err);
    return false;
  }
}

async function createNotificationOnce({ userId, title, message, dedupeHours = 24 }) {
  if (!userId || !title || !message) return false;

  const fromDate = new Date(Date.now() - dedupeHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('title', title)
    .eq('message', message)
    .gte('created_at', fromDate)
    .limit(1);

  if (error) {
    console.warn('No se pudo validar dedupe de notificacion:', error.message);
  }

  if (Array.isArray(data) && data.length > 0) {
    return false;
  }

  return createNotification(userId, title, message);
}

function getDueState(isoDate, now = Date.now()) {
  if (!isoDate) return null;
  const dueTs = new Date(isoDate).getTime();
  if (Number.isNaN(dueTs)) return null;

  const diff = dueTs - now;
  if (diff <= 0) return 'overdue';
  if (diff <= TWO_HOURS_MS) return '2h';
  if (diff <= ONE_DAY_MS) return '24h';
  return null;
}

async function remindActivityDeadlines() {
  const { data: rows, error } = await supabase
    .from('activities')
    .select('id,title,due_date,status,assigned_tech')
    .not('due_date', 'is', null)
    .in('status', ['pending', 'assigned', 'in_progress']);

  if (error) {
    console.warn('No se pudieron leer actividades para recordatorios:', error.message);
    return;
  }

  for (const row of rows || []) {
    if (!row.assigned_tech) continue;
    const dueState = getDueState(row.due_date);
    if (!dueState) continue;

    let title = 'Recordatorio de actividad';
    if (dueState === 'overdue') title = 'Actividad vencida';

    const message =
      dueState === '24h'
        ? `La actividad "${row.title || row.id}" vence en menos de 24 horas.`
        : dueState === '2h'
          ? `La actividad "${row.title || row.id}" vence en menos de 2 horas.`
          : `La actividad "${row.title || row.id}" ya vencio. Atiendela lo antes posible.`;

    const dedupeHours = dueState === '2h' ? 3 : 24;
    await createNotificationOnce({ userId: row.assigned_tech, title, message, dedupeHours });
  }
}

async function remindTicketDeadlines() {
  const { data: rows, error } = await supabase
    .from('tickets')
    .select('id,title,status,assigned_tech,scheduled_for')
    .not('scheduled_for', 'is', null)
    .neq('status', 'resolved');

  if (error) {
    console.warn('No se pudieron leer tickets para recordatorios:', error.message);
    return;
  }

  for (const row of rows || []) {
    if (!row.assigned_tech) continue;
    const dueState = getDueState(row.scheduled_for);
    if (!dueState) continue;

    let title = 'Recordatorio de ticket';
    if (dueState === 'overdue') title = 'Ticket con atencion vencida';

    const ticketLabel = row.title || `#${row.id}`;
    const message =
      dueState === '24h'
        ? `El ticket "${ticketLabel}" tiene atencion programada en menos de 24 horas.`
        : dueState === '2h'
          ? `El ticket "${ticketLabel}" tiene atencion programada en menos de 2 horas.`
          : `El ticket "${ticketLabel}" ya excedio su hora programada de atencion.`;

    const dedupeHours = dueState === '2h' ? 3 : 24;
    await createNotificationOnce({ userId: row.assigned_tech, title, message, dedupeHours });
  }
}

async function remindLoanDeadlines() {
  const { data: rows, error } = await supabase
    .from('general_requests')
    .select('id,user_id,subject,status,is_loan,loan_end_date')
    .eq('is_loan', true)
    .in('status', ['approved', 'borrowed', 'overdue'])
    .not('loan_end_date', 'is', null);

  if (error) {
    console.warn('No se pudieron leer prestamos para recordatorios:', error.message);
    return;
  }

  for (const row of rows || []) {
    const dueState = getDueState(row.loan_end_date);
    if (!dueState) continue;

    const title = dueState === 'overdue' ? 'Prestamo vencido' : 'Recordatorio de devolucion';
    const subject = row.subject || `prestamo #${row.id}`;
    const userMessage =
      dueState === '24h'
        ? `Tu ${subject} debe devolverse en menos de 24 horas.`
        : dueState === '2h'
          ? `Tu ${subject} debe devolverse en menos de 2 horas.`
          : `Tu ${subject} ya esta vencido. Favor de devolver el equipo.`;

    await createNotificationOnce({
      userId: row.user_id,
      title,
      message: userMessage,
      dedupeHours: dueState === '2h' ? 3 : 24
    });

    // Escalar a admins cuando el prestamo esta vencido
    if (dueState === 'overdue') {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id, role, department, status')
        .eq('status', true);

      const itAdmins = (admins || [])
        .filter((a) => {
          const role = String(a?.role || '').toLowerCase().trim();
          const dept = String(a?.department || '').toLowerCase().trim();
          const isMaintArea = dept.includes('mantenimiento') || dept.includes('ingenieria') || dept.includes('ingeniería');
          const itAdminRoles = ['admin', 'jefe_it', 'jefe_area_it', 'jefe area it'];
          return itAdminRoles.includes(role) && !isMaintArea;
        });

      for (const admin of itAdmins) {
        await createNotificationOnce({
          userId: admin.id,
          title: 'Prestamo vencido de usuario',
          message: `El usuario tiene vencido el ${subject}.`,
          dedupeHours: 24
        });
      }
    }
  }

  // Marcar automaticamente como overdue cuando ya vencio y sigue prestado
  const nowIso = new Date().toISOString();
  await supabase
    .from('general_requests')
    .update({ status: 'overdue' })
    .eq('is_loan', true)
    .in('status', ['approved', 'borrowed'])
    .lt('loan_end_date', nowIso);
}

export const workNotificationService = {
  createNotification,
  createNotificationOnce,
  remindActivityDeadlines,
  remindTicketDeadlines,
  remindLoanDeadlines,
  async runDueReminders() {
    try {
      await remindActivityDeadlines();
      await remindTicketDeadlines();
      await remindLoanDeadlines();
    } catch (err) {
      console.warn('runDueReminders fallo:', err?.message || err);
    }
  }
};
