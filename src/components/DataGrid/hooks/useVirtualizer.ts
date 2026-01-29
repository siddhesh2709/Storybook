import { useState, useEffect, useCallback, useMemo } from 'react';

type UseVirtualizerProps = {
    count: number;
    getScrollElement: () => HTMLElement | null;
    estimateSize: (index: number) => number;
    overscan?: number;
    horizontal?: boolean;
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
}: UseVirtualizerProps) {
    const [scrollOffset, setScrollOffset] = useState(0);
    const [containerSize, setContainerSize] = useState(0);

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
    const { totalSize, offsets, measurementCache } = useMemo(() => {
        const offsets = new Array(count);
        const measurementCache = new Array(count);
        let totalSize = 0;

        for (let i = 0; i < count; i++) {
            offsets[i] = totalSize;
            const size = estimateSize(i);
            measurementCache[i] = size;
            totalSize += size;
        }

        return { totalSize, offsets, measurementCache };
    }, [count, estimateSize]);

    const rangeStart = Math.max(0, findNearestBinarySearch(0, count - 1, scrollOffset, offsets));
    /* 
       findNearestBinarySearch finding the index where offset <= scrollOffset 
    */

    let scanIndex = rangeStart;
    let accumulatedSize = 0;
    while (scanIndex < count && accumulatedSize < containerSize) {
        accumulatedSize += measurementCache[scanIndex];
        scanIndex++;
    }

    const rangeEnd = Math.min(count - 1, scanIndex + overscan);
    const startIndex = Math.max(0, rangeStart - overscan);

    const virtualItems: VirtualItem[] = [];
    for (let i = startIndex; i <= rangeEnd; i++) {
        virtualItems.push({
            index: i,
            start: offsets[i],
            size: measurementCache[i],
            end: offsets[i] + measurementCache[i],
        });
    }

    return {
        virtualItems,
        totalSize,
        scrollToIndex: (index: number) => {
            const element = getScrollElement();
            if (element) {
                const offset = offsets[Math.max(0, Math.min(index, count - 1))];
                if (horizontal) element.scrollLeft = offset;
                else element.scrollTop = offset;
            }
        }
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
