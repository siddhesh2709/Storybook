import { useState, useCallback } from 'react';

export function useHistory<T>(initialState: T) {
    const [state, setState] = useState<T>(initialState);
    const [history, setHistory] = useState<T[]>([]);
    const [pointer, setPointer] = useState(-1);

    const set = useCallback((nextState: T | ((prev: T) => T)) => {
        setState((current) => {
            const newState = typeof nextState === 'function' ? (nextState as Function)(current) : nextState;

            // Add current to history before updating to newState
            const newHistory = history.slice(0, pointer + 1);
            newHistory.push(current);

            // Limit history size to 50
            if (newHistory.length > 50) newHistory.shift();
            else setPointer(prev => prev + 1);

            setHistory(newHistory);
            return newState;
        });
    }, [history, pointer]);

    const undo = useCallback(() => {
        if (pointer < 0) return;

        const prevState = history[pointer];
        if (prevState === undefined) return;

        setHistory(prev => {
            const next = [...prev];
            next[pointer] = state; // Optional: swap for redo?
            return next;
        });

        setState(prevState);
        setPointer(prev => prev - 1);
    }, [history, pointer, state]);

    // Simple Redo can be added similarly by keeping track of redo stack.
    // For this assignment "Undo support" is explicitly mentioned.

    return { state, set, undo, canUndo: pointer >= 0 };
}
