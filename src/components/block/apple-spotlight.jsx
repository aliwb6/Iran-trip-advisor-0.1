'use client';;
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import {
    Activity,
    Calendar,
    ChevronRight,
    Files,
    Folder,
    Globe,
    Image as ImageIcon,
    LayoutGrid,
    Mail,
    MessageSquare,
    Music,
    Search,
    Settings,
    StickyNote,
    Terminal,
    Twitter
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

const SVGFilter = () => (
    <svg width="0" height="0">
        <filter id="blob">
            <feGaussianBlur stdDeviation="10" in="SourceGraphic" />
            <feColorMatrix
                values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 18 -9"
                result="blob"
            />
            <feBlend in="SourceGraphic" in2="blob" />
        </filter>
    </svg>
);

const ShortcutButton = ({
    icon,
    link,
    label
}) => (
    <a href={link} target="_blank" rel="noopener noreferrer" aria-label={label}>
        <div className="rounded-full cursor-pointer hover:shadow-lg opacity-30 hover:opacity-100 transition-[opacity,shadow] duration-200">
            <div className="size-16 aspect-square flex items-center justify-center">{icon}</div>
        </div>
    </a>
);

const SpotlightPlaceholder = ({
    text,
    className
}) => (
    <motion.div layout className={cn('absolute text-gray-500 flex items-center pointer-events-none z-10', className)}>
        <AnimatePresence mode="popLayout">
            <motion.p
                layoutId={`placeholder-${text}`}
                key={`placeholder-${text}`}
                initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
            >
                {text}
            </motion.p>
        </AnimatePresence>
    </motion.div>
);

const SpotlightInput = ({
    placeholder,
    hidePlaceholder,
    value,
    onChange,
    placeholderClassName
}) => {
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    return (
        <div className="flex items-center w-full justify-start gap-2 px-6 h-16">
            <motion.div layoutId="search-icon"><Search /></motion.div>
            <div className="flex-1 relative text-2xl">
                {!hidePlaceholder && <SpotlightPlaceholder text={placeholder} className={placeholderClassName} />}
                <motion.input
                    ref={inputRef}
                    layout="position"
                    type="text"
                    aria-label="Search shortcuts"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-transparent outline-none ring-none"
                />
            </div>
        </div>
    );
};

const SearchResultCard = ({
    icon,
    label,
    description,
    link,
    isLast
}) => (
    <a href={link} target="_blank" className="overflow-hidden w-full group/card">
        <div className={cn(
            'flex items-center text-black justify-start hover:bg-white gap-3 py-2 px-2 rounded-xl hover:shadow-md w-full',
            isLast && 'rounded-b-3xl'
        )}>
            <div className="size-8 [&_svg]:stroke-[1.5] [&_svg]:size-6 aspect-square flex items-center justify-center">{icon}</div>
            <div className="flex flex-col">
                <p className="font-medium">{label}</p>
                <p className="text-xs opacity-50">{description}</p>
            </div>
            <div className="flex-1 flex items-center justify-end opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
                <ChevronRight className="size-6" />
            </div>
        </div>
    </a>
);

const SearchResultsContainer = ({
    searchResults,
    onHover
}) => (
    <motion.div layout onMouseLeave={() => onHover(null)} className="px-2 border-t flex flex-col bg-neutral-100 max-h-96 overflow-y-auto w-full py-2">
        {searchResults.map((result, index) => (
            <motion.div
                key={`search-result-${index}`}
                onMouseEnter={() => onHover(index)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: index * 0.1, duration: 0.2, ease: 'easeOut' }}
            >
                <SearchResultCard {...result} isLast={index === searchResults.length - 1} />
            </motion.div>
        ))}
    </motion.div>
);

const DEFAULT_SHORTCUTS = [
    { label: 'Apps', icon: <LayoutGrid />, link: '#' },
    { label: 'Files', icon: <Folder />, link: '#' },
    { label: 'Actions', icon: <Activity />, link: '#' },
    { label: 'Clipboard', icon: <Files />, link: '#' }
];

const DEFAULT_SEARCH_RESULTS = [
    { icon: <Twitter />, label: 'Twitter', description: 'Open Twitter', link: '#' },
    { icon: <Globe />, label: 'Safari', description: 'Open web browser', link: '#' },
    { icon: <Mail />, label: 'Mail', description: 'Open Mail', link: '#' },
    { icon: <Calendar />, label: 'Calendar', description: 'View calendar', link: '#' },
    { icon: <StickyNote />, label: 'Notes', description: 'Open Notes', link: '#' },
    { icon: <ImageIcon />, label: 'Photos', description: 'Browse photos', link: '#' },
    { icon: <Settings />, label: 'Settings', description: 'Open Settings', link: '#' },
    { icon: <Terminal />, label: 'Terminal', description: 'Open Terminal', link: '#' },
    { icon: <Folder />, label: 'Finder', description: 'Open Finder', link: '#' },
    { icon: <MessageSquare />, label: 'Messages', description: 'Open Messages', link: '#' },
    { icon: <Music />, label: 'Music', description: 'Open Music', link: '#' }
];

export function AppleSpotlight({
    shortcuts = DEFAULT_SHORTCUTS,
    isOpen = true,
    handleClose = () => { }
}) {
    const [hovered, setHovered] = useState(false);
    const [hoveredSearchResult, setHoveredSearchResult] = useState(null);
    const [hoveredShortcut, setHoveredShortcut] = useState(null);
    const [searchValue, setSearchValue] = useState('');

    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, filter: 'blur(20px)', scaleX: 1.3, scaleY: 1.1, y: -10 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', scaleX: 1, scaleY: 1, y: 0 }}
                    exit={{ opacity: 0, filter: 'blur(20px)', scaleX: 1.3, scaleY: 1.1, y: 10 }}
                    transition={{ stiffness: 550, damping: 50, type: 'spring' }}
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center"
                    onClick={handleClose}
                >
                    <SVGFilter />
                    <div
                        onMouseEnter={() => setHovered(true)}
                        onMouseLeave={() => { setHovered(false); setHoveredShortcut(null); }}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                            'w-full flex items-center justify-end gap-4 z-20 group',
                            '[&>div]:bg-neutral-100 [&>div]:text-black [&>div]:rounded-full [&>div]:backdrop-blur-xl',
                            '[&_svg]:size-7 [&_svg]:stroke-[1.4]',
                            'max-w-3xl'
                        )}
                    >
                        <AnimatePresence mode="popLayout">
                            <motion.div
                                layoutId="search-input-container"
                                transition={{ layout: { duration: 0.5, type: 'spring', bounce: 0.2 } }}
                                style={{ borderRadius: '30px' }}
                                className="h-full w-full flex flex-col items-center justify-start z-10 relative shadow-lg overflow-hidden border"
                            >
                                <SpotlightInput
                                    placeholder={
                                        hoveredShortcut !== null ? shortcuts[hoveredShortcut].label :
                                            hoveredSearchResult !== null ? DEFAULT_SEARCH_RESULTS[hoveredSearchResult].label : 'Search'
                                    }
                                    placeholderClassName={hoveredSearchResult !== null ? 'text-black bg-white' : 'text-gray-500'}
                                    hidePlaceholder={!(hoveredSearchResult !== null || !searchValue)}
                                    value={searchValue}
                                    onChange={setSearchValue}
                                />
                                {searchValue && <SearchResultsContainer searchResults={DEFAULT_SEARCH_RESULTS} onHover={setHoveredSearchResult} />}
                            </motion.div>
                            {hovered && !searchValue && shortcuts.map((shortcut, index) => (
                                <motion.div
                                    key={`shortcut-${index}`}
                                    onMouseEnter={() => setHoveredShortcut(index)}
                                    layout
                                    initial={{ scale: 0.7, x: -1 * (64 * (index + 1)) }}
                                    animate={{ scale: 1, x: 0 }}
                                    exit={{ scale: 0.7, x: 1 * (16 * (shortcuts.length - index - 1) + 64 * (shortcuts.length - index - 1)) }}
                                    transition={{ duration: 0.8, type: 'spring', bounce: 0.2, delay: index * 0.05 }}
                                    className="rounded-full cursor-pointer"
                                >
                                    <ShortcutButton icon={shortcut.icon} link={shortcut.link} label={shortcut.label} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default AppleSpotlight;
