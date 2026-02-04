import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

type UseVirtualizerProps = {
    count: number;
    getScrollElement: () => HTMLElement | null;
    estimateSize: (index: number) => number;
    overscan?: number;
    horizontal?: boolean;
    key?: string;
};

type VirtualItem = {
    index: number;
    start: number;
    size: number;
    end: number;
};

export function useVirtualizer({
    count,
    getScrollElement,
    estimateSize,
    overscan = 5,
    horizontal = false,
    key,
}: UseVirtualizerProps) {
    const [scrollOffset, setScrollOffset] = useState(0);
    const [containerSize, setContainerSize] = useState(0);
    const estimateSizeRef = useRef(estimateSize);
    
    // Update ref when estimateSize changes
    useEffect(() => {
        estimateSizeRef.current = estimateSize;
    }, [estimateSize]);

    const handleScroll = useCallback(() => {
        const element = getScrollElement();
        if (!element) return;
        setScrollOffset(horizontal ? element.scrollLeft : element.scrollTop);
    }, [getScrollElement, horizontal]);

    useEffect(() => {
        const element = getScrollElement();
        if (!element) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerSize(horizontal ? entry.contentRect.width : entry.contentRect.height);
            }
        });

        resizeObserver.observe(element);
        element.addEventListener('scroll', handleScroll, { passive: true });

        // Initial size
        setContainerSize(horizontal ? element.clientWidth : element.clientHeight);

        return () => {
            resizeObserver.disconnect();
            element.removeEventListener('scroll', handleScroll);
        };
    }, [getScrollElement, handleScroll, horizontal]);

    // Calculate total size
    // Note: For variable size, we might need a measurement cache. 
    // For this assignment, we assume fixed or function-based size.
    // We'll compute offsets eagerly for simplicity, or we can use a binary search if needed.
    // For 50k rows, iterating 50k times every render is bad. 
    // But if size is fixed, `index * size` is O(1).
    // If estimateSize is constant, we can optimize.

    // For robust generic implementation, we assume we need to calculate.
    // But strictly, 50k iteration is ~2ms. Might be acceptable, but let's cache if possible.

    // Let's assume fixed size for rows for now to guarantee 60fps easily, 
    // or build a measurement cache map.

    // Simple "measurement" version (supports variable matching logic):
    const measurements = useMemo(() => {
        const offsets = new Array(count);
        const measurementCache = new Array(count);
        let totalSize = 0;

        for (let i = 0; i < count; i++) {
            offsets[i] = totalSize;
            const size = estimateSizeRef.current(i);
            measurementCache[i] = size;
            totalSize += size;
        }

        return { totalSize, offsets, measurementCache };
    }, [count, key]);

    const virtualItems = useMemo(() => {
        const { offsets, measurementCache } = measurements;
        if (count === 0 || !offsets || !measurementCache) return [];

        const rangeStart = Math.max(0, findNearestBinarySearch(0, count - 1, scrollOffset, offsets));
        /* 
           findNearestBinarySearch finding the index where offset <= scrollOffset 
        */

        let scanIndex = rangeStart;
        let accumulatedSize = 0;
        while (scanIndex < count && accumulatedSize < containerSize) {
            accumulatedSize += measurementCache[scanIndex] ?? 0;
            scanIndex++;
        }

        const rangeEnd = Math.min(count - 1, scanIndex + overscan);
        const startIndex = Math.max(0, rangeStart - overscan);

        const items: VirtualItem[] = [];
        for (let i = startIndex; i <= rangeEnd && i < count; i++) {
            items.push({
                index: i,
                start: offsets[i] ?? 0,
                size: measurementCache[i] ?? 0,
                end: (offsets[i] ?? 0) + (measurementCache[i] ?? 0),
            });
        }

        return items;
    }, [count, scrollOffset, containerSize, measurements, overscan]);

    const scrollToIndex = useCallback((index: number) => {
        const element = getScrollElement();
        if (element && measurements.offsets) {
            const offset = measurements.offsets[Math.max(0, Math.min(index, count - 1))] ?? 0;
            if (horizontal) element.scrollLeft = offset;
            else element.scrollTop = offset;
        }
    }, [getScrollElement, measurements, count, horizontal]);

    return {
        virtualItems,
        totalSize: measurements.totalSize,
        scrollToIndex,
    };
}

function findNearestBinarySearch(low: number, high: number, target: number, offsets: number[]): number {
    let lowIndex = low;
    let highIndex = high;

    while (lowIndex <= highIndex) {
        const mid = Math.floor((lowIndex + highIndex) / 2);
        const offset = offsets[mid] ?? 0;

        if (offset === target) {
            return mid;
        } else if (offset < target) {
            lowIndex = mid + 1;
        } else {
            highIndex = mid - 1;
        }
    }

    // return the index just before if not found exact
    return Math.max(0, highIndex);
}
