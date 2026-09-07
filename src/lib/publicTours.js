export function applyPublicTourVisibility(query) {
  return query.or('status.eq.published,and(status.eq.active,is_active.is.true)');
}

export function selectPublicTours(client, columns = '*') {
  return applyPublicTourVisibility(client.from('tours').select(columns));
}
