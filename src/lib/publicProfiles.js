function normalizeValue(value) {
  return value == null ? '' : String(value).toLocaleLowerCase();
}

function matchesIlike(value, pattern) {
  const expression = String(pattern)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll('%', '.*')
    .replaceAll('_', '.');
  return new RegExp(`^${expression}$`, 'i').test(normalizeValue(value));
}

function projectPublicFields(row, columns) {
  if (!columns || columns === '*') return row;
  return columns.split(',').reduce((result, rawColumn) => {
    const column = rawColumn.trim();
    if (column && Object.hasOwn(row, column)) result[column] = row[column];
    return result;
  }, {});
}

class PublicProfilesQuery {
  constructor(client, columns) {
    this.client = client;
    this.columns = columns;
    this.filters = [];
    this.orders = [];
    this.limitValue = null;
    this.rangeValue = null;
    this.resultMode = 'many';
  }

  eq(column, value) {
    this.filters.push(row => row?.[column] === value);
    return this;
  }

  in(column, values) {
    const allowed = new Set(values || []);
    this.filters.push(row => allowed.has(row?.[column]));
    return this;
  }

  ilike(column, pattern) {
    this.filters.push(row => matchesIlike(row?.[column], pattern));
    return this;
  }

  order(column, { ascending = true, nullsFirst = false } = {}) {
    this.orders.push({ column, ascending, nullsFirst });
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  range(from, to) {
    this.rangeValue = { from, to };
    return this;
  }

  single() {
    this.resultMode = 'single';
    return this;
  }

  maybeSingle() {
    this.resultMode = 'maybeSingle';
    return this;
  }

  async execute() {
    const { data, error } = await this.client.rpc('get_public_profiles');
    if (error) return { data: null, error };

    let rows = (Array.isArray(data) ? data : []).filter(row => this.filters.every(filter => filter(row)));

    for (const { column, ascending, nullsFirst } of this.orders) {
      rows = [...rows].sort((left, right) => {
        const a = left?.[column];
        const b = right?.[column];
        if (a == null || b == null) {
          if (a == null && b == null) return 0;
          return a == null ? (nullsFirst ? -1 : 1) : (nullsFirst ? 1 : -1);
        }
        const comparison = typeof a === 'number' && typeof b === 'number'
          ? a - b
          : String(a).localeCompare(String(b));
        return ascending ? comparison : -comparison;
      });
    }

    if (this.rangeValue) rows = rows.slice(this.rangeValue.from, this.rangeValue.to + 1);
    if (this.limitValue != null) rows = rows.slice(0, this.limitValue);
    rows = rows.map(row => projectPublicFields(row, this.columns));

    if (this.resultMode === 'single') {
      if (rows.length !== 1) {
        return { data: null, error: { code: 'PGRST116', message: 'Expected exactly one public profile.' } };
      }
      return { data: rows[0], error: null };
    }

    if (this.resultMode === 'maybeSingle') {
      if (rows.length > 1) {
        return { data: null, error: { code: 'PGRST116', message: 'Expected at most one public profile.' } };
      }
      return { data: rows[0] || null, error: null };
    }

    return { data: rows, error: null };
  }

  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }
}

export function applyPublicProfileVisibility(query) {
  return query;
}

// Public callers use only the SECURITY DEFINER RPC. Filters are deliberately
// centralized here; there is no fallback to public.profiles or public_profiles.
export function selectPublicProfiles(client, columns = '*') {
  return applyPublicProfileVisibility(new PublicProfilesQuery(client, columns));
}
