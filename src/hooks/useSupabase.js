import { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import { selectPublicProfiles } from '@/lib/publicProfiles';
import { selectPublicTours } from '@/lib/publicTours';
import { fetchProfileReviewsSafely } from '@/lib/reviews';
import { mergeLanguages, popularLanguages } from '@/data/languages';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1564960723835-2898c9df9297?w=800&h=600&fit=crop";

export function useTours(filters = {}) {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchTours = async () => {
      try {
        // Public listing — hide draft/pending tours so visitors only see
        // what guides have actually published. Matches the convention used
        // by CityPage, the AI Assistant catalog, and the dashboard's
        // "Upcoming tour" widget.
        let query = selectPublicTours(supabase);

        // tours.purpose and tours.theme are `text[]` in Supabase, so we use
        // PostgREST array-containment (`@>`) via `.contains([value])`. A
        // simple `.eq` would compare against an exact array literal and never
        // match multi-value rows.
        if (filters.purpose && filters.purpose !== 'all') {
          query = query.contains('purpose', [filters.purpose]);
        }
        if (filters.theme && filters.theme !== 'all') {
          query = query.contains('theme', [filters.theme]);
        }
        if (filters.duration && filters.duration !== 'all') {
          if (filters.duration === 'short')  query = query.lte('duration', 7);
          if (filters.duration === 'medium') query = query.gte('duration', 8).lte('duration', 11);
          if (filters.duration === 'long')   query = query.gte('duration', 12);
        }

        const { data, error: supabaseError } = await query.order('created_at', { ascending: false });

        if (supabaseError) throw supabaseError;
        if (isMounted) {
          let rows = data || [];
          if (rows.length > 0) {
            const { data: reviewRows } = await supabase
              .from('reviews')
              .select('tour_id, rating')
              .in('tour_id', rows.map(row => row.id))
              .eq('status', 'approved');

            if (reviewRows) {
              const aggregates = reviewRows.reduce((result, review) => {
                if (!review.tour_id) return result;
                const current = result[review.tour_id] || { count: 0, sum: 0, positive: 0 };
                const rating = Number(review.rating) || 0;
                current.count += 1;
                current.sum += rating;
                if (rating >= 4) current.positive += 1;
                result[review.tour_id] = current;
                return result;
              }, {});

              rows = rows.map(row => {
                const aggregate = aggregates[row.id];
                if (!aggregate) return row;
                return {
                  ...row,
                  rating: aggregate.sum / aggregate.count,
                  review_count: aggregate.count,
                  positive_review_count: aggregate.positive,
                };
              });
            }
          }
          if (!isMounted) return;
          setTours(rows);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setTours([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTours();
    return () => { isMounted = false; };
  }, [JSON.stringify(filters)]);

  return { tours, loading, error };
}

export function useTopRatedTours(limit = 4) {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchTopRatedTours = async () => {
      try {
        const { data, error: supabaseError } = await selectPublicTours(supabase)
          .order('rating', { ascending: false, nullsLast: true })
          .limit(limit);

        if (supabaseError) throw supabaseError;
        if (isMounted) {
          setTours(data || []);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setTours([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTopRatedTours();
    return () => { isMounted = false; };
  }, [limit]);

  return { tours, loading, error };
}

export function useTourBySlug(slug) {
  const [tour, setTour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchTour = async () => {
      try {
        const { data, error: supabaseError } = await selectPublicTours(supabase)
          .eq('slug', slug)
          .single();

        if (supabaseError) throw supabaseError;
        if (isMounted) {
          setTour(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setTour(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (slug) fetchTour();
    return () => { isMounted = false; };
  }, [slug]);

  return { tour, loading, error };
}

export function useTourById(id) {
  const [tour, setTour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchTour = async () => {
      try {
        const { data, error: supabaseError } = await selectPublicTours(supabase)
          .eq('id', id)
          .single();

        if (supabaseError) throw supabaseError;
        if (isMounted) {
          setTour(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setTour(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (id) fetchTour();
    return () => { isMounted = false; };
  }, [id]);

  return { tour, loading, error };
}

export function usePackageById(id) {
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchPackage = async () => {
      try {
        const { data, error: supabaseError } = await selectPublicTours(supabase)
          .eq('id', id)
          .single();

        if (supabaseError) {
          console.warn('Supabase fetch error (table may not exist):', supabaseError.message);
          if (isMounted) {
            setPkg(null);
            setError(null);
          }
        } else if (isMounted) {
          setPkg(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setPkg(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (id) fetchPackage();
    return () => { isMounted = false; };
  }, [id]);

  return { pkg, loading, error };
}

export function useDestinations() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchDestinations = async () => {
      try {
        const { data, error: supabaseError } = await selectPublicTours(supabase, 'location, city')
          .order('location', { ascending: true });

        if (supabaseError) throw supabaseError;

        const uniqueLocations = [...new Set(data?.map(t => t.location).filter(Boolean))];
        const uniqueCities = [...new Set(data?.map(t => t.city).filter(Boolean))];

        if (isMounted) {
          setDestinations({ locations: uniqueLocations, cities: uniqueCities });
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setDestinations({ locations: [], cities: [] });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDestinations();
    return () => { isMounted = false; };
  }, []);

  return { destinations, loading, error };
}

export function useSearchTours(query) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const searchTours = async () => {
      try {
        const { data, error: supabaseError } = await selectPublicTours(supabase)
          .or(`title.ilike.%${query}%,description.ilike.%${query}%,location.ilike.%${query}%,cities.ilike.%${query}%`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (supabaseError) throw supabaseError;
        if (isMounted) {
          setResults(data || []);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setResults([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const debounce = setTimeout(searchTours, 300);
    return () => {
      clearTimeout(debounce);
      isMounted = false;
    };
  }, [query]);

  return { results, loading, error };
}

// Internal: fetch profiles for one or more roles. Used by `useGuides` and
// `useAgencies` below so the two pages can stay independent — Guides used to
// share its hook with agencies, but the UX now splits them.
function useProfilesByRole(roles) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const rolesKey = Array.isArray(roles) ? roles.join(',') : String(roles);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchRows = async () => {
      try {
        const list = Array.isArray(roles) ? roles : [roles];
        const { data: rows, error: supabaseError } = await selectPublicProfiles(supabase)
          .in('role', list)
          .order('created_at', { ascending: false });

        if (supabaseError) throw supabaseError;
        if (isMounted) {
          setData(rows || []);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setData([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRows();
    return () => { isMounted = false; };
  }, [rolesKey]);

  return { data, loading, error };
}

export function useGuides() {
  const { data, loading, error } = useProfilesByRole(['guide']);
  return { guides: data, loading, error };
}

export function useAgencies() {
  const { data, loading, error } = useProfilesByRole(['agency']);
  return { agencies: data, loading, error };
}

export function useAvailableProfileLanguages() {
  const [languages, setLanguages] = useState(popularLanguages);

  useEffect(() => {
    let isMounted = true;

    selectPublicProfiles(supabase, 'languages')
      .in('role', ['guide', 'agency'])
      .then(({ data }) => {
        if (!isMounted) return;
        setLanguages(mergeLanguages(popularLanguages, (data || []).map(row => row.languages)));
      });

    return () => { isMounted = false; };
  }, []);

  return languages;
}

export function useGuideProfile(guideId) {
  const [guide, setGuide] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewError, setReviewError] = useState(null);

  useEffect(() => {
    if (!guideId) return;
    let isMounted = true;
    setLoading(true);

    const fetchAll = async () => {
      try {
        const [profileResult, toursResult, reviewsResult] = await Promise.all([
          selectPublicProfiles(supabase).eq('id', guideId).single(),
          selectPublicTours(supabase).eq('guide_id', guideId),
          fetchProfileReviewsSafely(supabase, { targetType: 'guide', profileId: guideId }),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (isMounted) {
          setGuide(profileResult.data);
          setTours(toursResult.data || []);
          setReviews(reviewsResult.reviews);
          setReviewError(reviewsResult.error);
          setError(null);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAll();
    return () => { isMounted = false; };
  }, [guideId]);

  return { guide, reviews, tours, loading, error, reviewError };
}

export function useAgencyProfile(agencyId) {
  const [agency, setAgency] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewError, setReviewError] = useState(null);

  useEffect(() => {
    if (!agencyId) return;
    let isMounted = true;
    setLoading(true);

    const fetchAll = async () => {
      try {
        const [profileResult, toursResult, reviewsResult] = await Promise.all([
          selectPublicProfiles(supabase).eq('id', agencyId).single(),
          selectPublicTours(supabase).eq('agency_id', agencyId),
          fetchProfileReviewsSafely(supabase, { targetType: 'agency', profileId: agencyId }),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (isMounted) {
          setAgency(profileResult.data);
          setTours(toursResult.data || []);
          setReviews(reviewsResult.reviews);
          setReviewError(reviewsResult.error);
          setError(null);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAll();
    return () => { isMounted = false; };
  }, [agencyId]);

  return { agency, reviews, tours, loading, error, reviewError };
}

export function useSpecialties(role = 'guide') {
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchSpecialties = async () => {
      try {
        const { data } = await selectPublicProfiles(supabase, 'specialties')
          .eq('role', role);

        if (isMounted) {
          const all = new Set();
          (data || []).forEach((row) => {
            const list = Array.isArray(row.specialties)
              ? row.specialties
              : typeof row.specialties === 'string'
              ? row.specialties.split(',').map((s) => s.trim())
              : [];
            list.filter(Boolean).forEach((s) => all.add(s));
          });
          setSpecialties([...all].sort());
        }
      } catch {
        if (isMounted) setSpecialties([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSpecialties();
    return () => { isMounted = false; };
  }, [role]);

  return { specialties, loading };
}

export function useSubmitTripRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (payload) => {
    setLoading(true);
    setError(null);
    try {
      if (!payload.travelerId) throw new Error('Please sign in to submit a trip request.');

      const destination = payload.destinationCity ? [payload.destinationCity] : [];
      const adults = Math.max(1, Number(payload.adults) || 1);
      const children = Math.max(0, Number(payload.children) || 0);
      const assistance = [
        payload.needsTransport ? 'Transportation' : null,
        payload.needsAccommodation ? 'Accommodation' : null,
      ].filter(Boolean);

      const { error: supabaseError } = await supabase.from('trip_requests').insert([{
        user_id: payload.travelerId,
        destination,
        start_date: payload.startDate || null,
        end_date: payload.endDate || null,
        adults,
        children,
        num_people: adults + children,
        guide_languages: payload.language ? [payload.language] : [],
        assistance,
        requirements: payload.requirements || null,
        status: 'active',
      }]);

      if (supabaseError) throw supabaseError;
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading, error };
}

// ── Article hooks ─────────────────────────────────────────────────────────────

export function useArticles({ featured = false } = {}) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchArticles = async () => {
      try {
        let query = supabase
          .from('articles')
          .select('*')
          .eq('status', 'approved')
          .eq('is_published', true);

        if (featured) query = query.eq('is_featured', true);

        query = query.order('created_at', { ascending: false });

        const { data, error: err } = await query;
        if (err) throw err;
        if (isMounted) { setArticles(data || []); setError(null); }
      } catch (err) {
        if (isMounted) { setError(err.message); setArticles([]); }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchArticles();
    return () => { isMounted = false; };
  }, [featured]);

  return { articles, loading, error };
}

export function useGuideArticles(authorId) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authorId) return;
    let isMounted = true;
    setLoading(true);

    const fetchArticles = async () => {
      try {
        const { data, error: err } = await supabase
          .from('articles')
          .select('*')
          .eq('author_id', authorId)
          .eq('status', 'approved')
          .eq('is_published', true)
          .order('created_at', { ascending: false });

        if (err) throw err;
        if (isMounted) { setArticles(data || []); setError(null); }
      } catch (err) {
        if (isMounted) { setError(err.message); setArticles([]); }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchArticles();
    return () => { isMounted = false; };
  }, [authorId]);

  return { articles, loading, error };
}

export function useMyArticles(userId) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    setLoading(true);

    const fetchArticles = async () => {
      try {
        const { data, error: err } = await supabase
          .from('articles')
          .select('*')
          .eq('author_id', userId)
          .order('created_at', { ascending: false });

        if (err) throw err;
        if (isMounted) setArticles(data || []);
      } catch {
        if (isMounted) setArticles([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchArticles();
    return () => { isMounted = false; };
  }, [userId, tick]);

  return { articles, loading, refetch: () => setTick(t => t + 1) };
}

export function useAllArticlesAdmin() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchArticles = async () => {
      try {
        const { data, error: err } = await supabase
          .from('articles')
          .select('*, author_profile:profiles!author_id(full_name, role)')
          .order('created_at', { ascending: false });

        if (err) throw err;
        if (isMounted) setArticles(data || []);
      } catch {
        if (isMounted) setArticles([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchArticles();
    return () => { isMounted = false; };
  }, [tick]);

  return { articles, loading, refetch: () => setTick(t => t + 1) };
}

export { FALLBACK_IMAGE };
