// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors });
  if (request.headers.get('x-push-cron-secret') !== Deno.env.get('PUSH_CRON_SECRET')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

  const now = new Date();
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const nowLocal = new Date(`${localDate}T${localTime}:00+07:00`);

  const dateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

  const { data: tasks, error: tasksError } = await supabase.from('tasks')
    .select('id,user_id,title,due_date,due_time,status,notify,deleted_at')
    .eq('status', 'pending').eq('notify', true).is('deleted_at', null);
  if (tasksError) return Response.json({ error: 'Task query failed' }, { status: 500, headers: cors });

  const due = (tasks ?? []).flatMap((task) => {
    const deadline = new Date(`${task.due_date}T${task.due_time ?? '09:00:00'}+07:00`);
    const remaining = deadline.getTime() - nowLocal.getTime();
    if (remaining <= 0) return [{ task, overdue: true }];
    if (remaining <= 5 * 60 * 60 * 1000) return [{ task, overdue: false }];
    return [];
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const { task, overdue } of due) {
    const { data: subscriptions } = await supabase.from('push_subscriptions').select('endpoint,subscription').eq('user_id', task.user_id);
    for (const entry of subscriptions ?? []) {
      const { data: claimed, error: claimError } = await supabase.rpc('claim_push_reminder', {
        p_task_id: task.id,
        p_endpoint: entry.endpoint,
        p_overdue: overdue
      });
      if (claimError) { errors.push(`${task.id}:claim-error`); continue; }
      if (!claimed) { skipped++; continue; }
      try {
        await webpush.sendNotification(entry.subscription, JSON.stringify({
          title: overdue ? 'KAMU SUDAH MELEWATI BATAS' : 'Pengingat deadline',
          body: overdue ? `${task.title} · tenggat ${task.due_date}${task.due_time ? ` ${task.due_time}` : ''}` : `${task.title} · ${task.due_date}${task.due_time ? ` ${task.due_time}` : ''}`,
          tag: `task-${task.id}`,
          url: `/tasks/detail?id=${encodeURIComponent(task.id)}`
        }));
        await supabase.rpc('finish_push_reminder', { p_task_id: task.id, p_endpoint: entry.endpoint, p_sent: true });
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', entry.endpoint);
        else errors.push(`${task.id}:${status ?? 'send-error'}`);
        await supabase.rpc('finish_push_reminder', { p_task_id: task.id, p_endpoint: entry.endpoint, p_sent: status === 404 || status === 410 });
      }
    }
  }
  return Response.json({ sent, skipped, errors }, { headers: cors });
});
