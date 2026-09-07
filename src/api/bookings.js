import { supabase } from '../supabaseClient';

const FINANCIAL_FIELDS = [
  'price',
  'quoted_unit_price',
  'commission_rate',
  'commission_amount',
  'guide_payout',
  'deposit_percentage',
  'deposit_amount',
  'balance_due',
];

function normalizeFinancialRow(row) {
  if (!row) return null;
  const normalized = { ...row, raw: row };
  FINANCIAL_FIELDS.forEach(field => {
    if (row[field] != null) normalized[field] = Number(row[field]);
  });
  if (row.traveler_count != null) normalized.traveler_count = Number(row.traveler_count);
  if (row.trip_duration_days != null) normalized.trip_duration_days = Number(row.trip_duration_days);
  return normalized;
}

export async function fetchMyBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('booked_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeFinancialRow);
}

export async function fetchBookingByRequestId(requestId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle();
  if (error) throw error;
  return normalizeFinancialRow(data);
}

export async function fetchBookingsByRequestIds(requestIds) {
  if (!requestIds?.length) return [];
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .in('request_id', requestIds)
    .order('booked_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeFinancialRow);
}

export async function fetchBookingById(id) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return normalizeFinancialRow(data);
}

export async function fetchMyPayments() {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeFinancialRow);
}
