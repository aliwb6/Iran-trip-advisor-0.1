import { TransitionSurface } from '@/components/ui/TransitionSurface';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search } from 'lucide-react';
import { iranianCities } from '@/data/iranianCities';

const PLACEHOLDERS = [
  "Which city are you dreaming of?",
  "Search your next Iranian adventure...",
  "Explore Isfahan, Shiraz, Tehran...",
  "Looking for architecture tours?",
  "Find your perfect guide in Iran...",
  "What experience are you seeking?",
  "Desert, mountain, or ancient city?",
];

export default function HeroSearchBar() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCities = input.trim()
    ? iranianCities.filter((city) =>
        city.toLowerCase().includes(input.toLowerCase())
      ).slice(0, 6)
    : [];

  const handleSearch = (query = input) => {
    if (query.trim()) {
      navigate('/ai-assistant', { state: { initialMessage: query } });
      setShowDropdown(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleCitySelect = (city) => {
    setInput(city);
    handleSearch(city);
  };

  return (
    <div className="w-full flex justify-center px-5 sm:px-8 lg:px-10 mb-12">
      <div className="w-full max-w-2xl relative z-40" ref={containerRef}>
        <motion.div
          className={`relative flex items-center rounded-full transition-all duration-300 ${
            isFocused ? 'ring-2 ring-gold shadow-xl' : 'shadow-xl'
          } bg-white border border-gray-100`}
          animate={{ scale: isFocused ? 1.02 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          {/* Left MapPin icon - golden yellow */}
          <div className="absolute left-5 sm:left-6 flex items-center justify-center pointer-events-none z-10">
            <MapPin
              className="w-5 h-5 sm:w-6 sm:h-6 text-gold"
              strokeWidth={2.5}
            />
          </div>

          {/* Input field */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (e.target.value.trim()) {
                setShowDropdown(true);
              }
            }}
            onKeyPress={handleKeyPress}
            onFocus={() => {
              setIsFocused(true);
              if (input.trim()) {
                setShowDropdown(true);
              }
            }}
            onBlur={() => setIsFocused(false)}
            placeholder=" "
            className="flex-1 pl-14 sm:pl-16 pr-14 sm:pr-16 py-3.5 sm:py-4 bg-transparent outline-none text-sm sm:text-base font-medium text-gray-900 placeholder-transparent"
            autoComplete="off"
          />

          {/* Animated placeholder text - fades when user types */}
          {!input && (
            <div className="absolute left-14 sm:left-16 top-1/2 -translate-y-1/2 pointer-events-none">
              <AnimatePresence mode="wait">
                <motion.span
                  key={placeholderIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                  className="text-sm sm:text-base font-medium text-gray-500 whitespace-nowrap sm:whitespace-normal"
                >
                  {PLACEHOLDERS[placeholderIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
          )}

          {/* Search button - bold golden yellow with dark text */}
          <button
            onClick={() => handleSearch()}
            disabled={!input.trim()}
            className={`absolute right-2 sm:right-2.5 flex items-center justify-center h-10 sm:h-11 px-5 sm:px-6 rounded-full font-bold uppercase tracking-wide transition-all duration-200 ${
              input.trim()
                ? 'bg-gold hover:bg-gold/90 text-gray-900 hover:shadow-lg hover:shadow-gold/40 active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            aria-label="Search"
          >
            <Search className="w-5 h-5 sm:w-5 sm:h-5" />
          </button>

          {/* City autocomplete dropdown */}
          <AnimatePresence>
            {showDropdown && filteredCities.length > 0 && (
              <TransitionSurface kind="dropdown" data-origin="top-left"
                className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50"
              >
                {filteredCities.map((city) => (
                  <button
                    key={city}
                    onClick={() => handleCitySelect(city)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-yellow-50 transition-colors border-b last:border-b-0"
                  >
                    <MapPin className="w-4 h-4 text-gold flex-shrink-0" />
                    <span className="text-gray-900 font-medium">{city}</span>
                  </button>
                ))}
              </TransitionSurface>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
