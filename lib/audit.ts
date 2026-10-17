import { createClient } from '@/lib/supabase/server'

type AuditEntry = {
  action: string
  targetType: string
  targetId?: string | null
  details?: Record<string, unknown>
}

// Mencatat aksi lorekeeper. Gagal mencatat tidak membatalkan aksi utamanya
// (di 10D kita rapikan agar pencatatan ikut dalam transaksi yang sama).
export async function logAction({
  action,
  targetType,
  targetId = null,
  details = {},
}: AuditEntry) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('log_action', {
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId,
    p_details: details,
  })
  if (error) console.error('Gagal mencatat audit log:', error.message)
}